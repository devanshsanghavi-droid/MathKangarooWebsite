import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  EXAMS,
  EXAM_IDS,
  examById,
  examColorVar,
  examForSession,
  examsForGrade,
  isCatalogExamId,
  kaTrackForGrade,
  liveExams,
  soonExams,
  topicName,
} from '../exams';
import { EXAM_SPECS, mockQuestionCount, mockMinutes } from '../exam-engine';
import { SESSION_EXAMS } from '../local-progress';
import { BANDS } from '../schemas';
import { MOCK_MINUTES, maxScore, paperSize } from '../mock';

const tokensCss = readFileSync(join(process.cwd(), 'src/styles/tokens.css'), 'utf8');
const globalsCss = readFileSync(join(process.cwd(), 'src/styles/globals.css'), 'utf8');

describe('exam catalog', () => {
  it('has one entry per id, in catalog order', () => {
    expect(EXAMS.map((exam) => exam.id)).toEqual([...EXAM_IDS]);
  });

  it('splits into live and soon exams', () => {
    expect(liveExams().map((e) => e.id)).toEqual(['ka', 'amc8', 'amc10', 'amc12', 'sat', 'act']);
    expect(soonExams().map((e) => e.id)).toEqual(['aime', 'mathcounts', 'psat']);
  });

  it('looks exams up by id, and rejects unknown ids', () => {
    expect(examById('amc10')?.name).toBe('AMC 10');
    expect(examById('nope')).toBeUndefined();
    expect(isCatalogExamId('psat')).toBe(true);
    expect(isCatalogExamId('KA')).toBe(false);
  });

  it.each(EXAMS)('$id is complete and consistent', (exam) => {
    expect(exam.tips.length).toBeGreaterThanOrEqual(3);
    expect(exam.tips.length).toBeLessThanOrEqual(5);
    expect(exam.grades.min).toBeGreaterThanOrEqual(1);
    expect(exam.grades.max).toBeLessThanOrEqual(12);
    expect(exam.grades.min).toBeLessThanOrEqual(exam.grades.max);
    expect(exam.routes.page).toBe(`/exams/${exam.id}`);
    expect(exam.format.questions).toBe(
      exam.format.parts.reduce((sum, part) => sum + part.questions, 0),
    );
    if (exam.related) expect(examById(exam.related)).toBeDefined();
    // The token exists in tokens.css and is mapped for Tailwind in globals.css.
    expect(tokensCss).toContain(`${exam.color}:`);
    expect(globalsCss).toContain(`--color-${exam.color.slice(2)}: var(${exam.color});`);
    expect(examColorVar(exam)).toBe(`var(${exam.color})`);
    // House style: no em or en dashes in any student-facing string.
    expect(JSON.stringify(exam)).not.toMatch(new RegExp('[\\u2013\\u2014]'));
  });

  it('gives every live exam practice, mock, bank and learn routes, and a soon exam none', () => {
    for (const exam of liveExams()) {
      expect(exam.routes.practice).toMatch(/^\//);
      expect(exam.routes.mock).toMatch(/^\//);
      expect(exam.routes.bank).toMatch(/^\//);
      expect(exam.routes.learn).toMatch(/^\//);
      expect(exam.sessionExam).not.toBeNull();
    }
    for (const exam of soonExams()) {
      expect(exam.routes).toMatchObject({ practice: null, mock: null, bank: null, learn: null });
      expect(exam.color).toBe('--exam-soon');
      expect(exam.related && examById(exam.related)?.status).toBe('live');
    }
  });

  it('points each soon exam at the docs/08 related exam', () => {
    expect(examById('aime')?.related).toBe('amc12');
    expect(examById('mathcounts')?.related).toBe('amc8');
    expect(examById('psat')?.related).toBe('sat');
  });

  it('gives each live exam its own colour', () => {
    const colors = liveExams().map((exam) => exam.color);
    expect(new Set(colors).size).toBe(colors.length);
  });

  it('maps every session exam to exactly one catalog entry', () => {
    for (const session of SESSION_EXAMS) {
      expect(examForSession(session)?.sessionExam).toBe(session);
    }
  });

  it('reads AMC, SAT and ACT formats from the engine specs that run their mocks', () => {
    for (const exam of liveExams()) {
      if (exam.id === 'ka' || !exam.sessionExam) continue;
      const spec = EXAM_SPECS[exam.sessionExam];
      expect(exam.format.questions).toBe(mockQuestionCount(spec));
      expect(exam.format.minutes).toBe(mockMinutes(spec));
      expect(exam.format.choices).toBe(spec.choiceCount);
    }
    expect(examById('amc8')?.format.summary).toBe('25 questions, 40 minutes, 5 choices');
    expect(examById('sat')?.format.parts).toHaveLength(2);
    expect(examById('act')?.format.summary).toBe('45 questions, 50 minutes, 4 choices');
  });

  it('describes the coming-soon formats', () => {
    expect(examById('aime')?.format).toMatchObject({
      questions: 15,
      minutes: 180,
      answer: 'typed',
    });
    expect(examById('aime')?.format.summary).toBe('15 questions, 3 hours, typed answers');
    expect(examById('mathcounts')?.format.parts.map((p) => [p.label, p.questions])).toEqual([
      ['Sprint', 30],
      ['Target', 8],
    ]);
    expect(examById('mathcounts')?.format.parts[0]?.minutes).toBe(40);
    expect(examById('psat')?.format).toMatchObject({ questions: 44, minutes: 70 });
    expect(examById('psat')?.scoring.scale).toMatchObject({ min: 160, max: 760 });
  });

  describe('Math Kangaroo levels', () => {
    const ka = examById('ka');

    it('has one track per band, matching BANDS', () => {
      expect(ka?.tracks.map((t) => t.id)).toEqual([...BANDS]);
    });

    it.each([...BANDS])('level %s matches the mock paper', (band) => {
      const track = ka?.tracks.find((t) => t.id === band);
      expect(track?.format.questions).toBe(paperSize(band));
      expect(track?.format.minutes).toBe(MOCK_MINUTES);
      expect(track?.scoring.maxRaw).toBe(maxScore(band));
      expect(track?.format.choices).toBe(5);
      expect(track?.scoring.penalty).toBe(false);
      expect(track?.bank).toBe(`/problems?level=${band}`);
    });

    it('uses 24 questions for levels 1-2 and 3-4, and 30 above', () => {
      expect(ka?.tracks.map((t) => t.format.questions)).toEqual([24, 24, 30, 30, 30, 30]);
    });

    it('finds the level for a grade', () => {
      expect(kaTrackForGrade(1)?.id).toBe('1-2');
      expect(kaTrackForGrade(7)?.id).toBe('7-8');
      expect(kaTrackForGrade(12)?.id).toBe('11-12');
      expect(kaTrackForGrade(13)).toBeUndefined();
    });
  });

  describe('examsForGrade', () => {
    it('lists the exams usually taken in a grade, live first', () => {
      expect(examsForGrade(3).map((e) => e.id)).toEqual(['ka']);
      expect(examsForGrade(7).map((e) => e.id)).toEqual(['ka', 'amc8', 'mathcounts']);
      expect(examsForGrade(11).map((e) => e.id)).toEqual([
        'ka',
        'amc12',
        'sat',
        'act',
        'aime',
        'psat',
      ]);
    });

    it('can be narrowed to live exams', () => {
      expect(examsForGrade(7, { live: true }).map((e) => e.id)).toEqual(['ka', 'amc8']);
    });

    it('matches nothing outside grades 1-12', () => {
      expect(examsForGrade(0)).toEqual([]);
      expect(examsForGrade(13)).toEqual([]);
      expect(examsForGrade(2.5)).toEqual([]);
    });

    it('covers every grade with at least one live exam', () => {
      for (let grade = 1; grade <= 12; grade += 1) {
        expect(examsForGrade(grade, { live: true }).length).toBeGreaterThan(0);
      }
    });
  });

  it('applies topic-name overrides and falls back to the taxonomy name', () => {
    const sat = examById('sat');
    expect(sat && topicName(sat, 'PSD', 'Problem-Solving and Data Analysis')).toBe(
      'Problem solving and data',
    );
    expect(sat && topicName(sat, 'ALG', 'Algebra')).toBe('Algebra');
  });
});
