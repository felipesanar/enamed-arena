/**
 * Integration tests for `server.ts`: a real ephemeral `http.Server`
 * (`server.listen(0)`), driven with the global `fetch` client — no mocking
 * of `node:http` itself. Covers auth, request validation, the healthcheck,
 * a genuine full pipeline run (real `fetchAndNormalizeImages` +
 * `renderExamTex` + `compileTex`, real `tectonic` subprocess), and one
 * `RenderStageError` → HTTP response mapping per named stage.
 *
 * ─── Why some tests inject `pipeline` overrides ────────────────────────────
 *
 * `fetchAndNormalizeImages` is documented (Task 8) to never throw — any
 * individual image failure is caught internally and reported as
 * `localPath: null`. So a `stage: 'fetch_images'` HTTP response can't be
 * triggered through the real function via a bad `image_url` (the request
 * would just succeed with `imageFailCount > 0`). Per the task brief's own
 * guidance ("use your judgment on what's practical to construct"), this
 * file uses `createServer`'s `pipeline` override hook to inject a failing
 * stand-in for exactly one stage at a time, so the `RenderStageError` →
 * `{error, stage}` mapping is exercised for each of the three named stages
 * without reshaping fetchImages.ts/renderTemplate.ts/compile.ts's public
 * APIs (Tasks 6-11, out of scope for this task).
 *
 * The "escape" stage error test does NOT need an injected override — it's
 * triggered for real by pointing `templatesDir` at a directory with no
 * template files, so `renderExamTex` genuinely throws (ENOENT).
 *
 * The "compile" stage error test injects a fake `renderExamTex` that
 * returns deliberately broken LaTeX (no `\end{document}`), then lets the
 * REAL `compileTex`/`tectonic` subprocess run against it and fail for real
 * — only the upstream stage is faked, the failure itself is genuine.
 */

import { createServer as createHttpServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import net, { type AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createServer, DEFAULT_TEMPLATES_DIR } from './server.js';
import type { ImageFetchResult, ImageQuestion } from './fetchImages.js';
import type { RenderInput } from './renderTemplate.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const assetsFontsDir = path.join(__dirname, '..', 'assets', 'fonts');

const TEST_SECRET = 'test-internal-secret-12345';

// ─── Server lifecycle helpers ───────────────────────────────────────────────

async function listenEphemeral(server: Server): Promise<number> {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address() as AddressInfo | null;
  if (!addr) throw new Error('failed to bind test server');
  return addr.port;
}

async function closeServer(server: Server): Promise<void> {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
}

// ─── Local templates fixture with fonts pointed at assets/fonts/ ───────────
//
// Same pattern established by renderTemplate.test.ts: templates/preamble.tex
// references fonts via an absolute `/opt/fonts/...` path that only exists
// inside the production Docker image. This builds a throwaway copy with just
// that path swapped to the repo's local `assets/fonts/`, so the real,
// unmodified `cover.tex`/`exam.tex` compile for real on a plain dev host.
function buildLocalTemplatesDir(): string {
  const workDir = mkdtempSync(path.join(tmpdir(), 'server-test-templates-'));
  const realPreamble = readFileSync(path.join(DEFAULT_TEMPLATES_DIR, 'preamble.tex'), 'utf8');
  const localPreamble = realPreamble.replaceAll('/opt/fonts/', `${assetsFontsDir}/`);
  writeFileSync(path.join(workDir, 'preamble.tex'), localPreamble);
  copyFileSync(path.join(DEFAULT_TEMPLATES_DIR, 'cover.tex'), path.join(workDir, 'cover.tex'));
  copyFileSync(path.join(DEFAULT_TEMPLATES_DIR, 'exam.tex'), path.join(workDir, 'exam.tex'));
  return workDir;
}

// ─── Sample payload builder ─────────────────────────────────────────────────

function buildValidPayload(imageUrl: string | null) {
  return {
    simulado: {
      title: 'Simulado ENAMED — Clínica Médica & Cirurgia',
      sequence_number: 3,
      questions_count: 3,
      duration_minutes: 90,
    },
    questions: [
      {
        number: 1,
        text: 'Paciente de 45 anos apresenta dor torácica típica. Qual a conduta inicial?',
        image_url: imageUrl,
        options: [
          { label: 'A', text: 'Solicitar ECG de 12 derivações imediatamente' },
          { label: 'B', text: 'Aguardar 50% de melhora espontânea antes de agir' },
        ],
      },
      {
        // No image — kept fast per the brief's guidance.
        number: 2,
        text: 'A dosagem de α-fetoproteína e β-hCG está elevada.',
        image_url: null,
        options: [{ label: 'A', text: 'Investigar tumor de células germinativas' }],
      },
      {
        number: 3,
        text: 'Questão sem alternativas.',
        image_url: null,
        options: [],
      },
    ],
  };
}

describe('server.ts (POST /render, GET /healthz)', () => {
  let localTemplatesDir: string;

  // A tiny local image-fixture HTTP server (same pattern as
  // fetchImages.test.ts) so the full pipeline test also exercises a real
  // image fetch, not just the "no image" fast path.
  let imageServer: Server;
  let imageServerUrl: string;

  beforeAll(async () => {
    localTemplatesDir = buildLocalTemplatesDir();

    const pngBytes = await sharp({
      create: { width: 64, height: 48, channels: 3, background: { r: 200, g: 30, b: 60 } },
    })
      .png()
      .toBuffer();

    imageServer = createHttpServer((req: IncomingMessage, res: ServerResponse) => {
      if (req.url === '/q1.png') {
        res.writeHead(200, { 'content-type': 'image/png' });
        res.end(pngBytes);
        return;
      }
      res.writeHead(404);
      res.end('not found');
    });
    const imagePort = await listenEphemeral(imageServer);
    imageServerUrl = `http://127.0.0.1:${imagePort}/q1.png`;
  });

  afterAll(async () => {
    await closeServer(imageServer);
    rmSync(localTemplatesDir, { recursive: true, force: true });
  });

  // ─── Auth ──────────────────────────────────────────────────────────────

  describe('authentication', () => {
    let server: Server;
    let baseUrl: string;
    let port: number;

    beforeAll(async () => {
      server = createServer({ templatesDir: localTemplatesDir, expectedSecret: TEST_SECRET });
      port = await listenEphemeral(server);
      baseUrl = `http://127.0.0.1:${port}`;
    });

    afterAll(async () => {
      await closeServer(server);
    });

    it('rejects a /render request with no x-internal-secret header with 403', async () => {
      const res = await fetch(`${baseUrl}/render`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(buildValidPayload(null)),
      });
      expect(res.status).toBe(403);
      const json = (await res.json()) as { error: string; stage: string };
      expect(json.stage).toBe('unknown');
    });

    it('rejects a /render request with a wrong x-internal-secret header with 403', async () => {
      const res = await fetch(`${baseUrl}/render`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-internal-secret': 'totally-wrong' },
        body: JSON.stringify(buildValidPayload(null)),
      });
      expect(res.status).toBe(403);
    });

    // Regression test for the fix that moved `req.destroy()` into
    // `res.end()`'s flush callback instead of calling it immediately after
    // `res.end()`. Speaks raw HTTP over a `net.Socket` (rather than `fetch`)
    // so it can observe the exact ordering: every byte of the 403 response
    // is collected as it arrives, and only resolved once the socket itself
    // closes. If `req.destroy()` ran before the response had actually been
    // flushed to the client, this would very likely observe a truncated
    // (incomplete/unparseable) body instead of the full, valid JSON error.
    it('fully delivers the 403 response body before the request socket closes', async () => {
      const responseText = await new Promise<string>((resolve, reject) => {
        const socket = net.connect(port, '127.0.0.1', () => {
          const body = JSON.stringify(buildValidPayload(null));
          socket.write(
            `POST /render HTTP/1.1\r\n` +
              `Host: 127.0.0.1:${port}\r\n` +
              `Content-Type: application/json\r\n` +
              `Content-Length: ${Buffer.byteLength(body)}\r\n` +
              `Connection: keep-alive\r\n` +
              `\r\n${body}`,
          );
        });
        let data = '';
        const timer = setTimeout(() => {
          socket.destroy();
          reject(new Error('timed out waiting for socket to close'));
        }, 5000);
        socket.on('data', (chunk: Buffer) => {
          data += chunk.toString('utf8');
        });
        socket.on('close', () => {
          clearTimeout(timer);
          resolve(data);
        });
        socket.on('error', (e) => {
          clearTimeout(timer);
          reject(e);
        });
      });

      expect(responseText).toMatch(/^HTTP\/1\.1 403/);
      const headerEnd = responseText.indexOf('\r\n\r\n');
      expect(headerEnd).toBeGreaterThan(-1);
      const bodyText = responseText.slice(headerEnd + 4);
      const json = JSON.parse(bodyText) as { error: string; stage: string };
      expect(json).toEqual({ error: 'Forbidden', stage: 'unknown' });
    });
  });

  // ─── Body validation ────────────────────────────────────────────────────

  describe('request body validation', () => {
    let server: Server;
    let baseUrl: string;

    beforeAll(async () => {
      server = createServer({ templatesDir: localTemplatesDir, expectedSecret: TEST_SECRET });
      const port = await listenEphemeral(server);
      baseUrl = `http://127.0.0.1:${port}`;
    });

    afterAll(async () => {
      await closeServer(server);
    });

    it('rejects a payload missing the required "simulado" field with 400, stage unknown', async () => {
      const malformed = { questions: buildValidPayload(null).questions };
      const res = await fetch(`${baseUrl}/render`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-internal-secret': TEST_SECRET },
        body: JSON.stringify(malformed),
      });
      expect(res.status).toBe(400);
      const json = (await res.json()) as { error: string; stage: string };
      expect(json.stage).toBe('unknown');
      expect(json.error).toContain('simulado');
    });

    it('rejects a payload with a question missing "options" with 400, stage unknown', async () => {
      const payload = buildValidPayload(null);
      // @ts-expect-error deliberately malformed for the test
      delete payload.questions[0].options;
      const res = await fetch(`${baseUrl}/render`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-internal-secret': TEST_SECRET },
        body: JSON.stringify(payload),
      });
      expect(res.status).toBe(400);
      const json = (await res.json()) as { error: string; stage: string };
      expect(json.stage).toBe('unknown');
    });

    it('rejects a body that is not valid JSON with 400, stage unknown', async () => {
      const res = await fetch(`${baseUrl}/render`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-internal-secret': TEST_SECRET },
        body: '{not valid json',
      });
      expect(res.status).toBe(400);
      const json = (await res.json()) as { error: string; stage: string };
      expect(json.stage).toBe('unknown');
    });

    // `MAX_BODY_BYTES` (server.ts, 10_000_000) — the body-size guard rejects
    // a request before JSON parsing is even attempted, once the accumulated
    // bytes read so far exceed the limit. This constructs a real payload
    // (valid JSON otherwise) padded past 10MB via a long question text, so
    // the only thing that can make this request fail is the byte-count
    // guard, not any other validation rule.
    it('rejects a request body larger than the 10MB body-size limit with 400', async () => {
      const payload = buildValidPayload(null);
      payload.questions[0].text = 'x'.repeat(10_000_001);
      const res = await fetch(`${baseUrl}/render`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-internal-secret': TEST_SECRET },
        body: JSON.stringify(payload),
      });
      expect(res.status).toBe(400);
      const json = (await res.json()) as { error: string; stage: string };
      expect(json.stage).toBe('unknown');
      expect(json.error).toContain('10000000 byte limit');
    }, 20_000);
  });

  // ─── Healthcheck ────────────────────────────────────────────────────────

  describe('GET /healthz', () => {
    let server: Server;
    let baseUrl: string;

    beforeAll(async () => {
      server = createServer({ templatesDir: localTemplatesDir, expectedSecret: TEST_SECRET });
      const port = await listenEphemeral(server);
      baseUrl = `http://127.0.0.1:${port}`;
    });

    afterAll(async () => {
      await closeServer(server);
    });

    it('returns 200 with no auth required', async () => {
      const res = await fetch(`${baseUrl}/healthz`);
      expect(res.status).toBe(200);
      expect(await res.text()).toBe('ok');
    });
  });

  // ─── Full pipeline (real fetch + real render + real tectonic compile) ──

  describe('full pipeline (real tectonic compile)', () => {
    let server: Server;
    let baseUrl: string;

    beforeAll(async () => {
      server = createServer({ templatesDir: localTemplatesDir, expectedSecret: TEST_SECRET });
      const port = await listenEphemeral(server);
      baseUrl = `http://127.0.0.1:${port}`;
    });

    afterAll(async () => {
      await closeServer(server);
    });

    it('returns a real PDF for a valid payload with the correct secret', async () => {
      const res = await fetch(`${baseUrl}/render`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-internal-secret': TEST_SECRET },
        body: JSON.stringify(buildValidPayload(imageServerUrl)),
      });

      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toBe('application/pdf');

      const bytes = Buffer.from(await res.arrayBuffer());
      expect(bytes.subarray(0, 5).toString('latin1')).toBe('%PDF-');
      expect(bytes.length).toBeGreaterThan(0);
    }, 60_000);
  });

  // ─── RenderStageError → HTTP response mapping, one per named stage ──────

  describe('RenderStageError → HTTP response mapping', () => {
    afterEach(() => {
      // Individual `it` blocks each create/close their own server.
    });

    it('maps a fetch_images stage failure to the error httpStatus/stage (injected failing stage)', async () => {
      const failingFetch = async (
        _questions: ImageQuestion[],
        _tempDir: string,
      ): Promise<ImageFetchResult[]> => {
        throw new Error('synthetic fetch_images failure for test');
      };

      const server = createServer({
        templatesDir: localTemplatesDir,
        expectedSecret: TEST_SECRET,
        pipeline: { fetchAndNormalizeImages: failingFetch },
      });
      const port = await listenEphemeral(server);
      try {
        const res = await fetch(`http://127.0.0.1:${port}/render`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-internal-secret': TEST_SECRET },
          body: JSON.stringify(buildValidPayload(null)),
        });
        expect(res.status).toBe(500);
        const json = (await res.json()) as { error: string; stage: string };
        expect(json.stage).toBe('fetch_images');
        expect(json.error).toContain('synthetic fetch_images failure');
      } finally {
        await closeServer(server);
      }
    });

    it('maps an escape stage failure to the error httpStatus/stage (real renderExamTex, missing templates)', async () => {
      const missingTemplatesDir = path.join(tmpdir(), `server-test-missing-templates-${Date.now()}`);
      const server = createServer({
        templatesDir: missingTemplatesDir,
        expectedSecret: TEST_SECRET,
      });
      const port = await listenEphemeral(server);
      try {
        const res = await fetch(`http://127.0.0.1:${port}/render`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-internal-secret': TEST_SECRET },
          body: JSON.stringify(buildValidPayload(null)),
        });
        expect(res.status).toBe(500);
        const json = (await res.json()) as { error: string; stage: string };
        expect(json.stage).toBe('escape');
      } finally {
        await closeServer(server);
      }
    });

    it('maps a compile stage failure to the error httpStatus/stage (injected broken .tex, real tectonic)', async () => {
      // Deliberately missing `\end{document}` (same failure mode as
      // `test/fixtures/compile-invalid.tex`, Task 10) — NOT a literal
      // "\end{document}" string anywhere in this text, which would just
      // close the environment for real and make the document compile.
      const brokenRenderExamTex = (_input: RenderInput, _templatesDir: string): string =>
        '\\documentclass{article}\n\\begin{document}\nThis document never closes its document environment.\n';

      const server = createServer({
        templatesDir: localTemplatesDir,
        expectedSecret: TEST_SECRET,
        pipeline: { renderExamTex: brokenRenderExamTex },
      });
      const port = await listenEphemeral(server);
      try {
        const res = await fetch(`http://127.0.0.1:${port}/render`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-internal-secret': TEST_SECRET },
          body: JSON.stringify(buildValidPayload(null)),
        });
        expect(res.status).toBe(500);
        const json = (await res.json()) as { error: string; stage: string };
        expect(json.stage).toBe('compile');
      } finally {
        await closeServer(server);
      }
    }, 20_000);
  });
});
