import {
  MAX_ATTEMPTS_PER_SKILL,
  buildProgressFile,
  cleanAttempt,
  cleanSession,
  normalizeSaved,
  normalizeSessions,
  parseProgress,
  type ProgressFile,
  type SessionRecord,
} from './local-progress';

/**
 * Merging two copies of a student's progress file: the one in this browser and the one synced
 * to their account. Used on both sides - the browser merges what the server sends, and the
 * server merges what a browser uploads - so a stale device can only ever add attempts, never
 * erase ones another device recorded.
 *
 * An attempt is identified by problem id plus timestamp. The union is sorted oldest first and
 * trimmed to the newest MAX_ATTEMPTS_PER_SKILL per skill, the same cap local-progress keeps.
 *
 * Test sessions (docs/07 section 5) merge the same way: union by `kind|exam|at`, known fields
 * only, oldest first, newest MAX_SESSIONS kept. A file with no sessions on either side merges
 * to a file with no `sessions` key, so older copies compare equal to themselves.
 *
 * Attempt timing (docs/08 item 9): `ms` and `mode` are known fields and survive the merge
 * when valid. When both copies hold the same attempt and only one has timing, the timed copy
 * wins, so a device that predates timing cannot strip it.
 *
 * Saved questions (docs/08 item 10): the union of both lists, `a`'s order first, deduplicated,
 * newest MAX_SAVED kept, and the key left out when both are empty. Unsaving on one device is
 * therefore undone by a merge with a copy that still has the id; docs/08 accepts that.
 */

type Attempt = ProgressFile['attempts'][string][number];

function attemptKey(attempt: Attempt): string {
  return `${attempt.problemId}|${attempt.at}`;
}

export function mergeProgress(a: ProgressFile, b: ProgressFile): ProgressFile {
  const skills = new Set([...Object.keys(a.attempts), ...Object.keys(b.attempts)]);
  const attempts: ProgressFile['attempts'] = {};
  for (const skill of [...skills].sort()) {
    if (skill.length > 64) continue;
    const byKey = new Map<string, Attempt>();
    for (const attempt of [...(a.attempts[skill] ?? []), ...(b.attempts[skill] ?? [])]) {
      // Copy only the known fields, so an upload cannot smuggle anything else into storage.
      const clean = cleanAttempt(attempt);
      if (!clean) continue;
      const key = attemptKey(clean);
      const held = byKey.get(key);
      if (!held || (held.ms === undefined && held.mode === undefined && hasTiming(clean))) {
        byKey.set(key, clean);
      }
    }
    const merged = [...byKey.values()].sort((x, y) =>
      x.at === y.at ? x.problemId.localeCompare(y.problemId) : x.at < y.at ? -1 : 1,
    );
    attempts[skill] = merged.slice(-MAX_ATTEMPTS_PER_SKILL);
  }
  const version = Math.max(a.version, b.version);
  const sessions = normalizeSessions(
    [...(a.sessions ?? []), ...(b.sessions ?? [])]
      .map(cleanSession)
      .filter((s): s is SessionRecord => s !== null),
  );
  const saved = normalizeSaved([...(a.saved ?? []), ...(b.saved ?? [])]);
  return buildProgressFile(version, attempts, sessions, saved);
}

function hasTiming(attempt: Attempt): boolean {
  return attempt.ms !== undefined || attempt.mode !== undefined;
}

/** Same attempts in both? Cheap enough at this size to compare canonical JSON. */
export function sameProgress(a: ProgressFile, b: ProgressFile): boolean {
  return JSON.stringify(mergeProgress(a, a)) === JSON.stringify(mergeProgress(b, b));
}

/** Upload limit. A full file is well under this; anything bigger is not a progress file. */
export const MAX_SYNC_BYTES = 512 * 1024;

/** Parse an untrusted upload with the same validator the browser uses on localStorage. */
export function parseUpload(raw: string): ProgressFile | null {
  if (raw.length > MAX_SYNC_BYTES) return null;
  try {
    JSON.parse(raw);
  } catch {
    return null;
  }
  return parseProgress(raw);
}
