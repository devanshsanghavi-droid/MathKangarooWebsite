import {
  BatchSchema,
  bucketMs,
  EventSchema,
  TELEMETRY_SCHEMA_VERSION,
  type EventName,
  type EventProps,
  type TelemetryEvent,
} from './events';

/**
 * The client half of telemetry: a cookie-free, first-party beacon.
 *
 * Four properties, each of which is load-bearing rather than decorative:
 *
 *   No cookie, no fingerprint.  The session id lives in sessionStorage, so it dies with the
 *   tab and cannot link today's visit to tomorrow's. Nothing is written to a cookie, and no
 *   canvas/font/timezone signal is collected. There is nothing here to correlate across sites
 *   because there is nothing here that survives the tab.
 *
 *   Refusal is honoured.  Do Not Track and Global Privacy Control both switch the whole
 *   system off — not "anonymise harder", off. So does a `ka-telemetry=off` opt-out, which
 *   /legal/privacy exposes as a real control.
 *
 *   Validated before it leaves.  Every event is parsed against the schema on the CLIENT as
 *   well as the server. A payload that fails is dropped rather than sent, so a bug in a caller
 *   cannot smuggle an unexpected field into the request at all.
 *
 *   Never blocks the student.  Delivery is `sendBeacon` where available, fire-and-forget
 *   `fetch` with `keepalive` otherwise. A failed send is discarded, not retried forever: this
 *   is analytics, and no measurement is worth degrading the thing being measured.
 */

export const TELEMETRY_ENDPOINT = '/api/events';
export const SESSION_KEY = 'ka-telemetry-session';
export const FIRST_VISIT_KEY = 'ka-first-visit';
export const OPT_OUT_KEY = 'ka-telemetry';

/** Flush when this many events are buffered, or when the page is hidden — whichever first. */
export const BATCH_SIZE = 12;

function safeSession(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

function safeLocal(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** 16 hex characters from the platform CSPRNG. Random, not derived from anything about you. */
export function newSessionId(random: () => number = Math.random): string {
  const bytes = new Uint8Array(8);
  if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
    crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(random() * 256);
    }
  }
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function sessionId(): string {
  const store = safeSession();
  if (!store) return newSessionId();
  const existing = store.getItem(SESSION_KEY);
  if (existing && /^[0-9a-f]{16}$/.test(existing)) return existing;
  const fresh = newSessionId();
  try {
    store.setItem(SESSION_KEY, fresh);
  } catch {
    /* private mode: a per-call id is fine, it just splits the session */
  }
  return fresh;
}

/**
 * Which coarse returning-bucket this browser is in, computed HERE from a date this browser
 * holds. The server never sees the date, only the bucket — which is what lets a retention
 * split exist without any cross-visit identifier. See the note in aggregate.ts.
 */
export function returningBucket(now: Date = new Date()): EventProps['returning'] {
  const store = safeLocal();
  if (!store) return undefined;
  let first: string | null = null;
  try {
    first = store.getItem(FIRST_VISIT_KEY);
    if (!first) {
      store.setItem(FIRST_VISIT_KEY, now.toISOString());
      return 'first-visit';
    }
  } catch {
    return undefined;
  }
  const days = (now.getTime() - new Date(first).getTime()) / 86_400_000;
  if (!Number.isFinite(days) || days < 1) return 'first-visit';
  if (days <= 7) return 'within-week';
  if (days <= 31) return 'within-month';
  return 'older';
}

/** DNT, GPC, or an explicit opt-out. Any of the three switches the system off entirely. */
export function isOptedOut(): boolean {
  if (typeof navigator === 'undefined') return true;
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean; msDoNotTrack?: string };
  if (nav.doNotTrack === '1' || nav.msDoNotTrack === '1') return true;
  if (nav.globalPrivacyControl === true) return true;
  try {
    return safeLocal()?.getItem(OPT_OUT_KEY) === 'off';
  } catch {
    return false;
  }
}

export function setOptOut(off: boolean): void {
  try {
    const store = safeLocal();
    if (!store) return;
    if (off) store.setItem(OPT_OUT_KEY, 'off');
    else store.removeItem(OPT_OUT_KEY);
  } catch {
    /* nothing to do, and nothing that needs saying */
  }
}

let buffer: TelemetryEvent[] = [];
let seq = 0;

/** Exported for tests, which need a clean buffer between cases. */
export function resetTelemetry(): void {
  buffer = [];
  seq = 0;
}

export function buffered(): readonly TelemetryEvent[] {
  return buffer;
}

export type Sender = (body: string) => void;

function defaultSender(body: string): void {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      navigator.sendBeacon(TELEMETRY_ENDPOINT, new Blob([body], { type: 'application/json' }));
      return;
    }
    void fetch(TELEMETRY_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    /* analytics must never break the page it is measuring */
  }
}

export function flush(send: Sender = defaultSender): number {
  if (buffer.length === 0) return 0;
  const batch = { v: TELEMETRY_SCHEMA_VERSION as typeof TELEMETRY_SCHEMA_VERSION, events: buffer };
  buffer = [];
  const parsed = BatchSchema.safeParse(batch);
  if (!parsed.success) return 0;
  send(JSON.stringify(parsed.data));
  return parsed.data.events.length;
}

/**
 * Record one event. Returns whether it was accepted, which the tests assert on — a silent
 * no-op and a silent drop look identical from the outside otherwise.
 */
export function track(
  name: EventName,
  props: EventProps = {},
  { now = new Date(), send }: { now?: Date; send?: Sender } = {},
): boolean {
  if (isOptedOut()) return false;

  const candidate = {
    name,
    sessionId: sessionId(),
    seq: seq++,
    at: now.toISOString(),
    props: {
      ...props,
      ...(props.msElapsed === undefined ? {} : { msElapsed: bucketMs(props.msElapsed) }),
    },
  };

  const parsed = EventSchema.safeParse(candidate);
  if (!parsed.success) return false;

  buffer.push(parsed.data);
  if (buffer.length >= BATCH_SIZE) flush(send);
  return true;
}
