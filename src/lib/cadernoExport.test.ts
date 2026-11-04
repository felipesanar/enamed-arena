import { afterEach, describe, expect, it, vi } from 'vitest';
import { exportNotebookPdf } from './cadernoExport';
import * as helpers from './pdf/pdfHelpers';

describe('cumulative notebook PDF', () => {
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
  it('keeps the neutral edition badge and the product footer with no unique exam context', () => {
    const doc = helpers.createPdf();
    vi.spyOn(helpers, 'createPdf').mockReturnValue(doc);
    const text = vi.spyOn(doc, 'text');
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:test'), revokeObjectURL: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const blob = exportNotebookPdf([]);
    expect(blob.size).toBeGreaterThan(0);
    expect(text).toHaveBeenCalledWith('ENAMED', expect.any(Number), expect.any(Number));
    expect(text).toHaveBeenCalledWith(expect.stringContaining('Simulados SanarFlix'), expect.any(Number), expect.any(Number));
    expect(text.mock.calls.some(call => String(call[0]).includes('2027.1'))).toBe(false);
  });
  it('exports an unknown correction neutrally without reusing an AI or official correction', () => {
    const doc = helpers.createPdf();
    vi.spyOn(helpers, 'createPdf').mockReturnValue(doc);
    const text = vi.spyOn(doc, 'text');
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:test'), revokeObjectURL: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    exportNotebookPdf([{
      id: 'unknown', area: 'CM', theme: 'Tema', question_number: 1, question_text: 'Enunciado',
      reason: 'reading_error', learning_text: 'Minha anotação preservada', simulado_title: 'Simulado',
      ai_review_md: 'CACHED_CORRECTION', explanation: 'OFFICIAL_CORRECTION', created_at: '2026-01-01',
      options: [{ label: 'A', text: 'Alternativa A', isCorrect: null }],
      correct_label: null, correction_unavailable: true,
    }]);
    const renderedText = text.mock.calls.map(call => String(call[0])).join('\n');
    expect(renderedText).toContain('Correção indisponível');
    expect(renderedText).toContain('Minha anotação preservada');
    expect(renderedText).toContain('Alternativa A');
    expect(renderedText).not.toMatch(/CACHED_CORRECTION|OFFICIAL_CORRECTION|resposta correta|Gabarito:/);
  });
});
