import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getAllSkills, getProblemsForSkill, getSkill } from '@/lib/content';
import { SkillQuiz } from '@/components/practice/SkillQuiz';
import { pickQuizProblems } from '@/lib/skill-quiz';

interface Params {
  params: Promise<{ id: string }>;
}

export const dynamicParams = false;

export function generateStaticParams(): Array<{ id: string }> {
  return getAllSkills().map((skill) => ({ id: skill.id }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const skill = getSkill(id);
  if (!skill) return { title: 'Skill not found', robots: { index: false } };
  return {
    title: `Skill quiz: ${skill.name}`,
    description: `Five problems on ${skill.name}, marked at the end, with an explanation written for the answer you actually chose.`,
    alternates: { canonical: `/skill/${skill.id}/quiz` },
  };
}

export default async function SkillQuizPage({ params }: Params) {
  const { id } = await params;
  const skill = getSkill(id);
  if (!skill) notFound();

  return (
    <SkillQuiz
      skillId={skill.id}
      skillName={skill.name}
      problems={pickQuizProblems(getProblemsForSkill(skill.id))}
    />
  );
}
