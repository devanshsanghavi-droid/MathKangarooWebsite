/**
 * Whether this browser holds a Google sign-in, read from the `ka_signed_in` hint cookie.
 *
 * The real session cookie is httpOnly, so page scripts cannot see it. The hint is a plain "1"
 * set and cleared alongside it, so static pages know whether to sync without spending a
 * Worker request to ask. A stale hint costs one request that answers 401 and clears it.
 */
export const HINT_COOKIE_NAME = 'ka_signed_in';

export function hasSignedInHint(cookieString: string): boolean {
  return cookieString.split(';').some((part) => part.trim() === `${HINT_COOKIE_NAME}=1`);
}

export function readSignedInHint(): boolean {
  if (typeof document === 'undefined') return false;
  return hasSignedInHint(document.cookie);
}
