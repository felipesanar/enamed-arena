import { execFileSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { RenderStageError } from './errors.js';
import { compileTex, containsMissingCharacterWarning } from './compile.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(__dirname, '..', 'test', 'fixtures');

// `test/fixtures/minimal.tex` (Task 2) loads fonts via an absolute
// `fontspec` `Path = /opt/fonts/...`, which is only populated inside the
// production Docker image (Dockerfile's `COPY assets/fonts/ /opt/fonts/`).
// It is not present on a plain dev host — confirmed here: running Tectonic
// against it fails with "Package fontspec Error: The font ... cannot be
// found", a test-environment gap unrelated to compile.ts's correctness.
// `compile-ok.tex`/`compile-invalid.tex` (this task) are self-contained
// fixtures using only Tectonic's bundled default fonts, so the real
// `tectonic` binary can be exercised end-to-end on any host that merely has
// it installed.
const okFixture = path.join(fixturesDir, 'compile-ok.tex');
const invalidFixture = path.join(fixturesDir, 'compile-invalid.tex');

// Per the brief: if `tectonic` isn't on PATH in whatever environment later
// runs this suite, skip rather than fail CI. In this session it's installed
// (Homebrew, 0.17.0, matching the Dockerfile's pinned version) so the real
// binary is exercised, no subprocess mocking.
let tectonicAvailable = true;
try {
  execFileSync('tectonic', ['--version'], { stdio: 'ignore' });
} catch {
  tectonicAvailable = false;
}
const describeIfTectonic = tectonicAvailable ? describe : describe.skip;

describeIfTectonic('compileTex (real tectonic binary)', () => {
  let outDir: string;

  beforeAll(() => {
    if (!tectonicAvailable) {
      // eslint-disable-next-line no-console
      console.warn('[compile.test] tectonic not found on PATH — skipping compileTex suite');
    }
  });

  afterEach(async () => {
    if (outDir) await rm(outDir, { recursive: true, force: true });
  });

  it('compiles a valid .tex into a real PDF and reports a positive duration', async () => {
    outDir = await mkdtemp(path.join(tmpdir(), 'compile-test-ok-'));

    const result = await compileTex(okFixture, outDir);

    expect(result.pdfBytes.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(result.pdfBytes.length).toBeGreaterThan(0);
    expect(result.compileMs).toBeGreaterThan(0);
  });

  it('captures and logs stdout/stderr even on a successful compile', async () => {
    outDir = await mkdtemp(path.join(tmpdir(), 'compile-test-logs-'));
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    let calls: unknown[][];
    try {
      await compileTex(okFixture, outDir);
      // Read `.mock.calls` BEFORE `mockRestore()` — `mockRestore()` doesn't
      // just un-spy, it also resets recorded call state (equivalent to
      // `mockReset()` plus restoring the original implementation), so
      // reading calls afterwards always sees an empty array.
      calls = logSpy.mock.calls;
    } finally {
      logSpy.mockRestore();
    }

    // tectonic emits real progress notes to stdout even on success (e.g.
    // "note: Running TeX ...", "note: Writing `...pdf`") — confirm the
    // captured/logged text is non-empty, not just that logging happened.
    const stdoutLogCall = calls.find(
      (call) => typeof call[0] === 'string' && call[0].includes('tectonic stdout:'),
    );
    expect(stdoutLogCall).toBeDefined();
    const loggedStdout = String(stdoutLogCall?.[0] ?? '');
    expect(loggedStdout.length).toBeGreaterThan('[pdf-render] tectonic stdout:\n'.length);
    expect(loggedStdout).toContain('note:');
  });

  it('throws a RenderStageError with stage "compile" for invalid .tex (missing \\end{document})', async () => {
    outDir = await mkdtemp(path.join(tmpdir(), 'compile-test-invalid-'));

    await expect(compileTex(invalidFixture, outDir)).rejects.toMatchObject({
      name: 'RenderStageError',
      stage: 'compile',
    });

    try {
      await compileTex(invalidFixture, outDir);
      expect.unreachable('compileTex should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(RenderStageError);
      const err = e as RenderStageError;
      expect(err.stage).toBe('compile');
      expect(err.exitCode).not.toBe(0);
    }
  });

  it('kills the subprocess on an artificially short timeout and confirms it no longer exists', async () => {
    outDir = await mkdtemp(path.join(tmpdir(), 'compile-test-timeout-'));

    let caught: RenderStageError | undefined;
    try {
      // `okFixture` compiles in well under 200ms per the earlier manual
      // timing check; timeoutMs: 1 guarantees the kill fires before
      // tectonic can possibly finish (process spawn + TeX engine startup
      // alone takes longer than 1ms), so this is a deterministic timeout,
      // not a race.
      await compileTex(okFixture, outDir, 1);
      expect.unreachable('compileTex should have thrown due to timeout');
    } catch (e) {
      caught = e as RenderStageError;
    }

    expect(caught).toBeInstanceOf(RenderStageError);
    expect(caught?.stage).toBe('compile');
    expect(caught?.timedOut).toBe(true);
    expect(caught?.pid).toBeDefined();

    // compileTex's returned/rejected promise only settles after the child's
    // 'close' event, i.e. after the OS has actually reported the process as
    // exited — so by the time we get here, the real OS process must already
    // be gone, not merely "no longer awaited". Confirm at the OS level:
    // `process.kill(pid, 0)` throws ESRCH if no such process exists (and
    // does NOT throw merely because the process is owned by someone else —
    // it's spawned by this same test process, so a throw here can only mean
    // "gone").
    let killCheckError: NodeJS.ErrnoException | undefined;
    try {
      process.kill(caught!.pid!, 0);
    } catch (e) {
      killCheckError = e as NodeJS.ErrnoException;
    }
    expect(killCheckError).toBeDefined();
    expect(killCheckError?.code).toBe('ESRCH');
  });
});

// ─── "Missing character" detection ──────────────────────────────────────────
//
// Tested as a pure unit test against synthetic stdout+stderr text rather
// than a real compile: constructing a `.tex` fixture that reliably triggers
// a *real* XeTeX "Missing character" warning (a codepoint outside both Plus
// Jakarta Sans's coverage AND the Noto Sans Greek-block fallback wired up in
// preamble.tex) without depending on exactly which fonts/font versions are
// present on whatever host runs this suite is brittle. The brief explicitly
// sanctions this fallback: "se construir essa fixture for custoso, é
// aceitável testar a lógica de grep/detecção como teste unitário puro contra
// strings de stdout+stderr sintéticas."
describe('containsMissingCharacterWarning', () => {
  it('detects the literal "Missing character" warning XeTeX emits', () => {
    const syntheticLog = [
      'note: Running TeX ...',
      'Missing character: There is no ∀ (U+2200) in font PlusJakartaSans-Regular!',
      'note: Running xdvipdfmx ...',
    ].join('\n');

    expect(containsMissingCharacterWarning(syntheticLog)).toBe(true);
  });

  it('returns false for a clean compile log with no such warning', () => {
    const syntheticLog = [
      'note: Running TeX ...',
      'note: Rerunning TeX because "exam.aux" changed ...',
      'note: Running xdvipdfmx ...',
      "note: Writing `/tmp/out/exam.pdf` (128.4 KiB)",
    ].join('\n');

    expect(containsMissingCharacterWarning(syntheticLog)).toBe(false);
  });

  it('detects the warning even when only present in stderr (of a combined stdout+stderr string)', () => {
    const stdout = 'note: Running TeX ...';
    const stderr = 'Missing character: There is no 字 (U+5B57) in font NotoSans-Regular!';
    expect(containsMissingCharacterWarning(`${stdout}\n${stderr}`)).toBe(true);
  });
});
