import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePdfDownload } from '@/hooks/usePdfDownload';
import type { PerformanceBreakdown } from '@/lib/resultHelpers';
import type { ExamState } from '@/types/exam';

const mocks = vi.hoisted(() => ({ gabarito: vi.fn(), revisada: vi.fn() }));
vi.mock('@/lib/pdf/gabaritoPdf', () => ({ generateGabaritoPdf: mocks.gabarito }));
vi.mock('@/lib/pdf/provaRevisadaPdf', () => ({ generateProvaRevisadaPdf: mocks.revisada }));
vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }));
vi.mock('@/lib/analytics', () => ({ trackEvent: vi.fn() }));

const base = {
  simuladoId: 'uuid-real', simuladoTitle: 'Prova sem ano no titulo', studentName: 'Aluno', questions: [],
  examState: { status: 'submitted' } as ExamState,
  breakdown: { overall: {} } as PerformanceBreakdown,
};

describe('PDF download edition transport', () => {
  beforeEach(() => {
    mocks.gabarito.mockReset().mockReturnValue(new Blob(['gabarito']));
    mocks.revisada.mockReset().mockResolvedValue(new Blob(['revisada']));
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:pdf'), revokeObjectURL: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it('passes the actual edition to both generators, including after selecting another exam', async () => {
    const first = { editionCode: '2027.2', editionLabel: 'ENAMED 2027.2' };
    const second = { editionCode: '2026.1', editionLabel: 'Edicao historica' };
    const { result, rerender } = renderHook(({ simulado }) => usePdfDownload({ ...base, simulado }), {
      initialProps: { simulado: first },
    });
    await act(async () => { await result.current.downloadGabarito(); });
    await act(async () => { await result.current.downloadProvaRevisada(); });
    expect(mocks.gabarito).toHaveBeenLastCalledWith(expect.objectContaining({ simulado: first }));
    expect(mocks.revisada).toHaveBeenLastCalledWith(expect.objectContaining({ simulado: first }));
    rerender({ simulado: second });
    await act(async () => { await result.current.downloadGabarito(); });
    await act(async () => { await result.current.downloadProvaRevisada(); });
    expect(mocks.gabarito).toHaveBeenLastCalledWith(expect.objectContaining({ simulado: second }));
    expect(mocks.revisada).toHaveBeenLastCalledWith(expect.objectContaining({ simulado: second }));
  });

  it('does not infer an edition when metadata is absent', async () => {
    const { result } = renderHook(() => usePdfDownload(base));
    await act(async () => { await result.current.downloadGabarito(); });
    await act(async () => { await result.current.downloadProvaRevisada(); });
    expect(mocks.gabarito).toHaveBeenCalledWith(expect.objectContaining({ simulado: undefined }));
    expect(mocks.revisada).toHaveBeenCalledWith(expect.objectContaining({ simulado: undefined }));
  });

  it('does not generate downloads without released result data', async () => {
    const { result } = renderHook(() => usePdfDownload({ ...base, examState: null, breakdown: null }));
    await act(async () => { await result.current.downloadGabarito(); await result.current.downloadProvaRevisada(); });
    expect(mocks.gabarito).not.toHaveBeenCalled();
    expect(mocks.revisada).not.toHaveBeenCalled();
  });
});
