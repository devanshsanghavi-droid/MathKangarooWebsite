import type { ReactNode } from 'react';

/**
 * Long-form reading. Serif face, capped at 66ch per `docs/00-SPEC.md` §0.1 - a measure that
 * stays comfortable at 200% zoom, where a full-width column becomes unreadable.
 */
export function Prose({ children }: { children: ReactNode }) {
  return (
    <div className="reading prose-measure text-ink-2 [&>p]:mt-4 [&>p:first-child]:mt-0">
      {children}
    </div>
  );
}
