/**
 * Typed error for the render pipeline.
 *
 * Every stage of the pipeline (fetching remote images, escaping user text
 * into LaTeX, compiling the `.tex` into a PDF) can fail in ways callers need
 * to distinguish — both to decide what to log/monitor and, in `server.ts`
 * (Task 12), to map the failure onto an HTTP response body `{error, stage}`
 * with an appropriate status code. `RenderStageError` is the single error
 * type every stage throws to make that possible.
 */

/**
 * Which stage of the render pipeline raised the error. `'unknown'` is for
 * failures that don't cleanly attribute to one of the three named stages
 * (e.g. an unexpected error caught by a catch-all in `server.ts`).
 */
export type RenderStage = 'fetch_images' | 'escape' | 'compile' | 'unknown';

export interface RenderStageErrorOptions extends ErrorOptions {
  /**
   * HTTP status `server.ts` should respond with for this error. Defaults to
   * `500` (generic server-side failure) — most render-pipeline failures are
   * not the caller's fault (a malformed `.tex` from our own template, a
   * flaky image host, a `tectonic` crash), so `500` is the safer default;
   * pass a specific status (e.g. `502`) when a stage can tell the
   * difference and genuinely represents an upstream/bad-gateway failure.
   *
   * Note: as of this writing, no current call site actually passes `502`.
   * The one place that constructs a `'fetch_images'`-stage error
   * (`server.ts`'s catch around `fetchAndNormalizeImages`) is documented
   * there as a defensive guard against failures OUTSIDE that module's own
   * contract (e.g. a disk error creating the temp directory's entries) —
   * genuine upstream image-fetch failures (a slow/unreachable host, a
   * non-200 response) are tolerated INSIDE `fetchAndNormalizeImages`
   * itself and reported as `localPath: null` per question, never thrown.
   * So the one real call site's failure mode is "something on our side
   * broke," for which the `500` default is the semantically correct
   * status — not `502`. If a future call site is added that genuinely
   * represents an upstream/bad-gateway failure, that is the place to pass
   * `httpStatus: 502`.
   */
  httpStatus?: number;
  /** PID of the subprocess involved, if any (e.g. the killed `tectonic` process on timeout). */
  pid?: number;
  /** Subprocess exit code, if the failure was a non-zero exit (not a timeout or spawn error). */
  exitCode?: number | null;
  /** Signal that terminated the subprocess, if any (e.g. `'SIGKILL'` after a timeout). */
  signal?: NodeJS.Signals | null;
  /** Whether this failure was caused by the configured timeout elapsing. */
  timedOut?: boolean;
}

/**
 * Thrown by any render-pipeline stage that fails in a way callers need to
 * distinguish by `stage` (e.g. to decide what user-facing message to show,
 * which stage to blame in monitoring, or what HTTP status to respond with).
 *
 * The constructor takes an options object (rather than positional args for
 * every field) so call sites only need to name the fields that apply to
 * their failure — e.g. a `compile` failure passes subprocess metadata
 * (`pid`/`exitCode`/`signal`/`timedOut`), while a `fetch_images` failure has
 * no use for those and would just pass `httpStatus`/`cause`.
 */
export class RenderStageError extends Error {
  readonly stage: RenderStage;
  readonly httpStatus: number;
  readonly pid?: number;
  readonly exitCode?: number | null;
  readonly signal?: NodeJS.Signals | null;
  readonly timedOut?: boolean;

  constructor(stage: RenderStage, message: string, options: RenderStageErrorOptions = {}) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = 'RenderStageError';
    this.stage = stage;
    this.httpStatus = options.httpStatus ?? 500;
    this.pid = options.pid;
    this.exitCode = options.exitCode;
    this.signal = options.signal;
    this.timedOut = options.timedOut;
  }
}
