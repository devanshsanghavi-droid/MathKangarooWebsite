/**
 * Content schemas — the shape of everything in `content/`.
 *
 * These schemas validate a SINGLE file in isolation. Rules that need to see the whole
 * corpus (id uniqueness, prerequisite existence, acyclicity, `unlocks` being the exact
 * reverse of `prerequisites`, figure components resolving to a real file, the 2KB paper
 * tripwire) live in `scripts/validate-content.ts`, which is what `pnpm validate:content`
 * runs and what CI gates on.
 *
 * Source of truth: docs/01-DATA-MODEL.md §1.
 */

import { z } from 'zod';

/* -------------------------------------------------------------------------- */
/* Shared vocabularies                                                         */
/* -------------------------------------------------------------------------- */

export const STRANDS = ['NUM', 'CNT', 'GEO', 'LOG', 'PAT', 'MOD', 'CFT'] as const;
export const BANDS = ['1-2', '3-4', '5-6', '7-8', '9-10', '11-12'] as const;
export const TIERS = ['foundation', 'core', 'gateway'] as const;
export const CHOICE_KEYS = ['A', 'B', 'C', 'D', 'E'] as const;
export const POINT_VALUES = [3, 4, 5] as const;

export const StrandSchema = z.enum(STRANDS);
export const BandSchema = z.enum(BANDS);
export const TierSchema = z.enum(TIERS);
export const ChoiceKeySchema = z.enum(CHOICE_KEYS);
export const PointsSchema = z.union([z.literal(3), z.literal(4), z.literal(5)]);

export type Strand = z.infer<typeof StrandSchema>;
export type Band = z.infer<typeof BandSchema>;
export type Tier = z.infer<typeof TierSchema>;
export type ChoiceKey = z.infer<typeof ChoiceKeySchema>;
export type Points = z.infer<typeof PointsSchema>;

/** `NUM-01`, `CFT-12`, … — permanent once published; never renumbered. */
export const SKILL_ID_RE = /^(NUM|CNT|GEO|LOG|PAT|MOD|CFT)-\d{2}$/;
/** `KA-0001` — our own problems only. Official problems are never stored. */
export const PROBLEM_ID_RE = /^KA-\d{4}$/;

export const SkillIdSchema = z.string().regex(SKILL_ID_RE, 'must look like NUM-01');
export const ProblemIdSchema = z.string().regex(PROBLEM_ID_RE, 'must look like KA-0001');

/* -------------------------------------------------------------------------- */
/* Skill — content/skills/<STRAND>/<ID>.json                                   */
/* -------------------------------------------------------------------------- */

export const SkillSchema = z
  .object({
    id: SkillIdSchema,
    name: z.string().min(3).max(60),
    strand: StrandSchema,
    tier: TierSchema,
    bands: z.array(BandSchema).min(1),
    /** Plain language, 2–3 sentences, no jargon a 5th grader would not know. */
    definition: z.string().min(80).max(600),
    /** Concrete trigger phrases a student would actually meet in a problem. */
    recognizeWhen: z.array(z.string().min(8)).min(3).max(6),
    /** Problem id of the worked example on the skill page, or null until authored. */
    canonicalProblem: ProblemIdSchema.nullable(),
    /** Each phrased in the student's own voice: "I counted what I could see and stopped." */
    misconceptions: z.array(z.string().min(15)).min(2),
    prerequisites: z.array(SkillIdSchema),
    /** Derived by scripts/derive-unlocks.ts. Never hand-edited. */
    unlocks: z.array(SkillIdSchema),
    translations: z
      .record(z.string(), z.object({ name: z.string(), definition: z.string() }))
      .optional(),
  })
  .strict();

export type Skill = z.infer<typeof SkillSchema>;

/* -------------------------------------------------------------------------- */
/* Problem — content/problems/<band>/<ID>.json                                 */
/* -------------------------------------------------------------------------- */

/**
 * A choice. `misconception` is required exactly when the choice is wrong — this is the
 * product, not a nicety, so it is enforced at the schema level AND re-checked as a named
 * guardrail in the validator so the failure message says why it matters.
 */
export const ChoiceSchema = z
  .object({
    key: ChoiceKeySchema,
    text: z.string().min(1),
    correct: z.boolean(),
    misconception: z.string().min(30).nullable(),
  })
  .strict();

export type Choice = z.infer<typeof ChoiceSchema>;

export const FigureSchema = z
  .object({
    /** Component name exported from src/components/figures/<component>.tsx */
    component: z.string().regex(/^[A-Z][A-Za-z0-9]+$/, 'must be a PascalCase component name'),
    /** What a sighted solver extracts, not what the picture looks like. */
    alt: z.string().min(20),
  })
  .strict();

export type Figure = z.infer<typeof FigureSchema>;

export const CalibrationSchema = z
  .object({
    /** Proportion correct on first attempts. Measured, never asserted. */
    pValue: z.number().min(0).max(1).nullable(),
    medianMs: z.number().int().positive().nullable(),
    n: z.number().int().min(0),
  })
  .strict();

export const ProblemSchema = z
  .object({
    id: ProblemIdSchema,
    band: BandSchema,
    points: PointsSchema,
    statement: z.string().min(20),
    figure: FigureSchema.nullable(),
    choices: z.array(ChoiceSchema).length(5),
    skills: z.object({ primary: SkillIdSchema, secondary: z.array(SkillIdSchema) }).strict(),
    /** nudge, strategy, full — strictly graduated. */
    hints: z.tuple([z.string().min(5), z.string().min(10), z.string().min(20)]),
    solutions: z
      .object({ reliable: z.string().min(50), elegant: z.string().min(30).nullable() })
      .strict(),
    whyOnTest: z.string().min(20).max(200),
    estSeconds: z.number().int().min(20).max(300),
    calibration: CalibrationSchema,
    author: z.string().min(2),
    reviewedBy: z.array(z.string().min(2)).min(1),
    /** Equivalent to the deprecated z.string().date(); ISO calendar date. */
    createdAt: z.iso.date(),
    license: z.literal('CC-BY-NC-SA-4.0'),
    translations: z
      .record(z.string(), z.object({ statement: z.string(), choices: z.array(z.string()) }))
      .optional(),
  })
  .strict();

export type Problem = z.infer<typeof ProblemSchema>;

/* -------------------------------------------------------------------------- */
/* Paper index — content/papers/<year>-<band>.json                             */
/* -------------------------------------------------------------------------- */

/**
 * OUR ANALYSIS OF an official paper. Contains no official problem text, no figures and no
 * answers — question number, point value, our skill tags, and an optional ≤120-character
 * characterization in our own words. See CLAUDE.md, non-negotiable #1.
 */
export const PaperQuestionSchema = z
  .object({
    number: z.number().int().positive(),
    points: PointsSchema,
    skills: z.array(SkillIdSchema).min(1),
    /** Our one-line characterization. Never the problem. */
    note: z.string().max(120).optional(),
  })
  .strict();

export const PaperIndexSchema = z
  .object({
    year: z.number().int().min(1990).max(2100),
    band: BandSchema,
    /** Always remote, always mathkangaroo.org. We never host a copy. */
    officialPdfUrl: z.url(),
    questions: z.array(PaperQuestionSchema).min(1),
  })
  .strict();

export type PaperIndex = z.infer<typeof PaperIndexSchema>;
export type PaperQuestion = z.infer<typeof PaperQuestionSchema>;

/* -------------------------------------------------------------------------- */
/* Helpers shared by the validator and the content layer                       */
/* -------------------------------------------------------------------------- */

/** The band folder name used under content/problems/, e.g. "5-6". */
export const bandToFolder = (band: Band): string => band;

/** Strand a skill id belongs to, without needing the file. */
export function strandOf(skillId: string): Strand | null {
  const prefix = skillId.slice(0, 3);
  return (STRANDS as readonly string[]).includes(prefix) ? (prefix as Strand) : null;
}
