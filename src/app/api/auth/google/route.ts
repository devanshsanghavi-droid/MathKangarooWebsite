import { NextResponse, type NextRequest } from 'next/server';
import {
  buildAuthUrl,
  encodeOauthCookie,
  googleConfig,
  OAUTH_COOKIE,
  OAUTH_COOKIE_MAX_AGE,
  pkceChallenge,
  randomToken,
  safeNext,
} from '@/lib/auth/google';
import { authConfig } from '@/lib/auth/config';

/** Step 1 of "Continue with Google": remember state, verifier and nonce, then go to Google. */
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const config = googleConfig();
  if (!config || !authConfig().sessionSecret) {
    return NextResponse.redirect(new URL('/login?error=google-off', request.url));
  }

  const state = randomToken();
  const verifier = randomToken();
  const nonce = randomToken();
  const next = safeNext(request.nextUrl.searchParams.get('next'));

  const response = NextResponse.redirect(
    buildAuthUrl({
      clientId: config.clientId,
      redirectUri: new URL('/api/auth/google/callback', request.url).toString(),
      state,
      nonce,
      codeChallenge: await pkceChallenge(verifier),
    }),
  );
  response.cookies.set(OAUTH_COOKIE, encodeOauthCookie({ state, verifier, nonce, next }), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/api/auth',
    maxAge: OAUTH_COOKIE_MAX_AGE,
  });
  return response;
}
