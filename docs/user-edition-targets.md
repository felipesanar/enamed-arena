# F1-8: User Edition Targets

## Status And Sources

Implementation for review, not a production deployment. F0 has NOT been applied
in production. This job did not connect to a database or execute the SQL fixture.
The frontend tests use local doubles, not a live Supabase instance.

Sources inspected:

- `HANDOFF-2027.md`, F1-8 and `docs/contracts/editions-2027.md`.
- Sanitized `production-schema.json`, captured 2026-11-04, including both real
  `save_onboarding_guarded` overloads, guard/window definitions, ACLs and RLS.
- Existing F0 migrations and the parallel model migration
  `20261104065001_fase1_edition_model.sql` (subject to its own review).
- `perfil-academico-edit-lock-paridade.md` and `src/lib/editions.ts`.

## Database Contract

Apply `20261104072218_fase1_user_edition_targets.sql` AFTER all F0 migrations and
`20261104065001_fase1_edition_model.sql`. It fails early if the model's required
edition columns are absent. It neither implements nor backfills that model.
Reapplication retains data/history and enforces RPC-only student writes.

`onboarding_profiles.target_edition_id` is a nullable FK with `ON DELETE RESTRICT`.
`expected_graduation_term` accepts only null or `YYYY.1` / `YYYY.2`. Neither value
implies an official date, segment, specialty or a fourth-year mapping.

```sql
set_target_edition_guarded(
  p_edition_id uuid default null,
  p_expected_graduation_term text default null
) returns void
```

The RPC uses only `auth.uid()`. Null is undecided, not a request to assign a
default target. Existing onboarding status/completion and all academic fields
are preserved; a new profile retains the database's `pending` default. No
attempts, scores or segments are touched. Changing target is allowed during a
window. Advisory transaction locks serialize target/academic saves for the
same account, including concurrent first inserts.

History is appended only if either value actually changes, including a change
to null. Repeating the same pair is a no-op. A first undecided `(null,null)` call
creates a pending profile but no history: it changes neither preference.
Authenticated users can read only their own history. No public/anonymous read
or write, and no authenticated history insert/update/delete grant or policy.

The ENTIRE onboarding row is RPC-only for student writes. The migration revokes
table-level DML (including DELETE/TRUNCATE) and independent INSERT/UPDATE column
grants from PUBLIC, anon and authenticated, closing the real snapshot's broad
table grants plus own-row write policy bypass. Own-row SELECT remains governed
by the existing RLS policy. No authenticated UPDATE grant is added.

An **invoker** trigger additionally rejects ALL row INSERT/UPDATE/DELETE by an
ordinary caller, not just target changes, as defense in depth against accidental
future DML grants. It checks actual database `current_user` against the table
owner or real server `service_role`, never a JWT role or caller-settable GUC.
Guarded SECURITY DEFINER RPCs and real privileged server CRUD remain allowed;
claiming `service_role` in the JWT does not grant the underlying DB role.

## Guard And Save Parity

Private helpers accept a clock, never an arbitrary user ID. They resolve only
the authenticated user's edition:

1. Valid explicit target, including archived/closed editions.
2. Graduation term equal to the catalog `code`.
3. Closest non-closed/non-archived future exam date, including today in Sao Paulo.
4. Oldest undated `preparing`/`active` by year, term, code, ID.
5. Oldest undated `planned`; otherwise no edition.

Published windows use the existing inclusive start/end boundaries.
`get_onboarding_edit_guard_state`, `is_any_simulado_window_open` and both saves
share this resolution. `next_edit_available_at` is the earliest active window
end in that edition, preserving the existing multiple-window behavior. Another
edition's window does not lock the profile. With no resolved edition there is
no window lock. The guard requires authentication. The shared window helper
returns a locking end ONLY when the user's existing onboarding status is
`completed`; pending or absent onboarding has no academic edit lock.

The UUID and text saves keep their real parameter names and composite return
type, without new defaults or overloads. The text save delegates to the UUID
save. Institution IDs are deduplicated in first-occurrence order and validated
against the catalog; canonical names come from the database. Unknown text
values are rejected rather than silently dropped, with the existing
`Ainda nao sei` sentinel retained. No capability checks elsewhere are removed.
The usual blocking messages/reason remain unchanged.

First academic completion is allowed during a window, for both an absent row
and a `pending` row created earlier by target selection. Guard returns
`can_edit=true`, `reason=ok`, `next_edit_available_at=null` in those states.
The save completes the profile without losing its target; subsequent edits
lock while that edition's window remains open. Both saves serialize with target
changes using the same advisory transaction lock. This fixes the initial-save
regression identified in P1 review without trusting client-supplied status.

`is_any_simulado_window_open(timestamptz)` is no longer global; service callers
need a user claim to resolve an edition. The sanitized catalog and repository
show this helper as the academic-save guard. Review any out-of-repository
maintenance callers before deployment.

## Frontend Boundary

`userEditionsApi` has narrow, RPC/column-specific temporary types until database
types are generated. It does not calculate specialty, segment or dates.

`UserContext` exposes `saveTargetEdition(editionId, expectedGraduationTerm)`.
Only when `useAppConfig('editions_ui')` is true does it read the new columns or
allow the new RPC. The old profile queries and `saveOnboarding` argument shape
are unchanged with the flag off. A flag transition triggers a fresh mapping.

After a target save, the context refreshes the profile and edit guard and
invalidates React Query entries whose key contains the current account ID.
Global catalog entries are unchanged by a preference save. Session tokens and
request counters discard stale profile/guard/save completions after account,
logout/relogin, loading or flag transitions. The context does not optimistically
assign an edition or alter `onboarding_completed`.

## Analytics

P1 supplied the committed `target_edition_set` event name in `analytics.ts`.
This job does not edit that contract or the other job's Zod schema.
After a confirmed target RPC, profile/guard refresh and account-scoped cache
invalidation, the context looks up the selected ID in the typed
`editionsApi.getExamEditions()` catalog and emits only `{edition_code: code}`.
A null selection emits `{edition_code: null}` without fetching the catalog or
inferring an edition from the graduation term. No UUIDs are sent in the payload.

Missing catalog rows/read failures skip the event rather than inventing a code.
Catalog/analytics exceptions do not reject or undo the successful preference
write. A session-token check after every asynchronous boundary discards telemetry
if logout, account or flag changes occurred, including while reading the catalog.
UI/onboarding components and generated database types remain outside this job.

## Validation And Rollback

Frontend TDD: tests were run before implementation (missing service/method and
mapping failed). An additional auth-loading race was reproduced red and fixed.
P1 analytics regressions were also observed red before implementation.
Final scoped run: 21 tests passed, zero failed, exit 0. Scoped ESLint: exit 0,
no errors; existing `any` and mixed-export warnings remain in UserContext.
Run only the task's tests:

```text
npm exec -- vitest run src/services/userEditionsApi.test.ts src/contexts/UserContext.test.tsx --silent
```

The SQL fixture is `supabase/tests/fase1_user_edition_targets.sql`. Run ONLY in
a disposable database after the required migrations, as database owner with
the Supabase auth schema/roles or explicitly documented local doubles:

```text
psql -v ON_ERROR_STOP=1 -f supabase/tests/fase1_user_edition_targets.sql
```

It uses a transaction and ends in ROLLBACK. Tests cover owner spoofing (including
a forged JWT role), direct student INSERT/UPDATE/DELETE denial, real server CRUD,
immutable history, other account/anon access,
idempotence, undecided null, validation, resolver ordering, guard/save/text-save
parity, another edition's open window, target change during a window,
preservation of completion, first completion during a window with absent or
target-created pending onboarding, and unchanged segments and attempt/score
records. The isolated resolver oracle temporarily alters seed
statuses in a nested rollback block; never run it on production.

**SQL execution, migration reapplication, PostgREST dispatch, full typecheck and
the global suite remain pending the orchestrator's disposable DB/integration
validation.** A fixture file is not evidence of SQL passing. Local doubles do
not prove managed Auth/Supabase integration or concurrent database behavior.

The migration contains a data-preserving rollback procedure: disable the UI
flag and restore guard/window/save definitions together from the pre-deploy
catalog, retaining target columns, FK, history, write guard and RLS. Do not drop
data, rewrite attempts or clear preferences as a rollback shortcut.
