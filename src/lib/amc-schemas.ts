/**
 * AMC beta content schemas - the shape of everything in `content/amc/`.
 *
 * Source of truth: docs/06-V3-REDESIGN.md section 5. Like schemas.ts, these validate ONE file
 * in isolation. Corpus rules (unique ids, file name and folder matching, topic / type /
 * formula ids resolving against the taxonomy, figure components existing) live in
 * `scripts/lib/amc-rules.ts`, which `pnpm validate:content` runs.
 *
 * Imports use explicit `.ts` extensions because `node scripts/validate-content.ts` loads this
 * file directly with Node's type stripping, which does not guess extensions.
 *
 * Id formats
 *   problem       AM-0001                 (4 digits)
 *   area          ALG | GEO | NT | CP
 *   topic         ALG-01, GEO-11, NT-03, CP-07   (area prefix + 2 digits)
 *   problem type  T-TELESCOPE, T-STARS-BARS      (T- then uppercase words joined by -)
 *   formula       F-ALG-01, F-NT-12              (F- + area + 2 digits)
 *
 * NOTE: AMC topic ids share a shape with Kangaroo skill ids (GEO-01 exists in both). They are
 * separate namespaces. Never look an AMC topic up in the Skill Atlas or vice versa.
 */

import { z } from 'zod';
import { ChoiceSchema, FigureSchema, CalibrationSchema } from './schemas.ts';
import { AMC_TIERS, AMC_SLOT_MIN, AMC_SLOT_MAX, AMC_PROBLEM_ID_RE } from './amc-tier.ts';

export * from './amc-tier.ts';

/* -------------------------------------------------------------------------- */
/* Vocabularies                                                                */
/* -------------------------------------------------------------------------- */

export const AMC_AREAS = ['ALG', 'GEO', 'NT', 'CP'] as const;
export const AMC_CONTESTS = ['AMC10', 'AMC12', 'BOTH'] as const;
/** A formula is tagged with the papers it is useful on; BOTH is spelled as both entries. */
export const AMC_FORMULA_CONTESTS = ['AMC10', 'AMC12'] as const;
export const FORMULA_PRIORITIES = ['must-know', 'good-to-know'] as const;

export const AmcAreaIdSchema = z.enum(AMC_AREAS);
export const AmcContestSchema = z.enum(AMC_CONTESTS);
export const AmcFormulaContestSchema = z.enum(AMC_FORMULA_CONTESTS);
export const AmcTierSchema = z.enum(AMC_TIERS);
export const FormulaPrioritySchema = z.enum(FORMULA_PRIORITIES);

export type AmcAreaId = z.infer<typeof AmcAreaIdSchema>;
export type AmcContest = z.infer<typeof AmcContestSchema>;
export type AmcFormulaContest = z.infer<typeof AmcFormulaContestSchema>;
export type FormulaPriority = z.infer<typeof FormulaPrioritySchema>;

export const AMC_TOPIC_ID_RE = /^(ALG|GEO|NT|CP)-\d{2}$/;
export const AMC_TYPE_ID_RE = /^T-[A-Z0-9]+(?:-[A-Z0-9]+)*$/;
export const AMC_FORMULA_ID_RE = /^F-(ALG|GEO|NT|CP)-\d{2}$/;

export const AmcProblemIdSchema = z.string().regex(AMC_PROBLEM_ID_RE, 'must look like AM-0001');
export const AmcTopicIdSchema = z.string().regex(AMC_TOPIC_ID_RE, 'must look like ALG-01');
export const AmcTypeIdSchema = z.string().regex(AMC_TYPE_ID_RE, 'must look like T-TELESCOPE');
export const FormulaIdSchema = z.string().regex(AMC_FORMULA_ID_RE, 'must look like F-ALG-01');

/** The area an AMC topic or formula id belongs to, read from its prefix. */
export function amcAreaOf(id: string): AmcAreaId | null {
  const match = /^(?:F-)?(ALG|GEO|NT|CP)-\d{2}$/.exec(id);
  return match ? (match[1] as AmcAreaId) : null;
}

/** Folder under content/amc/problems/: BOTH problems live with the AMC 10 ones. */
export function amcContestFolder(contest: AmcContest): '10' | '12' {
  return contest === 'AMC12' ? '12' : '10';
}

/** Does a problem tagged `contest` belong on the given paper? BOTH belongs on either. */
export function amcInContest(contest: AmcContest, paper: AmcFormulaContest): boolean {
  return contest === 'BOTH' || contest === paper;
}

/* -------------------------------------------------------------------------- */
/* Taxonomy - content/amc/taxonomy.json                                        */
/* -------------------------------------------------------------------------- */

export const AmcAreaSchema = z
  .object({
    id: AmcAreaIdSchema,
    name: z.string().min(3).max(40),
    description: z.string().min(40).max(400),
  })
  .strict();

export const AmcTopicSchema = z
  .object({
    id: AmcTopicIdSchema,
    name: z.string().min(3).max(60),
    area: AmcAreaIdSchema,
    /** 1-2 sentences. */
    description: z.string().min(40).max(400),
    /** True when the topic is on the AMC 12 syllabus but not the AMC 10 one (trig, logs...). */
    amc12Only: z.boolean(),
  })
  .strict();

export const AmcProblemTypeSchema = z
  .object({
    id: AmcTypeIdSchema,
    name: z.string().min(3).max(60),
    description: z.string().min(40).max(500),
    /** Concrete cues in a problem statement that should make a student reach for this. */
    recognizeWhen: z.array(z.string().min(8)).min(3).max(5),
    areas: z.array(AmcAreaIdSchema).min(1),
  })
  .strict();

export const AmcTaxonomySchema = z
  .object({
    areas: z.array(AmcAreaSchema).length(AMC_AREAS.length),
    topics: z.array(AmcTopicSchema).min(1),
    types: z.array(AmcProblemTypeSchema).min(1),
  })
  .strict();

export type AmcArea = z.infer<typeof AmcAreaSchema>;
export type AmcTopic = z.infer<typeof AmcTopicSchema>;
export type AmcProblemType = z.infer<typeof AmcProblemTypeSchema>;
export type AmcTaxonomy = z.infer<typeof AmcTaxonomySchema>;

/* -------------------------------------------------------------------------- */
/* Problem - content/amc/problems/<10|12>/<ID>.json                            */
/* -------------------------------------------------------------------------- */

export const AmcProblemSchema = z
  .object({
    id: AmcProblemIdSchema,
    contest: AmcContestSchema,
    /** Where it would sit on a real 25-question paper. Tier and points derive from this. */
    slot: z.number().int().min(AMC_SLOT_MIN).max(AMC_SLOT_MAX),
    area: AmcAreaIdSchema,
    topic: AmcTopicIdSchema,
    /** 1-3 problem-type ids, most important first. */
    types: z.array(AmcTypeIdSchema).min(1).max(3),
    /** KaTeX inline math in `$...$`. Choice text may use `$...$` too. */
    statement: z.string().min(20),
    figure: FigureSchema.nullable(),
    choices: z.array(ChoiceSchema).length(5),
    /** nudge, strategy, full - strictly graduated. */
    hints: z.tuple([z.string().min(5), z.string().min(10), z.string().min(20)]),
    solutions: z
      .object({ reliable: z.string().min(50), elegant: z.string().min(30).nullable() })
      .strict(),
    /** Formula ids the solution leans on. May be empty. */
    formulas: z.array(FormulaIdSchema),
    estSeconds: z.number().int().min(30).max(900),
    calibration: CalibrationSchema,
    author: z.string().min(2),
    reviewedBy: z.array(z.string().min(2)).min(1),
    createdAt: z.iso.date(),
    license: z.literal('CC-BY-NC-SA-4.0'),
  })
  .strict();

export type AmcProblem = z.infer<typeof AmcProblemSchema>;

/* -------------------------------------------------------------------------- */
/* Formula - content/amc/formulas/<AREA>/<ID>.json                             */
/* -------------------------------------------------------------------------- */

export const FormulaSchema = z
  .object({
    id: FormulaIdSchema,
    area: AmcAreaIdSchema,
    name: z.string().min(3).max(80),
    /** Raw KaTeX source, rendered in display mode. NO surrounding `$`. */
    formula: z.string().min(3),
    /** One or two sentences. Inline math in `$...$`. */
    whenToUse: z.string().min(20).max(400),
    /** A short, original worked example. Inline math in `$...$`. */
    example: z.string().min(30).max(800),
    /** The common mistake, in plain words. */
    pitfall: z.string().min(20).max(400),
    priority: FormulaPrioritySchema,
    contests: z.array(AmcFormulaContestSchema).min(1).max(2),
    /** Optional problem-type ids this formula is the usual tool for. */
    types: z.array(AmcTypeIdSchema).optional(),
    /** Optional short derivation or reason it is true. Inline math in `$...$`. */
    derivation: z.string().min(20).max(1200).optional(),
  })
  .strict();

export type Formula = z.infer<typeof FormulaSchema>;
