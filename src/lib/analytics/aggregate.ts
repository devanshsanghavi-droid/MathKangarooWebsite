import type { EventName, Surface, TelemetryEvent } from '../telemetry/events';
import { PUBLISH_MIN_N } from './item-analysis';

/**
 * The product-analytics half: the questions any product team asks of a website, answered from
 * first-party, cookie-free events.
 *
 * Everything is a pure function over a list of events, so the same code runs over a live query
 * result, a fixture, or a day's export. Nothing here reads a clock or a database.
 *
 * ---------------------------------------------------------------------------------------
 * ONE METRIC IS DELIBERATELY MISSING, AND IT IS WORTH KNOWING WHY
 *
 * There is no per-user retention curve, no user journey, and no "same person came back on
 * day 7". Those all require recognising an individual across visits, which is precisely what
 * a tracking cookie is for and precisely what this design forbids — the users are minors.
 *
 * `returningMix` is the honest substitute: each client reads its OWN first-visit date from its
 * OWN storage and reports which coarse bucket it is in. That yields a true returning-vs-new
 * split for the cohort while leaving every session mutually indistinguishable on the server.
 * ---------------------------------------------------------------------------------------
 */

export interface Count {
  key: string;
  count: number;
  /** Share of the relevant denominator, 0-1. */
  share: number;
}

function tally(keys: readonly string[]): Count[] {
  const counts = new Map<string, number>();
  for (const key of keys) counts.set(key, (counts.get(key) ?? 0) + 1);
  const total = keys.length;
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count, share: total === 0 ? 0 : count / total }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

const named = (events: readonly TelemetryEvent[], name: EventName) =>
  events.filter((event) => event.name === name);

export function sessionIds(events: readonly TelemetryEvent[]): Set<string> {
  return new Set(events.map((event) => event.sessionId));
}

/** How many sessions, and how much they did. Engagement, in two numbers. */
export function sessionStats(events: readonly TelemetryEvent[]) {
  const sessions = sessionIds(events);
  const perSession = new Map<string, number>();
  for (const event of events) {
    perSession.set(event.sessionId, (perSession.get(event.sessionId) ?? 0) + 1);
  }
  const depths = [...perSession.values()].sort((a, b) => a - b);
  const median = depths.length === 0 ? 0 : (depths[Math.floor(depths.length / 2)] ?? 0);
  return {
    sessions: sessions.size,
    events: events.length,
    medianEventsPerSession: median,
    /** A session with one event and nothing else — the closest cookie-free analogue to a bounce. */
    singleEventSessions: [...perSession.values()].filter((depth) => depth === 1).length,
  };
}

/** "What do most people seek out first" — the entry surface of each session. */
export function entryPoints(events: readonly TelemetryEvent[]): Count[] {
  return tally(
    named(events, 'entry')
      .map((event) => event.props.surface)
      .filter((surface): surface is Surface => surface !== undefined),
  );
}

/** Which surfaces get used at all, by share of sessions rather than raw hits. */
export function surfaceReach(events: readonly TelemetryEvent[]): Count[] {
  const total = sessionIds(events).size;
  const bySurface = new Map<string, Set<string>>();
  for (const event of named(events, 'surface_view')) {
    const surface = event.props.surface;
    if (!surface) continue;
    const set = bySurface.get(surface) ?? new Set<string>();
    set.add(event.sessionId);
    bySurface.set(surface, set);
  }
  return [...bySurface.entries()]
    .map(([key, set]) => ({ key, count: set.size, share: total === 0 ? 0 : set.size / total }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

/** Behavioural flow: which surface leads to which. The site's actual shape, as opposed to its map. */
export function transitions(events: readonly TelemetryEvent[]): Count[] {
  return tally(
    named(events, 'nav_click')
      .filter((event) => event.props.fromSurface && event.props.surface)
      .map((event) => `${event.props.fromSurface} → ${event.props.surface}`),
  );
}

export interface FunnelStep {
  name: string;
  sessions: number;
  /** Share of the sessions that reached the step before this one. */
  stepConversion: number;
  /** Share of the sessions that entered the funnel at all. */
  overallConversion: number;
}

/**
 * A funnel over event names, counted in sessions rather than events, and counted as "ever
 * reached" rather than "reached in this order" — a student who opens a hint before answering
 * has still answered.
 */
export function funnel(
  events: readonly TelemetryEvent[],
  steps: readonly { name: string; when: (event: TelemetryEvent) => boolean }[],
): FunnelStep[] {
  const reached = steps.map(
    (step) => new Set(events.filter(step.when).map((event) => event.sessionId)),
  );
  const first = reached[0]?.size ?? 0;
  return steps.map((step, index) => {
    const here = reached[index]?.size ?? 0;
    const before = index === 0 ? here : (reached[index - 1]?.size ?? 0);
    return {
      name: step.name,
      sessions: here,
      stepConversion: before === 0 ? 0 : here / before,
      overallConversion: first === 0 ? 0 : here / first,
    };
  });
}

/** The learning loop, as a funnel. Where students fall out of it is the product question. */
export const LEARNING_FUNNEL = [
  { name: 'Opened a problem', when: (e: TelemetryEvent) => e.name === 'problem_view' },
  { name: 'Answered it', when: (e: TelemetryEvent) => e.name === 'choice_select' },
  {
    name: 'Answered a second',
    when: (e: TelemetryEvent) => e.name === 'choice_select' && (e.props.msElapsed ?? 0) > 0,
  },
  { name: 'Finished a ladder', when: (e: TelemetryEvent) => e.name === 'ladder_complete' },
] as const;

/** Which skills people actually go to. Demand, as distinct from what the Atlas emphasises. */
export function skillDemand(events: readonly TelemetryEvent[]): Count[] {
  return tally(
    events.map((event) => event.props.skillId).filter((id): id is string => id !== undefined),
  );
}

export interface ErrorRate {
  key: string;
  answered: number;
  wrong: number;
  /** 0-1. Null when the cell is too thin to publish. */
  rate: number | null;
}

/**
 * "What types are more wrong", sliced however you like — by skill, by point tier, by strand,
 * by band. Cells below `minN` report a null rate rather than a noisy one, per
 * docs/01-DATA-MODEL.md §4: nothing published is derived from fewer than ten students.
 */
export function errorRateBy(
  events: readonly TelemetryEvent[],
  dimension: (event: TelemetryEvent) => string | undefined,
  minN = PUBLISH_MIN_N,
): ErrorRate[] {
  const cells = new Map<string, { answered: number; wrong: number }>();
  for (const event of named(events, 'choice_select')) {
    const key = dimension(event);
    if (key === undefined || event.props.correct === undefined) continue;
    const cell = cells.get(key) ?? { answered: 0, wrong: 0 };
    cell.answered += 1;
    if (!event.props.correct) cell.wrong += 1;
    cells.set(key, cell);
  }
  return [...cells.entries()]
    .map(([key, cell]) => ({
      key,
      answered: cell.answered,
      wrong: cell.wrong,
      rate: cell.answered < minN ? null : cell.wrong / cell.answered,
    }))
    .sort((a, b) => (b.rate ?? -1) - (a.rate ?? -1) || a.key.localeCompare(b.key));
}

/** How often a correct answer leaned on more than the opening nudge. */
export function hintDependence(events: readonly TelemetryEvent[], minN = PUBLISH_MIN_N) {
  const answered = named(events, 'choice_select').filter((e) => e.props.correct === true);
  if (answered.length < minN) return null;
  const leaned = answered.filter((e) => (e.props.hintLevel ?? 0) > 1).length;
  return { correct: answered.length, withHelp: leaned, share: leaned / answered.length };
}

/** New versus returning, without ever recognising anyone. See the note at the top of the file. */
export function returningMix(events: readonly TelemetryEvent[]): Count[] {
  const perSession = new Map<string, string>();
  for (const event of events) {
    const bucket = event.props.returning;
    if (bucket && !perSession.has(event.sessionId)) perSession.set(event.sessionId, bucket);
  }
  return tally([...perSession.values()]);
}

/** Feature adoption: the share of sessions that ever used each surface-level feature. */
export function featureAdoption(events: readonly TelemetryEvent[]): Count[] {
  const total = sessionIds(events).size;
  const FEATURES: Array<[string, EventName]> = [
    ['Diagnostic', 'diagnostic_start'],
    ['Mock exam', 'mock_start'],
    ['Practice ladder', 'ladder_start'],
    ['Skill quiz', 'quiz_start'],
    ['Worksheet', 'worksheet_print'],
    ['Hints', 'hint_reveal'],
    ['Full solution', 'solution_open'],
    ['Figure description', 'figure_description_open'],
  ];
  return FEATURES.map(([key, name]) => {
    const count = new Set(named(events, name).map((event) => event.sessionId)).size;
    return { key, count, share: total === 0 ? 0 : count / total };
  }).sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}
