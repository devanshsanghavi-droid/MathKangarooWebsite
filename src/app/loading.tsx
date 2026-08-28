/**
 * The route-level loading state. It is deliberately a static block rather than a spinner:
 * an animation that respects prefers-reduced-motion but still moves is worse than text for a
 * page that usually appears in well under a second.
 */
export default function Loading() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      <p role="status" className="m-0 text-sm text-ink-3">
        Loading…
      </p>
    </div>
  );
}
