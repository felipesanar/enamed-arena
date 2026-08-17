import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateQuestions, type QuestionRow } from './validateQuestions';
import { checkGabarito } from '@/admin/lib/gabaritoCheck';
import type { GabaritoFinding } from '@/admin/lib/gabaritoCheck';

vi.mock('@/admin/lib/gabaritoCheck', () => ({
  checkGabarito: vi.fn(),
}));

const mockedCheckGabarito = vi.mocked(checkGabarito);

const base: QuestionRow = {
  numero: 1, enunciado: 'Qual a conduta?',
  alternativaA: 'a', alternativaB: 'b', alternativaC: 'c', alternativaD: 'd',
  gabarito: 'B', comentario: 'Alternativa B: CORRETA.',
};

const finding = (overrides: Partial<GabaritoFinding>): GabaritoFinding => ({
  questionNumber: 1,
  checkType: 'option_letter_misalignment',
  severity: 'warning',
  what: 'O comentário casa melhor com a alternativa D',
  how: 'Confira se o texto do comentário corresponde à alternativa D.',
  evidence: 'trecho do comentário',
  ...overrides,
});

describe('validateQuestions', () => {
  beforeEach(() => {
    mockedCheckGabarito.mockReset();
    mockedCheckGabarito.mockReturnValue([]);
  });

  it('questão válida não gera achados', () => {
    expect(validateQuestions([base])).toEqual([]);
  });

  it('enunciado vazio → erro empty_enunciado', () => {
    const out = validateQuestions([{ ...base, enunciado: '   ' }]);
    expect(out).toContainEqual(expect.objectContaining({
      question_number: 1, source: 'structural', check_type: 'empty_enunciado', severity: 'error',
    }));
  });

  it('alternativa vazia → erro empty_option listando a letra', () => {
    const out = validateQuestions([{ ...base, alternativaC: '' }]);
    const f = out.find((x) => x.check_type === 'empty_option');
    expect(f?.severity).toBe('error');
    expect(f?.evidence).toContain('C');
  });

  it('gabarito fora de A-D → erro invalid_gabarito', () => {
    expect(validateQuestions([{ ...base, gabarito: 'E' }]))
      .toContainEqual(expect.objectContaining({ check_type: 'invalid_gabarito', severity: 'error' }));
  });

  it('gabarito minúsculo é aceito (normalizado)', () => {
    expect(validateQuestions([{ ...base, gabarito: 'b' }])
      .some((x) => x.check_type === 'invalid_gabarito')).toBe(false);
  });

  it('numero NaN → erro bad_numbering', () => {
    expect(validateQuestions([{ ...base, numero: NaN }]))
      .toContainEqual(expect.objectContaining({ check_type: 'bad_numbering', severity: 'error' }));
  });

  it('numero repetido → aviso bad_numbering', () => {
    const out = validateQuestions([base, { ...base, numero: 1, enunciado: 'Outra?' }]);
    expect(out).toContainEqual(expect.objectContaining({
      check_type: 'bad_numbering', severity: 'warning', question_number: 1,
    }));
  });

  it('duas alternativas idênticas → aviso duplicate_options', () => {
    const out = validateQuestions([{ ...base, alternativaA: 'igual', alternativaB: 'igual' }]);
    const f = out.find((x) => x.check_type === 'duplicate_options');
    expect(f?.severity).toBe('warning');
    expect(f?.evidence).toMatch(/A|B/);
  });

  it('enunciados idênticos em questões diferentes → aviso duplicate_question nos dois', () => {
    const out = validateQuestions([
      { ...base, numero: 1, enunciado: 'Mesmo texto' },
      { ...base, numero: 2, enunciado: 'mesmo  TEXTO' },
    ]);
    const dups = out.filter((x) => x.check_type === 'duplicate_question');
    expect(dups.map((d) => d.question_number).sort()).toEqual([1, 2]);
  });

  it('numero NaN: evidence aponta a linha da planilha', () => {
    const out = validateQuestions([base, { ...base, numero: NaN }]);
    const f = out.find((x) => x.check_type === 'bad_numbering' && x.severity === 'error');
    expect(f?.evidence).toContain('linha 3');
  });

  it('gabarito só com espaços → invalid_gabarito', () => {
    expect(validateQuestions([{ ...base, gabarito: '   ' }])
      .some((x) => x.check_type === 'invalid_gabarito')).toBe(true);
  });

  // ── Cruzamento gabarito × comentário (checkGabarito mockado) ─────────────

  describe('cruzamento gabarito × comentário', () => {
    it('warning de gabarito é propagado com o check_type e evidence corretos', () => {
      mockedCheckGabarito.mockReturnValue([
        finding({ checkType: 'option_letter_misalignment', severity: 'warning', proposedLabel: 'D' }),
      ]);

      const out = validateQuestions([base]);
      const f = out.find((x) => x.check_type === 'option_letter_misalignment');
      expect(f).toEqual(expect.objectContaining({
        question_number: 1,
        source: 'structural',
        check_type: 'option_letter_misalignment',
        severity: 'warning',
      }));
      expect(f?.evidence).toContain('O comentário casa melhor com a alternativa D');
      expect(f?.evidence).toContain('trecho do comentário');
    });

    it('erro de gabarito (severity: error) não aparece na saída de validateQuestions', () => {
      mockedCheckGabarito.mockReturnValue([
        finding({ checkType: 'key_comment_conflict', severity: 'error', proposedLabel: 'C' }),
      ]);

      const out = validateQuestions([base]);
      expect(out.some((x) => x.check_type === 'key_comment_conflict')).toBe(false);
    });

    it('agrega key_unverifiable de várias linhas numa única finding', () => {
      mockedCheckGabarito.mockReturnValue([
        finding({ checkType: 'key_unverifiable', severity: 'info' }),
      ]);

      const rows = [
        { ...base, numero: 1, enunciado: 'Q1' },
        { ...base, numero: 2, enunciado: 'Q2' },
        { ...base, numero: 3, enunciado: 'Q3' },
      ];
      const out = validateQuestions(rows);
      const unverifiable = out.filter((x) => x.check_type === 'key_unverifiable');
      expect(unverifiable).toHaveLength(1);
      expect(unverifiable[0]).toEqual(expect.objectContaining({
        question_number: 0, source: 'structural', severity: 'warning',
      }));
      expect(unverifiable[0].evidence).toContain('3 questões');
    });

    it('contagem zero de key_unverifiable não emite nada', () => {
      mockedCheckGabarito.mockReturnValue([]);
      const out = validateQuestions([base]);
      expect(out.some((x) => x.check_type === 'key_unverifiable')).toBe(false);
    });

    it('exceção em checkGabarito não propaga e não impede as demais checagens', () => {
      mockedCheckGabarito.mockImplementation(() => {
        throw new Error('boom');
      });

      expect(() => validateQuestions([base])).not.toThrow();
      // A checagem estrutural de outras linhas segue funcionando.
      const out = validateQuestions([{ ...base, enunciado: '' }]);
      expect(out).toContainEqual(expect.objectContaining({ check_type: 'empty_enunciado' }));
    });
  });
});
