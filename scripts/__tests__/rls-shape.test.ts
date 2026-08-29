import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  readMigrations,
  SERVICE_ROLE_ONLY_TABLES,
  STUDENT_OWNED_TABLES,
  stripSqlComments,
} from '../lib/sql-shape.ts';

/**
 * What this suite can and cannot do.
 *
 * It CANNOT prove that student A is unable to read student B's attempts. Only a running
 * Postgres can do that, and `supabase/tests/rls.test.sql` does it — but that needs a database,
 * so it is not part of `pnpm test`.
 *
 * It CAN prove the structural properties that, when they break, break silently and totally:
 * a table added later with no RLS, a policy that says `using (true)`, a `security definer`
 * function with an unpinned search_path. Those are the ones a reviewer's eye slides over.
 */

const MIGRATIONS = join(process.cwd(), 'supabase', 'migrations');
const shape = readMigrations(MIGRATIONS);

describe('every table denies by default', () => {
  it('creates the ten tables the data model specifies', () => {
    expect([...shape.tables].sort()).toEqual([
      'assignments',
      'attempts',
      'cohort_members',
      'cohorts',
      'journal_entries',
      'mastery',
      'parent_consents',
      'profiles',
      'runs',
      'teaching_sessions',
    ]);
  });

  it.each(shape.tables)('%s has row level security enabled', (table) => {
    expect(shape.rlsEnabled).toContain(table);
  });

  it('enables RLS in the same migration that creates the table', () => {
    // Deny-by-default has to hold at every point during a migration run, not only at the end.
    const files = [
      '001_profiles',
      '002_cohorts',
      '003_attempts',
      '004_mastery',
      '005_runs',
      '006_assignments',
      '007_journal',
      '008_sessions_log',
      '009_consent',
    ];
    for (const file of files) {
      const sql = stripSqlComments(readFileSync(join(MIGRATIONS, `${file}.sql`), 'utf8'));
      const created = [...sql.matchAll(/create\s+table\s+([a-z_]+)/gi)].map((m) => m[1]);
      const enabled = [...sql.matchAll(/alter\s+table\s+([a-z_]+)\s+enable\s+row\s+level/gi)].map(
        (m) => m[1],
      );
      for (const table of created) {
        expect(enabled, `${file} creates ${table} without enabling RLS`).toContain(table);
      }
    }
  });
});

describe('no policy is unconditionally permissive', () => {
  it.each(shape.policies.map((p) => [p.name, p] as const))(
    '%s is not open to everyone',
    (_name, policy) => {
      for (const clause of [policy.using, policy.withCheck]) {
        if (clause === null) continue;
        const normalised = clause.trim().toLowerCase();
        expect(normalised, `${policy.name} on ${policy.table}`).not.toBe('true');
        expect(normalised).not.toBe('1 = 1');
      }
    },
  );

  it('gives every policy a condition of some kind', () => {
    for (const policy of shape.policies) {
      expect(
        policy.using !== null || policy.withCheck !== null,
        `${policy.name} has neither USING nor WITH CHECK`,
      ).toBe(true);
    }
  });
});

describe('student-owned tables are owner-only', () => {
  it.each(STUDENT_OWNED_TABLES)(
    '%s covers all four operations, each scoped to the owner',
    (table) => {
      const own = shape.policies.filter((p) => p.table === table);
      const commands = own.map((p) => p.command).sort();
      expect(commands).toEqual(['delete', 'insert', 'select', 'update']);
      for (const policy of own) {
        const clause = `${policy.using ?? ''} ${policy.withCheck ?? ''}`;
        expect(clause, `${policy.name} must compare student_id with auth.uid()`).toMatch(
          /student_id\s*=\s*auth\.uid\(\)/,
        );
      }
    },
  );

  it.each(STUDENT_OWNED_TABLES)('%s has no policy that mentions a mentor', (table) => {
    // A mentor's only path to another person's data is the aggregate function. A row policy
    // here, however carefully worded, would hand over whole rows.
    for (const policy of shape.policies.filter((p) => p.table === table)) {
      const clause = `${policy.name} ${policy.using ?? ''} ${policy.withCheck ?? ''}`.toLowerCase();
      expect(clause, `${policy.name} references a mentor`).not.toMatch(/mentor/);
    }
  });
});

describe('profiles', () => {
  it('is owner-only, with no mentor row policy', () => {
    const own = shape.policies.filter((p) => p.table === 'profiles');
    expect(own.map((p) => p.command).sort()).toEqual(['delete', 'insert', 'select', 'update']);
    for (const policy of own) {
      const clause = `${policy.using ?? ''} ${policy.withCheck ?? ''}`;
      expect(clause).toMatch(/auth\.uid\(\)\s*=\s*id/);
    }
  });

  it('exposes a mentor only two columns, through a function rather than a policy', () => {
    // Section 2.1 allows display_name and band and "nothing else". RLS is row-level, so a row
    // policy would leak role and locale as well; a function returning named columns cannot.
    const roster = shape.functions.find((f) => f.name.endsWith('cohort_roster'));
    expect(roster).toBeDefined();
    expect(shape.sql).toMatch(
      /cohort_roster[\s\S]*?returns table \(student_id uuid, display_name text, band text, consent_on_file boolean\)/,
    );
    expect(roster?.body).not.toMatch(/\bp\.role\b|\bp\.locale\b|p\.\*/);
  });
});

describe('the service-role-only table', () => {
  it.each(SERVICE_ROLE_ONLY_TABLES)('%s has RLS on and no policy at all', (table) => {
    expect(shape.rlsEnabled).toContain(table);
    expect(shape.policies.filter((p) => p.table === table)).toEqual([]);
  });
});

describe('security definer functions', () => {
  const definers = shape.functions.filter((f) => f.securityDefiner);

  it('has at least the helpers and the two aggregate paths', () => {
    expect(definers.length).toBeGreaterThanOrEqual(5);
  });

  it.each(definers.map((f) => [f.name, f] as const))(
    '%s pins an empty search_path',
    (_name, fn) => {
      // Without this a caller can create their own `public` schema and change what the function
      // reads, while it runs with the owner's privileges. It is the standard escalation.
      expect(fn.searchPath, `${fn.name} must set search_path = ''`).toBe("''");
    },
  );

  it.each(definers.map((f) => [f.name, f] as const))(
    '%s schema-qualifies every table it reads',
    (_name, fn) => {
      // An empty search_path means an unqualified name does not resolve at all, so this is
      // also what makes the function work.
      const froms = [...fn.body.matchAll(/\b(?:from|join)\s+([a-z_.][a-z0-9_.]*)/gi)].map(
        (m) => m[1] ?? '',
      );
      for (const table of froms) {
        expect(table, `${fn.name} reads unqualified "${table}"`).toMatch(/^public\./);
      }
    },
  );

  it("re-checks the caller inside every function that reads other people's rows", () => {
    for (const name of ['cohort_skill_counts', 'cohort_roster']) {
      const fn = shape.functions.find((f) => f.name.endsWith(name));
      expect(fn, name).toBeDefined();
      // These run past RLS, so the ownership check inside the body is the ONLY thing standing
      // between a mentor and another mentor's class.
      expect(fn?.body, `${name} must re-check is_cohort_mentor`).toMatch(
        /public\.is_cohort_mentor\(/,
      );
    }
  });

  it('returns counts rather than rows from the aggregate path', () => {
    const fn = shape.functions.find((f) => f.name.endsWith('cohort_skill_counts'));
    expect(fn?.body).toMatch(/count\(/);
    expect(fn?.body).not.toMatch(/select\s+a\.\*|select\s+\*\s+from\s+public\.attempts/);
  });

  it('revokes the default execute-to-everyone on both aggregate functions', () => {
    for (const name of ['cohort_skill_counts', 'cohort_roster']) {
      expect(
        shape.revokedFromPublic.some((f) => f.endsWith(name)),
        name,
      ).toBe(true);
    }
  });
});

describe('the pgTAP proof exists and covers the claim that matters', () => {
  const proof = readFileSync(join(process.cwd(), 'supabase', 'tests', 'rls.test.sql'), 'utf8');

  it('asserts a mentor reading attempts directly gets zero rows', () => {
    expect(proof).toMatch(/a mentor reading attempts directly gets zero rows/);
  });

  it('asserts isolation between two students in the same cohort', () => {
    // SQL doubles an apostrophe inside a string literal, hence student''s.
    expect(proof).toMatch(/student A sees no other student''s attempts/);
    expect(proof).toMatch(/student B sees no other student''s mastery/);
  });

  it('asserts a mentor of another class gets nothing through the aggregate path', () => {
    expect(proof).toMatch(/returns nothing to a mentor who does not own the cohort/);
  });

  it('asserts account deletion really cascades', () => {
    expect(proof).toMatch(/cascades the attempts away/);
    expect(proof).toMatch(/cascades the consent record away/);
  });

  it('declares a plan matching the number of assertions it makes', () => {
    const planned = Number(/select plan\((\d+)\)/.exec(proof)?.[1] ?? '0');
    const assertions = [...proof.matchAll(/^\s*select (?:ok|is|throws_ok)\(/gm)].length;
    expect(planned).toBeGreaterThan(0);
    // pgTAP aborts on a plan mismatch, so a wrong number here fails the whole file the first
    // time it is ever run - which is exactly the sort of thing that is discovered months late.
    // The RLS-enabled check is one statement that produces one assertion per table.
    expect(assertions - 1 + 10).toBe(planned);
  });
});
