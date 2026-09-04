/**
 * The login form's state shape.
 *
 * In its own module because a `'use server'` file may only export async functions — exporting
 * a type or a constant from one is a build error, and the same mistake already cost this repo
 * a debugging session on the contact form.
 */
export interface LoginState {
  /** Shown above the form. Deliberately identical for every failure — see actions.ts. */
  error: string | null;
}

export const EMPTY_LOGIN: LoginState = { error: null };

/**
 * One message for every failure mode. A form that distinguishes "no such user" from "wrong
 * password" tells an attacker which usernames exist, and this site has exactly one operator
 * account worth guessing at.
 */
export const GENERIC_FAILURE = 'That username and password do not match.';
