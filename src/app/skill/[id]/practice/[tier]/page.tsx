import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getAllSkills, getProblemsForSkill, getSkill } from '@/lib/content';
import { POINT_VALUES, type Points } from '@/lib/schemas';
import { LadderRunner } from '@/components/practice/LadderRunner';

interface Params {
  params: Promise<{ id: string; tier: string }>;
}

/** One page per skill per point tier. All of them exist at build time; nothing else does. */
export const dynamicParams = false;

export function generateStaticParams(): Array<{ id: string; tier: string }> {
  return getAllSkills().flatMap((skill) =>
    POINT_VALUES.map((points) => ({ id: skill.id, tier: String(points) })),
  );
}

function parseTier(value: string): Points | null {
  const points = Number(value);
  return POINT_VALUES.find((candidate) => candidate === points) ?? null;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id, tier } = await params;
  const skill = getSkill(id);
  const points = parseTier(tier);
  if (!skill || !points) return { title: 'Not found', robots: { index: false } };
  return {
    title: `${skill.name}: ${points}-point ladder`,
    description: `Practise ${skill.name} at the ${points}-point tier. Three correct in a row finishes the ladder, and every wrong answer explains itself.`,
    alternates: { canonical: `/skill/${skill.id}/practice/${points}` },
  };
}

export default async function LadderPage({ params }: Params) {
  const { id, tier } = await params;
  const skill = getSkill(id);
  const points = parseTier(tier);
  if (!skill || !points) notFound();

  const problems = getProblemsForSkill(skill.id).filter((problem) => problem.points === points);

  return (
    <LadderRunner skillId={skill.id} skillName={skill.name} points={points} problems={problems} />
  );
}
