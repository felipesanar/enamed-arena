import { describe, expect, it, vi } from 'vitest';
import { generateGabaritoPdf } from './gabaritoPdf';
import * as helpers from './pdfHelpers';

describe('gabarito PDF edition metadata', () => {
  it('passes the exam badge to the header and defaults to neutral', () => {
    const header = vi.spyOn(helpers, 'drawPremiumHeader');
    const input = { simuladoTitle: 'Prova', studentName: 'Aluno', questions: [], breakdown: {
      overall: { totalCorrect: 0, totalQuestions: 0, percentageScore: 0, questionResults: [] }, byArea: [],
    } } as unknown as Parameters<typeof generateGabaritoPdf>[0];
    generateGabaritoPdf({ ...input, simulado: { editionCode: '2027.1' } });
    expect(header).toHaveBeenLastCalledWith(expect.anything(), 'Gabarito Resumido', 'Prova', undefined, 'ENAMED 2027.1');
    generateGabaritoPdf(input);
    expect(header).toHaveBeenLastCalledWith(expect.anything(), 'Gabarito Resumido', 'Prova', undefined, 'ENAMED');
  });
});
