/**
 * Large exam (300 questions) timing gate — Tier A integration suite (see README.md).
 *
 * This is a DECISION GATE, not just a smoke check: the client
 * (`offlineApi.getSignedPdfUrl`, src/services/offlineApi.ts:85-86) gives up
 * after `MAX_ATTEMPTS=30 * POLL_INTERVAL_MS=3000` (~90s) of polling. If a
 * 300-question exam's real end-to-end generation time creeps close to (or
 * past) that window, someone needs to explicitly choose between:
 *   (a) optimizing services/pdf-render so large exams render faster, or
 *   (b) deliberately raising MAX_ATTEMPTS/POLL_INTERVAL_MS to widen the
 *       client's polling window.
 * This test asserts we stay under 80% of the window (a safety margin — the
 * failure message spells out the choice; the fix is a product/infra
 * decision, not something to silence here).
 *
 * Required env vars: STAGING_SUPABASE_URL, STAGING_SUPABASE_ANON_KEY,
 * STAGING_TEST_USER_JWT, STAGING_LARGE_SIMULADO_ID (a staging simulado with
 * ~300 questions, ideally including images, to reflect a realistic worst case).
 */
import { beforeAll, describe, expect, it } from "vitest";
import { offlineApi } from "@/services/offlineApi";
import { assertPdfMagicBytes, authenticateAsTestUser, CLIENT_POLL_WINDOW_MS, downloadPdfBytes } from "./helpers";

const hasStagingEnv = Boolean(
  process.env.STAGING_SUPABASE_URL &&
    process.env.STAGING_SUPABASE_ANON_KEY &&
    process.env.STAGING_TEST_USER_JWT &&
    process.env.STAGING_LARGE_SIMULADO_ID,
);

const GATE_MS = CLIENT_POLL_WINDOW_MS * 0.8; // ~72_000ms of ~90_000ms

describe.skipIf(!hasStagingEnv)("Large exam (300 questions) PDF generation timing gate (staging)", () => {
  beforeAll(async () => {
    await authenticateAsTestUser(process.env.STAGING_TEST_USER_JWT!);
  });

  it("generates a 300-question exam PDF within 80% of the client's polling window", async () => {
    const simuladoId = process.env.STAGING_LARGE_SIMULADO_ID!;

    const start = Date.now();
    const url = await offlineApi.getSignedPdfUrl(simuladoId, true);
    const elapsedMs = Date.now() - start;

    const bytes = await downloadPdfBytes(url);
    assertPdfMagicBytes(bytes);

    expect(
      elapsedMs,
      `Large exam (300 questions) PDF generation took ${elapsedMs}ms, exceeding the ${GATE_MS}ms gate ` +
        `(80% of the client's ${CLIENT_POLL_WINDOW_MS}ms polling window — MAX_ATTEMPTS=30 * ` +
        "POLL_INTERVAL_MS=3000 in src/services/offlineApi.ts:85-86). DECISION NEEDED: either " +
        "(a) optimize services/pdf-render so large exams render faster, or " +
        "(b) deliberately raise MAX_ATTEMPTS/POLL_INTERVAL_MS in src/services/offlineApi.ts to widen " +
        "the client's polling window. Do not raise/remove this gate without making that call explicitly.",
    ).toBeLessThan(GATE_MS);
  });
});
