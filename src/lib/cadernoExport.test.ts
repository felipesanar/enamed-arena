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
});
