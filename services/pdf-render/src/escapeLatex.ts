/**
 * Escapes the 10 LaTeX control characters in `input` so it can be safely
 * embedded inside a LaTeX document (e.g. inside a \textbf{...} group)
 * without the risk of command injection or broken group nesting.
 *
 * Control characters and their replacements:
 *   \  -> \textbackslash{}
 *   {  -> \{
 *   }  -> \}
 *   $  -> \$
 *   &  -> \&
 *   #  -> \#
 *   _  -> \_
 *   %  -> \%
 *   ~  -> \textasciitilde{}
 *   ^  -> \textasciicircum{}
 *
 * All other characters — including non-Latin-1 Unicode (PT-BR diacritics,
 * Greek letters, medical/scientific symbols, typographic punctuation) — are
 * passed through unchanged. This is a deliberate regression guard: the
 * legacy renderer (`supabase/functions/generate-exam-pdf/index.ts`, see
 * `sanitizeForWinAnsi`) mangled any character outside Latin-1 into "?",
 * which this migration must not repeat.
 *
 * IMPORTANT — implementation constraint: this MUST remain a single regex
 * pass with a replacer callback (`String.prototype.replace(regex, fn)`),
 * never a sequence of `.replaceAll()` calls. `String.prototype.replace`
 * always matches against the original input string, so a single pass is
 * structurally immune to double-escaping. A sequential approach (e.g.
 * escape `\` first, then `{`) would be unsafe: escaping `\` to
 * `\textbackslash{}` introduces a literal `{` character, which a
 * subsequent `.replaceAll('{', '\\{')` pass would incorrectly re-escape
 * into `\textbackslash\{}` (mangling the very sequence meant to be safe).
 */

const LATEX_SPECIAL_CHARS = /[\\{}$&#_%~^]/g;

const REPLACEMENTS: Readonly<Record<string, string>> = Object.freeze({
  '\\': '\\textbackslash{}',
  '{': '\\{',
  '}': '\\}',
  $: '\\$',
  '&': '\\&',
  '#': '\\#',
  _: '\\_',
  '%': '\\%',
  '~': '\\textasciitilde{}',
  '^': '\\textasciicircum{}',
});

function replaceControlChar(char: string): string {
  const replacement = REPLACEMENTS[char];
  if (replacement === undefined) {
    // Unreachable: LATEX_SPECIAL_CHARS only matches characters that are
    // keys of REPLACEMENTS. Thrown defensively in case the two ever drift
    // out of sync.
    throw new Error(`escapeLatex: no replacement registered for character ${JSON.stringify(char)}`);
  }
  return replacement;
}

/**
 * Escapes LaTeX control characters in `input`, leaving all other
 * characters (including Unicode) unchanged.
 */
export function escapeLatex(input: string): string {
  return input.replace(LATEX_SPECIAL_CHARS, replaceControlChar);
}
