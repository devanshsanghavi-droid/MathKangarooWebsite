import type { Figure } from '@/lib/schemas';
import { FIGURES } from './figures/registry';

/**
 * Resolves a figure component by the name in the problem JSON and renders it with its
 * author-written alt text.
 *
 * Two things carry the alt text, deliberately:
 *   - `role="img"` plus `aria-label` on the <figure>, which is what a screen reader announces
 *     and which hides the SVG's internals from the accessibility tree;
 *   - a collapsed text description below it, so a low-vision or colour-blind reader — or one
 *     on a phone at 200% zoom where the drawing is awkward — can read the same information
 *     instead of squinting at it. The alt describes what a solver EXTRACTS, so exposing it
 *     visibly gives away nothing the picture does not already give away.
 */
export function FigureRenderer({ figure, problemId }: { figure: Figure; problemId?: string }) {
  const Component = FIGURES[figure.component];

  if (!Component) {
    // Content validation catches this in CI. If one ever slips through, show the description
    // rather than a hole where the information should be.
    return (
      <div className="my-4 rounded-sm border border-rule-strong bg-surface-2 p-4">
        <p className="m-0 text-sm text-ink-2">{figure.alt}</p>
        <p className="mono m-0 mt-2 text-2xs text-ink-3">
          Figure “{figure.component}” could not be rendered.
        </p>
      </div>
    );
  }

  const descriptionId = problemId ? `figure-description-${problemId}` : undefined;

  return (
    <div className="my-5">
      <figure
        role="img"
        aria-label={figure.alt}
        className="m-0 rounded-sm border border-rule bg-surface p-4"
      >
        <Component />
      </figure>
      <details className="mt-2">
        <summary className="cursor-pointer text-xs text-ink-3 hover:text-ink">
          Text description of the figure
        </summary>
        <p id={descriptionId} className="prose-measure mt-2 mb-0 text-sm text-ink-2">
          {figure.alt}
        </p>
      </details>
    </div>
  );
}
