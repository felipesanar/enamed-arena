# Admin session rules: server runbook

Scope: F2-4/A05-A08, server only. No production execution or deployment was
authorized. Frontend forms and generated Supabase types are unchanged.
The detailed interface contract is in `contracts/admin-session-rules-2027.md`.

Delivery gate from Codex review: both new Edge tests must pass the standard
`vitest.config.ts` used by CI. This gate now passes: the tests inherit the
configured environment rather than overriding it with Node and breaking the
shared DOM setup. No production handlers, SQL or global test setup/config were
changed for this integration correction.

## Authorization and audit

- Verification Edges require a real JWT, `getUser`, then `content.manage` via
  the JWT client. They audit the request before model execution. Audit failure
  returns 500 without calling the model; payload metadata contains only counts.
- User deletion requires `users.manage`, validates the target UUID and forbids
  self-deletion. Its JWT audit records an intent, not a successful deletion:
  Supabase Auth deletion is not part of the SQL transaction.
- Window preview/apply requires both `content.manage` and `attempts.manage`.
  The actor is `auth.uid()`, never a supplied actor or the service identity.
- Direct authenticated date changes on a simulado with attempts are rejected,
  including editors whose RLS cannot see those attempts and spoofed GUCs.
  The INVOKER guard trusts effective privileged SQL roles; new DEFINER date
  writers must meet the same window contract before being exposed.

## Session rules

`presencial_sessions.ranking_rule` defaults to `legacy_online_window`.
`session_window_v1` requires check-in and submission inside the frozen session
window (inclusive endpoints), independently of the online window.

The administrative upsert adds a final nullable `p_ranking_rule`; the original
eight-argument call remains valid. NULL preserves an existing rule or selects
legacy for a new session. The list RPC includes `ranking_rule` as its final
column. There is no ambiguous overload.

The supervised Edge passes the server-resolved session ID to the service-only
`create_or_convert_presencial_attempt_for_session` RPC. New participation or
conversion freezes its first valid session in private RLS-protected tables.
Retry cannot retarget it. A legacy presencial retry without a snapshot stays
legacy: there is no historical backfill. Unlinked submissions freeze on insert
and propagate that snapshot on late link. Reassignment preserves provenance.

Authenticated `offline` attempts with a caderno are a separate flow, retaining
their existing exception. Session rule changes do not rewrite historical
attempts, scores, answers, academic snapshots, deadlines or finish times.
Only auxiliary attempt/submission snapshot FKs use CASCADE; F0 academic
RESTRICT constraints remain unchanged and students gain no delete access.

## Explicit Window Changes

1. Call `admin_preview_simulado_window(simulado_id, start, end, release)`.
2. Review aggregate counts and retain `current_window_hash`.
3. Call `admin_update_simulado_window(simulado_id, start, end, release, hash, reason)`.

Validation requires `start < end <= release` and a nonblank reason up to 2000
characters. Apply locks the parent, then attempts in ID order with NOWAIT;
dates, eligibility flags, operation checkpoint and audit commit atomically.
Online eligibility uses start time; completed offline eligibility uses the
existing submission/caderno semantics; v1 presencial uses the frozen session.
An in-progress offline/presencial attempt retains its current flag.

`40001` stale hash requires a new preview and review, not blind resubmission.
`55P03` means a concurrent creator/save/finalizer holds an incompatible lock;
no partial operation is committed. Retry only after the competing transaction
finishes, with a reviewed preview. Creation RPCs lock the parent before reading
dates so a new attempt cannot commit old eligibility after an edited window.

## Local Validation

The primary, durable Edge test command uses the repository's standard CI config,
from the worktree root:

```powershell
node node_modules/vitest/vitest.mjs run --config vitest.config.ts supabase/functions/_shared/adminAuthorization.test.ts supabase/functions/presencial/sessionRules.test.ts --maxWorkers=2
```

It runs all 24 tests under the default jsdom environment and shared setup.
No ignored launcher, excluded tests or global setup changes are required to
publish or verify these tests. The optional isolated Node launcher also passes:

```powershell
node node_modules/vitest/vitest.mjs run --config .superpowers/admin-sessionQA/vitest.config.ts supabase/functions/_shared/adminAuthorization.test.ts supabase/functions/presencial/sessionRules.test.ts --maxWorkers=2
```

All SQL testing used disposable `enamed_test_admin_session_*` clones on
`127.0.0.1:54737`, with both session and effective user `postgres`.
SQL fixtures and the concurrency runner verify the target before writes.
Never run these tests against the integrated template or a real environment.
Do not replace or delete existing clones to rerun a test; inspect or create a
new uniquely named clone from the reviewed baseline.

PowerShell commands from the worktree root (existing local PostgreSQL binary):

```powershell
$psql = '../../fase0-2027/.superpowers/editions/pg17-1260616/pgsql/bin/psql.exe'
$db = 'enamed_test_admin_session_integrated_41d1'
& $psql -X -h 127.0.0.1 -p 54737 -U postgres -d $db -v ON_ERROR_STOP=1 -q -f .superpowers/admin-sessionQA/apply.sql
& $psql -X -h 127.0.0.1 -p 54737 -U postgres -d $db -v ON_ERROR_STOP=1 -q -o NUL -f supabase/tests/fase2_admin_session_rules.sql
$env:ADMIN_SESSION_TEST_DB = $db
node --test scripts/sql-local/admin-session-concurrency.test.mjs
```

The local `.superpowers/admin-sessionQA` directory is ignored by Git. Its
`apply.sql` checks database prefix, host, port, session user and current user in
a DO block before including the migration. Its Vitest config sets
`envFile: false`, `test.environment: 'node'`, includes only the two Edge test
files above and uses two workers. This isolated configuration avoids loading
`.env` or React setup. It is a local convenience, not a CI or publication
requirement; the standard config command above is authoritative. Neither
launcher imports external Edge dependencies because the tests use local ports.
The durable SQL/concurrency tests are versioned outside that directory; the
guarded SQL apply launcher is also only a local maintenance convenience.

The SQL fixture normally ends with ROLLBACK. Installation rollback/reapply is
an additional opt-in phase in the same versioned file. Use a fresh, already
migrated disposable clone without any v1 snapshots or `rb:*` fixtures:

```powershell
& $psql -X -h 127.0.0.1 -p 54737 -U postgres -d enamed_test_admin_session_rollback3_41d1 -v ON_ERROR_STOP=1 -v test_installation_rollback=1 -q -o NUL -f supabase/tests/fase2_admin_session_rules.sql
```

The presence of `test_installation_rollback` enables that phase. It COMMITs
legacy fixtures so the actual migration transaction can run, and leaves them
in the clone. Do not rerun the opt-in phase on the same populated clone.

The sanitized integrated template lacks `backup.presencial_superseded_answers`.
The concurrency runner restores exactly its canonical schema/table DDL from
`20260812100000_presencial_schema.sql`, only after the clone guards pass.
It does not skip conversion or substitute another backup implementation.
The runner leaves uniquely named fixtures in its disposable clone.

## Results

- CI integration RED reproduced with the standard config: 2 failed suites,
  0 tests executed, `window is not defined` at `src/test/setup.ts:3`.
  Removing only the Node environment directive from each new test fixes the
  conflict without changing assertions, mocks, includes or global setup.
- Edge Vitest after the final test edit: standard `vitest.config.ts` passed
  2 files / 24 tests; isolated `.superpowers/admin-sessionQA/vitest.config.ts`
  also passed 2 files / 24 tests. Real handlers are transpiled with local fake
  ports; this is not a deployed Deno/network integration test.
- SQL and concurrency results below are from the completed server validation.
  Neither SQL nor the concurrency runner was rerun during this final CI-only
  correction; independent final SQL validation remains with the reviewer.
- Node concurrency: 2 passed, 0 skipped with the database opt-in enabled.
  Real lock waits are checked with `pg_stat_activity`/`pg_blocking_pids`;
  tests cover creator/apply in both directions, answer/finalizer NOWAIT,
  concurrent first check-in, conversion backup and preserved grades.
- Transactional SQL assertions passed on the integrated clone: capabilities,
  defaults/list, boundaries, late link, legacy retry, immutable provenance,
  reassignment, spoofed GUC, stale hash, audit-failure atomicity, rollback of
  an operation, v1 installation-rollback refusal and auxiliary CASCADE.
- Full installation rollback/reapply passed on
  `enamed_test_admin_session_rollback3_41d1`: original definitions/owner/ACL,
  drift refusal, service ACL fencing/restoration, grades, answers and snapshots.
- Initial rollback/reapply exposed search-path-dependent function type
  rendering in the checkpoint comparison. The comparison now uses the same
  `pg_catalog,public` context as restore; the regression is covered above.
- Expected local HubSpot Vault warnings reported that no outbound request was
  queued. No credentials were read or configured for these tests.
- No full build, full test suite, global typecheck, production test or deploy
  was run. No package installation, commit or push was performed.

## Manual Rollback

These entry points are private and owner-only, not public maintenance APIs.
Use a reviewed maintenance transaction and authenticated administrator identity.

For a specific window operation:

```sql
BEGIN;
SELECT set_config('request.jwt.claim.sub', '<verified-admin-uuid>', true);
SELECT admin_session_private.rollback_window_operation('<operation-uuid>');
COMMIT;
```

The function also requires both capabilities. It restores only the old window
and flags, writes a reversal operation and audit, and refuses changed dates,
flags or attempt membership. Refusal means review a new preview/apply rather
than overwriting later work. Never forge an actor for an unapproved operation.

For installation rollback, coordinate reverting the Edge caller first because
the session-aware RPC will lose service EXECUTE. In an approved maintenance
transaction call `admin_session_private.rollback_installation()`. It validates
installed definition hashes before restoration, restores original definitions,
owners and grants, and fences the new public RPCs. Any active v1 snapshot
refuses rollback rather than silently falling back to legacy semantics.
Private checkpoints, snapshots, added rule column and integrity guards remain.
Do not delete provenance or weaken F0 triggers to force rollback through.

Reapplying the reviewed migration restores the installation, validates original
definition/owner/ACL checkpoints and grants the intended callers again. Hash
gates intentionally reject unknown baselines; inspect differences and obtain
review instead of updating expected hashes to bypass the gate.

## Independent Codex review

After the final scoped CI correction, Codex ran all 24 handler tests with the
standard repository Vitest configuration successfully. Native Deno 2.9.8
typechecks passed for all four changed Edge Functions using the warmed cache.
On a separate fresh clone, `enamed_test_admin_session_finalreview1356`, the
migration, transactional assertions and opt-in installation rollback/reapply
all passed with PostgreSQL assertions enabled. The real concurrency runner
then passed both tests without skips, including the canonical conversion
backup. The ten SQL/script/handler/test source hashes stayed unchanged across
verification and after the job stopped. These checks did not execute any
operation on production.
