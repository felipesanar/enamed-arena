/**
 * Fills `templates/*.tex` (Tasks 3-5) with real, already-processed data
 * (escaped/wrapped via `escapeLatex`/`textToLatex`, Tasks 6-7; local image
 * paths already resolved by Task 8's `fetchImages.ts`) via plain string
 * substitution — no template engine (Handlebars etc.): literal
 * `@@TOKEN@@` markers are swapped for values via `.replace()`/
 * `.replaceAll()`. Rationale (from the task brief): one fewer dependency,
 * and zero additional "template injection" surface — every piece of
 * content reaching this module has already been through `escapeLatex`
 * before it gets here, so the substitutor only ever does pure string
 * swapping, never templating logic.
 *
 * ─── `question.tex`'s role (design decision) ───────────────────────────────
 *
 * `templates/question.tex` (Task 5) is documented, in its own header
 * comment, as a STYLE REFERENCE, not a file meant to be `\input`-ed or
 * substituted literally: a real question fragment needs 0-4 options and an
 * optional image, which a single static template with fixed placeholder
 * slots can't express cleanly (an empty `enumerate` with no `\item`s is
 * invalid LaTeX, for one). This module does NOT read `question.tex` from
 * disk; instead, `renderQuestion()` below builds each question fragment
 * directly as a template string in code, following the exact same
 * structure/order/macros documented in `question.tex`
 * (`\needspace` → title → body text → optional image → optional option
 * list), just with the "0 options" / "no image" cases handled by omitting
 * the corresponding block entirely instead of leaving a token substituted
 * with an empty string in the middle of otherwise-fixed markup.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { escapeLatex } from './escapeLatex.js';
import { blocksToLatex, reflowText, stripLabel } from './textToLatex.js';

export interface RenderInput {
  simulado: {
    title: string;
    sequence_number: number;
    questions_count: number;
    duration_minutes: number;
  };
  questions: Array<{
    number: number;
    text: string;
    localImagePath: string | null;
    options: Array<{ label: string; text: string }>;
  }>;
}

/**
 * Strips full-line LaTeX comments (lines whose trimmed content starts with
 * `%`) before any placeholder substitution runs.
 *
 * This is a correctness requirement, not cosmetic cleanup. Several
 * committed templates document their own placeholders/`\input` calls in
 * prose comments using the EXACT literal substrings this module later
 * searches for — e.g. `templates/exam.tex` lines 2-3 read
 * "% \input{preamble} (Task 3) define classe..." and "% \input{cover}
 * (Task 4) desenha a capa...", and line 7 reads
 * "% @@QUESTIONS_BODY@@ (concatenação de N fragmentos...)". Those comment
 * lines appear, in source order, BEFORE the real `\input{preamble}` /
 * `\input{cover}` / `@@QUESTIONS_BODY@@` usages further down the same
 * file. `String.prototype.replace` with a string needle only replaces the
 * FIRST match — so without stripping comments first, a naive substitution
 * would silently rewrite the comment instead of the real code line,
 * leaving the actual marker untouched (this exact failure mode was hit
 * and documented by Task 5's own throwaway test tooling). Since LaTeX
 * comments have no effect on the compiled document, dropping them here is
 * safe and side-effect-free.
 */
function stripFullLineComments(tex: string): string {
  return tex
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('%'))
    .join('\n');
}

function readTemplate(templatesDir: string, filename: string): string {
  return readFileSync(path.join(templatesDir, filename), 'utf8');
}

/**
 * Matches the legacy pdf-lib engine's rounding EXACTLY:
 * `legacyPdfLib.ts:470` — `const durationH = Math.round(simulado.duration_minutes / 60);`
 * (Not `Math.floor` — verified against the actual legacy source, since the
 * two round differently for any non-multiple-of-60 duration, e.g. 90
 * minutes: `Math.round(1.5) = 2` vs `Math.floor(1.5) = 1`.)
 */
function computeDurationHours(durationMinutes: number): number {
  return Math.round(durationMinutes / 60);
}

function renderCover(
  coverTemplate: string,
  simulado: RenderInput['simulado'],
  durationHours: number,
): string {
  // Numbers don't strictly need escapeLatex (digits are never one of the 10
  // control characters), but it's applied anyway per the brief's
  // "defense in depth" guidance — harmless no-op today, and free insurance
  // if a caller ever passes a non-numeric-looking value through this path.
  return stripFullLineComments(coverTemplate)
    .replaceAll('@@SIMULADO_TITLE@@', escapeLatex(simulado.title))
    .replaceAll('@@QUESTIONS_COUNT@@', escapeLatex(String(simulado.questions_count)))
    .replaceAll('@@DURATION_HOURS@@', escapeLatex(String(durationHours)))
    .replaceAll('@@DURATION_MINUTES@@', escapeLatex(String(simulado.duration_minutes)));
}

function renderOption(option: { label: string; text: string }): string {
  // Options are short, single-line strings (a letter label plus a brief
  // phrase) — unlike question bodies they don't need Task 7's
  // reflow-into-paragraphs/list-items pipeline (`reflowText` +
  // `blocksToLatex`), just the label-stripping step (`stripLabel`, to drop
  // a redundant "A) " prefix sometimes duplicated inside the stored option
  // text) followed by a direct `escapeLatex` call on what remains. This is
  // a deliberate simplification for this module's typical input shape; if
  // option text ever legitimately needs multi-paragraph/bullet structure,
  // this would need to switch to the same reflow pipeline used for
  // question text.
  const label = escapeLatex(option.label);
  const text = escapeLatex(stripLabel(option.text));
  return `  \\item[\\textbf{${label})}] ${text}`;
}

function renderQuestion(question: RenderInput['questions'][number]): string {
  const number = escapeLatex(String(question.number));
  const text = blocksToLatex(reflowText(question.text));

  // A `null` localImagePath must never leave a dangling/broken
  // `\includegraphics{}` (empty path) in the output — the whole image
  // block is omitted rather than substituted with an empty string inside
  // otherwise-fixed markup.
  //
  // The path itself is embedded as-is (NOT passed through `escapeLatex`):
  // it's a filesystem path, not LaTeX text content, and `escapeLatex`'s
  // replacements (e.g. turning `_` into `\_{}`, `%` into `\%`) would
  // corrupt a real path instead of protecting it. This is safe here
  // because `fetchImages.ts` (Task 8) writes every image to a filename of
  // the form `q${questionNumber}-image.${ext}` (`ext` is always literally
  // `png` or `jpg`) — no `_`, `%`, spaces, or other LaTeX-sensitive
  // characters ever appear in the filename component it controls. The
  // directory component of the path (`tempDir`) is caller-supplied; in
  // every current caller it comes from `fs.mkdtemp`-style temp directories
  // (alphanumeric + hyphens), which are also safe. This is a residual
  // assumption, not a guarantee enforced by this module — flagged in the
  // task report.
  const imageBlock = question.localImagePath
    ? `\\begin{center}\n\\includegraphics[width=0.82\\textwidth,height=320pt,keepaspectratio]{${question.localImagePath}}\n\\end{center}`
    : '';

  // A question may have 0 options (`templates/question.tex`'s own comment:
  // "cada questão tem de 0 a 4 opções") — an `enumerate` environment with
  // no `\item`s is invalid LaTeX ("something's wrong--perhaps a missing
  // \item"), so the whole options block is omitted rather than emitted
  // empty.
  const optionsBlock = question.options.length
    ? `\\begin{enumerate}[leftmargin=*, itemsep=4pt]\n${question.options.map(renderOption).join('\n')}\n\\end{enumerate}`
    : '';

  return [
    '\\needspace{4\\baselineskip}',
    '\\vspace{12pt}',
    `\\textbf{\\textcolor{winemid}{Questão ${number}}}\\\\[4pt]`,
    text,
    imageBlock,
    optionsBlock,
  ]
    .filter((part) => part !== '')
    .join('\n\n');
}

/**
 * Renders the complete `.tex` document for a simulado's offline exam PDF.
 *
 * Reads `preamble.tex`, `cover.tex`, and `exam.tex` from `templatesDir`
 * (`question.tex` is a style reference only — see the module doc comment
 * above — so it is not read here), substitutes every `@@TOKEN@@` marker
 * with escaped/processed data, and inlines `preamble.tex`'s and the
 * substituted `cover.tex`'s content in place of `exam.tex`'s
 * `\input{preamble}` / `\input{cover}` lines. The result is a single,
 * self-contained `.tex` string: it does not depend on sibling `.tex` files
 * being present next to wherever it is eventually written to disk (it
 * still depends on the font FILES referenced by absolute `Path=` inside
 * `preamble.tex`, e.g. `/opt/fonts/...` in production — those are binary
 * assets, not `.tex` sources, and are outside this function's concern).
 */
export function renderExamTex(input: RenderInput, templatesDir: string): string {
  const preambleTex = readTemplate(templatesDir, 'preamble.tex');
  const coverTemplate = readTemplate(templatesDir, 'cover.tex');
  const examTemplate = readTemplate(templatesDir, 'exam.tex');

  const durationHours = computeDurationHours(input.simulado.duration_minutes);
  const coverTex = renderCover(coverTemplate, input.simulado, durationHours);

  const examLabel = escapeLatex(
    `${input.simulado.title} · ${input.simulado.questions_count} questões · ${durationHours}h`,
  );
  const footerLabel = escapeLatex(`${input.simulado.title} · SanarFlix PRO · Modo Offline`);
  const questionsBody = input.questions.map(renderQuestion).join('\n\n');

  return stripFullLineComments(examTemplate)
    .replace('\\input{preamble}', preambleTex)
    .replace('\\input{cover}', coverTex)
    .replaceAll('@@EXAM_LABEL@@', examLabel)
    .replaceAll('@@FOOTER_LABEL@@', footerLabel)
    .replaceAll('@@QUESTIONS_BODY@@', questionsBody);
}
