/**
 * The offline attempt queue.
 *
 * A student on a bad connection answers a problem; the answer must not be lost, and it must not
 * be recorded twice when the connection comes back. This is the piece that guarantees both,
 * and it is deliberately independent of the API it will eventually post to - `POST /api/attempt`
 * is M2.3 and does not exist yet, so `flush` takes the sender as an argument.
 *
 * Exactly-once is the hard part. Every queued item carries a client-generated id; the flush
 * removes an item only after the sender resolves, and a sender that throws leaves the item in
 * place for the next attempt. The server side of exactly-once is a unique index on that id,
 * which is M2.3's job.
 */

export const QUEUE_KEY = 'ka-attempt-queue';
/** Beyond this the queue is a symptom, not a buffer; the oldest entries are dropped. */
export const MAX_QUEUED = 200;

export interface QueuedAttempt {
  /** Client-generated, stable across retries. The server de-duplicates on it. */
  clientId: string;
  problemId: string;
  chosenKey: string;
  correct: boolean;
  msElapsed: number;
  hintsUsed: number;
  context: string;
  /** When it happened, not when it was sent. */
  at: string;
}

export interface QueueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function safeRead(storage: QueueStorage): QueuedAttempt[] {
  try {
    const raw = storage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // A corrupted entry is dropped rather than poisoning the whole queue.
    return parsed.filter(
      (entry): entry is QueuedAttempt =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as QueuedAttempt).clientId === 'string' &&
        typeof (entry as QueuedAttempt).problemId === 'string',
    );
  } catch {
    return [];
  }
}

function safeWrite(storage: QueueStorage, items: QueuedAttempt[]): void {
  try {
    storage.setItem(QUEUE_KEY, JSON.stringify(items));
  } catch {
    // Storage full or disabled. Losing the queue is bad; crashing the page mid-practice is worse.
  }
}

export function readQueue(storage: QueueStorage): QueuedAttempt[] {
  return safeRead(storage);
}

/** Add an attempt. Re-enqueuing the same clientId replaces rather than duplicates. */
export function enqueue(storage: QueueStorage, attempt: QueuedAttempt): QueuedAttempt[] {
  const existing = safeRead(storage).filter((item) => item.clientId !== attempt.clientId);
  const next = [...existing, attempt].slice(-MAX_QUEUED);
  safeWrite(storage, next);
  return next;
}

export interface FlushResult {
  sent: string[];
  remaining: QueuedAttempt[];
  /** True when the flush stopped early because the sender failed. */
  interrupted: boolean;
}

/**
 * Send everything queued, oldest first, stopping at the first failure.
 *
 * Stopping rather than continuing keeps the order intact: attempts are a time series, and a
 * gap in the middle is harder to reason about later than a shorter, complete prefix.
 */
export async function flush(
  storage: QueueStorage,
  send: (attempt: QueuedAttempt) => Promise<void>,
): Promise<FlushResult> {
  const queued = safeRead(storage);
  const sent: string[] = [];

  for (const attempt of queued) {
    try {
      await send(attempt);
      sent.push(attempt.clientId);
    } catch {
      const remaining = queued.filter((item) => !sent.includes(item.clientId));
      safeWrite(storage, remaining);
      return { sent, remaining, interrupted: true };
    }
  }

  const remaining = queued.filter((item) => !sent.includes(item.clientId));
  safeWrite(storage, remaining);
  return { sent, remaining, interrupted: false };
}

/** A client id that does not need crypto.randomUUID, which older Android browsers lack. */
export function makeClientId(seed: () => number = Math.random): string {
  const part = () =>
    Math.floor(seed() * 0xffffffff)
      .toString(16)
      .padStart(8, '0');
  return `${part()}-${part()}`;
}
