import { supabase } from '@/integrations/supabase/client';
import type { ReprocessContext, ReprocessReport } from '@/types/admin-operations';

export function reprocessErrorMessage(error: unknown): string {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
  if (code === '55P03') return 'Prova ocupada por outra operação. Aguarde e tente novamente explicitamente.';
  if (code === '22023') return 'A janela, as tentativas ou a estrutura do gabarito impedem o reprocessamento. Revise a prova antes de tentar novamente.';
  if (code === 'P0003' || code === '42501') return 'Sem permissão para reprocessar. Verifique seu acesso.';
  return 'Resultado incerto. Confira os resultados e a auditoria antes de iniciar outra operação. Não houve repetição automática.';
}

export const adminReprocessApi = {
  async context(id: string): Promise<ReprocessContext> {
    const { data, error } = await supabase.from('simulados').select('id,title,execution_window_end,edition:exam_editions(label)' as never).eq('id', id).single();
    if (error) throw error;
    return data as unknown as ReprocessContext;
  },
  async reprocess(id: string, reason: string): Promise<ReprocessReport> {
    if (!reason.trim() || reason.trim().length > 2000) throw new Error('Motivo obrigatório, até 2000 caracteres.');
    const { data, error } = await supabase.rpc('admin_reprocess_simulado' as never, { p_simulado_id: id, p_reason: reason.trim() } as never);
    if (error) throw error;
    const report = data as unknown as ReprocessReport;
    if (!report || !report.operation_id || ![report.attempts_processed, report.scores_changed, report.entries_reconciled].every(n => Number.isInteger(n) && n >= 0)) throw new Error('Unknown reprocess response');
    return report;
  },
};
