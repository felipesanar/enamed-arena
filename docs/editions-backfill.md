# Edition Model Backfill

## Scope And Prerequisites

Migration: `supabase/migrations/20261104065001_fase1_edition_model.sql`.
Fixture: `supabase/tests/fase1_edition_model.sql`.
Nonzero historical driver: `supabase/tests/fase1_edition_backfill.sql`.

Read the sanitized production schema captured on 2026-11-04 and apply **all F0 migrations first**, in timestamp order. F0 is present in this branch but is not yet deployed. In particular, F0 replaces the production attempt guard with `SECURITY INVOKER` and removes broad question/answer-key column grants. This migration complements that guard rather than rewriting finalization RPCs.

No production connection or migration execution was performed. The first implementation turn had no `psql` on PATH and did not execute SQL. The follow-up used the already supplied portable PostgreSQL 17.11 binaries by absolute path and executed the nonzero local red/green driver described below. `normalize_exam_area` and the product migration were NOT changed during this follow-up.

## Decisions

- All legacy simulados without an edition become seed `2026`. No rows are generated for future editions. The fixed 2026 UUID becomes the column default for old clients; new admin writers must explicitly pass `edition_id`. This default never follows the clock or the active edition.
- Sequence uniqueness is `(edition_id, sequence_number)`; slug uniqueness is untouched. Only global single-column sequence unique constraints/nonpartial indexes are removed if present.
- The official blueprint is `inep-478-2025`, with seven distinct areas, uniform numeric weights `1/7` and `weights_provisional=true`. Seed editions 2026, 2027.1 and 2027.2 receive this blueprint if absent. Other editions and cutoff reference labels are not inferred.
- Matching is exact after case/accent/whitespace normalization, never substring matching. Ginecologia and Obstetricia belong to GO; Cirurgia belongs to Cirurgia Geral. MFC is distinct from Saude Coletiva. Preventiva and ambiguous composites stay NULL, including `Saude Coletiva / Preventiva`, `Clinica Medica / Preventiva`, and MFC/collective-health combinations. Conteudo must decide these mappings and approve weights. Seven catalog rows does **not** establish seven populated areas or complete question backfill.
- `questions.area` remains unchanged. Text-only legacy edits re-resolve the canonical area instead of retaining a stale association. Explicit `area_id` must belong to the simulado edition blueprint. Changing a populated edition blueprint or moving a simulado cannot silently invalidate associations. NULL legacy areas are allowed.
- The date CHECK is `NOT VALID`: new/updated rows must satisfy `start < end <= release`; old S7 dates remain untouched. Even an unrelated update of an inconsistent historical row will fail this CHECK. Obtain authorization for historical correction before editing S7, then separately approve constraint validation.
- Attempts derive edition from their simulado, reject mismatched supplied IDs, and cannot follow a parent moved to another edition. Missing parent associations abort the transaction; no deletion or weakened NOT NULL fallback.
- Existing submitted/expired attempts receive the **current** normalized onboarding IDs, explicitly marked `snapshot_backfilled=true`. These are not reconstructed historical preferences. No profile means unknown specialty (NULL) and an empty institution array. New finalizations capture once, including direct trusted inserts in final status. The non-NULL array is the capture marker even when no preferences exist; reopening/conversion/reprocessing preserves it. Reapplying the migration does not read the profile again for migrated attempts.
- Snapshot fields deliberately do not reference mutable specialty/institution catalogs: deleting a catalog entry must not erase a historical UUID snapshot.
- Direct authenticated users cannot change edition or snapshot fields, even with a forged service-role JWT claim. Both F0 and F1 guards use actual effective `current_user` with invoker security. Trusted service SQL roles and nested guarded DEFINER RPCs retain their existing path.
- New catalog/config tables have authenticated SELECT, no anon or authenticated direct DML grants, and RLS enabled. `admin_set_app_config(text,jsonb)` requires `admin_require('content.manage')` and records `admin_log_action`; production's generic audit trigger cannot be reused because it requires `NEW.id uuid`, while config is keyed by text. `editions_ui=false` is inserted only if absent, never reset on replay.
- The existing production published/admin simulado SELECT policies are preserved. An ownership policy permits archived metadata and a restrictive fence prevents permissive policies from exposing archived rows to nonowners. Question/options/explanation ACLs and F0 release policies are unchanged. Archived metadata access is **not** authorization for archived questions or corrections; extending historical corrections is a separate coordinated release task.

## Local Verification

Use only the portable local server at `127.0.0.1:54737`, with an `enamed_test_*` disposable database supplied by QA. No package install, production call, remote access, or global suite is needed. The original post-F1 fixture can be run separately on a schema-ready database with the flag disabled:

```powershell
& $psql -X -h 127.0.0.1 -p 54737 -U postgres -d enamed_test_f1_model -v ON_ERROR_STOP=1 -f supabase/tests/fase1_edition_model.sql
& $psql -X -h 127.0.0.1 -p 54737 -U postgres -d enamed_test_f1_model -v ON_ERROR_STOP=1 -f supabase/migrations/20261104065001_fase1_edition_model.sql
& $psql -X -h 127.0.0.1 -p 54737 -U postgres -d enamed_test_f1_model -v ON_ERROR_STOP=1 -f supabase/tests/fase1_edition_model.sql
& $psql -X -h 127.0.0.1 -p 54737 -U postgres -d enamed_test_f1_model -v ON_ERROR_STOP=1 -f supabase/migrations/20261104065001_fase1_edition_model.sql
& $psql -X -h 127.0.0.1 -p 54737 -U postgres -d enamed_test_f1_model -v ON_ERROR_STOP=1 -f supabase/tests/fase1_edition_model.sql
```

The first fixture invocation should fail on absent F1 schema (red); subsequent ones must pass (green/reapplication). The fixture has `ON_ERROR_STOP`, a database-name safety check, no extension dependency, and wraps its fixtures in a rolled-back transaction. Run with fresh `editions_ui=false`, before enabling the rollout flag. Fixture synthetic users must have local-only doubles for integration triggers; never allow external calls from the harness.

The post-migration fixture tests new writes, scoped schema invariants, alias resolution, edition/slug uniqueness, date rejection, spoofing, parent consistency, snapshot stability, and archive owner/nonowner/admin visibility. The separate historical driver now proves pre-migration transformation with nonzero fixtures rather than relying on that fixture's postconditions.

```sql
SELECT 'attempts' AS relation, count(*) FROM public.attempts
UNION ALL SELECT 'answers', count(*) FROM public.answers
UNION ALL SELECT 'attempt_question_results', count(*) FROM public.attempt_question_results;
```

## Executed Evidence (2026-11-04)

### Codex Verification

Reported by Codex via the orchestrator: on `enamed_test_f1_model_unicode_20261104`, migration + original model fixture + reapplication + original model fixture all exited **0**. This is attributed evidence, not a rerun by this job. QA traced the earlier local failure to locale `C`; production uses `en_US.UTF-8`. QA supplied an ICU/en-US Unicode baseline and validated it without a product change. Do not modify `normalize_exam_area` to compensate for a nonrepresentative local locale.

### Nonzero Backfill Run

This job verified the source catalog connection as `127.0.0.1:54737`, PostgreSQL 17.11, `datlocprovider=i`, `datlocale=en-US`, with zero simulados/attempts and 25 role capabilities, then created two private disposable clones of `enamed_test_sqlqa_20261104075418503_34180_catalog`. The source was not changed. No clone was dropped; synthetic data remains available for inspection.

| Run | Database | Result | Managed shell log filename |
|---|---|---|---|
| Red control, `skip_migration=1` | `enamed_test_f1_backfill_red_20261104080907` | Expected nonzero shell exit **1**, after the nonzero counts/ranking checks; failed specifically on missing `app_config` | `tool_1a59c68860010idqbRO7Lr6xz5` |
| Green driver, real migration + replay | `enamed_test_f1_backfill_green_20261104080907` | Exit **0**, **43 assertions passing**, none failing | `tool_1a59d045a0010W9GM2qkSUNZE1` |

Both clone creation commands exited **0**. Logs are retained under `C:/Users/felipe.souza/.local/share/opencode-sanar/tool-output/`. The shell receipt for the completed green run is job `654a8ba0-4b1e-4a76-bc16-f38e0cc335ab`; red receipt is `c4a34276-0111-4791-8e04-5298d30bfe8c`. The managed PowerShell shell reports failure as exit 1; no claim is made that this is the native `psql` exit code. An earlier attempt to author the driver failed on a fixture-only comparison of numeric JSON text `100.00` against `100`; the comparison was corrected to numeric before the successful red control. That failure rolled back seed data and did not change the migration.

Verified with the real migration included using psql `\i :migration_path`, never by copying its UPDATE statements into the test:

- Pre-F1 seed has **3 attempts, 33 answers, 22 question results**, two simulados, three synthetic students, and eleven questions. Alice has a profile and a submitted attempt, Bob has no onboarding and an expired attempt, Carol has a profile and a pending attempt.
- The **real** `get_ranking_for_simulado` RPC returns two ordered students with scores **100.00** and **45.45** before F1. Full JSON is identical immediately before/after initial migration and immediately before/after replay.
- All original attempt fields, answers, question results, legacy question fields and window/release dates are unchanged across both applications. Counts remain **3 / 33 / 22** until the explicitly tested new finalization.
- Both legacy simulados map to `2026`, every attempt edition matches its simulado, and no future-edition simulado is created.
- Historical submitted/expired snapshots are `snapshot_backfilled=true`. Alice retains the original specialty/institution UUIDs; Bob gets NULL specialty and an empty institution array. Carol's pending snapshot remains unset with `snapshot_backfilled=false`.
- Seven distinct canonical areas are **actually populated** from seven obvious aliases. Four ambiguous variants remain NULL and are emitted by the driver's grouped SQL report: `Preventiva `, `Saude Coletiva / Preventiva`, `Clinica Medica / Preventiva`, `MFC / Saude Coletiva`. MFC and collective health have distinct IDs.
- S7 retains its release exactly **two minutes before** the execution-window end; neither migration repairs or validates that historical inconsistency.
- Before replay, Alice/Carol's live specialty and institution IDs change and `editions_ui` becomes true. Replay leaves every snapshot and the enabled flag untouched. The current ranking RPC reads live profile labels, so those label fields legitimately change when the profile changes; all ranking positions/scores/participants stay identical. Full ranking JSON is compared against a fresh checkpoint immediately before replay, not against stale profile labels.
- Carol is finalized through the **real authenticated** `finalize_attempt_with_results(attempt_id,true)` RPC after replay. It generates eleven results and captures the **new current** specialty/institution IDs with `snapshot_backfilled=false`, score **27.27**, without changing historical snapshots.

The driver checks database prefix `enamed_test_f1_backfill_*`, exact server IPv4 address and port, SQL session user, ICU/en-US locale, empty pre-F1 data, and absence of F1 tables before seeding. It uses a transaction for seeding, then intentionally commits so the real migration's own BEGIN/COMMIT can run normally. Temporary checkpoints survive both migration applications. It is a disposable-database driver, **not** a single rollback-wrapped test; never reuse a populated clone. The HubSpot profile trigger is disabled only during synthetic user creation and reenabled immediately afterward, avoiding external calls. No external service is contacted.

Reproduction, from this worktree root, with a **new clone name for each execution**:

```powershell
$psql = 'C:\Users\felipe.souza\Documents\Projetos (Sanar)\enamed-arena\.claude\worktrees\fase0-2027\.superpowers\editions\pg17-1260616\pgsql\bin\psql.exe'
# Source catalog must remain disposable, pre-F1 and Unicode ICU/en-US.
& $psql -X -h 127.0.0.1 -p 54737 -U postgres -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE enamed_test_f1_backfill_UNIQUE WITH TEMPLATE enamed_test_sqlqa_20261104075418503_34180_catalog;"
& $psql -X -h 127.0.0.1 -p 54737 -U postgres -d enamed_test_f1_backfill_UNIQUE -v ON_ERROR_STOP=1 -v migration_path=supabase/migrations/20261104065001_fase1_edition_model.sql -f supabase/tests/fase1_edition_backfill.sql
# Separate fresh clone for red control: same command with -v skip_migration=1.
```

Limits: this is a restored function/policy/catalog harness with explicit local doubles for managed dependencies, not a live Supabase environment. ICU/en-US is QA's Unicode substitute, not proof of byte-for-byte equivalence to production `en_US.UTF-8`. These results prove the controlled synthetic historical transformation and local SQL behavior; they do not prove production dataset counts, real production ranking equivalence, Supabase Auth/PostgREST integration, scheduler operation or external delivery. Production deployment and production-data verification remain separately authorized work.

## Repeatable Report

Run these read-only statements on an authorized database. No implicit correction or deletion is performed. Outstanding ambiguous/unknown areas are a **partial backfill**, not a failure to preserve rows.

```sql
-- Coverage and unresolved count by simulado, including empty simulados.
SELECT e.code AS edition, s.id, s.slug, s.sequence_number,
       count(q.id) AS questions,
       count(q.area_id) AS mapped,
       count(q.id) FILTER (WHERE q.area_id IS NULL) AS unresolved
FROM public.simulados s JOIN public.exam_editions e ON e.id = s.edition_id
LEFT JOIN public.questions q ON q.simulado_id = s.id
GROUP BY e.code,s.id,s.slug,s.sequence_number
ORDER BY e.code,s.sequence_number,s.id;

-- Every unmapped variant, its normalized spelling and candidate count.
-- A candidate count other than 1 must never be auto-associated.
SELECT e.code AS edition,s.slug,q.area AS raw_area,
       public.normalize_exam_area(q.area) AS normalized_area,
       count(*) AS questions,
       (SELECT count(*) FROM public.exam_areas a
        WHERE a.blueprint_id = e.blueprint_id AND EXISTS (
          SELECT 1 FROM unnest(a.aliases || ARRAY[a.label,a.code]) alias
          WHERE public.normalize_exam_area(alias) = public.normalize_exam_area(q.area))) AS candidate_count
FROM public.questions q JOIN public.simulados s ON s.id = q.simulado_id
JOIN public.exam_editions e ON e.id = s.edition_id
WHERE q.area_id IS NULL
GROUP BY e.code,e.blueprint_id,s.slug,q.area
ORDER BY e.code,s.slug,q.area;

-- Catalog alias collisions (must return zero rows).
SELECT a.blueprint_id,public.normalize_exam_area(alias) AS normalized_alias,
       array_agg(DISTINCT a.code ORDER BY a.code) AS codes
FROM public.exam_areas a CROSS JOIN LATERAL unnest(a.aliases || ARRAY[a.label,a.code]) alias
GROUP BY a.blueprint_id,public.normalize_exam_area(alias)
HAVING count(DISTINCT a.id) > 1;

-- Date anomalies, including S7: report only, do not rewrite.
SELECT id,slug,execution_window_start,execution_window_end,results_release_at
FROM public.simulados
WHERE NOT (execution_window_start < execution_window_end
           AND execution_window_end <= results_release_at);

-- Attempt provenance and backfill markers. No student IDs are returned.
SELECT e.code,a.status,a.snapshot_backfilled,count(*) AS attempts,
       count(*) FILTER (WHERE a.edition_id IS DISTINCT FROM s.edition_id) AS mismatched,
       count(*) FILTER (WHERE a.status IN ('submitted','expired')
                        AND a.target_institution_ids_at_finish IS NULL) AS missing_snapshot
FROM public.attempts a JOIN public.simulados s ON s.id = a.simulado_id
JOIN public.exam_editions e ON e.id = a.edition_id
GROUP BY e.code,a.status,a.snapshot_backfilled ORDER BY e.code,a.status,a.snapshot_backfilled;

-- Invalid canonical associations: must return zero rows.
SELECT q.id,s.slug,q.area_id FROM public.questions q
JOIN public.simulados s ON s.id = q.simulado_id
JOIN public.exam_editions e ON e.id = s.edition_id
JOIN public.exam_areas a ON a.id = q.area_id
WHERE a.blueprint_id IS DISTINCT FROM e.blueprint_id;
```

## Rollback And Approval

The migration includes a commented data-preserving rollback procedure. Disable the UI flag and roll back dependent callers, retain edition associations/snapshots/FKs and F0 security controls, and do not restore global sequence uniqueness when numbers repeat across editions. No destructive contraction is automated. Local red/green, replay and nonzero synthetic historical count/ranking comparisons are now verified as described above. Remaining gates: Conteudo approval of ambiguous areas/weights, explicit S7 correction approval, production rollout authorization and separately approved production-data verification.
