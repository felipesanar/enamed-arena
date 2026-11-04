import { afterEach, describe, expect, it, vi } from 'vitest';
import { editionsApi } from '@/services/editionsApi';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc } }));
afterEach(() => vi.clearAllMocks());

describe('editionsApi.getExamEditions', () => {
  it('le RPC existente preservando formato legado vazio', async () => {
    const rows = [{ id: '1', format: {} }];
    rpc.mockResolvedValue({ data: rows, error: null });
    expect(await editionsApi.getExamEditions()).toEqual(rows);
    expect(rpc).toHaveBeenCalledWith('get_exam_editions');
  });
  it('ausencia vira lista vazia', async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    expect(await editionsApi.getExamEditions()).toEqual([]);
  });
  it('propaga erro e rejeita resposta nao-array', async () => {
    rpc.mockResolvedValue({ data: null, error: new Error('offline') });
    await expect(editionsApi.getExamEditions()).rejects.toThrow('offline');
    rpc.mockResolvedValue({ data: {}, error: null });
    await expect(editionsApi.getExamEditions()).rejects.toThrow('Invalid exam editions response');
  });
});
