'use client';

import { useActionState } from 'react';
import { signIn } from './actions';
import { EMPTY_LOGIN } from './login-state';

export function LoginForm() {
  const [state, action, pending] = useActionState(signIn, EMPTY_LOGIN);
  const field =
    'w-full rounded-sm border border-rule-strong bg-surface px-3 py-2 text-ink tap-target';

  return (
    <form action={action} className="mt-6 grid max-w-sm gap-4">
      {state.error ? (
        /*
          role="alert" so a screen reader hears the failure without hunting for it. The
          message is the same for every failure mode; see actions.ts for why.
        */
        <p
          role="alert"
          className="m-0 rounded-sm border-2 border-rule-strong bg-surface-3 px-3 py-2 text-sm text-ink"
        >
          {state.error}
        </p>
      ) : null}

      <div>
        <label htmlFor="username" className="ui block text-sm font-medium text-ink">
          Username
        </label>
        <input
          id="username"
          name="username"
          type="text"
          autoComplete="username"
          required
          className={`mt-1 ${field}`}
        />
      </div>

      <div>
        <label htmlFor="password" className="ui block text-sm font-medium text-ink">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={`mt-1 ${field}`}
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="tap-target ui cursor-pointer rounded-sm border border-accent-600 bg-accent-100 px-4 font-medium text-ink disabled:cursor-wait disabled:opacity-60"
      >
        {pending ? 'Checking…' : 'Sign in'}
      </button>
    </form>
  );
}
