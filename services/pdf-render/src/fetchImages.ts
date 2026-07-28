/**
 * Image fetching + normalization for the LaTeX render service.
 *
 * Ports `fetchImageWithTimeout`/`embedImage` from the legacy pdf-lib engine
 * (`supabase/functions/generate-exam-pdf/legacyPdfLib.ts`, lines ~160-196 and
 * their batching driver at ~611-643) to Node, preserving the exact same
 * safeguards and constants:
 *
 * - `MAX_IMAGES` (150): only the first N image-bearing questions are ever
 *   attempted; the cap is applied BEFORE any network request, so excess
 *   questions never get a fetch issued for them.
 * - `IMAGE_FETCH_TIMEOUT` (15s): per-image fetch timeout via `AbortController`
 *   (Node's global `fetch`, same Web-standard API Deno used).
 * - `MAX_IMAGE_BYTES` (5MB): oversized bodies are rejected.
 * - `FETCH_BATCH_SIZE` (8): fetches run in chunks of 8 concurrent requests
 *   (`Promise.all` per chunk), never more.
 *
 * Difference from the legacy engine: LaTeX/XeTeX needs an image FILE on
 * disk, not in-memory bytes handed to a PDF library, and is stricter than
 * pdf-lib about malformed JPEGs (e.g. CMYK colourspace, which pdf-lib's
 * `embedJpg` tolerates but XeTeX's graphics driver does not). So every
 * successfully-fetched image is re-encoded through `sharp` before being
 * written to `tempDir`:
 *   - images with an alpha channel are re-encoded as PNG;
 *   - everything else is re-encoded as baseline (non-progressive) JPEG in
 *     the sRGB colourspace.
 * Re-encoding through sharp also acts as a safety net against corrupted /
 * truncated bytes (sharp's decode failure becomes just another per-image
 * failure, exactly like a fetch timeout or an oversized body) and, since
 * sharp does not carry input metadata into its output unless explicitly
 * asked to, it drops any embedded ICC profile as a side effect.
 *
 * Any individual image failure (HTTP error, timeout, oversized body, sharp
 * decode failure, disk write failure) is caught, logged, and reported as
 * `localPath: null` for that question. It never throws out of this module
 * and never aborts the rest of the batch.
 */

import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

export const MAX_IMAGES = 150;
export const IMAGE_FETCH_TIMEOUT = 15_000;
export const MAX_IMAGE_BYTES = 5_000_000;
export const FETCH_BATCH_SIZE = 8;

export interface ImageFetchResult {
  questionNumber: number;
  localPath: string | null;
}

export interface ImageQuestion {
  number: number;
  image_url: string | null;
}

export interface FetchAndNormalizeImagesOptions {
  /**
   * Per-image fetch timeout in milliseconds. Defaults to
   * `IMAGE_FETCH_TIMEOUT` (15s), matching the legacy engine. Overriding this
   * is intended for tests only — production callers should rely on the
   * default.
   */
  timeoutMs?: number;
}

/**
 * Fetches the image for each question that has one, normalizes it via
 * `sharp`, and writes it to `tempDir`. Returns one result per attempted
 * question (questions with `image_url: null`, and any beyond the
 * `MAX_IMAGES` cap, are simply omitted from the output).
 */
export async function fetchAndNormalizeImages(
  questions: ImageQuestion[],
  tempDir: string,
  options: FetchAndNormalizeImagesOptions = {},
): Promise<ImageFetchResult[]> {
  const timeoutMs = options.timeoutMs ?? IMAGE_FETCH_TIMEOUT;

  const withImages = questions.filter(
    (q): q is ImageQuestion & { image_url: string } => q.image_url !== null,
  );
  // Cap applied before any fetch is issued: questions beyond MAX_IMAGES are
  // sliced off here and never reach fetchOne.
  const capped = withImages.slice(0, MAX_IMAGES);

  const results: ImageFetchResult[] = [];
  for (let i = 0; i < capped.length; i += FETCH_BATCH_SIZE) {
    const batch = capped.slice(i, i + FETCH_BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map((q) => fetchOne(q, tempDir, timeoutMs)),
    );
    results.push(...batchResults);
  }
  return results;
}

async function fetchOne(
  question: ImageQuestion & { image_url: string },
  tempDir: string,
  timeoutMs: number,
): Promise<ImageFetchResult> {
  const { number: questionNumber, image_url: url } = question;
  try {
    const bytes = await fetchImageBytes(url, questionNumber, timeoutMs);
    if (!bytes) return { questionNumber, localPath: null };

    const normalized = await normalizeImage(bytes, questionNumber);
    if (!normalized) return { questionNumber, localPath: null };

    const localPath = path.join(
      tempDir,
      `q${questionNumber}-image.${normalized.ext}`,
    );
    await writeFile(localPath, normalized.buffer);
    return { questionNumber, localPath };
  } catch (e) {
    console.warn(`[pdf-render] Image for Q${questionNumber} failed: ${String(e)}`);
    return { questionNumber, localPath: null };
  }
}

async function fetchImageBytes(
  url: string,
  questionNumber: number,
  timeoutMs: number,
): Promise<Uint8Array | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, { signal: controller.signal });
    if (!resp.ok) {
      console.warn(
        `[pdf-render] Image for Q${questionNumber} fetch failed: HTTP ${resp.status}`,
      );
      return null;
    }
    const buf = await resp.arrayBuffer();
    if (buf.byteLength > MAX_IMAGE_BYTES) {
      console.warn(
        `[pdf-render] Image for Q${questionNumber} skipped: ${buf.byteLength}B exceeds ${MAX_IMAGE_BYTES}B limit`,
      );
      return null;
    }
    return new Uint8Array(buf);
  } catch (e) {
    const reason =
      e instanceof Error && e.name === 'AbortError' ? 'timeout' : String(e);
    console.warn(`[pdf-render] Image for Q${questionNumber} fetch failed: ${reason}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function normalizeImage(
  bytes: Uint8Array,
  questionNumber: number,
): Promise<{ buffer: Buffer; ext: 'png' | 'jpg' } | null> {
  try {
    const image = sharp(bytes);
    const metadata = await image.metadata();
    if (metadata.hasAlpha) {
      const buffer = await image.toColourspace('srgb').png().toBuffer();
      return { buffer, ext: 'png' };
    }
    const buffer = await image
      .toColourspace('srgb')
      .jpeg({ quality: 92, progressive: false })
      .toBuffer();
    return { buffer, ext: 'jpg' };
  } catch (e) {
    console.warn(
      `[pdf-render] Image for Q${questionNumber} normalize failed: ${String(e)}`,
    );
    return null;
  }
}
