/**
 * Joins class names, skipping falsy parts. Small enough that a dependency (clsx, classnames)
 * would cost more than it saves - the dependency budget is deliberately small (CLAUDE.md).
 */
export function cx(...parts: Array<string | false | null | undefined | 0>): string {
  return parts.filter(Boolean).join(' ');
}
