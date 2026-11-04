import { beforeEach, describe, expect, it, vi } from 'vitest';
const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc } }));
import { adminApi } from '@/admin/services/adminApi';

const window = { execution_window_start: '2027-01-01T11:00:00Z', execution_window_end: '2027-01-02T11:00:00Z', results_release_at: '2027-01-02T11:00:00Z' };
const preview = { simulado_id: 's', current_window_hash: 'hash', attempts_examined: 3, old_eligible: 1, new_eligible: 2, eligibility_changed: 1, old_window: window, new_window: window };
const historicalWindow = { ...window, results_release_at: '2027-01-02T10:58:00Z' };
describe('explicit window RPCs', () => {
  beforeEach(() => { vi.restoreAllMocks(); rpc.mockReset(); });
  it('uses the exact preview contract', async () => {
    rpc.mockResolvedValue({ data: preview, error: null });
    await expect(adminApi.previewSimuladoWindow('s', window)).resolves.toEqual(preview);
    expect(rpc).toHaveBeenCalledWith('admin_preview_simulado_window', { p_simulado_id: 's', p_execution_window_start: window.execution_window_start, p_execution_window_end: window.execution_window_end, p_results_release_at: window.results_release_at });
  });
  it('previews a valid correction of an S7 historical window released before its end', async () => {
    const report = { ...preview, old_window: historicalWindow };
    rpc.mockResolvedValue({ data: report, error: null });
    await expect(adminApi.previewSimuladoWindow('s', window)).resolves.toEqual(report);
    expect(rpc).toHaveBeenCalledTimes(1);
  });
  it('accepts an update report correcting an S7 historical window released before its end', async () => {
    const report = { ...preview, old_window: historicalWindow, operation_id: 'op' };
    rpc.mockResolvedValue({ data: report, error: null });
    await expect(adminApi.updateSimuladoWindow('s', window, 'hash', 'Correção')).resolves.toEqual(report);
    expect(rpc).toHaveBeenCalledTimes(1);
  });
  it.each(['2027-01-02T10:58:00', 'bad'])('still rejects invalid historical ISO dates: %s', async release => {
    const report = { ...preview, old_window: { ...historicalWindow, results_release_at: release } };
    rpc.mockResolvedValue({ data: report, error: null });
    await expect(adminApi.previewSimuladoWindow('s', window)).rejects.toThrow();
    rpc.mockResolvedValue({ data: { ...report, operation_id: 'op' }, error: null });
    await expect(adminApi.updateSimuladoWindow('s', window, 'hash', 'Correção')).rejects.toThrow();
  });
  it.each([
    historicalWindow,
    { ...window, execution_window_end: window.execution_window_start },
  ])('keeps input and new-window order strict: %j', async invalidWindow => {
    await expect(adminApi.previewSimuladoWindow('s', invalidWindow)).rejects.toThrow();
    await expect(adminApi.updateSimuladoWindow('s', invalidWindow, 'hash', 'Correção')).rejects.toThrow();
    expect(rpc).not.toHaveBeenCalled();
    const report = { ...preview, old_window: historicalWindow, new_window: invalidWindow };
    rpc.mockResolvedValue({ data: report, error: null });
    await expect(adminApi.previewSimuladoWindow('s', window)).rejects.toThrow();
    rpc.mockResolvedValue({ data: { ...report, operation_id: 'op' }, error: null });
    await expect(adminApi.updateSimuladoWindow('s', window, 'hash', 'Correção')).rejects.toThrow();
  });
  it.each([null, { ...preview, attempts_examined: null }, { ...preview, new_eligible: '2' }, { ...preview, old_window: {} }, { ...preview, eligibility_changed: -1 }, { ...preview, new_window: { ...window, results_release_at: 'bad' } }])('rejects malformed reports without zero fallbacks: %j', async data => {
    rpc.mockResolvedValue({ data, error: null });
    await expect(adminApi.previewSimuladoWindow('s', window)).rejects.toThrow();
  });
  it('validates dates and reason before calling the server', async () => {
    await expect(adminApi.previewSimuladoWindow('s', { ...window, execution_window_end: window.execution_window_start })).rejects.toThrow();
    await expect(adminApi.updateSimuladoWindow('s', window, 'hash', '  ')).rejects.toThrow();
    expect(rpc).not.toHaveBeenCalled();
  });
  it('sends expected hash and trimmed reason once; never falls back on error', async () => {
    const failure = { code: '40001', message: 'STALE_WINDOW_HASH' };
    rpc.mockResolvedValue({ data: null, error: failure });
    await expect(adminApi.updateSimuladoWindow('s', window, 'hash', ' Correção ')).rejects.toBe(failure);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc.mock.calls[0][1]).toMatchObject({ p_expected_window_hash: 'hash', p_reason: 'Correção' });
  });
  it('rejects a malformed HTTP-success mutation report without attempting another write', async () => {
    rpc.mockResolvedValue({ data: { ...preview, operation_id: 'op', attempts_examined: null }, error: null });
    await expect(adminApi.updateSimuladoWindow('s', window, 'hash', 'Correção')).rejects.toThrow();
    expect(rpc).toHaveBeenCalledTimes(1);
  });
  it('preserves only the three dates on existing saves, not creation', async () => {
    const values = { ...window, edition_id: 'e', title: 'Dirty title', status: 'draft' } as Parameters<typeof adminApi.createSimulado>[0];
    vi.spyOn(adminApi, 'updateSimulado').mockResolvedValue({ id: 's' } as never);
    vi.spyOn(adminApi, 'createSimulado').mockResolvedValue({ id: 's' } as never);
    await adminApi.saveSimuladoWithEdition('s', values, vi.fn(), { preserveWindow: true });
    expect(adminApi.updateSimulado).toHaveBeenCalledWith('s', { edition_id: 'e', title: 'Dirty title', status: 'draft' });
    await adminApi.saveSimuladoWithEdition(null, values, vi.fn(), { preserveWindow: true });
    expect(adminApi.createSimulado).toHaveBeenCalledWith(values);
  });
});
