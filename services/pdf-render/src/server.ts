/**
 * HTTP orchestration for the LaTeX render service — ties together every
 * module from Tasks 6-11 into the `POST /render` pipeline documented in the
 * plan's Global Constraints:
 *
 *   auth (auth.ts) → parse/validate body → fetchAndNormalizeImages (Task 8)
 *   → renderExamTex (Task 9) → write .tex to disk → compileTex (Task 10)
 *   → respond with PDF bytes.
 *
 * Framework choice: plain Node `http`, not Express. This package has zero
 * runtime dependencies beyond `sharp` (see package.json) — every other
 * module in this service (fetchImages.ts's test server, compile.ts's
 * subprocess handling) already builds directly on Node primitives with no
 * framework, and the route surface here is exactly two endpoints with no
 * need for routing/middleware machinery. Adding Express would mean a new
 * dependency (plus its transitive tree) for functionality `node:http`
 * already provides in ~200 lines.
 *
 * Per-request isolation: Cloud Run can route concurrent requests to the same
 * container instance, so no state may be shared between requests. Every
 * `POST /render` call gets its own `fs.mkdtemp` temp directory, created
 * fresh and removed in a `finally` block regardless of success or failure —
 * nothing is cached or reused across requests.
 *
 * Testability: the three pipeline stage functions (`fetchAndNormalizeImages`,
 * `renderExamTex`, `compileTex`) and `templatesDir` are all injectable via
 * `createServer`'s options, defaulting to the real Task 8-10 implementations
 * and the real `templates/` directory. Production code path never overrides
 * these; `server.test.ts` uses the override hooks to (a) point at a
 * throwaway templates copy with local (non-`/opt/fonts`) font paths for a
 * genuine end-to-end compile on a dev host, and (b) inject a failing stand-in
 * for one stage at a time to exercise `RenderStageError` → HTTP response
 * mapping without reshaping any Task 6-11 module's public API.
 */

import { createServer as createHttpServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateInternalSecret } from './auth.js';
import { compileTex as defaultCompileTex } from './compile.js';
import { RenderStageError, type RenderStage } from './errors.js';
import { fetchAndNormalizeImages as defaultFetchAndNormalizeImages, type ImageQuestion } from './fetchImages.js';
import { renderExamTex as defaultRenderExamTex, type RenderInput } from './renderTemplate.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Real production templates directory (`services/pdf-render/templates/`). */
export const DEFAULT_TEMPLATES_DIR = path.join(__dirname, '..', 'templates');

/** Request body larger than this is rejected with 400 before JSON parsing is attempted. */
const MAX_BODY_BYTES = 10_000_000;

// ─── Request/response contract types ───────────────────────────────────────

interface RenderRequestOption {
  label: string;
  text: string;
}

interface RenderRequestQuestion {
  number: number;
  text: string;
  image_url: string | null;
  options: RenderRequestOption[];
}

interface RenderRequestBody {
  simulado: {
    title: string;
    sequence_number: number;
    questions_count: number;
    duration_minutes: number;
  };
  questions: RenderRequestQuestion[];
}

/** Thrown for a malformed/incomplete request body. Always maps to HTTP 400 + `stage: 'unknown'`. */
class ValidationError extends Error {}

// ─── Body parsing/validation ────────────────────────────────────────────────

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new ValidationError(`${field} must be a non-empty string`);
  }
  return value;
}

function requireNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new ValidationError(`${field} must be a finite number`);
  }
  return value;
}

function validateOption(raw: unknown, path: string): RenderRequestOption {
  if (!isPlainObject(raw)) throw new ValidationError(`${path} must be an object`);
  return {
    label: requireString(raw.label, `${path}.label`),
    text: requireString(raw.text, `${path}.text`),
  };
}

function validateQuestion(raw: unknown, path: string): RenderRequestQuestion {
  if (!isPlainObject(raw)) throw new ValidationError(`${path} must be an object`);
  const imageUrl = raw.image_url;
  if (imageUrl !== null && typeof imageUrl !== 'string') {
    throw new ValidationError(`${path}.image_url must be a string or null`);
  }
  if (!Array.isArray(raw.options)) {
    throw new ValidationError(`${path}.options must be an array`);
  }
  return {
    number: requireNumber(raw.number, `${path}.number`),
    text: requireString(raw.text, `${path}.text`),
    image_url: imageUrl,
    options: raw.options.map((opt, i) => validateOption(opt, `${path}.options[${i}]`)),
  };
}

/**
 * Validates that `raw` (the parsed JSON body) matches the request contract
 * from the plan's Global Constraints. Throws `ValidationError` (mapped to
 * HTTP 400, `stage: 'unknown'`, by the caller) on any missing/malformed
 * required field.
 */
function validateRequestBody(raw: unknown): RenderRequestBody {
  if (!isPlainObject(raw)) throw new ValidationError('request body must be a JSON object');

  const simuladoRaw = raw.simulado;
  if (!isPlainObject(simuladoRaw)) throw new ValidationError('missing or invalid "simulado" field');

  const simulado = {
    title: requireString(simuladoRaw.title, 'simulado.title'),
    sequence_number: requireNumber(simuladoRaw.sequence_number, 'simulado.sequence_number'),
    questions_count: requireNumber(simuladoRaw.questions_count, 'simulado.questions_count'),
    duration_minutes: requireNumber(simuladoRaw.duration_minutes, 'simulado.duration_minutes'),
  };

  if (!Array.isArray(raw.questions) || raw.questions.length === 0) {
    throw new ValidationError('missing or empty "questions" array');
  }

  const questions = raw.questions.map((q, i) => validateQuestion(q, `questions[${i}]`));

  return { simulado, questions };
}

/** Reads the full request body into a `Buffer`, rejecting once it exceeds `MAX_BODY_BYTES`. */
function readRequestBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    req.on('data', (chunk: Buffer) => {
      total += chunk.length;
      if (total > MAX_BODY_BYTES) {
        reject(new ValidationError(`request body exceeds ${MAX_BODY_BYTES} byte limit`));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', (e) => reject(e));
  });
}

function firstHeaderValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

// ─── HTTP response helpers ──────────────────────────────────────────────────

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

function sendErrorResponse(res: ServerResponse, err: unknown): { stage: RenderStage; httpStatus: number } {
  if (err instanceof ValidationError) {
    sendJson(res, 400, { error: err.message, stage: 'unknown' });
    return { stage: 'unknown', httpStatus: 400 };
  }
  if (err instanceof RenderStageError) {
    sendJson(res, err.httpStatus, { error: err.message, stage: err.stage });
    return { stage: err.stage, httpStatus: err.httpStatus };
  }
  console.error('[pdf-render] unexpected error handling /render:', err);
  sendJson(res, 500, { error: 'internal error', stage: 'unknown' });
  return { stage: 'unknown', httpStatus: 500 };
}

// ─── Timing helpers ─────────────────────────────────────────────────────────

function nowNs(): bigint {
  return process.hrtime.bigint();
}

function msSince(startNs: bigint): number {
  return Number(nowNs() - startNs) / 1_000_000;
}

function makeRequestId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// ─── Pipeline dependency injection (for tests) ──────────────────────────────

export interface PipelineDeps {
  fetchAndNormalizeImages: typeof defaultFetchAndNormalizeImages;
  renderExamTex: typeof defaultRenderExamTex;
  compileTex: typeof defaultCompileTex;
}

export interface CreateServerOptions {
  /** Defaults to the real `services/pdf-render/templates/` directory. */
  templatesDir?: string;
  /** Defaults to `process.env.PDF_RENDER_SERVICE_SECRET`. */
  expectedSecret?: string;
  /**
   * Override one or more pipeline stage functions. Intended for tests only —
   * production always uses the real Task 8/9/10 implementations (the
   * defaults). Lets `server.test.ts` inject a failing stand-in for a single
   * stage to exercise `RenderStageError` → HTTP response mapping without
   * reshaping any Task 6-11 module's public API.
   */
  pipeline?: Partial<PipelineDeps>;
}

interface ResolvedDeps {
  templatesDir: string;
  expectedSecret: string | undefined;
  pipeline: PipelineDeps;
}

function resolveDeps(options: CreateServerOptions): ResolvedDeps {
  return {
    templatesDir: options.templatesDir ?? DEFAULT_TEMPLATES_DIR,
    expectedSecret: options.expectedSecret ?? process.env.PDF_RENDER_SERVICE_SECRET,
    pipeline: {
      fetchAndNormalizeImages: options.pipeline?.fetchAndNormalizeImages ?? defaultFetchAndNormalizeImages,
      renderExamTex: options.pipeline?.renderExamTex ?? defaultRenderExamTex,
      compileTex: options.pipeline?.compileTex ?? defaultCompileTex,
    },
  };
}

// ─── /render handler ─────────────────────────────────────────────────────────

async function handleRender(req: IncomingMessage, res: ServerResponse, deps: ResolvedDeps): Promise<void> {
  const requestId = makeRequestId();
  const totalStart = nowNs();

  let tempDir: string | undefined;
  let imagesFetchMs = 0;
  let renderTemplateMs = 0;
  let compileMs = 0;
  let imageCount = 0;
  let imageFailCount = 0;
  let questionCount = 0;
  let outcome: { stage: RenderStage; httpStatus: number } = { stage: 'unknown', httpStatus: 200 };

  try {
    const headerSecret = firstHeaderValue(req.headers['x-internal-secret']);
    if (!validateInternalSecret(headerSecret, deps.expectedSecret)) {
      sendJson(res, 403, { error: 'Forbidden', stage: 'unknown' });
      // The request body was never read (auth is checked deliberately
      // before parsing, so an unauthenticated caller can't force us to
      // buffer an arbitrarily large body into memory). On a keep-alive
      // HTTP/1.1 connection those unread bytes would otherwise be
      // misinterpreted as the start of the next request on the same
      // socket — destroy the connection instead of leaving it open.
      req.destroy();
      outcome = { stage: 'unknown', httpStatus: 403 };
      return;
    }

    const rawBody = await readRequestBody(req);
    let parsedBody: unknown;
    try {
      parsedBody = JSON.parse(rawBody.toString('utf8'));
    } catch {
      throw new ValidationError('request body is not valid JSON');
    }
    const body = validateRequestBody(parsedBody);
    questionCount = body.questions.length;

    tempDir = await mkdtemp(path.join(tmpdir(), 'pdf-render-'));

    // Stage: fetch_images (Task 8). `fetchAndNormalizeImages` is documented
    // to never throw (individual image failures are tolerated, reported as
    // `localPath: null`) — this try/catch is defensive, guarding against a
    // failure the module's own contract doesn't anticipate (e.g. a disk
    // error creating tempDir's entries), per the task brief's instruction
    // to wrap this stage's failures as `RenderStageError('fetch_images', ...)`.
    const imagesStart = nowNs();
    const imageQuestions: ImageQuestion[] = body.questions.map((q) => ({
      number: q.number,
      image_url: q.image_url,
    }));
    let imageResults;
    try {
      imageResults = await deps.pipeline.fetchAndNormalizeImages(imageQuestions, tempDir);
    } catch (e) {
      throw new RenderStageError('fetch_images', `image fetch/normalize failed: ${describeError(e)}`, {
        cause: e,
      });
    }
    imagesFetchMs = msSince(imagesStart);
    imageCount = imageResults.length;
    imageFailCount = imageResults.filter((r) => r.localPath === null).length;

    const localImagePathByQuestion = new Map(imageResults.map((r) => [r.questionNumber, r.localPath]));

    // Stage: escape (Task 9 — template fill, including the escapeLatex/
    // textToLatex pipeline it calls internally) + writing the resulting
    // .tex string to disk. "escape" is the established stage name per the
    // plan even though this step also does template substitution.
    const renderStart = nowNs();
    let texFilePath: string;
    try {
      const renderInput: RenderInput = {
        simulado: body.simulado,
        questions: body.questions.map((q) => ({
          number: q.number,
          text: q.text,
          localImagePath: localImagePathByQuestion.get(q.number) ?? null,
          options: q.options,
        })),
      };
      const tex = deps.pipeline.renderExamTex(renderInput, deps.templatesDir);
      texFilePath = path.join(tempDir, 'exam.tex');
      await writeFile(texFilePath, tex, 'utf8');
    } catch (e) {
      throw new RenderStageError('escape', `template render failed: ${describeError(e)}`, { cause: e });
    }
    renderTemplateMs = msSince(renderStart);

    // Stage: compile (Task 10). `compileTex` already throws
    // `RenderStageError('compile', ...)` itself — no extra wrapping needed.
    const compileStart = nowNs();
    const { pdfBytes } = await deps.pipeline.compileTex(texFilePath, tempDir);
    compileMs = msSince(compileStart);

    res.writeHead(200, {
      'Content-Type': 'application/pdf',
      'Content-Length': pdfBytes.length,
    });
    res.end(pdfBytes);
    outcome = { stage: 'unknown', httpStatus: 200 };
  } catch (e) {
    outcome = sendErrorResponse(res, e);
  } finally {
    const totalMs = msSince(totalStart);
    console.log(
      JSON.stringify({
        tag: 'pdf-render-request',
        requestId,
        httpStatus: outcome.httpStatus,
        stage: outcome.stage,
        imagesFetchMs: round1(imagesFetchMs),
        renderTemplateMs: round1(renderTemplateMs),
        compileMs: round1(compileMs),
        totalMs: round1(totalMs),
        imageCount,
        imageFailCount,
        questionCount,
      }),
    );
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true }).catch((e) => {
        console.warn(`[pdf-render] failed to remove tempDir ${tempDir}: ${describeError(e)}`);
      });
    }
  }
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function describeError(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

// ─── Server wiring ───────────────────────────────────────────────────────────

function requestListener(deps: ResolvedDeps) {
  return (req: IncomingMessage, res: ServerResponse): void => {
    const pathname = (req.url ?? '/').split('?')[0];

    if (req.method === 'GET' && pathname === '/healthz') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('ok');
      return;
    }

    if (req.method === 'POST' && pathname === '/render') {
      void handleRender(req, res, deps);
      return;
    }

    sendJson(res, 404, { error: 'not found', stage: 'unknown' });
  };
}

/**
 * Builds the render service's `http.Server`. Does not call `.listen()` —
 * callers (production bootstrap below, or tests) decide the port.
 */
export function createServer(options: CreateServerOptions = {}): Server {
  const deps = resolveDeps(options);
  return createHttpServer(requestListener(deps));
}

const isMainModule = process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMainModule) {
  const server = createServer();
  const port = Number(process.env.PORT) || 8080;
  server.listen(port, () => {
    console.log(`[pdf-render] listening on port ${port}`);
  });
}
