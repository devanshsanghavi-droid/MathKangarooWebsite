import type { Strand, Tier } from '@/lib/schemas';

/**
 * The shape the sidebar needs, and nothing else.
 *
 * Kept separate from `@/lib/content` because the rail is a client component - it needs the
 * pathname to mark the student's position and localStorage to draw mastery dots - and
 * content.ts is server-only. The root layout does the lookup once and passes this down.
 */
export interface RailSkill {
  id: string;
  name: string;
  tier: Tier;
  problemCount: number;
}

export interface RailStrand {
  strand: Strand;
  name: string;
  skills: RailSkill[];
}
