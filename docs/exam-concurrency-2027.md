# Exam concurrency and runtime readiness

## Scope

F3-6 / `f3-multitab-6cd9`, verified locally on 2026-11-04. No production access,
package installation, generated-type edits, commits or pushes. Home/admin consumers,
`simuladosApi`, offline recovery and the shared clock pipeline remain outside this job.

## Persistence contract

- A user edit creates one monotonic `clientUpdatedAt` per question using the synchronized server clock. Retry, flush and unload reuse it.
- `answeredAt` describes the selection event, not a review/confidence edit. Loaded legacy timestamps survive flush; clearing a selection clears its selection timestamp.
- Remote data wins version ties. A pending unversioned answer can replace only an unversioned remote answer. Old offline timestamps are valid; absurd future versions are rejected by SQL.
- The F0 integrity trigger still runs before freshness. Freshness is SECURITY INVOKER, not a replacement for identity, option, deadline, status or RLS checks.
- The narrow postgres/supabase_admin presencial exception applies only to a validated offline_pending attempt. It does not trust JWT claims/GUCs and does not grant service_role a bypass. Privileged paper payloads without a version preserve the old version.
- The real presencial conversion/submission RPCs apply the paper answer and preserve the online backup. The local fixture provides a transactional backup-table double only when the clone lacks that table.
- Normal writes request the accepted representation. Missing, changed or incomplete rows are not ACKs even when HTTP succeeds. Dirty revisions clear only after the matching accepted write; an old request cannot ACK a newer edit.
- A mismatch retains dirty/cache, blocks further writes and forces capability re-probe plus remote reconciliation. A newer remote version may legitimately win reconciliation; pending intent is never given a fresh transport timestamp.
- Unload keepalive is best effort and never ACKs or clears dirty. It uses the validated attempt/user snapshot and current matching JWT.
- Automatic finalization flushes dirty answers within the server write grace. Beyond grace, pending dirty answers prevent a false successful local finalization; they remain cached for reconciliation. This does not extend server deadlines or implement late-write recovery.

## Tab ownership

`useExamTabLease` keys ownership by user and attempt. A confirmed owner wins over a
new contender in the same epoch; explicit takeover advances ownership. TTL is six
seconds, heartbeat one second, contender settlement 150 ms. Acquisition requires
an abortable remote reload, with a ten-second timeout, before writes are enabled.

BroadcastChannel is notification, not authority. Storage events provide fallback;
localStorage getter/read/write failures fail closed. Ownership is rechecked across
awaits, retries, queued operations, finalization and lifecycle/unload. User/attempt
changes and BFCache/pagehide cannot silently re-enable an old writer.

The ownership/preparation notice reuses the existing exam composition. Preparing
or failed readiness is not presented as "Tempo esgotado".

## Shared Readiness DTO

`src/types/exam-runtime.ts` exports `ExamRuntimeCapabilities`.
`examRuntimeCapabilitiesApi.get(): Promise<ExamRuntimeCapabilities | null>` is the
shared read service. Its valid object is:

```typescript
{
  version: 1,
  answer_freshness_v1: boolean,
  safe_auto_finalize: boolean,
  question_explanations: boolean,
  attempt_counts: boolean,
  server_clock: boolean,
  exam_editions: boolean
}
```

All six flags are independent strict booleans. False is valid readiness metadata,
not an error and not an authorization grant. The original RPCs still enforce
owner/auth/release/capability checks. No AQR owner-only shortcut is used.

The additive migration is **20261104120008**, reserved by the parent, not 120002.
The RPC is authenticated, read-only/STABLE, has a pg_catalog search path and
returns no PII. PUBLIC, anon and service_role have no EXECUTE grant; a non-null
auth.uid is required even for authenticated SQL sessions.

Canonical signatures were inspected through pg_catalog on the exclusive clone:

| Flag | Required metadata |
| --- | --- |
| answer_freshness_v1 | answers.client_updated_at timestamptz and the expected enabled F0/freshness row triggers, both SECURITY INVOKER |
| safe_auto_finalize | public.finalize_attempt_with_results(uuid,boolean); the one-argument overload is insufficient |
| question_explanations | public.get_question_explanations(uuid) |
| attempt_counts | public.admin_simulado_attempt_counts(uuid) |
| server_clock | public.get_server_time() |
| exam_editions | public.get_exam_editions() |

The clone initially lacked the clock RPC. Its existing canonical branch migration
`20261104074143_fase1_server_clock.sql` was applied locally before verifying all-new
metadata. No signature or production installation was inferred from frontend types.

Only PGRST202 from this probe returns null. Generic 404, internal 42883, auth/403,
network errors and invalid responses throw. A proxy/project 404 is never legacy.
The hook preserves `.mode`: null or confirmed freshness false maps to legacy;
freshness true maps to v1; pending/error never downgrade. Cache is scoped to
user/attempt for five minutes and explicitly reset after ACK mismatch.

Legacy transport omits client_updated_at in both the write and returned-column
selection, including keepalive. Legacy editing/manual persistence does not require
the new clock RPC. V1 editing/persistence waits for a synchronized clock; pending
or initial fallback cannot fabricate versions. A previously synchronized monotonic
anchor continues across connectivity loss and OS-clock changes. Initial fallback
recovers through the existing online/visibility clock refresh, not a new pipeline.

Safe auto-finalize/explanations/counts fallbacks in Home/admin are owned by the
parent. These flags are exposed for those consumers without editing them here.

## Escape

Only a trusted, non-repeated Escape keydown outside editable controls opens a
single-consumption 500 ms fullscreen-exit suppression window. It does not suppress
visibility exits, stale/untrusted events or later fullscreen exits. Intentional
programmatic exit is separate. Stable listeners and callback refs preserve the
marker across rerenders and clean up under StrictMode.

## Verification

Environment used existing Node 24.16.0 / Vitest 5.1.0 dependencies. Focused TDD
reproduced DTO/404 adaptation failures and late-finalize dirty loss before fixes.
Final focused rollout run: **97 passed, 0 failed, six files**.

Final consolidated command:

```powershell
node node_modules/vitest/vitest.mjs run src/hooks/useFocusControl.test.tsx src/services/examAnswersApi.test.ts src/services/examRuntimeCapabilitiesApi.test.ts src/hooks/useExamRuntimeCapabilities.test.tsx src/hooks/exam/useExamAnswers.test.ts src/hooks/useExamTabLease.test.tsx src/lib/exam-tab-lease.test.ts src/hooks/useExamStorageReal.test.tsx src/hooks/useExamFlow.test.tsx src/hooks/exam/useExamIntegrity.test.ts src/hooks/exam/useExamBeacon.test.ts src/hooks/exam/useExamLifecycle.test.tsx src/components/exam/ExamTabOwnershipNotice.test.tsx src/lib/exam-cache.test.ts src/lib/exam-answer-version.test.ts --maxWorkers=2
```

Result: **151 passed, 0 failed, 16 files**. The explicit useExamAnswers filter
also matches the existing .test.tsx companion. Coverage includes pending/error
probes, generic 404 negatives, strict feature booleans, isolated feature false,
scope changes, cached legacy to V1 no-op/reconciliation, dirty retention, legacy
without clock, V1 fallback blocking, OS skew +/-60 minutes, beacon modes and
manual/automatic submission guards.

```powershell
node --test scripts/sql-local/answer-freshness-concurrency.test.mjs
node scripts/sql-local/answer-freshness-concurrency.mjs --run enamed_test_answer_freshness_1793795153752_34084
```

Results: allowlist unit test **1 passed, 0 failed**. SQL runner completed with
**16 fixture checks and five concurrency/drift/rollback checks passing**, no failures.
Two independent PostgreSQL connections reached an observed lock barrier in both
version orders. Committed function-body/metadata drift was rejected by reapply and
rollback, preserving the later definition; the exact original clone definition was
restored. Rollback and double reapply preserved nonzero answer/version data and F0.

The capabilities fixture was run with local psql `-X -w -v ON_ERROR_STOP=1 -f
supabase/tests/fase3_exam_runtime_capabilities.sql`: **14 checks passed, 0 failed**.
It checks ACL/UID, all-new metadata, independent missing signatures, one- vs
two-argument finalizers, missing guards, SECURITY DEFINER rejection and all-old
metadata with all flags false. All metadata mutations roll back.

Every SQL fixture verifies 127.0.0.1:54737, postgres and the
`enamed_test_answer_freshness_*` clone allowlist before mutations. Only the exclusive
clone `enamed_test_answer_freshness_1793795153752_34084` was used in this continuation.
The SQL runner cleans only its exact fixture IDs, never drops a database.
Local hubspot-sync warned that no secret was configured and queued no request;
no external transport or production service was exercised.

`git diff --check`: no whitespace errors; only the checkout's LF-to-CRLF warnings.
No global suite, full tsc/build, Managed Supabase run or full exam E2E was claimed.

## QA Limits

Preserved prior QA evidence covers helpers, two real Chromium tabs with
BroadcastChannel/storage and 18 responsive captures. That exercise used the real
lease hook with mocked remote reload, not the complete exam/backend flow. The
Escape sequence used a trusted key and real DOM fullscreen state, not a claim of
complete native Escape-to-fullscreen E2E coverage. It was not rerun as broad visual
QA in this continuation. Managed rollout and whole-exam integration remain parent
verification responsibilities; production was not accessed.
