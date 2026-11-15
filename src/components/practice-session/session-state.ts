import type { ChoiceKey } from '@/lib/schemas';
import type { PracticeItem } from '@/lib/practice-item';

/**
 * The practice session's state, as a pure reducer, so every rule below is testable without
 * rendering anything.
 *
 *   pick       choose a letter. Not an answer yet: nothing is judged until Check.
 *   check      judge the current pick. The FIRST check of a question is the attempt that is
 *              scored and recorded; later checks only give feedback, so changing an answer
 *              after reading the misconception cannot turn a miss into a solve.
 *   hint       a rung of the hint ladder was opened.
 *   mark       flag the question for review (test-style), unrelated to correctness.
 *   go         move to another question.
 *   finish     end screen; `resume` goes back to the questions.
 */

export interface QuestionState {
  /** The letter currently picked, judged or not. */
  selected: ChoiceKey | null;
  /** The letter most recently judged by Check. */
  checked: ChoiceKey | null;
  /** Result of the first Check. Null until the question has been checked once. */
  firstCorrect: boolean | null;
  /** Hints open at the moment of the first Check. */
  hintsAtFirstCheck: number;
  /** Has any Check been correct. */
  solved: boolean;
  /** Hint rungs opened, 0-3. */
  hints: number;
  marked: boolean;
}

export interface SessionState {
  index: number;
  finished: boolean;
  questions: QuestionState[];
}

export type SessionAction =
  | { type: 'pick'; key: ChoiceKey }
  | { type: 'check'; correct: boolean }
  | { type: 'hint'; level: number }
  | { type: 'mark' }
  | { type: 'go'; index: number }
  | { type: 'finish' }
  | { type: 'resume'; index?: number };

export const EMPTY_QUESTION: QuestionState = {
  selected: null,
  checked: null,
  firstCorrect: null,
  hintsAtFirstCheck: 0,
  solved: false,
  hints: 0,
  marked: false,
};

export function initialSession(count: number): SessionState {
  return {
    index: 0,
    finished: false,
    questions: Array.from({ length: count }, () => ({ ...EMPTY_QUESTION })),
  };
}

function updateCurrent(
  state: SessionState,
  change: (question: QuestionState) => QuestionState,
): SessionState {
  const current = state.questions[state.index];
  if (!current) return state;
  const questions = [...state.questions];
  questions[state.index] = change(current);
  return { ...state, questions };
}

export function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case 'pick':
      return updateCurrent(state, (q) => ({ ...q, selected: action.key }));
    case 'check':
      return updateCurrent(state, (q) => {
        if (q.selected === null) return q;
        const first = q.firstCorrect === null;
        return {
          ...q,
          checked: q.selected,
          firstCorrect: first ? action.correct : q.firstCorrect,
          hintsAtFirstCheck: first ? q.hints : q.hintsAtFirstCheck,
          solved: q.solved || action.correct,
        };
      });
    case 'hint':
      return updateCurrent(state, (q) => ({
        ...q,
        hints: Math.max(q.hints, Math.min(3, Math.max(0, action.level))),
      }));
    case 'mark':
      return updateCurrent(state, (q) => ({ ...q, marked: !q.marked }));
    case 'go':
      if (action.index < 0 || action.index >= state.questions.length) return state;
      return { ...state, index: action.index, finished: false };
    case 'finish':
      return { ...state, finished: true };
    case 'resume':
      return {
        ...state,
        finished: false,
        index:
          action.index !== undefined && action.index >= 0 && action.index < state.questions.length
            ? action.index
            : state.index,
      };
    default:
      return state;
  }
}

/** Has this question been answered (checked at least once)? */
export const isAnswered = (question: QuestionState): boolean => question.firstCorrect !== null;

export type QuestionOutcome = 'first-try' | 'after-miss' | 'missed' | 'unanswered';

export function outcomeOf(question: QuestionState): QuestionOutcome {
  if (question.firstCorrect === null) return 'unanswered';
  if (question.firstCorrect) return 'first-try';
  return question.solved ? 'after-miss' : 'missed';
}

export const OUTCOME_LABEL: Record<QuestionOutcome, string> = {
  'first-try': 'Right first time',
  'after-miss': 'Right after a miss',
  missed: 'Missed',
  unanswered: 'Not answered',
};

export interface GroupResult {
  id: string;
  name: string;
  correct: number;
  total: number;
}

export interface SessionSummary {
  total: number;
  /** Right on the first Check. This is the set's score. */
  correct: number;
  answered: number;
  unanswered: number;
  /** Ids not right first time, unanswered included: the "Review missed" set. */
  missedIds: string[];
  /** By each item's primary group (skill or topic), in first-seen order. */
  groups: GroupResult[];
}

export function summarize(items: readonly PracticeItem[], state: SessionState): SessionSummary {
  const groups = new Map<string, GroupResult>();
  let correct = 0;
  let answered = 0;
  const missedIds: string[] = [];
  items.forEach((item, index) => {
    const question = state.questions[index] ?? EMPTY_QUESTION;
    const right = question.firstCorrect === true;
    if (right) correct += 1;
    else missedIds.push(item.id);
    if (isAnswered(question)) answered += 1;
    const primary = item.groups[0] ?? { id: item.id, name: item.id };
    const entry = groups.get(primary.id) ?? { ...primary, correct: 0, total: 0 };
    entry.total += 1;
    if (right) entry.correct += 1;
    groups.set(primary.id, entry);
  });
  return {
    total: items.length,
    correct,
    answered,
    unanswered: items.length - answered,
    missedIds,
    groups: [...groups.values()],
  };
}

/** "4:05", or "1:02:09" past an hour. */
export function formatClock(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = String(seconds % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

/** "4 minutes 5 seconds", for screen readers and the end screen. */
export function spokenDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  const part = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'}`;
  if (m === 0) return part(s, 'second');
  return s === 0 ? part(m, 'minute') : `${part(m, 'minute')} ${part(s, 'second')}`;
}
