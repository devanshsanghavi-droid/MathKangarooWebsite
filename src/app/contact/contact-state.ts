/**
 * Shared types and constants for the contact form.
 *
 * Split out of `actions.ts` because a `'use server'` module may only export async functions -  * a constant object in there is a build error, not a lint warning.
 */
export interface ContactState {
  status: 'idle' | 'sent' | 'error';
  message?: string;
  fieldErrors?: Partial<Record<'message' | 'replyTo', string>>;
}

export const INITIAL_CONTACT_STATE: ContactState = { status: 'idle' };
