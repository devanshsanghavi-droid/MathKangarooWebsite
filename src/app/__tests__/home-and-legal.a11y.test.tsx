import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { auditBothThemes } from '@/lib/a11y';
import HomePage from '../page';
import AboutPage from '../about/page';
import PrivacyPage from '../legal/privacy/page';
import TermsPage from '../legal/terms/page';
import LicensePage from '../legal/license/page';
import { ContactForm } from '../contact/ContactForm';

describe('the Phase 1 content pages', () => {
  it.each([
    ['home', HomePage],
    ['about', AboutPage],
    ['privacy', PrivacyPage],
    ['terms', TermsPage],
    ['license', LicensePage],
  ])('%s has no axe violations in either theme', async (_name, Page) => {
    const { container } = render(<Page />);
    expect(await auditBothThemes(container)).toEqual([]);
  });

  it('the contact form has no axe violations in either theme', async () => {
    const { container } = render(<ContactForm mailConfigured />);
    expect(await auditBothThemes(container)).toEqual([]);
  });

  it('the contact form is still clean when it is warning that mail is off', async () => {
    const { container } = render(<ContactForm mailConfigured={false} />);
    expect(await auditBothThemes(container)).toEqual([]);
  });
});
