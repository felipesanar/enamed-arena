import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { renderExamTex } from './renderTemplate.js';
import type { RenderInput } from './renderTemplate.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const templatesDir = path.join(__dirname, '..', 'templates');
const assetsFontsDir = path.join(__dirname, '..', 'assets', 'fonts');

// ─── Sample input ───────────────────────────────────────────────────────────
//
// 3 questions exercising the cases called out by the task brief:
//   - Q1: has an image (localImagePath non-null) AND an option containing
//     both `_` and `%` (special-character escaping in option text).
//   - Q2: no image; one option deliberately carries a redundant "B) "
//     label prefix (tests `stripLabel`), and the question TEXT contains
//     Greek characters (α, β) that must pass through unescaped.
//   - Q3: no image, zero options (tests the "0 options" branch — no
//     dangling/invalid empty `enumerate`).
function buildInput(imagePath: string | null): RenderInput {
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
        text:
          'Paciente de 45 anos apresenta dor torácica típica.\n\n' +
          'Considere o quadro clínico:\n' +
          '- Dor retroesternal\n' +
          '- Sudorese profusa\n' +
          'Qual a conduta inicial?',
        localImagePath: imagePath,
        options: [
          { label: 'A', text: 'Solicitar ECG de 12 derivações imediatamente' },
          { label: 'B', text: 'Aguardar 50% de melhora espontânea antes de agir' },
          { label: 'C', text: 'Prescrever apenas paracetamol_500mg e reavaliar em 24h' },
          { label: 'D', text: 'Encaminhar para fisioterapia respiratória' },
        ],
      },
      {
        number: 2,
        text: 'A dosagem de α-fetoproteína e β-hCG está elevada, sugerindo neoplasia germinativa.',
        localImagePath: null,
        options: [
          { label: 'A', text: 'B) Investigar tumor de células germinativas' },
          { label: 'B', text: 'Repetir exame em 90% dos casos assintomáticos' },
        ],
      },
      {
        number: 3,
        text: 'Questão sem alternativas, usada apenas para testar o caso de 0 opções.',
        localImagePath: null,
        options: [],
      },
    ],
  };
}

describe('renderExamTex', () => {
  it('substitutes every @@TOKEN@@ marker (none remain in the output)', () => {
    const tex = renderExamTex(buildInput(null), templatesDir);
    expect(tex).not.toMatch(/@@[A-Z0-9_]+@@/);
  });

  it('replaces \\input{preamble} and \\input{cover} with real inlined content, not leaving the \\input calls behind', () => {
    const tex = renderExamTex(buildInput(null), templatesDir);
    expect(tex).not.toContain('\\input{preamble}');
    expect(tex).not.toContain('\\input{cover}');
    // Sanity: inlined preamble/cover content actually made it in.
    expect(tex).toContain('\\documentclass[11pt,a4paper]{article}');
    expect(tex).toContain('PROVA OFFLINE');
  });

  it('escapes the simulado title (em dash + "&") wherever it is substituted into cover.tex', () => {
    const tex = renderExamTex(buildInput(null), templatesDir);
    expect(tex).toContain('Simulado ENAMED — Clínica Médica \\& Cirurgia');
  });

  it('computes DURATION_HOURS via Math.round(duration_minutes / 60), matching the legacy engine exactly', () => {
    // 90 minutes: Math.round(1.5) = 2, whereas Math.floor(1.5) = 1 — this
    // input value deliberately disambiguates the two, matching
    // legacyPdfLib.ts:470 (`Math.round(simulado.duration_minutes / 60)`).
    const tex = renderExamTex(buildInput(null), templatesDir);
    expect(tex).toContain('{\\Large\\bfseries\\color{winedark} 2h}');
    expect(tex).toContain('90 minutos');
  });

  it('escapes special characters (_ and %) inside option text', () => {
    const tex = renderExamTex(buildInput(null), templatesDir);
    expect(tex).toContain('paracetamol\\_500mg');
    expect(tex).toContain('50\\% de melhora');
    expect(tex).toContain('90\\% dos casos');
  });

  it('lets Greek characters in question text pass through unescaped', () => {
    const tex = renderExamTex(buildInput(null), templatesDir);
    expect(tex).toContain('α-fetoproteína');
    expect(tex).toContain('β-hCG');
  });

  it('strips a redundant option-label prefix ("B) ") from option text via stripLabel', () => {
    const tex = renderExamTex(buildInput(null), templatesDir);
    expect(tex).toContain('Investigar tumor de células germinativas');
    expect(tex).not.toContain('B) Investigar tumor');
  });

  it('omits the image block entirely for a null localImagePath (no dangling \\includegraphics{})', () => {
    const tex = renderExamTex(buildInput(null), templatesDir);
    expect(tex).not.toContain('\\includegraphics');
  });

  it('emits an \\includegraphics block with the exact local path for a non-null localImagePath', () => {
    const tex = renderExamTex(buildInput('/tmp/some-dir/q1-image.png'), templatesDir);
    expect(tex).toContain(
      '\\includegraphics[width=0.82\\textwidth,height=320pt,keepaspectratio]{/tmp/some-dir/q1-image.png}',
    );
  });

  it('omits the enumerate/options block entirely for a question with zero options', () => {
    const tex = renderExamTex(buildInput(null), templatesDir);
    // Question 3 has zero options; its fragment must contain no
    // \begin{enumerate} immediately preceding \end{document} (i.e. the
    // last question's body is not followed by an empty options list).
    const q3Index = tex.lastIndexOf('Questão 3');
    const afterQ3 = tex.slice(q3Index);
    expect(afterQ3).not.toContain('\\begin{enumerate}');
  });

  it('emits an enumerate block with bold letter labels for a question with options', () => {
    const tex = renderExamTex(buildInput(null), templatesDir);
    expect(tex).toContain('\\item[\\textbf{A)}] Solicitar ECG de 12 derivações imediatamente');
  });

  // ─── Real end-to-end compile with the native tectonic binary ────────────
  //
  // String-level assertions above can pass while the document is still
  // structurally broken LaTeX (mismatched braces, an environment that
  // doesn't nest correctly, etc.) — actually compiling with tectonic is
  // the only way to catch that class of bug. This test is slower
  // (real subprocess, real TeX run) but is the most important test in
  // this file.
  //
  // `templates/preamble.tex` references fonts via an absolute path
  // (`/opt/fonts/...`), which only exists inside the production Docker
  // image (Task 2) — not on this native host (`/opt` requires root here).
  // Following the exact same pattern used by Tasks 2-5's own local
  // verification (documented in their task reports), this test builds a
  // throwaway copy of `templatesDir` with only `preamble.tex`'s font
  // `Path=` values swapped to the repo's local `assets/fonts/` absolute
  // path; `cover.tex` and `exam.tex` are copied byte-for-byte, unmodified.
  // The committed `templates/preamble.tex` itself is never touched.
  describe('tectonic compile (end-to-end)', () => {
    it('compiles the rendered .tex into a non-empty PDF with tectonic', async () => {
      const workDir = mkdtempSync(path.join(tmpdir(), 'render-template-compile-'));
      const localTemplatesDir = path.join(workDir, 'templates');
      mkdirSync(localTemplatesDir, { recursive: true });

      const realPreamble = readFileSync(path.join(templatesDir, 'preamble.tex'), 'utf8');
      const localPreamble = realPreamble.replaceAll('/opt/fonts/', `${assetsFontsDir}/`);
      writeFileSync(path.join(localTemplatesDir, 'preamble.tex'), localPreamble);
      copyFileSync(path.join(templatesDir, 'cover.tex'), path.join(localTemplatesDir, 'cover.tex'));
      copyFileSync(path.join(templatesDir, 'exam.tex'), path.join(localTemplatesDir, 'exam.tex'));

      // A real image file must exist on disk at the path embedded into
      // \includegraphics for the compile to succeed — generate one with
      // sharp (same fixture-generation approach as fetchImages.test.ts).
      const imagePath = path.join(workDir, 'q1-image.png');
      const imageBuffer = await sharp({
        create: { width: 400, height: 300, channels: 3, background: { r: 200, g: 30, b: 60 } },
      })
        .png()
        .toBuffer();
      writeFileSync(imagePath, imageBuffer);

      const tex = renderExamTex(buildInput(imagePath), localTemplatesDir);

      const texFile = path.join(workDir, 'rendered-exam.tex');
      writeFileSync(texFile, tex, 'utf8');

      const outDir = path.join(workDir, 'out');
      mkdirSync(outDir, { recursive: true });

      let stdoutAndStderr = '';
      let exitCode = 0;
      try {
        const output = execFileSync('tectonic', [texFile, '--outdir', outDir], {
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
        });
        stdoutAndStderr = output;
      } catch (e) {
        const err = e as { status?: number; stdout?: string; stderr?: string; message: string };
        exitCode = err.status ?? 1;
        stdoutAndStderr = `${err.stdout ?? ''}\n${err.stderr ?? ''}\n${err.message}`;
      }

      expect(exitCode, `tectonic did not exit 0 — output:\n${stdoutAndStderr}`).toBe(0);
      expect(stdoutAndStderr).not.toMatch(/missing character/i);

      const pdfPath = path.join(outDir, 'rendered-exam.pdf');
      const stat = statSync(pdfPath);
      expect(stat.size).toBeGreaterThan(0);
    }, 60_000);
  });
});
