import { describe, expect, it } from 'vitest';
import { blocksToLatex, reflowText, stripLabel } from './textToLatex.js';
import type { TextBlock } from './textToLatex.js';

describe('reflowText', () => {
  it('merges multi-line text without a separator into a single paragraph', () => {
    const raw = 'Uma linha\nOutra linha\nMais uma linha';
    expect(reflowText(raw)).toEqual([
      { type: 'p', text: 'Uma linha Outra linha Mais uma linha' },
    ]);
  });

  it('treats a blank line as a paragraph separator', () => {
    const raw = 'Primeiro paragrafo\ncontinua aqui\n\nSegundo paragrafo';
    expect(reflowText(raw)).toEqual([
      { type: 'p', text: 'Primeiro paragrafo continua aqui' },
      { type: 'p', text: 'Segundo paragrafo' },
    ]);
  });

  it.each([
    ['-', '- Item com hifen'],
    ['•', '• Item com bullet'],
    ['–', '– Item com en dash'],
    ['*', '* Item com asterisco'],
  ])('treats a line starting with "%s" as a list item, stripping the marker', (_marker, line) => {
    expect(reflowText(line)).toEqual([{ type: 'li', text: line.replace(/^\S+\s+/, '') }]);
  });

  it('mixes paragraphs and list items in document order', () => {
    const raw = 'Enunciado da questao\n- Alternativa 1\n- Alternativa 2\nComentario final';
    expect(reflowText(raw)).toEqual([
      { type: 'p', text: 'Enunciado da questao' },
      { type: 'li', text: 'Alternativa 1' },
      { type: 'li', text: 'Alternativa 2' },
      { type: 'p', text: 'Comentario final' },
    ]);
  });

  it('forces a paragraph break when a line ends in ":"', () => {
    const raw = 'Considere o seguinte:\nDado clinico relevante';
    expect(reflowText(raw)).toEqual([
      { type: 'p', text: 'Considere o seguinte:' },
      { type: 'p', text: 'Dado clinico relevante' },
    ]);
  });

  it('returns an empty array for empty input', () => {
    expect(reflowText('')).toEqual([]);
  });

  it('handles CRLF line endings', () => {
    const raw = 'Linha um\r\nLinha dois';
    expect(reflowText(raw)).toEqual([{ type: 'p', text: 'Linha um Linha dois' }]);
  });
});

describe('stripLabel', () => {
  it('strips an uppercase parenthesis-style label', () => {
    expect(stripLabel('A) Texto')).toBe('Texto');
  });

  it('strips a lowercase dot-style label', () => {
    expect(stripLabel('a. Texto')).toBe('Texto');
  });

  it.each(['A', 'B', 'C', 'D', 'a', 'b', 'c', 'd'])(
    'strips label "%s)" regardless of case/letter',
    (letter) => {
      expect(stripLabel(`${letter}) Texto da alternativa`)).toBe('Texto da alternativa');
    },
  );

  it('leaves unprefixed text unchanged', () => {
    expect(stripLabel('Texto sem prefixo')).toBe('Texto sem prefixo');
  });

  it('handles a label with no trailing text', () => {
    expect(stripLabel('D) ')).toBe('');
  });

  it('does not strip a letter outside A-D', () => {
    expect(stripLabel('E) Texto')).toBe('E) Texto');
  });

  it('tolerates leading whitespace before the label', () => {
    expect(stripLabel('  B) Texto com espaco')).toBe('Texto com espaco');
  });
});

describe('blocksToLatex', () => {
  it('renders a single paragraph block as escaped plain text', () => {
    const blocks: TextBlock[] = [{ type: 'p', text: 'Texto simples' }];
    expect(blocksToLatex(blocks)).toBe('Texto simples');
  });

  it('escapes special characters inside a paragraph block', () => {
    const blocks: TextBlock[] = [{ type: 'p', text: 'Valor de 50% em A&B' }];
    expect(blocksToLatex(blocks)).toBe('Valor de 50\\% em A\\&B');
  });

  it('wraps consecutive list-item blocks in a single itemize environment', () => {
    const blocks: TextBlock[] = [
      { type: 'li', text: 'Primeiro item' },
      { type: 'li', text: 'Segundo item' },
    ];
    expect(blocksToLatex(blocks)).toBe(
      '\\begin{itemize}\n  \\item Primeiro item\n  \\item Segundo item\n\\end{itemize}',
    );
  });

  // ─── Composite regression test ─────────────────────────────────────────
  //
  // This is the most important test in this file: it verifies the
  // reflow -> escape -> wrap ordering directly. If escaping ran BEFORE
  // wrapping in markup (or if the raw text were escaped before reflow),
  // one of the two assertions below would fail:
  //
  //   - the literal `\begin{itemize}` / `\item` / `\end{itemize}` markup
  //     must survive completely intact (it must NOT have been escaped —
  //     e.g. must not appear as `\textbackslash{}begin\{itemize\}`);
  //   - the `_`, `%`, and `&` characters that were inside the raw list-item
  //     text must appear ESCAPED (`\_`, `\%`, `\&`) in the final output.
  it('produces intact itemize/item markup with properly escaped special characters inside a list item', () => {
    const raw = 'Introducao ao caso clinico\n- Item com under_score, 50% e A&B\nConclusao final';

    const blocks = reflowText(raw);
    expect(blocks).toEqual([
      { type: 'p', text: 'Introducao ao caso clinico' },
      { type: 'li', text: 'Item com under_score, 50% e A&B' },
      { type: 'p', text: 'Conclusao final' },
    ]);

    const latex = blocksToLatex(blocks);

    // The itemize/item markup must be intact, literal LaTeX — not escaped.
    expect(latex).toContain('\\begin{itemize}');
    expect(latex).toContain('\\item ');
    expect(latex).toContain('\\end{itemize}');
    expect(latex).not.toContain('\\textbackslash{}begin');
    expect(latex).not.toContain('\\textbackslash{}item');
    expect(latex).not.toContain('\\textbackslash{}end');

    // The special characters that were inside the list item's raw text
    // must be properly escaped in the final output.
    expect(latex).toContain('under\\_score');
    expect(latex).toContain('50\\%');
    expect(latex).toContain('A\\&B');

    // No raw, unescaped `_`, standalone `%`, or `&` should remain from the
    // original list-item text (only the escaped forms above).
    const itemLine = latex.split('\n').find((line) => line.includes('Item com'));
    expect(itemLine).toBe('  \\item Item com under\\_score, 50\\% e A\\&B');

    expect(latex).toBe(
      [
        'Introducao ao caso clinico',
        '',
        '\\begin{itemize}',
        '  \\item Item com under\\_score, 50\\% e A\\&B',
        '\\end{itemize}',
        '',
        'Conclusao final',
      ].join('\n'),
    );
  });

  it('returns an empty string for an empty block list', () => {
    expect(blocksToLatex([])).toBe('');
  });
});
