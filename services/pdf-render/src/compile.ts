/**
 * Invokes the `tectonic` binary to compile an already-written `.tex` file
 * (the output of `renderExamTex`, Task 9, written to disk by this module's
 * caller — a later task, `server.ts`/Task 12) into PDF bytes.
 *
 * Safety/observability properties required by the task brief, all
 * implemented here:
 * - `child_process.spawn` with an argv array — never `exec`/`shell: true`,
 *   so arguments are never passed through shell interpretation (defense in
 *   depth, even though every argument here is controlled by this codebase).
 * - stdout/stderr are captured and logged UNCONDITIONALLY, not just on
 *   failure — dense Tectonic/XeTeX logs (overfull hbox, font substitution
 *   notes, etc.) are the primary debugging tool for LaTeX issues, and many
 *   real problems show up as warnings in an otherwise "successful" (exit
 *   code 0) compile.
 * - The combined stdout+stderr is grepped for the literal string
 *   "Missing character" and, if found, a distinct, prominent WARNING is
 *   logged separately from the generic log dump. This operationalizes a
 *   finding from earlier tasks in this migration: the vendored Plus Jakarta
 *   Sans font doesn't cover the full Unicode range (e.g. Greek letters),
 *   `preamble.tex` adds a Noto Sans fallback for the Greek block
 *   specifically via `ucharclasses`, but any OTHER uncovered Unicode block
 *   showing up in real exam content would render with a missing/wrong
 *   glyph and this warning is the only operational signal of that.
 * - A configurable timeout kills the subprocess (`SIGKILL`) if it hangs —
 *   pathological `.tex` input (e.g. a hyphenation infinite loop or a table
 *   that never breaks) could otherwise hang the whole service indefinitely.
 *   The promise only resolves/rejects after the child's `'close'` event,
 *   i.e. after the OS has actually reported the process as exited — timing
 *   out here is a real kill, not merely abandoning a pending promise while
 *   `tectonic` keeps running.
 * - Compile duration is measured (`compileMs`) via `process.hrtime.bigint`,
 *   which is monotonic and unaffected by wall-clock adjustments.
 */

import { spawn } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { RenderStageError } from './errors.js';

export interface CompileResult {
  pdfBytes: Buffer;
  compileMs: number;
}

/**
 * Default compile timeout: 40s.
 *
 * Deliberately kept safely BELOW `supabase/functions/generate-exam-pdf/renderClient.ts`'s
 * default per-attempt timeout (`PDF_RENDER_TIMEOUT_MS`, 45s) — the render
 * service must always be the side that times out first. If this value were
 * higher than the Edge Function's timeout (as a previous 60s default was),
 * a compile legitimately taking 45-60s would get abandoned by the Edge
 * Function caller while this service kept burning CPU on a PDF nobody would
 * ever receive, with no chance to fail cleanly with an actionable
 * `stage: 'compile'` error. Both values remain independently configurable
 * via env vars — only the relative ORDER of the two defaults matters here.
 */
export const DEFAULT_COMPILE_TIMEOUT_MS = 40_000;

/** Captured stdout/stderr is truncated past this many bytes each, per the brief ("buffer com limite, ex. truncar em 2MB"). */
export const MAX_CAPTURED_OUTPUT_BYTES = 2_000_000;

const MISSING_CHARACTER_NEEDLE = 'Missing character';

/**
 * Returns whether the combined stdout+stderr of a `tectonic` run contains
 * the literal "Missing character" warning XeTeX emits when a codepoint has
 * no glyph in any font it tried (main font, then any `ucharclasses`
 * fallback). Exported as a standalone function so the detection logic can
 * be exercised as a pure unit test against synthetic log text, without
 * needing to construct a real `.tex` fixture that reliably reproduces a
 * missing glyph on every environment/font version.
 */
export function containsMissingCharacterWarning(combinedOutput: string): boolean {
  return combinedOutput.includes(MISSING_CHARACTER_NEEDLE);
}

/** Accumulates chunks up to `limitBytes`, dropping anything past that (with a note appended), so a runaway log can't grow captured output unboundedly. */
function makeTruncatingCollector(limitBytes: number) {
  const chunks: Buffer[] = [];
  let total = 0;
  let truncated = false;

  return {
    push(chunk: Buffer): void {
      if (truncated) return;
      const remaining = limitBytes - total;
      if (chunk.length <= remaining) {
        chunks.push(chunk);
        total += chunk.length;
      } else {
        if (remaining > 0) chunks.push(chunk.subarray(0, remaining));
        total = limitBytes;
        truncated = true;
      }
    },
    toString(): string {
      const text = Buffer.concat(chunks).toString('utf8');
      return truncated ? `${text}\n...[output truncated at ${limitBytes} bytes]` : text;
    },
  };
}

interface SpawnOutcome {
  code: number | null;
  signal: NodeJS.Signals | null;
  timedOut: boolean;
  spawnError: Error | null;
  pid: number | undefined;
}

function runTectonic(texFilePath: string, outDir: string, timeoutMs: number): {
  outcome: Promise<SpawnOutcome>;
  stdout: ReturnType<typeof makeTruncatingCollector>;
  stderr: ReturnType<typeof makeTruncatingCollector>;
} {
  const stdout = makeTruncatingCollector(MAX_CAPTURED_OUTPUT_BYTES);
  const stderr = makeTruncatingCollector(MAX_CAPTURED_OUTPUT_BYTES);

  const outcome = new Promise<SpawnOutcome>((resolve) => {
    // Argv array, no `shell: true` — arguments are never shell-interpreted.
    const child = spawn('tectonic', [texFilePath, `--outdir=${outDir}`], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let timedOut = false;
    let settled = false;
    const timer = setTimeout(() => {
      timedOut = true;
      // SIGKILL directly (not SIGTERM-then-escalate): the process is going
      // to be reported as failed regardless, so there's no benefit to a
      // graceful-shutdown grace period here, only latency.
      child.kill('SIGKILL');
    }, timeoutMs);

    child.stdout?.on('data', (chunk: Buffer) => stdout.push(chunk));
    child.stderr?.on('data', (chunk: Buffer) => stderr.push(chunk));

    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ code: null, signal: null, timedOut, spawnError: err, pid: child.pid });
    });

    // 'close' (not 'exit') fires once the OS has reported the process exited
    // AND its stdio streams have closed — the strongest available guarantee
    // that a killed process is actually gone, not just that we stopped
    // listening.
    child.on('close', (code, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ code, signal, timedOut, spawnError: null, pid: child.pid });
    });
  });

  return { outcome, stdout, stderr };
}

/**
 * Compiles `texFilePath` with `tectonic`, returning the resulting PDF bytes.
 *
 * @param texFilePath Path to an already-written `.tex` file on disk.
 * @param outDir Directory `tectonic --outdir=` writes into; the compiled
 *   PDF is expected at `${outDir}/${basename(texFilePath, '.tex')}.pdf`.
 * @param timeoutMs Kill the subprocess if it hasn't finished within this
 *   many milliseconds. Defaults to `DEFAULT_COMPILE_TIMEOUT_MS` (40s).
 * @throws {RenderStageError} with `stage: 'compile'` if `tectonic` fails to
 *   start, exits non-zero, times out, or produces a missing/empty PDF.
 */
export async function compileTex(
  texFilePath: string,
  outDir: string,
  timeoutMs: number = DEFAULT_COMPILE_TIMEOUT_MS,
): Promise<CompileResult> {
  const startedAt = process.hrtime.bigint();
  const { outcome, stdout, stderr } = runTectonic(texFilePath, outDir, timeoutMs);
  const { code, signal, timedOut, spawnError, pid } = await outcome;
  const compileMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;

  const stdoutText = stdout.toString();
  const stderrText = stderr.toString();
  const combined = `${stdoutText}\n${stderrText}`;

  // Log captured output unconditionally — on success too, per the brief.
  console.log(
    `[pdf-render] tectonic compile finished: file=${texFilePath} outDir=${outDir} ` +
      `compileMs=${compileMs.toFixed(1)} exitCode=${code ?? 'null'} signal=${signal ?? 'none'} timedOut=${timedOut}`,
  );
  console.log(`[pdf-render] tectonic stdout:\n${stdoutText}`);
  console.log(`[pdf-render] tectonic stderr:\n${stderrText}`);

  if (containsMissingCharacterWarning(combined)) {
    console.warn(
      [
        '!'.repeat(70),
        `[pdf-render] WARNING: tectonic reported "${MISSING_CHARACTER_NEEDLE}" ` +
          `compiling ${texFilePath}.`,
        'A character in this document has no glyph in any loaded font ' +
          '(Plus Jakarta Sans, or the Noto Sans fallback wired up for the ' +
          'Greek Unicode block in preamble.tex). It rendered as a missing/' +
          'wrong glyph in the output PDF. If this is from real exam ' +
          'content, a Unicode block outside what those two fonts cover is ' +
          'in use — investigate and consider widening the fallback.',
        '!'.repeat(70),
      ].join('\n'),
    );
  }

  if (spawnError) {
    throw new RenderStageError('compile', `tectonic failed to start: ${spawnError.message}`, {
      cause: spawnError,
      pid,
    });
  }

  if (timedOut) {
    throw new RenderStageError(
      'compile',
      `tectonic compile of ${texFilePath} did not finish within ${timeoutMs}ms and was killed`,
      { pid, timedOut: true, signal },
    );
  }

  if (code !== 0) {
    throw new RenderStageError(
      'compile',
      `tectonic exited with code ${code} (signal=${signal ?? 'none'}) compiling ${texFilePath}`,
      { pid, exitCode: code, signal },
    );
  }

  const pdfPath = path.join(outDir, `${path.basename(texFilePath, path.extname(texFilePath))}.pdf`);

  let fileInfo;
  try {
    fileInfo = await stat(pdfPath);
  } catch (e) {
    throw new RenderStageError('compile', `expected output PDF not found at ${pdfPath}`, {
      cause: e,
      pid,
    });
  }
  if (fileInfo.size === 0) {
    throw new RenderStageError('compile', `output PDF at ${pdfPath} is empty (0 bytes)`, { pid });
  }

  const pdfBytes = await readFile(pdfPath);
  return { pdfBytes, compileMs };
}
