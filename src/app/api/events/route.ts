import { NextResponse } from 'next/server';
import { BatchSchema, bucketMs } from '@/lib/telemetry/events';

/**
 * The collector.
 *
 * Deliberately the least clever endpoint on the site. It validates, it drops anything that
 * does not fit the schema, and it stores what is left. It does not enrich, it does not resolve
 * IPs to locations, and it does not read a single request header beyond the content type.
 *
 * Three rules it enforces, in order:
 *
 *   1. VALIDATE, THEN DROP. A batch that fails BatchSchema is discarded whole. Nothing is
 *      "cleaned up" and stored anyway — a payload that does not match the taxonomy is either a
 *      bug or an attempt to smuggle a field past it, and both deserve the bin.
 *   2. NO IP, EVER. docs/01-DATA-MODEL.md §4 forbids IP addresses in analytics, so the address
 *      is never read, never hashed, and never used for geolocation. There is no country tile
 *      on the dashboard for exactly this reason.
 *   3. RE-BUCKET SERVER-SIDE. Durations are re-bucketed here even though the client already
 *      did it, because the client is not a trusted input.
 *
 * It always answers 202. A telemetry endpoint that returns errors teaches the client to retry,
 * and a retry storm on an analytics beacon degrades the thing it is measuring.
 */

export const runtime = 'nodejs';
/** Never prerendered, never cached: it exists to receive writes. */
export const dynamic = 'force-dynamic';

const ACCEPTED = { ok: true } as const;

export async function POST(request: Request): Promise<NextResponse> {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(ACCEPTED, { status: 202 });
  }

  const parsed = BatchSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(ACCEPTED, { status: 202 });
  }

  const rows = parsed.data.events.map((event) => ({
    name: event.name,
    session_id: event.sessionId,
    seq: event.seq,
    /* The server's own clock is the authority; the client's `at` is only used for ordering. */
    received_at: new Date().toISOString(),
    props: {
      ...event.props,
      ...(event.props.msElapsed === undefined
        ? {}
        : { msElapsed: bucketMs(event.props.msElapsed) }),
    },
    schema_version: parsed.data.v,
  }));

  await store(rows);
  return NextResponse.json(ACCEPTED, { status: 202 });
}

type Row = {
  name: string;
  session_id: string;
  seq: number;
  received_at: string;
  props: Record<string, unknown>;
  schema_version: number;
};

/**
 * Writes the batch, when there is somewhere to write it.
 *
 * Supabase is not connected yet, so this is a no-op with the shape of the eventual insert
 * rather than a stub that throws. The site behaves identically with and without it — which is
 * also the behaviour we want in production the day the database is briefly unreachable.
 */
async function store(rows: readonly Row[]): Promise<void> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || rows.length === 0) return;

  try {
    await fetch(`${url}/rest/v1/telemetry_events`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        apikey: key,
        authorization: `Bearer ${key}`,
        prefer: 'return=minimal',
      },
      body: JSON.stringify(rows),
    });
  } catch {
    /* Losing a telemetry batch is not an incident. Failing a student's page load would be. */
  }
}
