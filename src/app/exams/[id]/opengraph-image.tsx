import { EXAM_OG_SIZE, examOgImage } from '@/components/exams/exam-og';
import { EXAMS, examById, type CatalogExamId } from '@/lib/exams';

export const size = EXAM_OG_SIZE;
export const contentType = 'image/png';
export const alt = 'Kangaroo Atlas exam guide: format, scoring and tips';

/** Only catalog exams; an unknown id must not fall through to an on-demand render. */
export const dynamicParams = false;

export function generateStaticParams(): Array<{ id: string }> {
  return EXAMS.map((exam) => ({ id: exam.id }));
}

/** The exam owner's trademark, in short, for the card's footer. */
const NOTICE: Record<CatalogExamId, string> = {
  ka: 'Not affiliated with Math Kangaroo in USA, NFP.',
  amc8: 'AMC is a trademark of the MAA. Not affiliated.',
  amc10: 'AMC is a trademark of the MAA. Not affiliated.',
  amc12: 'AMC is a trademark of the MAA. Not affiliated.',
  aime: 'AIME is a trademark of the MAA. Not affiliated.',
  sat: 'SAT is a College Board trademark. Not affiliated.',
  psat: 'PSAT is a College Board trademark. Not affiliated.',
  act: 'ACT is a trademark of ACT Education Corp. Not affiliated.',
  mathcounts: 'MATHCOUNTS is a Foundation trademark. Not affiliated.',
};

export default async function OpenGraphImage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const exam = examById(id);
  if (!exam) {
    return examOgImage({
      badge: 'Exams',
      kicker: 'Exam guide',
      title: 'Every math exam in one place',
      notice: 'Independent. Not affiliated with any exam body.',
    });
  }
  return examOgImage({
    badge: exam.status === 'soon' ? 'Coming soon' : exam.shortName,
    kicker: 'Exam guide: format, scoring and tips',
    title: exam.name,
    detail: exam.format.summary,
    notice: NOTICE[exam.id],
    accentToken: exam.color,
  });
}
