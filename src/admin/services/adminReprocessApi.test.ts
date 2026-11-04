import { describe, expect, it, vi } from 'vitest';
const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc } }));
import { adminReprocessApi, reprocessErrorMessage } from './adminReprocessApi';
describe('reprocess RPC', () => {
  it('sends trimmed reason once and returns the aggregate report', async () => {
    const report = { operation_id: 'op', simulado_id: 's', answer_key_hash: 'hash', attempts_processed: 12, scores_changed: 3, entries_reconciled: 4, idempotent: false };
    rpc.mockResolvedValue({ data: report, error: null });
    expect(await adminReprocessApi.reprocess('s', ' Correção ')).toEqual(report);
    expect(rpc).toHaveBeenCalledWith('admin_reprocess_simulado', { p_simulado_id: 's', p_reason: 'Correção' });
  });
  it('explains locks and unknown outcomes without exposing SQL', () => {
    expect(reprocessErrorMessage({ code: '55P03' })).toMatch(/ocupada/);
    expect(reprocessErrorMessage(new TypeError('secret SQL'))).toMatch(/incerto/);
    expect(reprocessErrorMessage({ code: '22023' })).toMatch(/estrutura/);
  });
});
