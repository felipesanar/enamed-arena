# F1-9: attempt concurrency and captured integrity counters

## Scope and decisions

- Contract: `docs/contracts/attempt-reliability-2027.md` and HANDOFF F1-9. No production access, legacy backlog finalization, status/metadata integration, UI or shared type changes.
- Source inspected programmatically: the selected `create_attempt_guarded` and `update_attempt_progress_guarded` definitions, ACLs, and attempt indexes/constraints in the production-schema.json supplied in the job. The full snapshot was not printed or copied into the repo.
- Real uniqueness is `attempts_simulado_user_type_key (simulado_id,user_id,attempt_type)`. It already exists; no duplicate index or new retry policy is introduced.
- Creation retains published/test eligibility, presencial precedence, online-only lookup, offline coexistence, existing in-progress resume and rejection of submitted/expired attempts. Before opening it now rejects without inserting. Official deadlines use `LEAST(personal,window_end)`; late training uses the personal deadline and is excluded from ranking.
- The insert uses `ON CONFLICT ON CONSTRAINT ... DO NOTHING`. A separate `SELECT ... FOR UPDATE` sees the winning committed row under READ COMMITTED; a same-statement CTE would not guarantee this fresh snapshot. Finalized conflicts are rejected, never returned as a blank composite. Existing higher-isolation serialization errors remain server errors, not a new client retry mechanism.
- Progress RPC signatures, ownership, in-progress predicate, protected fields and original input acceptance remain unchanged. Only the exit counters become `GREATEST(stored,incoming)`; navigation is deliberately not made monotonic.
- Storage increments each event once, taking high-water marks from the captured attempt's latest snapshot and the supplied React state. It returns that captured state. The integrity hook merges these values with functional `setState`, outside which persistence and telemetry execute only once. React updater replay cannot write twice. Old queued updaters cannot change a different simulado/attempt. Existing immutable operation capture and request retry queues are preserved.
- `useExamFlow` supplies the existing synchronized `now` for telemetry. No timer reset, client score calculation or new clock is introduced.
- Migration `20261104083727_fase1_attempt_reliability.sql` uses the real UTC time observed at creation. It is reappliable; first function definitions are retained in a private RLS-protected rollback checkpoint. The commented rollback restores definitions and the observed original ACLs without deleting attempts, answers or results.

## Local environment

Only `127.0.0.1:54737`, SQL user `postgres`, database `enamed_test_attempt_f1_20261104_0837` was mutated. It was created with `createdb --template=enamed_test_f1_target_review_20261104`, preserving the supplied Unicode F0 + auditfix + F1 model/target environment. No other job's database was changed.

The clone inherits explicit local managed-service doubles from `supabase/tests/local/bootstrap.sql`: Auth SQL helpers driven by settings, inert HTTP/Vault interfaces and a cron catalog double. Warnings about the absent local HubSpot secret are expected; no outbound request is sent. This is **not** a real Supabase Auth, JWT-validation, REST/PostgREST or scheduler end-to-end test. PostgreSQL transactions, RLS, constraints, answer triggers and finalization RPCs are real. No RLS relaxation or trigger disabling was used.

The SQL fixture rolls back. Cross-session fixtures must be committed to be visible: the coordinator deletes only its synthetic user/simulados in `finally`, in FK-safe order, clearing its Auth settings before cleanup. Audit-trigger history can remain in this disposable database. The database itself is retained for review, not dropped automatically.

## Two-session evidence

The coordinator starts exactly two persistent `psql.exe` children. Client writes and finalization run after `SET ROLE authenticated`. Only fixture setup/cleanup and observation use the local owner role. Each observed barrier requires the waiting backend's `wait_event_type='Lock'` and the holder PID in `pg_blocking_pids(waiter_pid)`, restricted to the current database and exact application name. Polling checks this condition; a fixed delay is never accepted as proof.

Transactions are deliberately overlapped: A creates but has not committed when B invokes creation; B has no visible existing row and waits at uniqueness enforcement. A commits only after observing B blocked. Both callers must return the same non-null ID and the database must contain one row.

Four real lock barriers passed:

| Holder A | Waiting B | Database assertion after A commits |
| --- | --- | --- |
| Uncommitted guarded creation | Guarded creation | One ID, one row |
| Progress counters 25 / 17 | Old counters 1 / 2 | Counters remain 25 / 17 |
| Persisted correct answer holding parent lock | Real finalization RPC | Score 100, one correct, one answered; repeat finalization returns 100 |
| Real finalization RPC with score zero, not yet committed | Answer insert | After confirmed commit: `online attempt is not in progress`, psql exit 3; zero answers and repeat RPC score zero |

Only the RPC computes scores. The script compares returned and persisted values, not a mock or a client formula. Statement timeout is 6 seconds, lock timeout 5 seconds, barrier deadline 4 seconds, client-query timeout 10 seconds and idle-in-transaction timeout 15 seconds. Cleanup closes only the exact children this invocation spawned; no process-name kill is used.

## Commands and results

Run from this worktree. PowerShell setup (existing binaries and parent locations only):

```powershell
$pg = 'C:/Users/felipe.souza/Documents/Projetos (Sanar)/enamed-arena/.claude/worktrees/fase0-2027/.superpowers/editions/pg17-1260616/pgsql/bin'
$db = 'enamed_test_attempt_f1_20261104_0837'
# Already executed once; do not recreate/overwrite an existing review database.
& "$pg/createdb.exe" -w -h 127.0.0.1 -p 54737 -U postgres --maintenance-db=enamed_test_f1_target_review_20261104 --template=enamed_test_f1_target_review_20261104 $db

# Reapplication was explicitly tested with the same migration twice.
& "$pg/psql.exe" -X -w -h 127.0.0.1 -p 54737 -U postgres -d $db -v ON_ERROR_STOP=1 -f supabase/migrations/20261104083727_fase1_attempt_reliability.sql -f supabase/migrations/20261104083727_fase1_attempt_reliability.sql -f supabase/tests/fase1_attempt_reliability.sql

node scripts/sql-local/attempt-concurrency.mjs enamed_test_attempt_f1_20261104_0837
node -e "process.env.ATTEMPT_CONCURRENCY_DATABASE='enamed_test_attempt_f1_20261104_0837'; import('./scripts/sql-local/attempt-concurrency.test.mjs');"
node node_modules/vitest/vitest.mjs run src/hooks/exam/useExamIntegrity.test.ts src/hooks/useExamStorageReal.test.tsx src/hooks/useExamFlow.test.tsx
node node_modules/eslint/bin/eslint.js src/hooks/exam/useExamIntegrity.ts src/hooks/exam/useExamIntegrity.test.ts src/hooks/useExamFlow.ts src/hooks/useExamFlow.test.tsx src/hooks/useExamStorageReal.ts src/hooks/useExamStorageReal.test.tsx scripts/sql-local/attempt-concurrency.mjs scripts/sql-local/attempt-concurrency.test.mjs
```

Observed 2026-11-04:

- Initial hook TDD run: exit 1, 5 failing / 37 passing. Failures covered absent tab state update, clock wiring, missing-state behavior and burst snapshot return. Final run: exit 0, **43 passing / 0 failing** (3 files), including real storage + integrity-hook batched mixed bursts (8 tab, 3 fullscreen), stale cache-save high-water marks and existing identity/clock/finalization regressions.
- Initial SQL run before migration: exit 3, failed `before opening rejected`. Final fixture: exit 0, **22 local assertions / 0 failures**, `ROLLBACK`. Covers opening, official/training deadlines, idempotent ID, ownership, auth absence, missing simulado, offline coexistence, presencial precedence, submitted/expired rejection, burst monotonicity, protected fields and private ACLs.
- Migration applied twice: exit 0; first checkpoint remains intact. Commented rollback mechanism was exercised only in this exclusive database by restoring its saved definitions. Running the real coordinator then reproduced the old duplicate-key failure: parent exit 1, waiting psql exit 3, `attempts_simulado_user_type_key`. Reapplying the migration restored the passing state.
- Coordinator: exit 0, two connections, all four observable barriers and grade assertions pass. Node test file with explicit database setting: exit 0, **2 passing / 0 failing / 0 skipped**. Without the explicit database setting the real-database case is intentionally skipped, never silently represented as executed.
- Restricted ESLint: exit 0, zero errors; one pre-existing `no-explicit-any` warning in the answer-confidence mapping of `useExamStorageReal.ts` (outside counter integration).
- Early coordinator iterations exposed insufficient stats visibility under the client role and FK/audit cleanup ordering. Observation now temporarily resets the holder role, then restores authenticated; cleanup deletes the user before simulados and clears Auth settings. Final repeat runs pass with fixtures cleaned.

No full test suite, global typecheck, build, package installation, network/API operation or git mutation was performed. Full integration review and commit remain the orchestrator's responsibility.
