/**
 * SAT / ACT content schemas - the shape of everything in `content/tests/`.
 *
 * Source of truth: docs/07-EXAMS-PROGRESS-MOCKS.md section 3. Like amc-schemas.ts, these
 * validate ONE file in isolation. Corpus rules (unique ids, file name and folder matching,
 * skill resolving against the right test's taxonomy, figure components existing) live in
 * `scripts/lib/test-rules.ts`, which `pnpm validate:content` runs.
 *
 * Imports use explicit `.ts` extensions because `node scripts/validate-content.ts` loads this
 * file directly with Node's type stripping.
 *
 * Problem files: content/tests/sat/problems/SA-0001.json, content/tests/act/problems/AC-0001.json
 * Taxonomy:      content/tests/sat/taxonomy.json, content/tests/act/taxonomy.json
 */

import { z } from 'zod';
import { ChoiceSchema, FigureSchema, CalibrationSchema } from './schemas.ts';
import {
  STD_TESTS,
  TEST_DIFFICULTIES,
  ALL_TEST_DOMAINS,
  TEST_PROBLEM_ID_RE,
  TEST_SKILL_ID_RE,
} from './test-meta.ts';

export * from './test-meta.ts';

/* -------------------------------------------------------------------------- */
/* Vocabularies                                                                */
/* -------------------------------------------------------------------------- */

export const StdTestSchema = z.enum(STD_TESTS);
export const TestDifficultySchema = z.enum(TEST_DIFFICULTIES);
export const TestDomainIdSchema = z.enum(ALL_TEST_DOMAINS);
export const TestProblemIdSchema = z
  .string()
  .regex(TEST_PROBLEM_ID_RE, 'must look like SA-0001 or AC-0001');
export const TestSkillIdSchema = z.string().regex(TEST_SKILL_ID_RE, 'must look like ALG-01');

/** SAT and ACT both use four choices (the enhanced ACT moved to four in 2025). */
export const TEST_CHOICE_KEYS = ['A', 'B', 'C', 'D'] as const;

/* -------------------------------------------------------------------------- */
/* Taxonomy - content/tests/<sat|act>/taxonomy.json                            */
/* -------------------------------------------------------------------------- */

export const TestSkillSchema = z
  .object({
    id: TestSkillIdSchema,
    name: z.string().min(3).max(70),
    /** 1-2 sentences. */
    description: z.string().min(40).max(400),
  })
  .strict();

export const TestDomainSchema = z
  .object({
    id: TestDomainIdSchema,
    name: z.string().min(3).max(60),
    description: z.string().min(40).max(400),
    skills: z.array(TestSkillSchema).min(1),
  })
  .strict();

export const TestTaxonomySchema = z
  .object({
    test: StdTestSchema,
    domains: z.array(TestDomainSchema).min(1),
  })
  .strict();

export type TestSkill = z.infer<typeof TestSkillSchema>;
export type TestDomainEntry = z.infer<typeof TestDomainSchema>;
export type TestTaxonomy = z.infer<typeof TestTaxonomySchema>;

/* -------------------------------------------------------------------------- */
/* Problem - content/tests/<sat|act>/problems/<ID>.json                        */
/* -------------------------------------------------------------------------- */

export const TestProblemSchema = z
  .object({
    id: TestProblemIdSchema,
    test: StdTestSchema,
    domain: TestDomainIdSchema,
    skill: TestSkillIdSchema,
    difficulty: TestDifficultySchema,
    /** KaTeX inline math in `$...$`. Choice text may use `$...$` too. */
    statement: z.string().min(20),
    figure: FigureSchema.nullable(),
    choices: z.array(ChoiceSchema).length(4),
    /** nudge, strategy, full - strictly graduated. */
    hints: z.tuple([z.string().min(5), z.string().min(10), z.string().min(20)]),
    solutions: z
      .object({ reliable: z.string().min(50), elegant: z.string().min(30).nullable() })
      .strict(),
    estSeconds: z.number().int().min(20).max(600),
    calibration: CalibrationSchema,
    author: z.string().min(2),
    reviewedBy: z.array(z.string().min(2)).min(1),
    createdAt: z.iso.date(),
    license: z.literal('CC-BY-NC-SA-4.0'),
  })
  .strict();

export type TestProblem = z.infer<typeof TestProblemSchema>;
