import { describe, it, expect } from 'vitest';
import { summarizeFindings } from './verifyFindings';

it('conta erros e avisos e ordena por questão', () => {
  const out = summarizeFindings([
    { question_number: 5, check_type: 'missing_image', slot: 'enunciado', severity: 'warning', evidence: 'x' },
    { question_number: 2, check_type: 'missing_image', slot: 'enunciado', severity: 'error', evidence: 'y' },
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
