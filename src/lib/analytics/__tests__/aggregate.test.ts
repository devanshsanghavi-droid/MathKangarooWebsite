import { describe, it, expect } from 'vitest';
import {
  entryPoints,
  errorRateBy,
  featureAdoption,
  funnel,
  hintDependence,
  returningMix,
  sessionStats,
  skillDemand,
  surfaceReach,
  transitions,
} from '../aggregate.ts';
import type { EventName, EventProps, TelemetryEvent } from '../../telemetry/events.ts';

let seq = 0;
function ev(sessionId: string, name: EventName, props: EventProps = {}): TelemetryEvent {
  return {
    name,
    sessionId: sessionId.padEnd(16, '0'),
    seq: seq++,
    at: '2026-03-01T10:00:00.000Z',
    props,
  };
}

describe('engagement', () => {
  const events = [
    ev('a', 'entry', { surface: 'home' }),
    ev('a', 'surface_view', { surface: 'home' }),
    ev('a', 'surface_view', { surface: 'atlas' }),
    ev('b', 'entry', { surface: 'problem' }),
    ev('b', 'surface_view', { surface: 'problem' }),
    ev('c', 'entry', { surface: 'home' }),
  ];

  it('counts sessions rather than hits', () => {
    const stats = sessionStats(events);
    expect(stats.sessions).toBe(3);
    expect(stats.events).toBe(6);
  });

  it('counts a one-event session, the cookie-free stand-in for a bounce', () => {
    expect(sessionStats(events).singleEventSessions).toBe(1);
  });

  it('answers what people seek out first', () => {
    expect(entryPoints(events)).toEqual([
      { key: 'home', count: 2, share: 2 / 3 },
      { key: 'problem', count: 1, share: 1 / 3 },
    ]);
  });

  it('reports reach as a share of sessions, not raw views', () => {
    const reach = surfaceReach(events);
    expect(reach.find((r) => r.key === 'home')).toEqual({ key: 'home', count: 1, share: 1 / 3 });
  });

  it('maps the flow between surfaces', () => {
    const flow = transitions([
      ev('a', 'nav_click', { fromSurface: 'home', surface: 'atlas' }),
      ev('b', 'nav_click', { fromSurface: 'home', surface: 'atlas' }),
      ev('c', 'nav_click', { fromSurface: 'atlas', surface: 'skill-unit' }),
    ]);
    expect(flow[0]).toMatchObject({ key: 'home → atlas', count: 2 });
  });
});

describe('the learning funnel', () => {
  const events = [
    ...['a', 'b', 'c', 'd'].map((s) => ev(s, 'problem_view', { problemId: 'KA-0001' })),
    ...['a', 'b', 'c'].map((s) => ev(s, 'choice_select', { choiceKey: 'A', correct: true })),
    ...['a'].map((s) => ev(s, 'ladder_complete', { skillId: 'CNT-12' })),
  ];

  it('reports step and overall conversion in sessions', () => {
    const steps = funnel(events, [
      { name: 'Opened', when: (e) => e.name === 'problem_view' },
      { name: 'Answered', when: (e) => e.name === 'choice_select' },
      { name: 'Finished', when: (e) => e.name === 'ladder_complete' },
    ]);
    expect(steps[0]).toMatchObject({ sessions: 4, stepConversion: 1, overallConversion: 1 });
    expect(steps[1]).toMatchObject({ sessions: 3, stepConversion: 0.75, overallConversion: 0.75 });
    expect(steps[2]?.stepConversion).toBeCloseTo(1 / 3, 10);
  });

  it('does not divide by zero on an empty funnel', () => {
    const steps = funnel([], [{ name: 'Opened', when: () => true }]);
    expect(steps[0]).toMatchObject({ sessions: 0, stepConversion: 0, overallConversion: 0 });
  });
});

describe('what is getting answered wrong', () => {
  /** Twelve answers on CNT-12, nine of them wrong; four on GEO-01, too few to publish. */
  const events = [
    ...Array.from({ length: 12 }, (_u, i) =>
      ev(`s${i}`, 'choice_select', { skillId: 'CNT-12', correct: i >= 9, points: 5 }),
    ),
    ...Array.from({ length: 4 }, (_u, i) =>
      ev(`t${i}`, 'choice_select', { skillId: 'GEO-01', correct: false, points: 3 }),
    ),
  ];

  it('reports an error rate per skill, worst first', () => {
    const rates = errorRateBy(events, (e) => e.props.skillId);
    expect(rates[0]).toMatchObject({ key: 'CNT-12', answered: 12, wrong: 9, rate: 0.75 });
  });

  it('suppresses a cell derived from fewer than ten answers', () => {
    // docs/01-DATA-MODEL.md §4. The count is still shown; the RATE is withheld, because a
    // rate over four answers is noise presented as a finding.
    const geo = errorRateBy(events, (e) => e.props.skillId).find((r) => r.key === 'GEO-01');
    expect(geo).toMatchObject({ answered: 4, wrong: 4, rate: null });
  });

  it('slices by any dimension, not just skill', () => {
    const byTier = errorRateBy(events, (e) => e.props.points?.toString());
    expect(byTier.find((r) => r.key === '5')?.rate).toBe(0.75);
    expect(byTier.find((r) => r.key === '3')?.rate).toBeNull();
  });

  it('reports how often a right answer leaned on more than the opening nudge', () => {
    const answered = Array.from({ length: 20 }, (_u, i) =>
      ev(`s${i}`, 'choice_select', { correct: true, hintLevel: i < 5 ? 2 : 0 }),
    );
    expect(hintDependence(answered)).toMatchObject({ correct: 20, withHelp: 5, share: 0.25 });
  });

  it('says nothing about hints on a thin sample', () => {
    expect(hintDependence([ev('a', 'choice_select', { correct: true })])).toBeNull();
  });
});

describe('demand and adoption', () => {
  it('ranks the skills people actually go to', () => {
    const events = [
      ev('a', 'surface_view', { skillId: 'CNT-12' }),
      ev('b', 'surface_view', { skillId: 'CNT-12' }),
      ev('c', 'surface_view', { skillId: 'NUM-01' }),
    ];
    expect(skillDemand(events)[0]).toMatchObject({ key: 'CNT-12', count: 2 });
  });

  it('reports feature adoption as a share of sessions', () => {
    const events = [
      ev('a', 'entry', { surface: 'home' }),
      ev('b', 'entry', { surface: 'home' }),
      ev('a', 'diagnostic_start'),
      ev('a', 'diagnostic_start'),
    ];
    const adoption = featureAdoption(events);
    // Two starts, one session: adoption is 1 of 2 sessions, not 2.
    expect(adoption.find((a) => a.key === 'Diagnostic')).toEqual({
      key: 'Diagnostic',
      count: 1,
      share: 0.5,
    });
  });

  it('splits new from returning without recognising anyone', () => {
    const events = [
      ev('a', 'entry', { surface: 'home', returning: 'first-visit' }),
      ev('b', 'entry', { surface: 'home', returning: 'within-week' }),
      ev('c', 'entry', { surface: 'home', returning: 'first-visit' }),
      // A second event in a session must not be counted twice.
      ev('a', 'surface_view', { surface: 'atlas', returning: 'first-visit' }),
    ];
    expect(returningMix(events)).toEqual([
      { key: 'first-visit', count: 2, share: 2 / 3 },
      { key: 'within-week', count: 1, share: 1 / 3 },
    ]);
  });
});
