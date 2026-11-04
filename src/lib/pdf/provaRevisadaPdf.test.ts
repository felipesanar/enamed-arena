import { describe, expect, it, vi } from 'vitest';
import { generateProvaRevisadaPdf } from './provaRevisadaPdf';
import * as helpers from './pdfHelpers';

describe('review PDF edition metadata', () => {
  it('passes the selected exam metadata without deriving a year from the clock or title', async () => {
    const header = vi.spyOn(helpers, 'drawPremiumHeader');
    const input = { simuladoTitle: 'Prova', studentName: 'Aluno', questions: [], examState: {}, breakdown: {
      overall: { totalCorrect: 0, totalQuestions: 0, percentageScore: 0, questionResults: [] }, byArea: [],
    } } as unknown as Parameters<typeof generateProvaRevisadaPdf>[0];
    await generateProvaRevisadaPdf({ ...input, simulado: { editionCode: '2026' } });
    expect(header).toHaveBeenLastCalledWith(expect.anything(), 'Prova Revisada', 'Prova', undefined, 'ENAMED 2026');
    await generateProvaRevisadaPdf(input);
    expect(header).toHaveBeenLastCalledWith(expect.anything(), 'Prova Revisada', 'Prova', undefined, 'ENAMED');
  });
});
