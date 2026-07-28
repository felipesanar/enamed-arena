/**
 * Broken image resilience — Tier A integration suite (see README.md).
 *
 * A staging simulado with one question whose `image_url` is 404/unreachable,
 * alongside otherwise-valid questions, should still produce a complete PDF —
 * the broken image must not take down generation for the whole exam.
 *
 * Required env vars: STAGING_SUPABASE_URL, STAGING_SUPABASE_ANON_KEY,
 * STAGING_TEST_USER_JWT, STAGING_BROKEN_IMAGE_SIMULADO_ID (a staging simulado
 * with >= 2 questions where exactly one has a broken/unreachable image_url).
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { offlineApi } from "@/services/offlineApi";
import { assertPdfMagicBytes, authenticateAsTestUser, downloadPdfBytes } from "./helpers";

const hasStagingEnv = Boolean(
  process.env.STAGING_SUPABASE_URL &&
    process.env.STAGING_SUPABASE_ANON_KEY &&
    process.env.STAGING_TEST_USER_JWT &&
    process.env.STAGING_BROKEN_IMAGE_SIMULADO_ID,
);

describe.skipIf(!hasStagingEnv)("PDF generation tolerates a broken image_url (staging)", () => {
  beforeAll(async () => {
    await authenticateAsTestUser(process.env.STAGING_TEST_USER_JWT!);
  });

  it("still produces a complete PDF containing the other questions when one image_url is broken", async () => {
    const simuladoId = process.env.STAGING_BROKEN_IMAGE_SIMULADO_ID!;

    const url = await offlineApi.getSignedPdfUrl(simuladoId, true);
    const bytes = await downloadPdfBytes(url);
    assertPdfMagicBytes(bytes);
    expect(bytes.byteLength).toBeGreaterThan(1000);

    const dir = mkdtempSync(path.join(tmpdir(), "pdf-broken-image-"));
    const pdfPath = path.join(dir, "exam.pdf");
    writeFileSync(pdfPath, bytes);

    try {
      // Requires poppler's `pdftotext` on PATH — see README.md.
      const text = execFileSync("pdftotext", [pdfPath, "-"], { encoding: "utf-8" });

      expect(
        text.length,
        "PDF text extraction should yield non-trivial content from the surviving questions",
      ).toBeGreaterThan(50);

      // "Questão N" is the literal heading emitted per question — see
      // services/pdf-render/templates/question.tex:16. Its presence confirms
      // question content actually made it into the PDF, not just a cover page.
      expect(text).toMatch(/[Qq]uest(ã|a)o\s+\d+/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
