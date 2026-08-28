import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { sendContactMessage } from '../contact/actions';
import { INITIAL_CONTACT_STATE } from '../contact/contact-state';
import { ContactForm } from '../contact/ContactForm';

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const ORIGINAL_KEY = process.env.RESEND_API_KEY;

afterEach(() => {
  if (ORIGINAL_KEY === undefined) delete process.env.RESEND_API_KEY;
  else process.env.RESEND_API_KEY = ORIGINAL_KEY;
  vi.unstubAllGlobals();
});

describe('sendContactMessage validation', () => {
  beforeEach(() => {
    process.env.RESEND_API_KEY = 'test-key';
  });

  it('rejects a message that is too short to act on', async () => {
    const state = await sendContactMessage(
      INITIAL_CONTACT_STATE,
      form({ message: 'hi', replyTo: '', website: '' }),
    );
    expect(state.status).toBe('error');
    expect(state.fieldErrors?.message).toMatch(/at least a sentence/);
  });

  it('rejects a malformed email but accepts an empty one', async () => {
    const bad = await sendContactMessage(
      INITIAL_CONTACT_STATE,
      form({ message: 'This problem looks wrong to me.', replyTo: 'not-an-email', website: '' }),
    );
    expect(bad.fieldErrors?.replyTo).toMatch(/does not look like an email/);

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}', { status: 200 })),
    );
    const good = await sendContactMessage(
      INITIAL_CONTACT_STATE,
      form({ message: 'This problem looks wrong to me.', replyTo: '', website: '' }),
    );
    expect(good.status).toBe('sent');
  });

  it('caps the message length', async () => {
    const state = await sendContactMessage(
      INITIAL_CONTACT_STATE,
      form({ message: 'x'.repeat(2001), replyTo: '', website: '' }),
    );
    expect(state.fieldErrors?.message).toMatch(/under 2000 characters/);
  });

  it('silently accepts a honeypot hit rather than telling the bot it was caught', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const state = await sendContactMessage(
      INITIAL_CONTACT_STATE,
      form({ message: 'A perfectly reasonable message.', replyTo: '', website: 'http://spam' }),
    );
    expect(state.status).toBe('sent');
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('sendContactMessage delivery', () => {
  it('says plainly when mail is not configured, and points at the fallback', async () => {
    delete process.env.RESEND_API_KEY;
    const state = await sendContactMessage(
      INITIAL_CONTACT_STATE,
      form({ message: 'A perfectly reasonable message.', replyTo: '', website: '' }),
    );
    expect(state.status).toBe('error');
    expect(state.message).toMatch(/use the email link below/);
  });

  it('posts to the mail provider with the message and the reply address', async () => {
    process.env.RESEND_API_KEY = 'test-key';
    const fetchSpy = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchSpy);

    const state = await sendContactMessage(
      INITIAL_CONTACT_STATE,
      form({ message: 'A perfectly reasonable message.', replyTo: 'a@b.test', website: '' }),
    );

    expect(state.status).toBe('sent');
    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.resend.com/emails');
    const body = JSON.parse(String(init.body));
    expect(body.text).toBe('A perfectly reasonable message.');
    expect(body.reply_to).toBe('a@b.test');
  });

  it('omits reply_to entirely when no address was given', async () => {
    process.env.RESEND_API_KEY = 'test-key';
    const fetchSpy = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchSpy);
    await sendContactMessage(
      INITIAL_CONTACT_STATE,
      form({ message: 'A perfectly reasonable message.', replyTo: '', website: '' }),
    );
    const [, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body))).not.toHaveProperty('reply_to');
  });

  it('reports a provider failure honestly instead of pretending it sent', async () => {
    process.env.RESEND_API_KEY = 'test-key';
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('nope', { status: 500 })),
    );
    const state = await sendContactMessage(
      INITIAL_CONTACT_STATE,
      form({ message: 'A perfectly reasonable message.', replyTo: '', website: '' }),
    );
    expect(state.status).toBe('error');
    expect(state.message).toMatch(/fault is on our side/);
  });

  it('never logs the message body', async () => {
    process.env.RESEND_API_KEY = 'test-key';
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('nope', { status: 500 })),
    );
    await sendContactMessage(
      INITIAL_CONTACT_STATE,
      form({ message: 'A secret sentence nobody should log.', replyTo: 'a@b.test', website: '' }),
    );
    const logged = errorSpy.mock.calls.flat().join(' ');
    expect(logged).not.toContain('A secret sentence');
    expect(logged).not.toContain('a@b.test');
  });

  it('survives the network being unreachable', async () => {
    process.env.RESEND_API_KEY = 'test-key';
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline');
      }),
    );
    const state = await sendContactMessage(
      INITIAL_CONTACT_STATE,
      form({ message: 'A perfectly reasonable message.', replyTo: '', website: '' }),
    );
    expect(state.status).toBe('error');
    expect(state.message).toMatch(/unreachable/);
  });
});

describe('the contact form', () => {
  it('labels both fields and marks the email optional', () => {
    render(<ContactForm mailConfigured />);
    expect(screen.getByLabelText(/your message/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByText(/\(optional\)/i)).toBeInTheDocument();
  });

  it('asks people not to identify themselves', () => {
    const { container } = render(<ContactForm mailConfigured />);
    expect(container.textContent).toMatch(/do not include your last name, your school/i);
  });

  it('hides the honeypot from people and from assistive technology', () => {
    const { container } = render(<ContactForm mailConfigured />);
    const honeypot = container.querySelector('input[name="website"]');
    expect(honeypot).not.toBeNull();
    expect(honeypot?.closest('[aria-hidden="true"]')).not.toBeNull();
    expect(honeypot?.getAttribute('tabindex')).toBe('-1');
  });

  it('is a real form with a submit button, so it works without JavaScript', () => {
    const { container } = render(<ContactForm mailConfigured />);
    expect(container.querySelector('form')).not.toBeNull();
    expect(screen.getByRole('button', { name: /send/i })).toHaveAttribute('type', 'submit');
  });

  it('says up front when the deployment cannot send', () => {
    render(<ContactForm mailConfigured={false} />);
    expect(screen.getByText(/no mail service configured/i)).toBeInTheDocument();
  });

  it('is operable from the keyboard', async () => {
    render(<ContactForm mailConfigured />);
    await userEvent.tab();
    expect(screen.getByLabelText(/your message/i)).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByLabelText(/email/i)).toHaveFocus();
  });
});
