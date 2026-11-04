import { describe, expect, it, vi } from 'vitest';
import { createPdf, drawPremiumHeader, addFooterToAllPages } from './pdfHelpers';

describe('PDF edition header compatibility', () => {
  it('preserves the old signature with a neutral badge and accepts an optional last argument', () => {
    const doc = createPdf();
    const text = vi.spyOn(doc, 'text');
    const y = drawPremiumHeader(doc, 'Prova', 'Revisão', 30);
    expect(y).toBe(64);
    expect(text).toHaveBeenCalledWith('ENAMED', expect.any(Number), expect.any(Number));
    text.mockClear();
    drawPremiumHeader(doc, 'Prova', 'Revisão', 30, 'ENAMED 2027.1');
    expect(text).toHaveBeenCalledWith('ENAMED 2027.1', expect.any(Number), expect.any(Number));
  });
  it('uses product name in the footer, without attributing a cumulative notebook to an edition', () => {
    const doc = createPdf();
    const text = vi.spyOn(doc, 'text');
    addFooterToAllPages(doc);
    expect(text).toHaveBeenCalledWith(expect.stringContaining('Simulados SanarFlix'), expect.any(Number), expect.any(Number));
  });
});
