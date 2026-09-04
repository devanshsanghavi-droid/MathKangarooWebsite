import { NextResponse, type NextRequest } from 'next/server';
import { decodeSession, SESSION_COOKIE } from '@/lib/auth/session';

/**
 * Turns away unauthenticated requests to /admin before they reach a page.
 *
 * ---------------------------------------------------------------------------------------
 * THIS IS THE OUTER LAYER, NOT THE ONLY ONE
 *
 * `src/app/admin/page.tsx` re-checks the session itself and redirects on its own. That is not
 * belt-and-braces pedantry: Next.js middleware has been bypassable before — CVE-2025-29927
 * let a crafted `x-middleware-subrequest` header skip it entirely — and any authorisation
 * that exists only in middleware is one header away from not existing. Middleware is here to
 * keep unauthenticated traffic off the route cheaply; the page is what actually decides.
 * ---------------------------------------------------------------------------------------
 */
export const config = {
  matcher: ['/admin/:path*'],
};

export async function middleware(request: NextRequest) {
  const secret = process.env.AUTH_SECRET;
  const session = secret
    ? await decodeSession(
        request.cookies.get(SESSION_COOKIE)?.value,
        secret,
        Math.floor(Date.now() / 1000),
      )
    : null;

  if (session?.role === 'admin') return NextResponse.next();

  const login = new URL('/login', request.url);
  return NextResponse.redirect(login);
}
