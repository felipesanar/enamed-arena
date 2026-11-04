# Edition Analysis RPCs

Migration: `20261104120005_fase4_edition_analysis.sql`. Requires the integrated F1/F2 schema, including archived result guards and cutoff references. Single atomic DO statement (also safe inside an outer transaction), reapplicable without reseeding or changing existing functions. No frontend, generated types, answer-key grants, operational writes, TRI or proficiency calculation.

## Authentication And Privacy

All four RPCs require `auth.uid()` and grant EXECUTE only to authenticated. No user ID argument exists on the longitudinal endpoint. Configuration is RPC-only: RLS enabled, no direct client table grants or permissive policies. No new callable population helper exists.

Published rankings remain available to authenticated students without PRO or participation requirements. Archived populations require the caller's finished submitted/expired participation, exactly as `get_ranking_for_simulado`. This means an edition's visible ranking can depend on the archived simulados the caller may access. `offered_simulados` reports the caller-visible released set. No hidden archived contributions are counted or exposed.

The canonical ranking exposes user ID and profile full name; edition ranking reuses only those as `user_id`/`display_name`. It does not expose email, segment, institutions, specialty, private target snapshots or individual attempt IDs. Profile display name is current, not a historical PII snapshot.

## Percentile History

`get_my_percentile_history(p_edition_id uuid DEFAULT NULL)` returns `{items, metadata}`. Null reads the caller's history across editions, never a cross-edition raw-score series. An explicit unknown edition raises `22023`. Filter is applied before aggregation. Items contain simulado/edition identity, edition `code`/`label`, `sequence`, `date` (results release timestamp), `position`, `population`, `top_percentile`, and small-sample metadata. Order is release timestamp then simulado UUID, not sequence (which repeats between editions).

The implementation delegates to the existing guarded ranking, preserving its exact deduplication (highest score, earliest finish, attempt UUID) and position ties (score, finish, user UUID), as well as population/profile joins. The caller's selected attempt must have a finish timestamp. Published/archived, released, started, submitted/expired, non-null server score, in-window eligibility is inherited. Training, pending and in-progress attempts do not participate.

Important actual-schema limitation: the canonical ranking has no test/internal-account exclusion flag or capability filter. This migration does not invent one, since that would disagree with its population. If a future canonical ranking adds such filtering, delegation inherits it. Existing anomalous competitor rows with a score and no finish are also governed by the canonical function; the caller's own unfinished point is never returned.

Top X% is `ceil(position / population * 100)` clamped to 1..99, identical to `src/lib/ranking-percentile.ts`. A sole participant is Top 99%, not Top 1%. No raw score, percentage correct or other participant identity is returned. Population below 30 has a warning flag; 30 is a presentation caution threshold, not a psychometric certification. No proficiency or score comparability claims.

## Edition Ranking

No official N is defined or seeded. Missing/disabled policy returns `status: unconfigured`, empty items and population zero. `admin_configure_edition_ranking(edition_id, best_n, minimum_simulados, enabled, reason)` requires both `content.manage` and `intel.view`, a nonblank reason, positive integers and minimum <= N. It locks the edition, persists actor/time, and logs before/after/reason through the existing admin audit. Any error rolls back policy and audit together. Unknown editions fail closed.

Future N is allowed without invented dates or published counts. Enabling requires at least minimum released published/archived simulados; best N may exceed current availability. A caller with fewer visible offered simulados receives `insufficient_offered` and no student rows. Policy is rechecked at read time if offerings later change.

`get_edition_ranking(edition_id, limit DEFAULT 50, offset DEFAULT 0)` accepts limit 1..200 and nonnegative offset. All eligible participants are ranked before pagination; population is not limited to 1000 or to the page size. An empty page retains the real population. Candidates require at least minimum distinct eligible simulados from this edition. Canonical ranking first deduplicates online/offline/presencial attempts. Only finished results contribute. Per participant, choose min(N, count) highest server-owned raw scores; equal scores choose earliest finish then simulado UUID. No client score calculation or AQR recomputation.

Average uses unrounded numeric values. Order is average descending, highest counted score descending, last counted finish ascending, user UUID ascending. `position` is sequential row number, not shared competition rank. These edition-specific tie rules do not change per-simulado ranking. Response includes policy, actual `used_simulados`, `completed_simulados`, offered count and population, particularly important when minimum < N. Never label a partial average as an N-exam average. Raw averages are within-edition only, not comparable psychometric scales.

## Cutoff References

`get_cutoff_score_history(institution_id, specialty_id, practice_scenario DEFAULT NULL)` uses canonical IDs and static parameterized SQL. Null scenario means all; non-null uses the existing `lower(btrim(coalesce(scenario,'')))` normalization. Empty string selects the empty scenario rather than all scenarios.

Each source row remains separate with its ID, source, explicit reference edition/code/label/year/term, optional reference label, general/quota values and vacancies where present. Vacancies join only the same canonical institution/specialty, normalized scenario, reference and exact source. Distinct processes/scales are never averaged or merged. Existing schema's per-reference unique indexes still constrain what can be imported; this read migration neither changes them nor invents another feed.

There is no version column or scale/process certification contract. `source_version` is explicitly null and `source_version_available` false, not inferred from created_at. `trend_comparable` is false on every item and envelope. Source must be nonblank and reference explicit; unreferenced or blank-source legacy is counted in `legacy_unknown_count` only, never attributed to 2026 or plotted. Existing insertion constraints reject null sources for new rows. Unknown IDs or D6 unknown feed data produce empty known references, no sourcing request or mutation.

## Local Verification

Run only in a fresh `enamed_test_edition_analysis_*` clone of the authorized empty integrated template on 127.0.0.1:54737 as postgres. Apply migration then `psql -X -v ON_ERROR_STOP=1 -f supabase/tests/fase4_edition_analysis.sql`. Test fixtures roll back; the database is retained. The suite covers two editions, repeated sequences, modalities, ties, 1501 fictional participants/pagination, ownership/archival guards, configuration validation/capabilities/audit, and reference/source separation. No production or network API use.

The lateral canonical ranking preserves semantics at the cost of per-simulado ranking calls. Pagination bounds response size, not total computation. The test's generic EXPLAIN of the PL/pgSQL RPC exposes only the outer Result node, not its internal execution plan. This is not a load test; larger real edition sizes need measured review by the orchestrator before rollout. Reapplication is checked against exact policy/audit snapshots, and a forced audit insert failure verifies atomic policy rollback. The documented emergency rollback and subsequent reapplication are exercised inside the fixture transaction.

## Manual Rollback

Prefer disabling through the admin RPC with an explicit rollback reason, keeping an audit entry. The migration footer contains an owner-only emergency transaction: disable policies and drop only the four new RPCs. Preserve configuration and existing audit rows; do not drop tables, delete databases or change legacy functions. Reapplying restores RPCs and leaves the disabled policies disabled. Nothing here activates a rollout flag or changes the frontend's hardcoded target of 50.
