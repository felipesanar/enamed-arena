import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  FETCH_BATCH_SIZE,
  MAX_IMAGES,
  MAX_IMAGE_BYTES,
  fetchAndNormalizeImages,
  type ImageQuestion,
} from './fetchImages.js';

// ─── Fixtures (generated via sharp itself, no binary files committed) ──────

async function makePng(): Promise<Buffer> {
  return sharp({
    create: { width: 32, height: 32, channels: 4, background: { r: 10, g: 120, b: 200, alpha: 0.5 } },
  })
    .png()
    .toBuffer();
}

async function makeJpeg(): Promise<Buffer> {
  return sharp({
    create: { width: 32, height: 32, channels: 3, background: { r: 200, g: 30, b: 60 } },
  })
    .jpeg()
    .toBuffer();
}

async function makeCmykJpeg(): Promise<Buffer> {
  return sharp({
    create: { width: 32, height: 32, channels: 3, background: { r: 15, g: 200, b: 30 } },
  })
    .toColourspace('cmyk')
    .jpeg()
    .toBuffer();
}

async function makeTruncatedJpeg(): Promise<Buffer> {
  const full = await makeJpeg();
  return full.subarray(0, Math.floor(full.length * 0.3));
}

// ─── Test server ─────────────────────────────────────────────────────────────
//
// A real ephemeral http.Server (no mocking library) that:
// - serves fixture bytes on fixed routes (/png, /jpeg, /cmyk, /corrupt, /big)
// - serves unique bytes per id on /counted/:id, recording every path hit in
//   `requestedPaths` (used to prove the MAX_IMAGES cap is enforced before
//   any request is issued, and that all 150 permitted requests do land)
// - serves /slow/:id with an artificial delay + a live concurrency counter
//   (used to prove FETCH_BATCH_SIZE=8 is a genuine concurrency cap, not
//   just a chunking artifact)
// - serves /hang, which never responds (used for the timeout test, with a
//   short injected timeoutMs — the real 15s default is never exercised here)

describe('fetchAndNormalizeImages', () => {
  let server: Server;
  let baseUrl: string;
  let tempDir: string;

  let pngBytes: Buffer;
  let jpegBytes: Buffer;
  let cmykBytes: Buffer;
  let truncatedBytes: Buffer;

  let requestedPaths: string[];
  let concurrentCount: number;
  let maxConcurrentSeen: number;
  let slowDelayMs: number;

  beforeAll(async () => {
    [pngBytes, jpegBytes, cmykBytes, truncatedBytes] = await Promise.all([
      makePng(),
      makeJpeg(),
      makeCmykJpeg(),
      makeTruncatedJpeg(),
    ]);

    server = createServer((req: IncomingMessage, res: ServerResponse) => {
      const url = new URL(req.url ?? '/', 'http://localhost');
      requestedPaths.push(url.pathname);

      if (url.pathname === '/png') {
        res.writeHead(200, { 'content-type': 'image/png' });
        res.end(pngBytes);
        return;
      }
      if (url.pathname === '/jpeg') {
        res.writeHead(200, { 'content-type': 'image/jpeg' });
        res.end(jpegBytes);
        return;
      }
      if (url.pathname === '/cmyk') {
        res.writeHead(200, { 'content-type': 'image/jpeg' });
        res.end(cmykBytes);
        return;
      }
      if (url.pathname === '/corrupt') {
        res.writeHead(200, { 'content-type': 'image/jpeg' });
        res.end(truncatedBytes);
        return;
      }
      if (url.pathname === '/missing') {
        res.writeHead(404);
        res.end('not found');
        return;
      }
      if (url.pathname === '/big') {
        res.writeHead(200, { 'content-type': 'image/png' });
        res.end(Buffer.alloc(MAX_IMAGE_BYTES + 1, 1));
        return;
      }
      if (url.pathname === '/hang') {
        // Never respond, and never end — the client's AbortController must
        // be what tears this down.
        return;
      }
      if (url.pathname.startsWith('/counted/')) {
        res.writeHead(200, { 'content-type': 'image/png' });
        res.end(pngBytes);
        return;
      }
      if (url.pathname.startsWith('/slow/')) {
        concurrentCount++;
        maxConcurrentSeen = Math.max(maxConcurrentSeen, concurrentCount);
        setTimeout(() => {
          concurrentCount--;
          res.writeHead(200, { 'content-type': 'image/png' });
          res.end(pngBytes);
        }, slowDelayMs);
        return;
      }

      res.writeHead(404);
      res.end('unknown route');
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const addr = server.address();
    if (!addr || typeof addr === 'string') throw new Error('failed to bind test server');
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  beforeEach(async () => {
    requestedPaths = [];
    concurrentCount = 0;
    maxConcurrentSeen = 0;
    slowDelayMs = 30;
    tempDir = await mkdtemp(path.join(tmpdir(), 'fetch-images-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('fetches and normalizes a PNG, writing it to disk', async () => {
    const questions: ImageQuestion[] = [{ number: 1, image_url: `${baseUrl}/png` }];
    const results = await fetchAndNormalizeImages(questions, tempDir);

    expect(results).toHaveLength(1);
    expect(results[0]?.questionNumber).toBe(1);
    expect(results[0]?.localPath).not.toBeNull();

    const files = await readdir(tempDir);
    expect(files).toHaveLength(1);

    const meta = await sharp(results[0]!.localPath!).metadata();
    expect(meta.space).toBe('srgb');
  });

  it('fetches and normalizes a JPEG, writing it to disk', async () => {
    const questions: ImageQuestion[] = [{ number: 2, image_url: `${baseUrl}/jpeg` }];
    const results = await fetchAndNormalizeImages(questions, tempDir);

    expect(results).toHaveLength(1);
    expect(results[0]?.localPath).not.toBeNull();
    expect(results[0]?.localPath).toMatch(/\.jpg$/);

    const meta = await sharp(results[0]!.localPath!).metadata();
    expect(meta.format).toBe('jpeg');
    expect(meta.space).toBe('srgb');
  });

  it('tolerates a 404 without affecting the rest of the batch', async () => {
    const questions: ImageQuestion[] = [
      { number: 1, image_url: `${baseUrl}/missing` },
      { number: 2, image_url: `${baseUrl}/png` },
    ];
    const results = await fetchAndNormalizeImages(questions, tempDir);

    expect(results).toHaveLength(2);
    const q1 = results.find((r) => r.questionNumber === 1);
    const q2 = results.find((r) => r.questionNumber === 2);
    expect(q1?.localPath).toBeNull();
    expect(q2?.localPath).not.toBeNull();
  });

  it('rejects a body larger than MAX_IMAGE_BYTES (5MB)', async () => {
    const questions: ImageQuestion[] = [
      { number: 1, image_url: `${baseUrl}/big` },
      { number: 2, image_url: `${baseUrl}/png` },
    ];
    const results = await fetchAndNormalizeImages(questions, tempDir);

    const q1 = results.find((r) => r.questionNumber === 1);
    const q2 = results.find((r) => r.questionNumber === 2);
    expect(q1?.localPath).toBeNull();
    expect(q2?.localPath).not.toBeNull();
  });

  it('aborts on timeout without throwing, using an injected short timeout', async () => {
    const questions: ImageQuestion[] = [
      { number: 1, image_url: `${baseUrl}/hang` },
      { number: 2, image_url: `${baseUrl}/png` },
    ];
    // Inject a short timeout so the test doesn't wait for the real 15s
    // production default (IMAGE_FETCH_TIMEOUT) — this only overrides the
    // per-call timeout for this test, the production constant is untouched.
    const results = await fetchAndNormalizeImages(questions, tempDir, { timeoutMs: 100 });

    const q1 = results.find((r) => r.questionNumber === 1);
    const q2 = results.find((r) => r.questionNumber === 2);
    expect(q1?.localPath).toBeNull();
    expect(q2?.localPath).not.toBeNull();
  });

  it('normalizes a CMYK JPEG to sRGB', async () => {
    const questions: ImageQuestion[] = [{ number: 1, image_url: `${baseUrl}/cmyk` }];

    // Sanity check the fixture is actually CMYK before normalization.
    const fixtureMeta = await sharp(cmykBytes).metadata();
    expect(fixtureMeta.space).toBe('cmyk');

    const results = await fetchAndNormalizeImages(questions, tempDir);
    expect(results[0]?.localPath).not.toBeNull();

    const meta = await sharp(results[0]!.localPath!).metadata();
    expect(meta.space).toBe('srgb');
  });

  it('tolerates corrupted/truncated image bytes without throwing', async () => {
    const questions: ImageQuestion[] = [
      { number: 1, image_url: `${baseUrl}/corrupt` },
      { number: 2, image_url: `${baseUrl}/png` },
    ];
    const results = await fetchAndNormalizeImages(questions, tempDir);

    const q1 = results.find((r) => r.questionNumber === 1);
    const q2 = results.find((r) => r.questionNumber === 2);
    expect(q1?.localPath).toBeNull();
    expect(q2?.localPath).not.toBeNull();
  });

  it('never issues more than FETCH_BATCH_SIZE (8) concurrent requests', async () => {
    const total = 20;
    expect(total).toBeGreaterThan(FETCH_BATCH_SIZE);
    const questions: ImageQuestion[] = Array.from({ length: total }, (_, i) => ({
      number: i + 1,
      image_url: `${baseUrl}/slow/${i}`,
    }));

    const results = await fetchAndNormalizeImages(questions, tempDir);

    expect(results).toHaveLength(total);
    expect(results.every((r) => r.localPath !== null)).toBe(true);
    expect(maxConcurrentSeen).toBeLessThanOrEqual(FETCH_BATCH_SIZE);
    // With 20 images and a batch size of 8, there must be at least 2
    // batches that actually reach full concurrency (batches of 8, 8, 4) —
    // otherwise the assertion above would be vacuously true for a
    // sequential (non-concurrent) implementation.
    expect(maxConcurrentSeen).toBe(FETCH_BATCH_SIZE);
  });

  it('caps at MAX_IMAGES (150) and never issues a request for images beyond the cap', async () => {
    const total = MAX_IMAGES + 10;
    const questions: ImageQuestion[] = Array.from({ length: total }, (_, i) => ({
      number: i + 1,
      image_url: `${baseUrl}/counted/${i}`,
    }));

    const results = await fetchAndNormalizeImages(questions, tempDir);

    expect(results).toHaveLength(MAX_IMAGES);
    expect(requestedPaths).toHaveLength(MAX_IMAGES);

    const requestedIds = new Set(requestedPaths.map((p) => p.replace('/counted/', '')));
    for (let i = 0; i < MAX_IMAGES; i++) {
      expect(requestedIds.has(String(i))).toBe(true);
    }
    for (let i = MAX_IMAGES; i < total; i++) {
      expect(requestedIds.has(String(i))).toBe(false);
    }
  }, 20_000);

  it('filters out questions with image_url: null', async () => {
    const questions: ImageQuestion[] = [
      { number: 1, image_url: null },
      { number: 2, image_url: `${baseUrl}/png` },
    ];
    const results = await fetchAndNormalizeImages(questions, tempDir);

    expect(results).toHaveLength(1);
    expect(results[0]?.questionNumber).toBe(2);
  });
});
