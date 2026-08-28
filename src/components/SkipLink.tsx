/**
 * The first thing in the tab order. Hidden until focused, then a real, visible target - a skip
 * link nobody can see is a skip link nobody can use. The styling lives in globals.css as
 * `.skip-link`; see the comment there for why it is not composed from utilities.
 */
export function SkipLink() {
  return (
    <a href="#main" className="skip-link">
      Skip to main content
    </a>
  );
}
