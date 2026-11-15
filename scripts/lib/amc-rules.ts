/**
 * Every content rule for the AMC beta (`content/amc/`), in one place.
 *
 * Kept apart from content-rules.ts so the Kangaroo rules stay exactly as they were. The CLI
 * (scripts/validate-content.ts) runs both and reports them together. Like validateContent,
 * this never throws on bad content and never exits, so tests can point it at fixtures.
 *
 * Rule ids are stable strings; scripts/__tests__/amc-rules.test.ts asserts on them.
 */

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, basename, relative, sep } from 'node:path';
import { checkProblemRules } from '../../src/lib/problem-rules.ts';
import {
  AmcTaxonomySchema,
  AmcProblemSchema,
  FormulaSchema,
  AMC_AREAS,
  amcAreaOf,
  amcContestFolder,
  type AmcTaxonomy,
  type AmcProblem,
  type Formula,
} from '../../src/lib/amc-schemas.ts';

export type AmcRuleId =
  | 'amc/json-parse'
  | 'amc/schema-taxonomy'
  | 'amc/schema-problem'
  | 'amc/schema-formula'
  | 'amc/taxonomy-missing'
  | 'amc/taxonomy-areas'
  | 'amc/taxonomy-duplicate-id'
  | 'amc/topic-area-prefix'
  | 'amc/problem-id-matches-path'
  | 'amc/problem-duplicate-id'
  | 'amc/problem-exactly-one-correct'
  | 'amc/problem-choice-keys'
  | 'amc/misconception-required'
  | 'amc/correct-choice-no-misconception'
  | 'amc/figure-alt-required'
  | 'amc/figure-component-exists'
  | 'amc/topic-exists'
  | 'amc/topic-area-matches'
  | 'amc/topic-contest'
  | 'amc/type-exists'
  | 'amc/formula-exists'
  | 'amc/formula-id-matches-path'
  | 'amc/formula-duplicate-id'
  | 'amc/formula-no-dollars';

export interface AmcFinding {
  rule: AmcRuleId;
  file: string;
  message: string;
}

export interface AmcValidateOptions {
  /** Directory holding amc/ (i.e. the repo's content/). */
  contentDir: string;
  /** Directory holding the figure components. Existence checks are skipped if absent. */
  figuresDir?: string;
}

export interface AmcValidateResult {
  findings: AmcFinding[];
  taxonomy: AmcTaxonomy | null;
  problems: Map<string, AmcProblem>;
  formulas: Map<string, Formula>;
  counts: { problems: number; formulas: number; topics: number; types: number };
}

function listJsonFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  const walk = (d: string): void => {
    for (const entry of readdirSync(d, { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name),
    )) {
      const full = join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name.endsWith('.json')) out.push(full);
    }
  };
  walk(dir);
  return out;
}

function readJson(file: string): { ok: true; value: unknown } | { ok: false; message: string } {
  try {
    return { ok: true, value: JSON.parse(readFileSync(file, 'utf8')) };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}

function formatZodIssues(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'issues' in error) {
    const issues = (error as { issues: Array<{ path: PropertyKey[]; message: string }> }).issues;
    return issues
      .map((i) => `${i.path.length ? i.path.join('.') : '(root)'}: ${i.message}`)
      .join('; ');
  }
  return String(error);
}

/** The shared Kangaroo guardrails, renamed into the amc/ namespace. Same text, same rule. */
const GUARDRAIL_RENAME = {
  'problem/misconception-required': 'amc/misconception-required',
  'problem/correct-choice-no-misconception': 'amc/correct-choice-no-misconception',
  'problem/figure-alt-required': 'amc/figure-alt-required',
} as const satisfies Record<string, AmcRuleId>;

export function validateAmcContent(options: AmcValidateOptions): AmcValidateResult {
  const { contentDir, figuresDir } = options;
  const amcDir = join(contentDir, 'amc');
  const findings: AmcFinding[] = [];
  const rel = (f: string) => relative(process.cwd(), f) || f;
  const add = (rule: AmcRuleId, file: string, message: string): void => {
    findings.push({ rule, file: rel(file), message });
  };

  const problems = new Map<string, AmcProblem>();
  const formulas = new Map<string, Formula>();
  const empty: AmcValidateResult = {
    findings,
    taxonomy: null,
    problems,
    formulas,
    counts: { problems: 0, formulas: 0, topics: 0, types: 0 },
  };

  // No AMC content at all (e.g. a Kangaroo-only fixture tree): nothing to check.
  if (!existsSync(amcDir)) return empty;

  /* -------------------------------------------------------------- taxonomy */

  const taxonomyFile = join(amcDir, 'taxonomy.json');
  let taxonomy: AmcTaxonomy | null = null;
  if (!existsSync(taxonomyFile)) {
    add('amc/taxonomy-missing', taxonomyFile, 'content/amc/ exists but taxonomy.json does not');
  } else {
    const raw = readJson(taxonomyFile);
    if (!raw.ok) add('amc/json-parse', taxonomyFile, `not valid JSON - ${raw.message}`);
    else {
      const parsed = AmcTaxonomySchema.safeParse(raw.value);
      if (!parsed.success) add('amc/schema-taxonomy', taxonomyFile, formatZodIssues(parsed.error));
      else taxonomy = parsed.data;
    }
  }

  const topicById = new Map<string, AmcTaxonomy['topics'][number]>();
  const typeIds = new Set<string>();

  if (taxonomy) {
    const areaIds = taxonomy.areas.map((a) => a.id).sort();
    if (areaIds.join(',') !== [...AMC_AREAS].sort().join(',')) {
      add(
        'amc/taxonomy-areas',
        taxonomyFile,
        `areas must be exactly ${AMC_AREAS.join(', ')} once each, found ${areaIds.join(', ')}`,
      );
    }
    for (const topic of taxonomy.topics) {
      if (topicById.has(topic.id)) {
        add('amc/taxonomy-duplicate-id', taxonomyFile, `topic id ${topic.id} appears twice`);
      }
      topicById.set(topic.id, topic);
      if (amcAreaOf(topic.id) !== topic.area) {
        add(
          'amc/topic-area-prefix',
          taxonomyFile,
          `topic ${topic.id} has area ${topic.area}; the id prefix must match the area`,
        );
      }
    }
    for (const type of taxonomy.types) {
      if (typeIds.has(type.id)) {
        add('amc/taxonomy-duplicate-id', taxonomyFile, `problem type id ${type.id} appears twice`);
      }
      typeIds.add(type.id);
    }
  }

  /* -------------------------------------------------------------- formulas */

  const formulaIdSeen = new Map<string, string>();
  for (const file of listJsonFiles(join(amcDir, 'formulas'))) {
    const raw = readJson(file);
    if (!raw.ok) {
      add('amc/json-parse', file, `not valid JSON - ${raw.message}`);
      continue;
    }
    const parsed = FormulaSchema.safeParse(raw.value);
    if (!parsed.success) {
      add('amc/schema-formula', file, formatZodIssues(parsed.error));
      continue;
    }
    const formula = parsed.data;

    if (basename(file) !== `${formula.id}.json`) {
      add('amc/formula-id-matches-path', file, `id ${formula.id} expects ${formula.id}.json`);
    }
    if (file.split(sep).at(-2) !== formula.area) {
      add(
        'amc/formula-id-matches-path',
        file,
        `area ${formula.area} expects the folder content/amc/formulas/${formula.area}/`,
      );
    }
    if (amcAreaOf(formula.id) !== formula.area) {
      add(
        'amc/formula-id-matches-path',
        file,
        `id prefix of ${formula.id} disagrees with area ${formula.area}`,
      );
    }
    if (/^\s*\$|\$\s*$/.test(formula.formula)) {
      add(
        'amc/formula-no-dollars',
        file,
        '`formula` is raw KaTeX rendered in display mode; remove the surrounding $ signs',
      );
    }
    if (taxonomy) {
      for (const typeId of formula.types ?? []) {
        if (!typeIds.has(typeId)) {
          add('amc/type-exists', file, `lists problem type ${typeId}, not in taxonomy.json`);
        }
      }
    }

    const previous = formulaIdSeen.get(formula.id);
    if (previous) {
      add('amc/formula-duplicate-id', file, `formula ${formula.id} is already in ${rel(previous)}`);
      continue;
    }
    formulaIdSeen.set(formula.id, file);
    formulas.set(formula.id, formula);
  }

  /* -------------------------------------------------------------- problems */

  const problemIdSeen = new Map<string, string>();
  for (const file of listJsonFiles(join(amcDir, 'problems'))) {
    const raw = readJson(file);
    if (!raw.ok) {
      add('amc/json-parse', file, `not valid JSON - ${raw.message}`);
      continue;
    }

    // GUARDRAIL: misconception on every wrong choice, alt text on every figure. Same shared
    // implementation as the Kangaroo bank, run before the schema so the message teaches.
    for (const violation of checkProblemRules(raw.value)) {
      add(GUARDRAIL_RENAME[violation.rule], file, violation.message);
    }

    const parsed = AmcProblemSchema.safeParse(raw.value);
    if (!parsed.success) {
      add('amc/schema-problem', file, formatZodIssues(parsed.error));
      continue;
    }
    const problem = parsed.data;

    if (basename(file) !== `${problem.id}.json`) {
      add('amc/problem-id-matches-path', file, `id ${problem.id} expects ${problem.id}.json`);
    }
    const folder = amcContestFolder(problem.contest);
    if (file.split(sep).at(-2) !== folder) {
      add(
        'amc/problem-id-matches-path',
        file,
        `contest ${problem.contest} expects the folder content/amc/problems/${folder}/ ` +
          '(AMC10 and BOTH live in 10/, AMC12 in 12/)',
      );
    }

    const previous = problemIdSeen.get(problem.id);
    if (previous) {
      add('amc/problem-duplicate-id', file, `problem ${problem.id} is already in ${rel(previous)}`);
      continue;
    }
    problemIdSeen.set(problem.id, file);
    problems.set(problem.id, problem);

    const correct = problem.choices.filter((c) => c.correct).length;
    if (correct !== 1) {
      add('amc/problem-exactly-one-correct', file, `expected 1 correct choice, found ${correct}`);
    }
    const keys = problem.choices.map((c) => c.key);
    if ([...keys].sort().join('') !== 'ABCDE') {
      add(
        'amc/problem-choice-keys',
        file,
        `choice keys must be exactly A-E, found ${keys.join('')}`,
      );
    }

    if (problem.figure && figuresDir) {
      const candidates = [
        join(figuresDir, `${problem.figure.component}.tsx`),
        join(figuresDir, `${problem.figure.component}.jsx`),
      ];
      if (!candidates.some((c) => existsSync(c))) {
        add(
          'amc/figure-component-exists',
          file,
          `figure component ${problem.figure.component} has no file in ${rel(figuresDir)}`,
        );
      }
    }

    if (taxonomy) {
      const topic = topicById.get(problem.topic);
      if (!topic) {
        add('amc/topic-exists', file, `topic ${problem.topic} is not in taxonomy.json`);
      } else {
        if (topic.area !== problem.area) {
          add(
            'amc/topic-area-matches',
            file,
            `area ${problem.area} disagrees with topic ${topic.id}, which is in ${topic.area}`,
          );
        }
        if (topic.amc12Only && problem.contest !== 'AMC12') {
          add(
            'amc/topic-contest',
            file,
            `topic ${topic.id} (${topic.name}) is AMC 12 only, so contest must be AMC12`,
          );
        }
      }
      for (const typeId of problem.types) {
        if (!typeIds.has(typeId)) {
          add('amc/type-exists', file, `problem type ${typeId} is not in taxonomy.json`);
        }
      }
      if (new Set(problem.types).size !== problem.types.length) {
        add('amc/type-exists', file, 'types lists the same problem type twice');
      }
    }
  }

  // Formula references are checked after every formula file is read, in id order.
  for (const [id, problem] of problems) {
    for (const formulaId of problem.formulas) {
      if (!formulas.has(formulaId)) {
        add(
          'amc/formula-exists',
          problemIdSeen.get(id) ?? id,
          `formula ${formulaId} has no file in content/amc/formulas/`,
        );
      }
    }
  }

  return {
    findings,
    taxonomy,
    problems,
    formulas,
    counts: {
      problems: problems.size,
      formulas: formulas.size,
      topics: taxonomy?.topics.length ?? 0,
      types: taxonomy?.types.length ?? 0,
    },
  };
}
