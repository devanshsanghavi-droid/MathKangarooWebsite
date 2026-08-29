import { describe, it, expect, vi } from 'vitest';
import {
  enqueue,
  flush,
  makeClientId,
  MAX_QUEUED,
  QUEUE_KEY,
  readQueue,
  type QueuedAttempt,
  type QueueStorage,
} from '../offline-queue';

function memoryStorage(initial?: string): QueueStorage & { raw: () => string | null } {
  let value: string | null = initial ?? null;
  return {
    getItem: () => value,
    setItem: (_key, next) => {
      value = next;
    },
    raw: () => value,
  };
}

function attempt(id: string, overrides: Partial<QueuedAttempt> = {}): QueuedAttempt {
  return {
    clientId: id,
    problemId: 'KA-0001',
    chosenKey: 'C',
    correct: true,
    msElapsed: 41_000,
    hintsUsed: 0,
    context: 'free',
    at: '2026-03-01T10:00:00Z',
    ...overrides,
  };
}

describe('reading the queue', () => {
  it('starts empty', () => {
    expect(readQueue(memoryStorage())).toEqual([]);
  });

  it('survives corrupted storage rather than throwing mid-practice', () => {
    expect(readQueue(memoryStorage('not json at all'))).toEqual([]);
    expect(readQueue(memoryStorage('{"not":"an array"}'))).toEqual([]);
  });

  it('drops a corrupted entry without losing the good ones', () => {
    const raw = JSON.stringify([attempt('a'), { junk: true }, attempt('b')]);
    expect(readQueue(memoryStorage(raw)).map((item) => item.clientId)).toEqual(['a', 'b']);
  });

  it('survives storage that throws, as it does in some private modes', () => {
    const throwing: QueueStorage = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
    };
    expect(readQueue(throwing)).toEqual([]);
    expect(() => enqueue(throwing, attempt('a'))).not.toThrow();
  });
});

describe('enqueue', () => {
  it('appends in order', () => {
    const storage = memoryStorage();
    enqueue(storage, attempt('a'));
    enqueue(storage, attempt('b'));
    expect(readQueue(storage).map((item) => item.clientId)).toEqual(['a', 'b']);
  });

  it('replaces rather than duplicates when the same clientId is queued twice', () => {
    const storage = memoryStorage();
    enqueue(storage, attempt('a', { chosenKey: 'A' }));
    enqueue(storage, attempt('a', { chosenKey: 'E' }));
    const queue = readQueue(storage);
    expect(queue).toHaveLength(1);
    expect(queue[0]?.chosenKey).toBe('E');
  });

  it('caps the queue, dropping the oldest', () => {
    const storage = memoryStorage();
    for (let index = 0; index < MAX_QUEUED + 10; index += 1) {
      enqueue(storage, attempt(`id-${index}`));
    }
    const queue = readQueue(storage);
    expect(queue).toHaveLength(MAX_QUEUED);
    expect(queue[0]?.clientId).toBe('id-10');
  });

  it('writes under the documented key', () => {
    const storage = memoryStorage();
    enqueue(storage, attempt('a'));
    expect(QUEUE_KEY).toBe('ka-attempt-queue');
    expect(storage.raw()).toContain('"clientId": "a"'.replace(': ', ':'));
  });
});

describe('flush — attempts made offline appear exactly once', () => {
  it('sends everything and empties the queue', async () => {
    const storage = memoryStorage();
    enqueue(storage, attempt('a'));
    enqueue(storage, attempt('b'));
    const send = vi.fn(async () => undefined);

    const result = await flush(storage, send);

    expect(send).toHaveBeenCalledTimes(2);
    expect(result.sent).toEqual(['a', 'b']);
    expect(result.remaining).toEqual([]);
    expect(readQueue(storage)).toEqual([]);
  });

  it('sends oldest first', async () => {
    const storage = memoryStorage();
    enqueue(storage, attempt('a'));
    enqueue(storage, attempt('b'));
    const order: string[] = [];
    await flush(storage, async (item) => {
      order.push(item.clientId);
    });
    expect(order).toEqual(['a', 'b']);
  });

  it('keeps an item that failed to send, and everything after it', async () => {
    const storage = memoryStorage();
    enqueue(storage, attempt('a'));
    enqueue(storage, attempt('b'));
    enqueue(storage, attempt('c'));

    const result = await flush(storage, async (item) => {
      if (item.clientId === 'b') throw new Error('offline again');
    });

    expect(result.interrupted).toBe(true);
    expect(result.sent).toEqual(['a']);
    expect(readQueue(storage).map((item) => item.clientId)).toEqual(['b', 'c']);
  });

  it('never sends the same attempt twice across two flushes', async () => {
    const storage = memoryStorage();
    enqueue(storage, attempt('a'));
    enqueue(storage, attempt('b'));

    let failNext = true;
    const seen: string[] = [];
    const send = async (item: QueuedAttempt) => {
      if (item.clientId === 'b' && failNext) {
        failNext = false;
        throw new Error('offline');
      }
      seen.push(item.clientId);
    };

    await flush(storage, send);
    await flush(storage, send);

    // "a" was sent in the first flush and must not be sent again in the second.
    expect(seen).toEqual(['a', 'b']);
    expect(readQueue(storage)).toEqual([]);
  });

  it('does nothing, without error, on an empty queue', async () => {
    const send = vi.fn(async () => undefined);
    const result = await flush(memoryStorage(), send);
    expect(send).not.toHaveBeenCalled();
    expect(result).toEqual({ sent: [], remaining: [], interrupted: false });
  });
});

describe('makeClientId', () => {
  it('produces a stable-looking id without crypto.randomUUID', () => {
    expect(makeClientId(() => 0.5)).toMatch(/^[0-9a-f]{8}-[0-9a-f]{8}$/);
  });

  it('produces different ids for different draws', () => {
    let n = 0;
    const seed = () => {
      n += 0.37;
      return n % 1;
    };
    expect(makeClientId(seed)).not.toBe(makeClientId(seed));
  });
});
