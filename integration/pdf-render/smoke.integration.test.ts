/**
 * Smoke test — Tier A integration suite (see README.md).
 *
 * Drives the full real pipeline: Edge Function `generate-exam-pdf` → LaTeX
 * render service (services/pdf-render) → signed URL → download → validate.
 * Requires a real staging Supabase project with `PDF_ENGINE=render` and the
 * render service reachable — see README.md for the full env var contract.
 *
 * Required env vars: STAGING_SUPABASE_URL, STAGING_SUPABASE_ANON_KEY,
 * STAGING_TEST_USER_JWT, STAGING_SMOKE_SIMULADO_ID.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { offlineApi } from "@/services/offlineApi";
import { assertPdfMagicBytes, authenticateAsTestUser, downloadPdfBytes } from "./helpers";

const hasStagingEnv = Boolean(
  process.env.STAGING_SUPABASE_URL &&
    process.env.STAGING_SUPABASE_ANON_KEY &&
    process.env.STAGING_TEST_USER_JWT &&
    process.env.STAGING_SMOKE_SIMULADO_ID,
);

describe.skipIf(!hasStagingEnv)("PDF generation smoke test (staging)", () => {
  beforeAll(async () => {
    await authenticateAsTestUser(process.env.STAGING_TEST_USER_JWT!);
  });

  it("generates a small exam PDF end-to-end and produces a valid PDF file", async () => {
    const simuladoId = process.env.STAGING_SMOKE_SIMULADO_ID!;

    // force=true bypasses any previously-cached PDF so we exercise the real
    // render path, not just a signed-URL-for-existing-file shortcut.
    const url = await offlineApi.getSignedPdfUrl(simuladoId, true);
    expect(url).toMatch(/^https?:\/\//);

    const bytes = await downloadPdfBytes(url);
    assertPdfMagicBytes(bytes);
    expect(bytes.byteLength).toBeGreaterThan(1000);
  });
});
