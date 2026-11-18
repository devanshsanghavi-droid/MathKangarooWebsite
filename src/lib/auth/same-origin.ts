/**
 * A state-changing request must come from this site. Browsers send `Origin` on every
 * cross-site POST, PUT and DELETE, so a mismatch means another site is trying to act for a
 * signed-in student (SameSite=Lax already stops it carrying the cookie; this is the second lock).
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  return origin === new URL(request.url).origin;
}
