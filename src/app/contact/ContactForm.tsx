'use client';

import { useActionState } from 'react';
import { sendContactMessage } from './actions';
import { INITIAL_CONTACT_STATE } from './contact-state';

/**
 * Progressive enhancement: this is a real `<form>` with a server action, so it submits and
 * works without client-side JavaScript. `useActionState` adds the inline error and success
 * states on top for everyone else.
 */
export function ContactForm({ mailConfigured }: { mailConfigured: boolean }) {
  const [state, action, pending] = useActionState(sendContactMessage, INITIAL_CONTACT_STATE);

  if (state.status === 'sent') {
    return (
      <div
        role="status"
        className="rounded-md border border-correct-border bg-correct-100 p-4 text-sm text-ink"
      >
        <p className="m-0 font-medium">Sent. Thank you.</p>
        <p className="mt-2 mb-0 text-ink-2">
          If you left an address I will reply to it. Nothing about this message is stored on the
          site.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="grid gap-4">
      {!mailConfigured ? (
        <p className="m-0 rounded-sm border border-rule-strong bg-surface-2 px-3 py-2 text-sm text-ink-2">
          This deployment has no mail service configured yet, so the form cannot send. The email
          link below goes to the same place and works now.
        </p>
      ) : null}

      <div>
        <label htmlFor="message" className="block text-sm font-medium text-ink">
          Your message
        </label>
        <p id="message-help" className="mt-1 mb-2 text-xs text-ink-3">
          Please do not include your last name, your school, or anything else about who you are. For
          a problem that looks wrong, the report link on that problem&rsquo;s own page is faster —
          it opens a public issue with the id already filled in.
        </p>
        <textarea
          id="message"
          name="message"
          required
          rows={7}
          maxLength={2000}
          aria-describedby="message-help"
          aria-invalid={state.fieldErrors?.message ? true : undefined}
          className="w-full rounded-sm border border-rule-strong bg-surface px-3 py-2 text-ink"
        />
        {state.fieldErrors?.message ? (
          <p className="mt-1 mb-0 text-sm text-wrong-700">{state.fieldErrors.message}</p>
        ) : null}
      </div>

      <div>
        <label htmlFor="replyTo" className="block text-sm font-medium text-ink">
          Email <span className="font-normal text-ink-3">(optional)</span>
        </label>
        <p id="replyTo-help" className="mt-1 mb-2 text-xs text-ink-3">
          Only if you want a reply. It is used to answer you and for nothing else — it is not stored
          anywhere on this site.
        </p>
        <input
          id="replyTo"
          name="replyTo"
          type="email"
          autoComplete="email"
          aria-describedby="replyTo-help"
          aria-invalid={state.fieldErrors?.replyTo ? true : undefined}
          className="w-full rounded-sm border border-rule-strong bg-surface px-3 py-2 text-ink"
        />
        {state.fieldErrors?.replyTo ? (
          <p className="mt-1 mb-0 text-sm text-wrong-700">{state.fieldErrors.replyTo}</p>
        ) : null}
      </div>

      {/* Honeypot. Hidden from people and from assistive technology; bots fill in everything. */}
      <div className="visually-hidden" aria-hidden="true">
        <label htmlFor="website">Leave this field empty</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      {state.status === 'error' && state.message ? (
        <p
          role="alert"
          className="m-0 rounded-sm border border-wrong-border bg-wrong-100 px-3 py-2 text-sm text-ink"
        >
          {state.message}
        </p>
      ) : null}

      <div>
        <button
          type="submit"
          disabled={pending}
          className="cursor-pointer rounded-sm border border-accent-600 bg-accent-100 px-4 py-2 font-medium text-ink disabled:cursor-wait disabled:opacity-60"
        >
          {pending ? 'Sending…' : 'Send'}
        </button>
      </div>
    </form>
  );
}
