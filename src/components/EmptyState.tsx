import type { ReactNode } from 'react';

/**
 * A section with nothing in it yet.
 *
 * Written as a sentence, never as a placeholder. `docs/02-BUILD-PLAN.md` M1.5 requires every
 * skill page to render all nine sections or explicitly mark them absent — so "no problems yet"
 * has to say what that means and what to do instead, not show a grey box.
 */
export function EmptyState({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-sm border border-dashed border-rule px-4 py-3">
      <p className="m-0 text-sm text-ink-2">{children}</p>
      {action ? <p className="mt-2 mb-0 text-sm">{action}</p> : null}
    </div>
  );
}
