import { describe, it, expect } from 'vitest';
import { validateQuestions, type QuestionRow } from './validateQuestions';

const base: QuestionRow = {
  numero: 1, enunciado: 'Qual a conduta?',
  alternativaA: 'a', alternativaB: 'b', alternativaC: 'c', alternativaD: 'd',
  gabarito: 'B',
};

describe('validateQuestions', () => {
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
});
