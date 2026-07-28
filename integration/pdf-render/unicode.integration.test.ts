/**
 * Unicode / medical-symbol test — Tier A integration suite (see README.md).
 *
 * Under the legacy pdf-lib engine (WinAnsi-only font encoding), characters
 * like µg, °C, ±, →, α, β silently degrade to "?". This test drives the real
 * pipeline against a staging simulado seeded with those characters and
 * extracts the resulting PDF's text via `pdftotext` (poppler-utils) to assert
 * they round-trip correctly.
 *
 * Why `pdftotext` instead of a JS PDF-text-extraction library: it's already
 * available in this dev environment (poppler), it's the same tool a human
 * would reach for to sanity-check a PDF manually, and it sidesteps pulling in
 * a JS PDF-parsing dependency (e.g. pdf-parse/pdfjs-dist) into this test-only
 * package just to extract text once per run. The tradeoff: whatever
 * environment runs this suite for real (staging CI runner, or a developer's
 * machine) needs poppler installed — documented in README.md.
 *
 * Required env vars: STAGING_SUPABASE_URL, STAGING_SUPABASE_ANON_KEY,
 * STAGING_TEST_USER_JWT, STAGING_UNICODE_SIMULADO_ID.
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
    process.env.STAGING_UNICODE_SIMULADO_ID,
);

// Characters known to render as "?" under the legacy pdf-lib/WinAnsi engine.
// The staging simulado behind STAGING_UNICODE_SIMULADO_ID must contain
// question/option text using all of these — see README.md.
const EXPECTED_UNICODE_CHARS = ["µg", "°C", "±", "→", "α", "β"];

describe.skipIf(!hasStagingEnv)("PDF generation preserves Unicode/medical symbols (staging)", () => {
  beforeAll(async () => {
    await authenticateAsTestUser(process.env.STAGING_TEST_USER_JWT!);
  });

  it("extracts correctly-rendered Unicode characters from the generated PDF", async () => {
    const simuladoId = process.env.STAGING_UNICODE_SIMULADO_ID!;
    const url = await offlineApi.getSignedPdfUrl(simuladoId, true);
    const bytes = await downloadPdfBytes(url);
    assertPdfMagicBytes(bytes);

    const dir = mkdtempSync(path.join(tmpdir(), "pdf-unicode-"));
    const pdfPath = path.join(dir, "exam.pdf");
    writeFileSync(pdfPath, bytes);

    try {
      // Requires poppler's `pdftotext` on PATH — see README.md.
      const text = execFileSync("pdftotext", [pdfPath, "-"], { encoding: "utf-8" });

      for (const char of EXPECTED_UNICODE_CHARS) {
        expect(
          text.includes(char),
          `Expected "${char}" to appear correctly in the extracted PDF text, not degraded to "?". ` +
            `Extracted text:\n${text.slice(0, 2000)}`,
        ).toBe(true);
      }

      // U+FFFD (replacement character) is what many extractors emit for
      // genuinely unmappable glyphs — a stronger signal than "?" alone,
      // which can also appear legitimately in exam text (e.g. a literal "?").
      expect(text).not.toMatch(/\uFFFD/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
