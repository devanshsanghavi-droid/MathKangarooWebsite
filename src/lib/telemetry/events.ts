import { z } from 'zod';
import { BANDS, CHOICE_KEYS, POINT_VALUES, STRANDS } from '../schemas';

/**
 * The event taxonomy.
 *
 * ---------------------------------------------------------------------------------------
 * THE RULE THIS FILE EXISTS TO ENFORCE
 *
 *   Every field is an ENUMERATED value drawn from content that already ships publicly - a
 *   skill id, a problem id, a choice key, a route name, a point tier. There is no free-text
 *   field anywhere in this schema, and there never may be.
 *
 * That is not a stylistic preference. The users are minors, so CLAUDE.md forbids PII beyond a
 * first name, and COPPA is a build constraint here rather than a legal appendix. A telemetry
 * payload with a string field is a payload a child can type their name into - via a search
 * box, a journal reflection, a mistyped URL - and once it is in the events table it is in
 * every backup and every aggregate. The schema is the control: `.strict()` rejects unknown
 * keys, and the collector drops anything that fails to parse rather than storing it "just in
 * case".
 * ---------------------------------------------------------------------------------------
 *
 * Coverage is deliberately the union of two literatures:
 *
 *   product analytics   acquisition, activation, engagement, retention, funnels, path
 *                       analysis, feature adoption, performance - the things any product team
 *                       would instrument.
 *   learning analytics  item difficulty, discrimination, and per-option distractor behaviour -
 *                       the things that actually tell you whether the teaching works.
 *
 * The second is where this site earns its keep: every wrong answer already stores the
 * misconception that produces it, so recording WHICH distractor was chosen turns the problem
 * bank into a live map of how students actually think.
 */

/** Bumped when a field changes meaning. Rows carry it so old and new are never averaged together. */
export const TELEMETRY_SCHEMA_VERSION = 1;

/**
 * Every surface a student can be on, as a closed set. Routes are recorded by NAME, never as a
 * raw pathname: a pathname can carry a query string, and a query string can carry anything.
 */
export const SURFACES = [
  'home',
  'atlas',
  'atlas-strand',
  'skill-unit',
  'skill-learn',
  'skill-ladder',
  'skill-quiz',
  'problem',
  'problems',
  'papers',
  'paper',
  'diagnostic',
  'mock',
  'worksheet',
  'about',
  'legal',
  'contact',
  'offline',
  'not-found',
] as const;
export type Surface = (typeof SURFACES)[number];

/** Where an attempt happened. Mirrors the `context` column on the attempts table. */
export const CONTEXTS = ['free', 'ladder', 'quiz', 'diagnostic', 'mock', 'worksheet'] as const;
export type Context = (typeof CONTEXTS)[number];

export const EVENT_NAMES = [
  // --- acquisition and navigation ----------------------------------------
  'surface_view', // a page was shown
  'entry', // the FIRST surface of a session - answers "what do people seek out first"
  'nav_click', // an internal link followed, with source and destination surface
  'exit_intent', // last surface before the session ended

  // --- activation and the learning loop -----------------------------------
  'problem_view',
  'choice_select', // WHICH option - the distractor analysis feed
  'hint_reveal',
  'solution_open',
  'figure_description_open',

  // --- feature adoption ----------------------------------------------------
  'ladder_start',
  'ladder_complete',
  'quiz_start',
  'quiz_complete',
  'diagnostic_start',
  'diagnostic_complete',
  'mock_start',
  'mock_complete',
  'worksheet_print',
  'atlas_view_toggle', // graph vs list
  'filter_apply', // which facet, not what was typed
  'theme_change',

  // --- health --------------------------------------------------------------
  'client_error',
  'slow_surface',
] as const;
export type EventName = (typeof EVENT_NAMES)[number];

const SkillId = z.string().regex(/^[A-Z]{3}-\d{2}$/);
const ProblemId = z.string().regex(/^KA-\d{4}$/);

/**
 * The event body. Every property is optional because different events carry different
 * subsets, and `.strict()` means an event carrying anything NOT listed here is rejected
 * outright rather than trimmed.
 */
export const EventPropsSchema = z
  .object({
    surface: z.enum(SURFACES).optional(),
    fromSurface: z.enum(SURFACES).optional(),
    skillId: SkillId.optional(),
    problemId: ProblemId.optional(),
    strand: z.enum(STRANDS).optional(),
    band: z.enum(BANDS).optional(),
    points: z
      .number()
      .int()
      .refine((value): value is (typeof POINT_VALUES)[number] =>
        POINT_VALUES.includes(value as (typeof POINT_VALUES)[number]),
      )
      .optional(),
    context: z.enum(CONTEXTS).optional(),
    /** Which option was chosen. The whole point of the exercise. */
    choiceKey: z.enum(CHOICE_KEYS).optional(),
    correct: z.boolean().optional(),
    /** 0-3. Recorded at the moment of answering, not afterwards. */
    hintLevel: z.number().int().min(0).max(3).optional(),
    /** Milliseconds on the problem before answering. Capped: see MAX_MS. */
    msElapsed: z.number().int().min(0).max(1_800_000).optional(),
    /** For filter_apply: which facet was used, never the value typed into it. */
    facet: z.enum(['strand', 'band', 'points', 'skill', 'coverage', 'view', 'sort']).optional(),
    /** For quiz/mock/diagnostic completion. */
    score: z.number().int().min(0).max(200).optional(),
    outOf: z.number().int().min(0).max(200).optional(),
    /** For client_error: a stable enumerated reason, never a stack or a message. */
    reason: z
      .enum(['hydration', 'network', 'render', 'storage', 'service-worker', 'unknown'])
      .optional(),
    /** For slow_surface: milliseconds to interactive, bucketed by the collector. */
    ms: z.number().int().min(0).max(120_000).optional(),
    /*
     * Retention, without an identifier.
     *
     * A D1/D7 retention curve normally needs the server to recognise the same person twice,
     * which is exactly what a cookie does and exactly what this design refuses. Instead the
     * CLIENT reads its own first-visit date out of its own localStorage and sends back which
     * of three coarse buckets it falls into. The server learns "roughly a third of sessions
     * this week were returning" and still cannot tell any two sessions apart.
     */
    returning: z.enum(['first-visit', 'within-week', 'within-month', 'older']).optional(),
  })
  .strict();

export type EventProps = z.infer<typeof EventPropsSchema>;

export const EventSchema = z
  .object({
    name: z.enum(EVENT_NAMES),
    /**
     * Rotates every session and is never persisted beyond the tab. It exists so a single
     * visit's events can be ordered and counted as one session; it is deliberately useless
     * for recognising the same person tomorrow, which is what a cookie would do.
     */
    sessionId: z.string().regex(/^[0-9a-f]{16}$/),
    /** Monotonic within a session, so ordering survives out-of-order delivery. */
    seq: z.number().int().min(0).max(100_000),
    /** Client clock, ISO. The collector records its own receipt time as the authority. */
    at: z.iso.datetime(),
    props: EventPropsSchema,
  })
  .strict();

export type TelemetryEvent = z.infer<typeof EventSchema>;

export const BatchSchema = z
  .object({
    v: z.literal(TELEMETRY_SCHEMA_VERSION),
    events: z.array(EventSchema).min(1).max(50),
  })
  .strict();

export type TelemetryBatch = z.infer<typeof BatchSchema>;

/** Anything longer is a tab left open overnight, not time on task. */
export const MAX_MS = 1_800_000;

/**
 * Durations are stored in buckets rather than exactly.
 *
 * A precise millisecond count is a surprisingly strong fingerprint - a handful of exact
 * durations picks one person out of a cohort. Buckets keep every question this system needs to
 * answer ("do students who rush get more wrong?") and answer none of the ones it should not.
 */
export const MS_BUCKETS = [5_000, 15_000, 30_000, 60_000, 120_000, 300_000, MAX_MS] as const;

export function bucketMs(ms: number): number {
  for (const edge of MS_BUCKETS) if (ms <= edge) return edge;
  return MAX_MS;
}
