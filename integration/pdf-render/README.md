# pdf-render Tier A integration suite

End-to-end tests that drive the **real** pipeline: Edge Function
`generate-exam-pdf` → LaTeX render service (`services/pdf-render/`, Cloud Run)
→ Supabase Storage → signed URL → downloaded PDF. They talk to a real staging
Supabase project and a real deployed render service — there is no mocking.

This is deliberately separate from `e2e/` at the repo root: `e2e/` is scoped
to public routes with no backend (see `e2e/smoke.spec.ts`). This suite needs
a backend, so it lives in its own top-level `integration/` directory.

**As of this writing, no staging environment with the new render engine
deployed exists yet.** Running `npm run test:pdf-integration` without the env
vars below will **skip every test cleanly** (not fail, not hang) — that's the
expected state until staging infra exists. See "Verifying without staging"
below for what that looks like.

## Staging precondition

Before any of these tests can do anything useful, the staging Supabase
project's `generate-exam-pdf` Edge Function must be deployed with:

- `PDF_ENGINE=render` (not the default `pdf-lib` fallback)
- `PDF_RENDER_SERVICE_URL` pointing at a real, reachable deployment of
  `services/pdf-render` (e.g. on Cloud Run)
- `PDF_RENDER_SERVICE_SECRET` matching what that service expects
- `PDF_RENDER_TIMEOUT_MS` optionally tuned (defaults to `45000`)

See `supabase/functions/generate-exam-pdf/index.ts` for exactly how these are
read.

## Required env vars

### Core (used by smoke, unicode, large-exam, broken-image)

| Env var | Purpose |
|---|---|
| `STAGING_SUPABASE_URL` | Staging project URL. Mapped internally to `VITE_SUPABASE_URL` by `vitest.config.ts` so the app's `@/integrations/supabase/client` singleton points at staging instead of its hardcoded production fallback. |
| `STAGING_SUPABASE_ANON_KEY` | Staging anon/publishable key. Mapped to `VITE_SUPABASE_PUBLISHABLE_KEY`. |
| `STAGING_TEST_USER_JWT` | A currently-valid **access token** for a real, authenticated test user in the staging project. `offlineApi.getSignedPdfUrl` calls an Edge Function that requires a real user JWT (not just the anon key) — see `index.ts`'s `anonClient.auth.getClaims(token)` check. Mint one by signing in a dedicated staging test account (e.g. via the Supabase JS client or `supabase auth` tooling) and copying its `access_token`. Tokens are short-lived; re-mint if tests start failing with 401s. |

We deliberately did **not** name these `VITE_SUPABASE_URL` /
`VITE_SUPABASE_PUBLISHABLE_KEY` directly — those names are shared with the
app's own dev/build tooling, and reusing them here would make it too easy to
accidentally point a local `npm run dev` at staging (or vice versa).

### Per-scenario simulado IDs

| Env var | Used by | Staging data precondition |
|---|---|---|
| `STAGING_SMOKE_SIMULADO_ID` | `smoke.integration.test.ts` | Any small, valid simulado. |
| `STAGING_UNICODE_SIMULADO_ID` | `unicode.integration.test.ts` | A simulado with question/option text containing `µg`, `°C`, `±`, `→`, `α`, `β` (characters known to degrade to `?` under the legacy pdf-lib/WinAnsi engine). |
| `STAGING_LARGE_SIMULADO_ID` | `large-exam.integration.test.ts` | A ~300-question simulado, ideally with images, to reflect a realistic worst case for render time. |
| `STAGING_SERVICE_DOWN_SIMULADO_ID` | `service-down.integration.test.ts` | Any simulado not already cached in Storage for the current `updated_at` version (use a dedicated one to avoid clashing with the smoke test's cache). See "Service-down precondition" below — this test needs staging temporarily misconfigured. |
| `STAGING_BROKEN_IMAGE_SIMULADO_ID` | `broken-image.integration.test.ts` | A simulado with >= 2 questions where exactly one has a broken/unreachable `image_url` (e.g. a 404). |

### Service-down precondition (manual, run in isolation)

`service-down.integration.test.ts` needs the Edge Function's
`PDF_RENDER_SERVICE_URL` secret to point at something unreachable **for the
duration of that one test**. We intentionally do **not** automate flipping
this secret: the Supabase Management API's `GET .../secrets` endpoint returns
secret *names* only, never values, so there is no safe way for a test process
to read the current value, flip it, and reliably restore the original
afterward. Automating this risks leaving staging's PDF generation broken for
everyone if a test run is interrupted mid-way.

To run this test for real:

1. Note the current `PDF_RENDER_SERVICE_URL` value (from wherever it's
   normally configured/deployed from) so you can restore it.
2. Temporarily set it to something unreachable, e.g.
   `supabase secrets set PDF_RENDER_SERVICE_URL=https://127.0.0.1:1/unreachable --project-ref <staging-ref>`.
3. Run **only** this file in isolation:
   `npx vitest run --config integration/pdf-render/vitest.config.ts service-down.integration.test.ts`
4. Restore the original `PDF_RENDER_SERVICE_URL` immediately afterward.

This test takes close to the full client polling window (~90s) to resolve,
because each failed background render attempt releases its lock and the next
poll re-triggers a fresh attempt (see `buildAndUploadPdf`'s catch block in
`supabase/functions/generate-exam-pdf/index.ts`) until the client's own
`MAX_ATTEMPTS` is exhausted. The resulting error message is a generic timeout
message today, not a specific "render service unreachable" message — the test
only asserts that `offlineApi.getSignedPdfUrl` rejects (vs. resolving as if
successful, or never settling at all). Making the failure surface faster or
with a more specific message is a reasonable follow-up, out of scope here.

## Running against staging

```bash
export STAGING_SUPABASE_URL=https://your-staging-project.supabase.co
export STAGING_SUPABASE_ANON_KEY=...
export STAGING_TEST_USER_JWT=...
export STAGING_SMOKE_SIMULADO_ID=...
export STAGING_UNICODE_SIMULADO_ID=...
export STAGING_LARGE_SIMULADO_ID=...
export STAGING_SERVICE_DOWN_SIMULADO_ID=...
export STAGING_BROKEN_IMAGE_SIMULADO_ID=...

npm run test:pdf-integration
```

Or run a single file directly (recommended for `service-down`, see above):

```bash
npx vitest run --config integration/pdf-render/vitest.config.ts smoke.integration.test.ts
```

### System dependency: poppler (`pdftotext`)

`unicode.integration.test.ts` and `broken-image.integration.test.ts` shell out
to `pdftotext` (from `poppler-utils`/`poppler`) to extract text from the
generated PDF. Whatever machine/CI runner executes this suite for real needs
it installed:

- macOS: `brew install poppler`
- Debian/Ubuntu: `apt-get install poppler-utils`

If `pdftotext` isn't on `PATH`, those two test files will fail with a clear
`ENOENT`/"command not found" error from `execFileSync` — not a silent skip,
since that's a genuine environment misconfiguration rather than "staging
doesn't exist yet".

## CI

This suite is **not** wired into `.github/workflows/ci.yml` on purpose: it
needs real staging secrets and takes minutes to run (the large-exam and
service-down scenarios each approach the ~90s client polling window). If/when
staging infra exists, wiring this up as a manual `workflow_dispatch` job (or
a scheduled nightly run) is a reasonable next step — that's an infra decision
left for whoever stands up staging, not made here.

## Verifying without staging

With no `STAGING_*` env vars set, `npm run test:pdf-integration` should run
and report all 5 suites as **skipped** (via `describe.skipIf`), not fail with
an import/syntax error and not hang. This confirms the test code itself is
correct even though there's no staging environment to validate the real
scenarios against yet.
