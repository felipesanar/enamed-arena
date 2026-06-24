import { describe, it, expect } from 'vitest';
import { summarizeFindings, findingLabel } from './verifyFindings';

it('conta erros e avisos e ordena por questão', () => {
  const out = summarizeFindings([
    { question_number: 5, source: 'ai', check_type: 'missing_image', slot: 'enunciado', severity: 'warning', evidence: 'x' },
    { question_number: 2, source: 'ai', check_type: 'missing_image', slot: 'enunciado', severity: 'error', evidence: 'y' },
  ]);
  expect(out.errorCount).toBe(1);
  expect(out.warningCount).toBe(1);
  expect(out.byQuestion[0].question_number).toBe(2);
});

it('vazio retorna zeros', () => {
  const out = summarizeFindings([]);
  expect(out.errorCount).toBe(0);
  expect(out.warningCount).toBe(0);
  expect(out.byQuestion).toEqual([]);
});

describe('findingLabel', () => {
  it('missing_image usa o slot', () => {
    expect(findingLabel({ question_number: 1, source: 'ai', check_type: 'missing_image', slot: 'enunciado2', severity: 'error', evidence: '' }))
      .toBe('imagem 2 ausente');
  });
  it('image_mismatch', () => {
    expect(findingLabel({ question_number: 1, source: 'ai', check_type: 'image_mismatch', slot: 'enunciado', severity: 'error', evidence: '' }))
      .toBe('imagem do enunciado não corresponde ao texto');
  });
  it('invalid_gabarito', () => {
    expect(findingLabel({ question_number: 1, source: 'structural', check_type: 'invalid_gabarito', severity: 'error', evidence: '' }))
      .toBe('gabarito inválido');
  });
});
