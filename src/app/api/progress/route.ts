import { NextResponse, type NextRequest } from 'next/server';
import { authConfig } from '@/lib/auth/config';
import { SIGNED_IN_HINT_COOKIE } from '@/lib/auth/google';
import { decodeSession, SESSION_COOKIE } from '@/lib/auth/session';
import { EMPTY_PROGRESS } from '@/lib/local-progress';
import { deleteProgress, loadProgress, progressDb, saveProgress } from '@/lib/progress-store';
import { mergeProgress, parseUpload } from '@/lib/progress-sync';
import { isSameOrigin } from '@/lib/auth/same-origin';

/**
 * A signed-in student's synced progress.
 *
 *   GET     the stored file (an empty one if nothing is stored yet)
 *   PUT     merge an uploaded file into the stored one and return the result
 *   DELETE  remove the stored file and sign out: the "delete my data" button
 *
 * Only a student session reaches the data, and only its own row: the account id comes from
 * the signed cookie, never from the request.
 */
export const dynamic = 'force-dynamic';

async function accountOf(request: NextRequest): Promise<string | null> {
  const secret = authConfig().sessionSecret;
  if (!secret) return null;
  const session = await decodeSession(
    request.cookies.get(SESSION_COOKIE)?.value,
    secret,
    Math.floor(Date.now() / 1000),
  );
  return session?.role === 'student' ? session.sub : null;
}

function signedOut(): NextResponse {
  const response = NextResponse.json({ error: 'signed-out' }, { status: 401 });
  response.cookies.delete(SIGNED_IN_HINT_COOKIE);
  return response;
}

const NO_STORE = { 'cache-control': 'no-store' };

export async function GET(request: NextRequest): Promise<NextResponse> {
  const account = await accountOf(request);
  if (!account) return signedOut();
  const db = await progressDb();
  if (!db) return NextResponse.json({ error: 'unavailable' }, { status: 503 });
  const file = (await loadProgress(db, account)) ?? EMPTY_PROGRESS;
  return NextResponse.json(file, { headers: NO_STORE });
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  if (!isSameOrigin(request)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const account = await accountOf(request);
  if (!account) return signedOut();
  const upload = parseUpload(await request.text());
  if (!upload) return NextResponse.json({ error: 'invalid' }, { status: 400 });
  const db = await progressDb();
  if (!db) return NextResponse.json({ error: 'unavailable' }, { status: 503 });
  const merged = mergeProgress((await loadProgress(db, account)) ?? EMPTY_PROGRESS, upload);
  await saveProgress(db, account, merged);
  return NextResponse.json(merged, { headers: NO_STORE });
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  if (!isSameOrigin(request)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const account = await accountOf(request);
  if (!account) return signedOut();
  const db = await progressDb();
  if (!db) return NextResponse.json({ error: 'unavailable' }, { status: 503 });
  await deleteProgress(db, account);
  const response = NextResponse.json({ deleted: true });
  response.cookies.delete(SESSION_COOKIE);
  response.cookies.delete(SIGNED_IN_HINT_COOKIE);
  return response;
}
