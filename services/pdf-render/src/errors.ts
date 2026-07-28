/**
 * Minimal, provisional typed error for the render pipeline.
 *
 * This file is a placeholder: Task 11 (`errors.ts`) is the task actually
 * responsible for the render pipeline's error hierarchy — a fuller `stage`
 * union covering every pipeline stage (fetch/template/compile/...), richer
 * per-stage metadata, maybe error subclasses per stage. Task 10
 * (`compile.ts`) needs *some* typed error to throw on compile failure and
 * runs before Task 11 exists, so it defines this minimal version instead of
 * blocking on it. Per the Task 10 brief: Task 11's implementer should
 * consolidate/import from this if reasonable, or supersede it outright and
 * update `compile.ts`'s import accordingly — either is fine, this is not
 * meant to be the final shape.
 */

/**
 * Which stage of the render pipeline raised the error. Only `'compile'` is
 * produced by code that exists as of Task 10; kept as a plain `string`
 * (rather than a `'compile'`-only literal) so other stages can start
 * throwing this same class without a type change, until Task 11 tightens it
 * into a real union.
 */
export type RenderStage = string;

export interface RenderStageErrorOptions extends ErrorOptions {
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
 * or which stage to blame in monitoring).
 */
export class RenderStageError extends Error {
  readonly stage: RenderStage;
  readonly pid?: number;
  readonly exitCode?: number | null;
  readonly signal?: NodeJS.Signals | null;
  readonly timedOut?: boolean;

  constructor(stage: RenderStage, message: string, options: RenderStageErrorOptions = {}) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = 'RenderStageError';
    this.stage = stage;
    this.pid = options.pid;
    this.exitCode = options.exitCode;
    this.signal = options.signal;
    this.timedOut = options.timedOut;
  }
}
