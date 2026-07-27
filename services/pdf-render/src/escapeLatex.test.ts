import { describe, expect, it } from 'vitest';
import { escapeLatex } from './escapeLatex.js';

describe('escapeLatex', () => {
  describe('isolated control characters', () => {
    const cases: Array<[string, string]> = [
      ['\\', '\\textbackslash{}'],
      ['{', '\\{'],
      ['}', '\\}'],
      ['$', '\\$'],
      ['&', '\\&'],
      ['#', '\\#'],
      ['_', '\\_'],
      ['%', '\\%'],
      ['~', '\\textasciitilde{}'],
      ['^', '\\textasciicircum{}'],
    ];

    for (const [input, expected] of cases) {
      it(`escapes ${JSON.stringify(input)} to ${JSON.stringify(expected)}`, () => {
        expect(escapeLatex(input)).toBe(expected);
      });
    }
  });

  it('escapes all 10 control characters combined with normal text without double-escaping', () => {
    // Deliberately includes `\` alongside `{` and `}` in the same input.
    // This is the specific case that breaks under sequential .replaceAll()
    // calls: escaping `\` to `\textbackslash{}` first introduces a literal
    // `{`, which a later `.replaceAll('{', '\\{')` pass would wrongly
    // re-escape (producing `\textbackslash\{}` instead of the correct
    // `\textbackslash{}`). A single-pass regex+callback replace must not
    // exhibit this.
    const input = 'a\\b{c}d$e&f#g_h%i~j^k';
    const expected =
      'a\\textbackslash{}b\\{c\\}d\\$e\\&f\\#g\\_h\\%i\\textasciitilde{}j\\textasciicircum{}k';
    const output = escapeLatex(input);

    expect(output).toBe(expected);

    // Specifically confirm no double-escaping occurred: the literal `{`
    // introduced by \textbackslash{} must not itself have been escaped to
    // \{, and the literal `}` closing it must not have become \}.
    expect(output).not.toContain('\\textbackslash\\{}');
    expect(output).not.toContain('\\textbackslash{\\}');
  });

  describe('LaTeX injection attempt', () => {
    it('neutralizes an attempt to break out of a \\textbf{...} wrapper', () => {
      const maliciousInput = '}\\input{/etc/passwd}';
      const output = escapeLatex(maliciousInput);

      // Every `\`, `{`, `}` appearing in the output must be part of one of
      // the known-safe replacement strings, never a raw, unescaped
      // character carried over from the original input.
      const knownSafeSubstrings = [
        '\\}', // escaped `}`
        '\\{', // escaped `{`
        '\\textbackslash{}', // escaped `\`
      ];

      let scrubbed = output;
      for (const safe of knownSafeSubstrings) {
        scrubbed = scrubbed.split(safe).join('');
      }

      // After stripping every known-safe substitution, nothing but plain
      // text should remain: no stray \, {, or } characters. If any raw
      // control character from the original input had survived unescaped,
      // it would still be present here and fail this assertion — meaning
      // it could not have prematurely closed (or escaped out of) a
      // \textbf{...} wrapper.
      expect(scrubbed).not.toMatch(/[\\{}]/);

      // Sanity check that the malicious input's structural characters were
      // in fact present before escaping (otherwise the assertion above
      // would be vacuous).
      expect(maliciousInput).toMatch(/[\\{}]/);
    });

    it('output contains no unescaped control characters from the raw input', () => {
      const maliciousInput = '}\\input{/etc/passwd}';
      const output = escapeLatex(maliciousInput);
      expect(output).toBe(
        '\\}\\textbackslash{}input\\{/etc/passwd\\}',
      );
    });
  });

  describe('Unicode / PT-BR / medical symbols pass through unchanged', () => {
    const samples = [
      'ção',
      'ã',
      'µ',
      '°',
      '±',
      '≥',
      '≤',
      '→',
      '—', // em dash
      '–', // en dash
      '“curly quotes”',
      'α',
      'β',
    ];

    for (const sample of samples) {
      it(`leaves ${JSON.stringify(sample)} unchanged`, () => {
        expect(escapeLatex(sample)).toBe(sample);
      });
    }

    it('leaves a full PT-BR medical sentence unchanged', () => {
      const input = 'A alfa-fetoproteína (α-FP) e a concentração de β-hCG estão elevadas — pressão ≥ 140/90 mmHg, µg/dL, 37°C, razão ± 0.5.';
      expect(escapeLatex(input)).toBe(input);
    });
  });

  describe('edge cases', () => {
    it('returns an empty string for empty input', () => {
      expect(escapeLatex('')).toBe('');
    });

    it('returns whitespace-only input unchanged', () => {
      expect(escapeLatex('   \t\n  ')).toBe('   \t\n  ');
    });

    it('throws for null input rather than silently returning it (strict runtime signature)', () => {
      // The TypeScript signature is `(input: string) => string` — null and
      // undefined are not accepted by the type system at all. This test
      // documents the runtime behavior if the type check is bypassed
      // (e.g. from untyped/JS callers), rather than asserting any
      // particular type-level guarantee.
      expect(() => escapeLatex(null as unknown as string)).toThrow();
    });

    it('throws for undefined input rather than silently returning it (strict runtime signature)', () => {
      expect(() => escapeLatex(undefined as unknown as string)).toThrow();
    });
  });
});
