/**
 * Text structuring utilities ported from the legacy pdf-lib renderer
 * (`supabase/functions/generate-exam-pdf/legacyPdfLib.ts`, `reflowText` and
 * `stripLabel`). These are generic text-parsing steps — not specific to
 * pdf-lib — so they are reused as-is for the LaTeX-based render service.
 *
 * ─── ORDER OF OPERATIONS (critical, do not invert) ──────────────────────────
 *
 * 1. `reflowText` / `stripLabel` run on RAW, un-escaped text. The
 *    bullet-detection regex and the label-stripping regex (see their
 *    doc comments below) must match literal source characters; running
 *    them after `escapeLatex` would corrupt the matching (escaped output can
 *    contain backslashes/braces that were never in the original text).
 * 2. Only after `reflowText` has produced `TextBlock[]` does `escapeLatex`
 *    (Task 6) run, once per block, on that block's plain-text content.
 * 3. Only after escaping does `blocksToLatex` wrap the escaped content in
 *    literal LaTeX markup (`\begin{itemize}...\end{itemize}` / `\item`, or
 *    blank-line-separated paragraphs). Escaping AFTER wrapping would mangle
 *    the markup itself (e.g. turn `\item` into `\textbackslash{}item`).
 */

import { escapeLatex } from './escapeLatex.js';

export type TextBlock = { type: 'p' | 'li'; text: string };

const BULLET_RE = /^[-•–*]\s+/;

/**
 * Reflows hard-wrapped text (manual line breaks) into paragraph/list-item
 * blocks. Ported verbatim from `reflowText` in
 * `supabase/functions/generate-exam-pdf/legacyPdfLib.ts`.
 *
 * - Blank lines flush the current paragraph buffer.
 * - A line starting with `-`, `•`, `–`, or `*` (followed by whitespace)
 *   becomes its own `li` block, with the marker stripped.
 * - Other lines accumulate into a `p` buffer, joined with spaces; a line
 *   ending in `:` forces an immediate flush (paragraph break).
 */
export function reflowText(raw: string): TextBlock[] {
  const lines = raw.split(/\r?\n/);
  const blocks: TextBlock[] = [];
  let buf: string[] = [];

  const flush = () => {
    if (buf.length) {
      blocks.push({ type: 'p', text: buf.join(' ').trim() });
      buf = [];
    }
  };

  for (const line of lines) {
    const s = line.trim();
    if (s === '') {
      flush();
      continue;
    }
    if (BULLET_RE.test(s)) {
      flush();
      blocks.push({ type: 'li', text: s.replace(BULLET_RE, '') });
      continue;
    }
    buf.push(s);
    if (s.endsWith(':')) flush();
  }
  flush();

  return blocks;
}

/**
 * Strips a redundant answer-option label prefix (e.g. "A) ", "a.") that
 * sometimes comes embedded in option text stored in the database. Ported
 * verbatim from `stripLabel` in
 * `supabase/functions/generate-exam-pdf/legacyPdfLib.ts`.
 */
export function stripLabel(optionText: string): string {
  return optionText.replace(/^\s*[A-Da-d][).]\s*/, '');
}

/**
 * Converts reflowed `TextBlock[]` into a LaTeX string: consecutive `li`
 * blocks are merged into a single `itemize` environment; `p` blocks become
 * plain paragraphs separated by blank lines. `escapeLatex` is applied to
 * each block's text BEFORE it is embedded in LaTeX markup, so the markup
 * characters themselves (`\`, `{`, `}`) are never re-escaped.
 */
export function blocksToLatex(blocks: TextBlock[]): string {
  const parts: string[] = [];
  let pendingItems: string[] = [];

  const flushItems = () => {
    if (pendingItems.length) {
      parts.push(`\\begin{itemize}\n${pendingItems.join('\n')}\n\\end{itemize}`);
      pendingItems = [];
    }
  };

  for (const block of blocks) {
    if (block.type === 'li') {
      pendingItems.push(`  \\item ${escapeLatex(block.text)}`);
      continue;
    }
    flushItems();
    parts.push(escapeLatex(block.text));
  }
  flushItems();

  return parts.join('\n\n');
}
