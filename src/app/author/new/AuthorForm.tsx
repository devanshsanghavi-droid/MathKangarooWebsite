'use client';

import { useMemo, useState } from 'react';
import { BANDS, POINT_VALUES, type Band, type ChoiceKey, type Points } from '@/lib/schemas';
import { draftPath, emptyDraft, openPrUrl, validateDraft, type ProblemDraft } from '@/lib/author';
import { ProblemCardView } from '@/components/ProblemCardView';

/**
 * The authoring form.
 *
 * Two things it does that a plain form would not:
 *
 *  - **It validates against the same Zod schema CI runs.** Not a copy of the rules, the schema
 *    itself. A draft this form calls valid is a file `pnpm validate:content` accepts unmodified,
 *    which is M2.13's acceptance criterion.
 *  - **It previews with the real `<ProblemCard>`**, the same component the site renders. So the
 *    author sees the distractor feedback their misconceptions actually produce, while writing
 *    them, rather than discovering the wording is wrong after it ships.
 *
 * There is no database write anywhere. Submitting means opening GitHub's new-file editor with
 * the JSON already in it, so content arrives through git and through review.
 */
export function AuthorForm({
  knownSkillIds,
  usedProblemIds,
  nextId,
  today,
  repo,
  figureNames,
}: {
  knownSkillIds: readonly string[];
  usedProblemIds: readonly string[];
  nextId: string;
  today: string;
  repo: string;
  figureNames: readonly string[];
}) {
  const [draft, setDraft] = useState<ProblemDraft>(() => emptyDraft(nextId, today));
  const [copied, setCopied] = useState(false);

  const result = useMemo(
    () => validateDraft(draft, { knownSkillIds, usedProblemIds }),
    [draft, knownSkillIds, usedProblemIds],
  );

  const set = <K extends keyof ProblemDraft>(key: K, value: ProblemDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setCopied(false);
  };

  const setChoice = (key: ChoiceKey, field: 'text' | 'misconception', value: string) => {
    setDraft((current) => ({
      ...current,
      choices: current.choices.map((choice) =>
        choice.key === key ? { ...choice, [field]: value } : choice,
      ),
    }));
    setCopied(false);
  };

  const issuesFor = (path: string) =>
    result.issues.filter((issue) => issue.path === path || issue.path.startsWith(`${path}.`));

  const field = 'w-full rounded-sm border border-rule-2 bg-surface px-3 py-2 text-ink';
  const label = 'block text-sm font-medium text-ink';
  const help = 'mt-1 mb-2 text-xs text-ink-3';

  function Issues({ path }: { path: string }) {
    const found = issuesFor(path);
    if (found.length === 0) return null;
    return (
      <ul className="m-0 mt-1 grid list-none gap-0.5 p-0">
        {found.map((issue) => (
          <li key={`${issue.path}-${issue.message}`} className="text-sm text-incorrect">
            {issue.message}
          </li>
        ))}
      </ul>
    );
  }

  async function copyJson() {
    try {
      await navigator.clipboard.writeText(result.json);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <form className="grid gap-6" onSubmit={(event) => event.preventDefault()}>
        <fieldset className="m-0 grid gap-4 border-0 p-0">
          <legend className="mb-1 p-0 text-sm font-semibold text-ink">The problem</legend>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className={label} htmlFor="id">
                Id
              </label>
              <input
                id="id"
                className={`${field} mono`}
                value={draft.id}
                onChange={(e) => set('id', e.target.value)}
              />
              <Issues path="id" />
            </div>
            <div>
              <label className={label} htmlFor="band">
                Level
              </label>
              <select
                id="band"
                className={field}
                value={draft.band}
                onChange={(e) => set('band', e.target.value as Band)}
              >
                {BANDS.map((band) => (
                  <option key={band} value={band}>
                    {band.replace('-', '–')}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={label} htmlFor="points">
                Points
              </label>
              <select
                id="points"
                className={field}
                value={draft.points}
                onChange={(e) => set('points', Number(e.target.value) as Points)}
              >
                {POINT_VALUES.map((points) => (
                  <option key={points} value={points}>
                    {points}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={label} htmlFor="statement">
              Statement
            </label>
            <p className={help}>
              Under 35 words for levels 1–4, under 60 above. Keep the numbers small — Kangaroo
              rewards insight, not arithmetic stamina.
            </p>
            <textarea
              id="statement"
              rows={3}
              className={field}
              value={draft.statement}
              onChange={(e) => set('statement', e.target.value)}
            />
            <p className="mono mt-1 mb-0 text-2xs text-ink-3">
              {draft.statement.trim() ? draft.statement.trim().split(/\s+/).length : 0} words
            </p>
            <Issues path="statement" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={label} htmlFor="figureComponent">
                Figure component <span className="font-normal text-ink-3">(optional)</span>
              </label>
              <p className={help}>Must already exist in src/components/figures/.</p>
              <input
                id="figureComponent"
                list="figure-names"
                className={`${field} mono`}
                value={draft.figureComponent}
                onChange={(e) => set('figureComponent', e.target.value)}
              />
              <datalist id="figure-names">
                {figureNames.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </div>
            <div>
              <label className={label} htmlFor="figureAlt">
                Figure alt text
              </label>
              <p className={help}>What a sighted solver extracts, not what it looks like.</p>
              <textarea
                id="figureAlt"
                rows={2}
                className={field}
                value={draft.figureAlt}
                onChange={(e) => set('figureAlt', e.target.value)}
                disabled={!draft.figureComponent.trim()}
              />
              <Issues path="figure" />
            </div>
          </div>
        </fieldset>

        <fieldset className="m-0 grid gap-4 border-0 p-0">
          <legend className="mb-1 p-0 text-sm font-semibold text-ink">The five choices</legend>
          <p className="m-0 text-xs text-ink-3">
            Write the misconception first, then the number it produces. Every wrong choice must be
            reachable by a defensible mistake — no joke answers, nothing wildly out of range.
          </p>

          {draft.choices.map((choice) => {
            const isCorrect = choice.key === draft.correctKey;
            return (
              <div
                key={choice.key}
                className={[
                  'grid gap-2 rounded-sm border p-3',
                  isCorrect ? 'border-correct bg-correct-bg' : 'border-rule',
                ].join(' ')}
              >
                <div className="flex items-center gap-3">
                  <span className="mono text-sm font-semibold text-ink-3">{choice.key}</span>
                  <input
                    aria-label={`Choice ${choice.key} text`}
                    className={field}
                    value={choice.text}
                    onChange={(e) => setChoice(choice.key, 'text', e.target.value)}
                  />
                  <label className="flex shrink-0 items-center gap-1.5 text-xs text-ink-2">
                    <input
                      type="radio"
                      name="correct"
                      checked={isCorrect}
                      onChange={() => set('correctKey', choice.key)}
                    />
                    correct
                  </label>
                </div>
                {isCorrect ? (
                  <p className="m-0 text-xs text-ink-2">
                    The correct choice carries no misconception — the schema requires it to be null.
                  </p>
                ) : (
                  <textarea
                    aria-label={`Misconception for choice ${choice.key}`}
                    rows={2}
                    placeholder="I counted the squares I could see and stopped."
                    className={field}
                    value={choice.misconception}
                    onChange={(e) => setChoice(choice.key, 'misconception', e.target.value)}
                  />
                )}
              </div>
            );
          })}
          <Issues path="choices" />
        </fieldset>

        <fieldset className="m-0 grid gap-4 border-0 p-0">
          <legend className="mb-1 p-0 text-sm font-semibold text-ink">Skills</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={label} htmlFor="primarySkill">
                Primary skill
              </label>
              <p className={help}>
                One skill. If you cannot name it in four words, it is unfocused.
              </p>
              <input
                id="primarySkill"
                list="skill-ids"
                className={`${field} mono`}
                value={draft.primarySkill}
                onChange={(e) => set('primarySkill', e.target.value)}
              />
              <Issues path="skills.primary" />
            </div>
            <div>
              <label className={label} htmlFor="secondarySkills">
                Secondary skills
              </label>
              <p className={help}>
                Comma separated. Not padding — only what the problem really uses.
              </p>
              <input
                id="secondarySkills"
                className={`${field} mono`}
                value={draft.secondarySkills}
                onChange={(e) => set('secondarySkills', e.target.value)}
              />
              <Issues path="skills.secondary" />
            </div>
          </div>
          <datalist id="skill-ids">
            {knownSkillIds.map((id) => (
              <option key={id} value={id} />
            ))}
          </datalist>
        </fieldset>

        <fieldset className="m-0 grid gap-4 border-0 p-0">
          <legend className="mb-1 p-0 text-sm font-semibold text-ink">The hint ladder</legend>
          {(
            [
              ['hint1', 'Nudge', 'At most 15 words. Points attention, gives nothing away.'],
              [
                'hint2',
                'Strategy',
                'At most 40 words. Names the skill and why it applies. No arithmetic.',
              ],
              [
                'hint3',
                'Full solution',
                'Complete, with the figure, ending in the general principle.',
              ],
            ] as const
          ).map(([key, name, guidance]) => (
            <div key={key}>
              <label className={label} htmlFor={key}>
                {name}
              </label>
              <p className={help}>{guidance}</p>
              <textarea
                id={key}
                rows={2}
                className={field}
                value={draft[key]}
                onChange={(e) => set(key, e.target.value)}
              />
              <p className="mono mt-1 mb-0 text-2xs text-ink-3">
                {draft[key].trim() ? draft[key].trim().split(/\s+/).length : 0} words
              </p>
            </div>
          ))}
          <Issues path="hints" />
        </fieldset>

        <fieldset className="m-0 grid gap-4 border-0 p-0">
          <legend className="mb-1 p-0 text-sm font-semibold text-ink">
            Solutions and metadata
          </legend>
          <div>
            <label className={label} htmlFor="reliable">
              The reliable way
            </label>
            <p className={help}>
              The method that always works under time pressure, written for a tired student. End
              with the transferable idea.
            </p>
            <textarea
              id="reliable"
              rows={4}
              className={field}
              value={draft.reliable}
              onChange={(e) => set('reliable', e.target.value)}
            />
            <Issues path="solutions.reliable" />
          </div>
          <div>
            <label className={label} htmlFor="elegant">
              The elegant way{' '}
              <span className="font-normal text-ink-3">(leave empty if there isn&rsquo;t one)</span>
            </label>
            <textarea
              id="elegant"
              rows={2}
              className={field}
              value={draft.elegant}
              onChange={(e) => set('elegant', e.target.value)}
            />
            <Issues path="solutions.elegant" />
          </div>
          <div>
            <label className={label} htmlFor="whyOnTest">
              Why this is on the test
            </label>
            <p className={help}>One sentence, at most 200 characters.</p>
            <textarea
              id="whyOnTest"
              rows={2}
              className={field}
              value={draft.whyOnTest}
              onChange={(e) => set('whyOnTest', e.target.value)}
            />
            <Issues path="whyOnTest" />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className={label} htmlFor="estSeconds">
                Estimated seconds
              </label>
              <input
                id="estSeconds"
                type="number"
                min={20}
                max={300}
                className={field}
                value={draft.estSeconds}
                onChange={(e) => set('estSeconds', e.target.value)}
              />
              <Issues path="estSeconds" />
            </div>
            <div>
              <label className={label} htmlFor="author">
                Author
              </label>
              <input
                id="author"
                className={field}
                value={draft.author}
                onChange={(e) => set('author', e.target.value)}
              />
              <Issues path="author" />
            </div>
            <div>
              <label className={label} htmlFor="createdAt">
                Created
              </label>
              <input
                id="createdAt"
                type="date"
                className={field}
                value={draft.createdAt}
                onChange={(e) => set('createdAt', e.target.value)}
              />
              <Issues path="createdAt" />
            </div>
          </div>
        </fieldset>
      </form>

      {/* ------------------------------------------------------------ preview */}
      <div className="lg:sticky lg:top-20 lg:self-start">
        <div
          role="status"
          aria-live="polite"
          className={[
            'rounded-sm border p-4',
            result.ok ? 'border-correct bg-correct-bg' : 'border-rule bg-surface-2',
          ].join(' ')}
        >
          {result.ok ? (
            <p className="m-0 text-sm font-medium text-ink">
              Valid. This will pass <code className="mono">pnpm validate:content</code> unmodified.
            </p>
          ) : (
            <>
              <p className="m-0 text-sm font-medium text-ink">
                {result.issues.length} thing{result.issues.length === 1 ? '' : 's'} still to fix
              </p>
              <ul className="m-0 mt-2 grid list-none gap-1 p-0">
                {result.issues.slice(0, 8).map((issue) => (
                  <li key={`${issue.path}-${issue.message}`} className="text-xs text-ink-2">
                    <span className="mono mr-2 text-ink-3">{issue.path || '(file)'}</span>
                    {issue.message}
                  </li>
                ))}
              </ul>
              {result.issues.length > 8 ? (
                <p className="m-0 mt-2 text-xs text-ink-3">
                  and {result.issues.length - 8} more, mostly fields that are still empty
                </p>
              ) : null}
            </>
          )}
          <p className="mono mt-3 mb-0 text-2xs text-ink-3">{draftPath(draft)}</p>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={copyJson}
            className="cursor-pointer rounded-sm border border-rule-2 bg-surface px-4 py-2 text-sm text-ink"
          >
            {copied ? 'Copied' : 'Copy JSON'}
          </button>
          <a
            href={openPrUrl(repo, draft, result.json)}
            rel="noreferrer"
            aria-disabled={!result.ok}
            className={[
              'rounded-sm border px-4 py-2 text-sm no-underline',
              result.ok
                ? 'border-accent bg-accent-soft font-medium text-ink'
                : 'pointer-events-none border-rule text-ink-3 opacity-60',
            ].join(' ')}
          >
            Open a pull request
          </a>
        </div>
        <p className="mt-2 mb-0 text-xs text-ink-3">
          The pull request link opens GitHub&rsquo;s editor with the file named and filled in. No
          problem is ever written straight to a database — content arrives through git and through
          review.
        </p>

        {result.problem ? (
          <div className="mt-6">
            <h2 className="m-0 mb-3 text-sm font-semibold text-ink">
              Live preview — try a wrong answer
            </h2>
            <ProblemCardView problem={result.problem} headingLevel={3} showSkills={false} />
          </div>
        ) : (
          <details className="mt-6 rounded-sm border border-rule bg-surface px-3 py-2">
            <summary className="cursor-pointer text-sm text-ink-2">The JSON so far</summary>
            <pre className="mono mt-2 overflow-x-auto text-2xs text-ink-2">{result.json}</pre>
          </details>
        )}
      </div>
    </div>
  );
}
