import { describe, expect, it, vi } from 'vitest';
const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke } } }));
import { adminQuestionImportApi } from './adminQuestionImportApi';
describe('adminQuestionImportApi', () => {
  it('sends the complete payload once and preserves row errors', async () => {
    const result = { ok: false, imported: 0, errors: [{ row: 105, field: 'area', message: 'Inválida' }] };
    invoke.mockResolvedValue({ data: result, error: null });
    const rows = Array.from({ length: 120 }, (_, i) => ({ question_number: i + 1 }));
    expect(await adminQuestionImportApi.importQuestions('sim', rows as never[])).toEqual(result);
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke.mock.calls[0][1].body.rows).toHaveLength(120);
  });
  it('rejects transport errors and invalid responses', async () => {
    invoke.mockResolvedValue({ error: new Error('offline') });
    await expect(adminQuestionImportApi.importQuestions('sim', [])).rejects.toThrow('offline');
    invoke.mockResolvedValue({ data: { inserted: 1 }, error: null });
    await expect(adminQuestionImportApi.importQuestions('sim', [])).rejects.toThrow();
  });
});
