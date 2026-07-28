/**
 * Render service unreachable — Tier A integration suite (see README.md).
 *
 * Simulates the render service being down by requiring that, for the
 * duration of this specific test, the staging `generate-exam-pdf` Edge
 * Function's `PDF_RENDER_SERVICE_URL` secret (the env var it reads — see
 * supabase/functions/generate-exam-pdf/index.ts:71) points at an
 * unreachable/mock endpoint.
 *
 * Why this test doesn't flip that secret itself: Supabase's Management API
 * is write-only for secrets (`GET .../secrets` returns names only, never
 * values), so there is no safe way for this test process to read the current
 * value, flip it, and reliably restore the original afterwards. Rather than
 * risk leaving staging's PDF generation permanently broken if a test run is
 * interrupted, this scenario is a deliberate, manual, run-in-isolation
 * precondition — see README.md for the exact steps.
 *
 * What this asserts: `offlineApi.getSignedPdfUrl` (src/services/offlineApi.ts)
 * eventually REJECTS with a clear error rather than resolving successfully or
 * hanging forever with no signal at all. Note this is a known-generic error
 * today ("A geração do PDF está demorando mais do que o esperado...") because
 * each failed background render releases its lock and a subsequent poll just
 * re-triggers a fresh attempt (see generate-exam-pdf/index.ts's
 * buildAndUploadPdf catch block) until the client's own MAX_ATTEMPTS is
 * exhausted — so this test necessarily takes close to the full
 * CLIENT_POLL_WINDOW_MS to observe the rejection. Making the error surface
 * faster/more specifically is a possible follow-up product improvement, not
 * in scope here; this test's job is to catch a regression to "resolves as if
 * successful" or "never settles at all".
 *
 * Required env vars: STAGING_SUPABASE_URL, STAGING_SUPABASE_ANON_KEY,
 * STAGING_TEST_USER_JWT, STAGING_SERVICE_DOWN_SIMULADO_ID.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { offlineApi } from "@/services/offlineApi";
import { authenticateAsTestUser, CLIENT_POLL_WINDOW_MS } from "./helpers";

const hasStagingEnv = Boolean(
  process.env.STAGING_SUPABASE_URL &&
    process.env.STAGING_SUPABASE_ANON_KEY &&
    process.env.STAGING_TEST_USER_JWT &&
    process.env.STAGING_SERVICE_DOWN_SIMULADO_ID,
);

describe.skipIf(!hasStagingEnv)("PDF render service unreachable → clear client error (staging)", () => {
  beforeAll(async () => {
    await authenticateAsTestUser(process.env.STAGING_TEST_USER_JWT!);
  });

  it(
    "surfaces a clear rejection instead of hanging when the render service is unreachable",
    async () => {
      const simuladoId = process.env.STAGING_SERVICE_DOWN_SIMULADO_ID!;

      // force=true so we don't accidentally hit a cached PDF from a previous
      // (working) run against this same simulado_id.
      await expect(offlineApi.getSignedPdfUrl(simuladoId, true)).rejects.toThrow();
    },
    CLIENT_POLL_WINDOW_MS + 20_000,
  );
});
