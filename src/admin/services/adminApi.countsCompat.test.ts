import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn(), select: vi.fn(), order: vi.fn(), delete: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: mocks.from, rpc: mocks.rpc } }));
import { adminApi } from './adminApi';

const simulados = [
  { id: 'sim-1', sequence_number: 1, title: 'Primeiro' },
  { id: 'sim-2', sequence_number: 2, title: 'Segundo' },
  { id: 'sim-3', sequence_number: 3, title: 'Terceiro' },
];
const missingRpc = {
  code: 'PGRST202',
  message: 'Could not find the function public.admin_simulado_attempt_counts without parameters in the schema cache',
  details: 'Searched for the function public.admin_simulado_attempt_counts without parameters, but no matches were found in the schema cache.',
  hint: null,
};
const missingSql = {
  code: '42883', message: 'function public.admin_simulado_attempt_counts() does not exist', details: null, hint: null,
};

describe('admin counts rollout read compatibility', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.from.mockReturnValue({ select: mocks.select, delete: mocks.delete });
    mocks.select.mockReturnValue({ order: mocks.order });
    mocks.order.mockResolvedValue({ data: simulados, error: null });
    mocks.rpc.mockResolvedValue({ data: null, error: missingRpc });
  });

  it.each([
    missingRpc,
    { ...missingRpc, message: 'Function not found in schema cache' },
    missingSql,
    { ...missingSql, message: 'function public.admin_simulado_attempt_counts(p_simulado_id => uuid) does not exist' },
  ])('returns all selected rows with unknown counts for confirmed target absence: $message', async error => {
    mocks.rpc.mockResolvedValue({ data: null, error });
    await expect(adminApi.listSimulados()).resolves.toEqual(simulados.map(row => ({ ...row, attempts_count: null })));
    expect(mocks.from.mock.calls).toEqual([['simulados']]);
    expect(mocks.select).toHaveBeenCalledWith('*');
    expect(mocks.order).toHaveBeenCalledWith('sequence_number', { ascending: true });
    expect(mocks.rpc.mock.calls).toEqual([['admin_simulado_attempt_counts', {}]]);
    expect(mocks.delete).not.toHaveBeenCalled();
  });

  it('preserves authoritative zero and five counts and leaves missing rows unknown', async () => {
    mocks.rpc.mockResolvedValue({ data: [
      { simulado_id: 'sim-2', attempts_count: 5 },
      { simulado_id: 'sim-1', attempts_count: 0 },
    ], error: null });
    const rows = await adminApi.listSimulados();
    expect(rows).toEqual(simulados.map((row, index) => ({ ...row, attempts_count: [0, 5, null][index] })));
    expect(mocks.from.mock.calls).toEqual([['simulados']]);
  });

  it.each([
    { code: '403', message: 'Forbidden' },
    { code: '42501', message: 'permission denied for function admin_simulado_attempt_counts' },
    { code: 'PGRST301', message: 'JWT expired' },
    { code: '', message: 'TypeError: Failed to fetch' },
    { code: '57014', message: 'canceling statement due to statement timeout' },
    { code: 'XX000', message: 'internal error in admin_simulado_attempt_counts' },
    { ...missingRpc, message: 'Could not find the function public.other_counts() in the schema cache', details: null },
    { ...missingRpc, message: 'Could not find the function public.admin_simulado_attempt_counts_backup() in the schema cache', details: null },
    { code: 'PGRST202', message: 'Function not found', details: null },
    { ...missingSql, message: 'function public.internal_counts_helper(uuid) does not exist', details: 'Called by admin_simulado_attempt_counts()' },
    { ...missingSql, message: 'function public.internal_counts_helper(uuid) does not exist in admin_simulado_attempt_counts()' },
    { ...missingSql, message: 'admin_simulado_attempt_counts failed: function resolution error' },
  ])('propagates ineligible errors without querying attempts: $message', async error => {
    mocks.rpc.mockResolvedValue({ data: null, error });
    await expect(adminApi.listSimulados()).rejects.toBe(error);
    expect(mocks.from.mock.calls).toEqual([['simulados']]);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.delete).not.toHaveBeenCalled();
  });

  it('propagates rejected network requests', async () => {
    const error = new TypeError('Failed to fetch');
    mocks.rpc.mockRejectedValue(error);
    await expect(adminApi.listSimulados()).rejects.toBe(error);
    expect(mocks.from.mock.calls).toEqual([['simulados']]);
  });

  it('propagates the simulado SELECT failure before calling counts', async () => {
    const error = { code: '42501', message: 'permission denied for table simulados' };
    mocks.order.mockResolvedValue({ data: null, error });
    await expect(adminApi.listSimulados()).rejects.toBe(error);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it.each([missingRpc, missingSql])('keeps count and both deletion paths fail-closed: $code', async error => {
    mocks.rpc.mockResolvedValue({ data: null, error });
    await expect(adminApi.getSimuladoAttemptsCount('sim-1')).rejects.toBe(error);
    await expect(adminApi.deleteSimulado('sim-1')).rejects.toBe(error);
    await expect(adminApi.deleteQuestionsForSimulado('sim-1')).rejects.toBe(error);
    expect(mocks.rpc.mock.calls).toEqual(Array.from({ length: 3 }, () => [
      'admin_simulado_attempt_counts', { p_simulado_id: 'sim-1' },
    ]));
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.delete).not.toHaveBeenCalled();
  });
});
