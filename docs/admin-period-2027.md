# Administrative Edition And Period Reports

## Scope

Implements `docs/contracts/admin-period-2027.md` only in SQL. No frontend, Edge,
public/student gates, finalizers, reprocessing, in-person sessions or deployment.
`editions_ui` does not change these SQL signatures; frontend opt-in is future work.

Sources inspected: `HANDOFF-2027.md` F2-4, edition contracts and the originating
worktree's `.superpowers/editions/admin-period-sql.md`. A separately named
`HANDOFF-2027F2-4` was not present. Only the seven function objects were extracted
from the read-only `fase1-edicoes/.superpowers/editions/production-schema.json`.
Their UTF-8 definition hashes match `pg_get_functiondef` in the supplied local
F0+F1 model/target/admin catalog. No production connection or credential was used.

## Signatures

Every existing argument/default remains in its original position. The following
three arguments are appended to each function:

```sql
p_edition_id uuid DEFAULT NULL,
p_start_at timestamptz DEFAULT NULL,
p_end_at timestamptz DEFAULT NULL
```

| RPC | Preserved leading arguments |
| --- | --- |
| `admin_score_evolution` | none |
| `admin_segment_breakdown` | none |
| `admin_cohort_retention` | `p_months integer DEFAULT 6` |
| `admin_intel_insights` | none |
| `admin_score_distribution` | `p_simulado_id uuid DEFAULT NULL` |
| `admin_performance_by_area` | `p_simulado_id uuid DEFAULT NULL, p_segment text DEFAULT 'all'` |
| `admin_performance_by_theme` | `p_simulado_id uuid DEFAULT NULL, p_area text DEFAULT NULL, p_limit integer DEFAULT 12` |

Only one public signature exists per name: old signatures are removed with
`DROP FUNCTION ... RESTRICT`, never `CASCADE`. Legacy named/positional/defaulted
calls remain valid. The fixture checks SQL-level overload uniqueness and named
arguments, not an actual PostgREST schema-cache refresh or HTTP dispatch.

All previous result columns and types are retained. Evolution appends
`edition_id uuid, edition_code text, edition_label text`, and orders by edition
year/term/id, sequence and simulado id. Sequences restart within an edition;
sequence 1 from two editions produces two distinguishable rows.

## Filter Semantics

- Attempts are scoped through their actual simulado's edition, and through
  `coalesce(started_at, created_at)` in `[start,end)`. Either bound can be NULL.
  The real catalog has NOT NULL `started_at`; the fallback is defensive.
- Both non-NULL bounds with `start >= end` raise `22023`, after authorization.
  `admin_intel_insights` no longer catches SQL errors as an empty/healthy report.
- History is scoped through its attempt and simulado before aggregation or
  latest/previous selection. AQR queries also scope the question's simulado,
  defending against a cross-edition question attached to a valid attempt.
- All existing simulado/segment/area/limit conditions are retained. An explicit
  simulado from another edition produces empty area/theme results and ten zero
  histogram buckets; it is never silently ignored.
- Edition population is explicit onboarding target OR scoped activity, counted
  once per profile. There is no inference from profile year, graduation term or
  current edition. Targets without attempts count; undecided inactive users do
  not. Activity-only users count even without a target.
- With no edition but an explicit interval, population is registration within
  the interval OR activity within the interval. With all new arguments NULL,
  population is unchanged. Existing segment/cohort internal-account exclusions
  remain in their original queries.
- Cohort month remains the original profile registration month in
  `America/Sao_Paulo`. An explicit bound replaces the automatic `p_months`
  population window; old registrations can therefore contribute through scoped
  activity or edition targeting without being moved to an activity-month cohort.
  With neither bound, the original `p_months` window remains in force.
- An explicit interval also replaces insights' automatic 30-day engagement
  window and automatic mature-cohort window. Otherwise those windows remain.

No status/modality definition is silently normalized across reports. In
particular, segment/cohort valid completion and average scores use submitted,
within-window attempts; cohort started includes training. Evolution/histogram
keep their existing history + within-window semantics. Area/theme keep
submitted/expired, within-window, answered-only semantics. Insights retain their
original per-metric modalities, including training in the historical
latest/previous comparison and all statuses in engagement. The fixture verifies
this distinction (85 to 60 in insights, while evolution is 80 to 60).

Raw percentage averages are not normalized across editions. If scoped history
contains multiple editions, `score_decline` and `participation_drop` are
suppressed, rather than comparing unrelated exam sequences. With one edition
they retain their legacy IDs and thresholds. Other insights remain aggregate
within the requested scope; no per-edition IDs are fabricated.

## Migration And Recovery

`20261104115402_fase2_admin_period.sql` includes its own `BEGIN/COMMIT`, so plain
`psql -f` is atomic even without `--single-transaction`. It expands the verified
real definitions rather than replacing the surrounding business formulas with
new handwritten versions. The seven source hashes are pinned: missing objects,
extra overloads or definition drift abort the transaction for review.

Within the replacement transaction it records the original definition, owner, input
identity, expanded identity, ACL replay SQL and installed definition hash in
`admin_period_private.checkpoints`. The schema/table are postgres-owned, with
RLS and FORCE RLS, no policies and no client grants. New functions' inherited
default-privilege grants are removed before the exact original ACL is replayed;
this matters because the local catalog grants `anon` in default privileges.
`intel.view` and the existing authenticated/service_role ACL are preserved.

A complete active checkpoint makes subsequent application a public-function
no-op, preserving future definition changes and original backup rows. Partial
or rolled-back checkpoints fail closed. Recovery is installed only once, not
overwritten on reapplication. Reapplication still enforces private storage ACLs.

Explicit recovery, only after review and with the original privileged owner:

```sql
BEGIN;
CALL admin_period_private.rollback_admin_period();
COMMIT;
```

The private SECURITY INVOKER procedure has no client EXECUTE grants. It checks
all installed hashes before any drop, uses RESTRICT, restores definitions,
owners and ACLs, and marks checkpoints inactive. Business rows and backup rows
are never deleted. A later function change blocks rollback rather than being
overwritten. After an actual committed recovery, reapplication requires manual
review; it does not silently reactivate stale checkpoints.

## Local Verification

Only `127.0.0.1:54737`, user `postgres`, and disposable
`enamed_test_admin_period_*` clones were mutated. The source database
`enamed_test_f1_admin_review_20261104` was used only as a clone template and for
read-only catalog inspection. Each clone command first asserted address, port,
database and session user. The fixture repeats those guards before writes.

PowerShell runner, using the already installed PostgreSQL binary:

```powershell
$pg = 'C:\Users\felipe.souza\Documents\Projetos (Sanar)\enamed-arena\.claude\worktrees\fase0-2027\.superpowers\editions\pg17-1260616\pgsql\bin\psql.exe'
& $pg -X -w -h 127.0.0.1 -p 54737 -U postgres -d enamed_test_admin_period_fd86_release -v ON_ERROR_STOP=1 -v fault=1 -v lifecycle=1 -f supabase/tests/fase2_admin_period.sql
```

The combined invocation requires a FRESH F0+F1 clone. `fault=1` first injects an
error after the third replacement, proves that all original definitions/ACLs
and the absence of private storage survived, then installs normally.
`lifecycle=1` tests future-definition preservation on reapply and refuses
rollback over that future definition; it restores the test change and exercises
recovery inside a rolled-back transaction. The default fixture can be rerun on
an installed clone without either optional variable:

```powershell
& $pg -X -w -h 127.0.0.1 -p 54737 -U postgres -d enamed_test_admin_period_fd86_release -v ON_ERROR_STOP=1 -f supabase/tests/fase2_admin_period.sql
```

Coverage includes two editions with sequences 1/2, ten synthetic users, both
editions sharing users and segment, ten attempts, submitted/training/pending/
started activities, exact start inclusion, exact end exclusion, one-sided
intervals, BRT month boundaries, old profiles, target-only and activity-only
users, excluded undecided users, and an inconsistent cross-edition AQR.
Both editions are checked independently for population, scores, response
statistics, pending/started counters and engagement integrity alerts.

Seven real legacy definitions are recreated transactionally in `pg_temp` and
compared against default calls on nonzero single-edition data (only the three
new evolution metadata keys are removed). There are fourteen invalid-period
cases, fourteen unauthorized/content-editor cases, seven real anon-role calls,
analyst-positive calls, and per-function ACL checks. Private recovery is also
tested with complete nonzero fixture rows, verifying byte-equivalent JSON
before/after rather than only counts. All fixture data is rolled back.

TDD evidence: the initial fixture failed on the missing expanded signature;
the defensive cross-edition AQR test independently failed before adding the
question-source filter. Initial ACL assertions also exposed inherited anon
grants, which are now removed. Expected fault-injection errors appear in stderr
only in the optional fault run; subsequent assertions must pass. Normal fixture
runs keep `ON_ERROR_STOP=1` throughout.

Final combined rehearsal on `enamed_test_admin_period_fd86_release`: exit 0,
all three PASS markers (fault atomicity, lifecycle/recovery, data fixture), zero
unexpected test failures. The latest lifecycle + fixture repeat on
`enamed_test_admin_period_fd86_final` also exited 0. The initial TDD missing-
signature and cross-edition AQR runs were expected failures, not final failures.
`git diff --no-index --check -- NUL <file>` was run separately on each of the
three new files, with no whitespace errors (only the repository's LF/CRLF notice).

Local trigger warnings report that HubSpot requests were NOT queued because no
secret is configured; no external service was called or configured. This local
PostgreSQL rehearsal does not prove Supabase Auth/PostgREST integration or
production deployment. No global test suite, package install, network access,
secret-file read, production mutation or commit was performed.
