import { NextResponse, type NextRequest } from 'next/server';
import { SIGNED_IN_HINT_COOKIE } from '@/lib/auth/google';
import { SESSION_COOKIE } from '@/lib/auth/session';
import { isSameOrigin } from '@/lib/auth/same-origin';

/** Sign a student out. A POST, so a link or an image tag on another site cannot do it. */
export const dynamic = 'force-dynamic';

export function POST(request: NextRequest): NextResponse {
  if (!isSameOrigin(request)) return new NextResponse(null, { status: 403 });
  const response = NextResponse.redirect(new URL('/login?signed-out=1', request.url), 303);
  response.cookies.delete(SESSION_COOKIE);
  response.cookies.delete(SIGNED_IN_HINT_COOKIE);
  return response;
}
