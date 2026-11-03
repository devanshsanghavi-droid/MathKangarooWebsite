'use server';

import { z } from 'zod';
import { SITE } from '@/lib/site';
import type { ContactState } from './contact-state';

/**
 * The contact form's server action.
 *
 * Three deliberate choices:
 *
 *  - **The email address is optional.** Most people using this site are children, and a form
 *    that demands an address collects one from every child who wants to report a typo. If you
 *    give one we reply to it; if you do not, we read the message and that is that.
 *  - **No CAPTCHA.** Every CAPTCHA worth using is a third-party tracker, which CLAUDE.md rules
 *    out. Spam is handled by a honeypot field and a length cap, which is proportionate for a
 *    form that receives a handful of messages a week.
 *  - **The message is emailed and never stored.** There is no contact table, so there is
 *    nothing to leak, export or delete later.
 */

const ContactSchema = z.object({
  message: z
    .string()
    .trim()
    .min(10, 'Please write at least a sentence, so I know what to look at.')
    .max(2000, 'Please keep it under 2000 characters.'),
  replyTo: z.union([z.literal(''), z.email('That does not look like an email address.')]),
  // Hidden field. A real person never fills it in; a bot fills in everything.
  website: z.string().max(0),
});

/** Is the mail transport configured? Exported so the page can say so honestly up front. */
export async function isMailConfigured(): Promise<boolean> {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function sendContactMessage(
  _previous: ContactState,
  formData: FormData,
): Promise<ContactState> {
  const parsed = ContactSchema.safeParse({
    message: formData.get('message') ?? '',
    replyTo: formData.get('replyTo') ?? '',
    website: formData.get('website') ?? '',
  });

  if (!parsed.success) {
    const fieldErrors: ContactState['fieldErrors'] = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (field === 'message' || field === 'replyTo') fieldErrors[field] = issue.message;
      // A honeypot failure is silently treated as success: telling a bot it was caught only
      // teaches it to stop filling the field in.
      if (field === 'website') return { status: 'sent' };
    }
    return { status: 'error', fieldErrors };
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return {
      status: 'error',
      message:
        'The mail service is not configured on this deployment yet, so this form cannot send. ' +
        'Please use the email link below instead - it goes to the same place.',
    };
  }

  const { message, replyTo } = parsed.data;

  try {
    // Resend's REST API directly rather than its SDK: one fetch call, and the dependency budget
    // stays where CLAUDE.md wants it.
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.CONTACT_FROM ?? `${SITE.name} <onboarding@resend.dev>`,
        to: [SITE.contactEmail],
        subject: `${SITE.name} contact form`,
        ...(replyTo ? { reply_to: replyTo } : {}),
        text: message,
      }),
    });

    if (!response.ok) {
      // Deliberately not logging the body: it contains the message, and no PII goes in logs.
      console.error('Contact form: mail provider returned', response.status);
      return {
        status: 'error',
        message:
          'That did not send, and the fault is on our side. Please use the email link below.',
      };
    }
  } catch {
    return {
      status: 'error',
      message: 'That did not send - the network or the mail service is unreachable right now.',
    };
  }

  return { status: 'sent' };
}
