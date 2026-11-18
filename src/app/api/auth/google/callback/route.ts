import { NextResponse, type NextRequest } from 'next/server';
import {
  accountIdFor,
  decodeOauthCookie,
  exchangeCode,
  googleConfig,
  OAUTH_COOKIE,
  SIGNED_IN_HINT_COOKIE,
  subjectFromIdToken,
} from '@/lib/auth/google';
import { timingSafeEqual } from '@/lib/auth/password';
import { authConfig } from '@/lib/auth/config';
import {
  cookieOptions,
  encodeSession,
  SESSION_COOKIE,
  STUDENT_MAX_AGE_SECONDS,
} from '@/lib/auth/session';

/**
 * Step 2: Google sends the student back here with a one-time code. Check the state against the
 * cookie set in step 1, trade the code for an ID token, check its claims, and sign the student
 * in under an opaque account id. Any failure lands on /login with one generic message.
 */
export const dynamic = 'force-dynamic';

function fail(request: NextRequest): NextResponse {
  const response = NextResponse.redirect(new URL('/login?error=google', request.url));
  response.cookies.delete({ name: OAUTH_COOKIE, path: '/api/auth' });
  return response;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const config = googleConfig();
  const secret = authConfig().sessionSecret;
  const saved = decodeOauthCookie(request.cookies.get(OAUTH_COOKIE)?.value);
  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state') ?? '';
  if (!config || !secret || !saved || !code || !timingSafeEqual(state, saved.state)) {
    return fail(request);
  }

  const idToken = await exchangeCode({
    config,
    code,
    verifier: saved.verifier,
    redirectUri: new URL('/api/auth/google/callback', request.url).toString(),
  }).catch(() => null);
  const nowSeconds = Math.floor(Date.now() / 1000);
  const subject = idToken
    ? subjectFromIdToken(idToken, { clientId: config.clientId, nonce: saved.nonce, nowSeconds })
    : null;
  if (!subject) return fail(request);

  const accountId = await accountIdFor(subject, secret);
  const isProduction = process.env.NODE_ENV === 'production';
  const response = NextResponse.redirect(new URL(saved.next, request.url));
  response.cookies.delete({ name: OAUTH_COOKIE, path: '/api/auth' });
  response.cookies.set(
    SESSION_COOKIE,
    await encodeSession(
      { sub: accountId, role: 'student', exp: nowSeconds + STUDENT_MAX_AGE_SECONDS },
      secret,
    ),
    cookieOptions(isProduction, STUDENT_MAX_AGE_SECONDS),
  );
  response.cookies.set(SIGNED_IN_HINT_COOKIE, '1', {
    ...cookieOptions(isProduction, STUDENT_MAX_AGE_SECONDS),
    httpOnly: false,
  });
  return response;
}
