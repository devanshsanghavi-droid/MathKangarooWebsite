import Link from 'next/link';
import type { Skill } from '@/lib/schemas';

/**
 * A link to a skill page. The id is always shown next to the name: ids are permanent and are
 * what a tutor writes on a worksheet, so they are part of the label rather than a tooltip.
 */
export function SkillChip({
  skill,
  variant = 'default',
}: {
  skill: Pick<Skill, 'id' | 'name'>;
  variant?: 'default' | 'primary';
}) {
  const primary = variant === 'primary';
  return (
    <Link
      href={`/skill/${skill.id}`}
      className={[
        'inline-flex items-baseline gap-1.5 rounded-sm border px-2 py-1 text-xs no-underline transition-colors',
        primary
          ? 'border-accent bg-accent-soft font-medium text-ink hover:border-accent-2'
          : 'border-rule text-ink-2 hover:border-rule-2 hover:text-ink',
      ].join(' ')}
    >
      <span className="mono text-2xs text-ink-3">{skill.id}</span>
      <span>{skill.name}</span>
    </Link>
  );
}

/** The same chip for a skill we could not resolve — shows the id rather than silently vanishing. */
export function UnknownSkillChip({ id }: { id: string }) {
  return (
    <span className="mono inline-flex items-center rounded-sm border border-rule px-2 py-1 text-2xs text-ink-3">
      {id} (not in the Atlas)
    </span>
  );
}
