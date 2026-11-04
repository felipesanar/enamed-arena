import { supabase } from '@/integrations/supabase/client';
import { adminApi } from '@/admin/services/adminApi';
import type { AddBankVersionToSimuladoArgs, AddBankVersionToSimuladoResult, QuestionBankListPage, QuestionBankVersion, QuestionItemAnalysis } from '@/types/question-bank';

async function assertIdentity(userId: string) {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!userId || data.session?.user.id !== userId) throw new Error('A conta mudou. Atualize a consulta.');
}
async function call<T>(userId: string, name: string, args: Record<string, unknown>): Promise<T> {
  await assertIdentity(userId);
  const { data, error } = await supabase.rpc(name as never, args as never);
  if (error) throw error;
  await assertIdentity(userId);
  if (data === null) throw new Error('Resposta do banco de questões indisponível.');
  return data as unknown as T;
}
function requireId(id: string) { if (!id) throw new Error('Selecione uma identidade ou versão.'); }
function pageOffset(offset: number) { if (!Number.isSafeInteger(offset) || offset < 0 || offset > 1000000) throw new Error('Página inválida.'); }

export const questionBankApi = {
  async list(userId: string, { search = '', offset = 0 }: { search?: string; offset?: number }) {
    pageOffset(offset);
    const query = search.trim();
    if ([...query].length > 500) throw new Error('Use até 500 caracteres na busca.');
    return call<QuestionBankListPage>(userId, 'admin_list_question_bank', { p_search: query || null, p_limit: 50, p_offset: offset });
  },
  async listVersions(userId: string, bankId: string, offset = 0) {
    requireId(bankId); pageOffset(offset);
    return call<QuestionBankVersion[]>(userId, 'admin_list_question_bank_versions', { p_bank_id: bankId, p_limit: 50, p_offset: offset });
  },
  async getAnalysis(userId: string, bankId: string, editionId: string | null) {
    requireId(bankId);
    return call<QuestionItemAnalysis[]>(userId, 'admin_get_question_item_analysis', { p_bank_id: bankId, p_edition_id: editionId });
  },
  async getDrafts(userId: string) {
    await assertIdentity(userId);
    const drafts = await adminApi.listSimulados();
    await assertIdentity(userId);
    return drafts.filter(draft => draft.status === 'draft' && draft.attempts_count === 0);
  },
  async reuseVersion(userId: string, input: AddBankVersionToSimuladoArgs) {
    requireId(input.p_version_id); requireId(input.p_simulado_id);
    if (!Number.isSafeInteger(input.p_question_number) || input.p_question_number < 1 || input.p_question_number > 2147483647) throw new Error('Número da questão inválido.');
    // No automatic retry: a failed acknowledgement can follow a committed mutation.
    return call<AddBankVersionToSimuladoResult>(userId, 'admin_add_bank_version_to_simulado', { ...input });
  },
};
