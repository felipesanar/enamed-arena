/**
 * cadernoApi — cadernos impressos no fluxo LOGADO (`/simulados/:id/gabarito`).
 *
 * Três RPCs `SECURITY DEFINER`, todas EXECUTE para `authenticated`. O modelo
 * de dados (`presencial_cadernos`, `presencial_caderno_items`) já está em
 * produção e é o mesmo usado pelo fluxo público v1 (`presencialApi.ts`) —
 * este serviço só expõe a mesma informação para quem já está logado.
 *
 * Ver contrato: docs/superpowers/specs/2026-09-06-presencial-cadernos-v2-fluxo-logado.md
 */
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import type { PresencialCaderno, CadernoSkeletonQuestion } from '@/types/presencial';

// As RPCs abaixo são novas e ainda não estão no `types.ts` gerado (migration
// em paralelo) — mesmo padrão de cast usado em `offlineApi.ts` para não travar
// o typecheck contra o union literal de nomes de function do Supabase.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = (name: string, params?: Record<string, unknown>) =>
  (supabase.rpc as any)(name, params) as ReturnType<typeof supabase.rpc>;

const OPTION_LABELS = ['A', 'B', 'C', 'D'] as const;

interface CadernoSkeletonRow {
  position: number;
  question_id: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
}

export const cadernoApi = {
  /**
   * Lista os cadernos ativos do simulado. `[]` significa "sem caderno" —
   * o caller deve cair no comportamento de hoje (grade a partir de
   * `useSimuladoDetail().questions`), sem Tela 0.
   */
  async listActiveCadernos(simuladoId: string): Promise<PresencialCaderno[]> {
    logger.log('[CadernoApi] Listando cadernos ativos do simulado:', simuladoId);
    const { data, error } = await rpc('list_active_cadernos', { p_simulado_id: simuladoId });
    if (error) {
      logger.error('[CadernoApi] Erro ao listar cadernos ativos:', error);
      throw error;
    }
    return ((data as unknown[]) ?? []) as PresencialCaderno[];
  },

  /**
   * Esqueleto do caderno escolhido: numeração impressa (`position` → `number`)
   * e o `option_id` real de cada alternativa A/B/C/D — nunca enunciado, texto
   * de alternativa, `explanation` ou `image_url*`.
   *
   * `[]` significa caderno indisponível ou incompleto (nº de itens ≠ nº de
   * questões do simulado) — o caller NUNCA deve cair na ordem natural das
   * questões nesse caso: preencher na ordem errada é pior do que não
   * preencher.
   */
  async getCadernoSkeleton(
    simuladoId: string,
    cadernoCode: string,
  ): Promise<CadernoSkeletonQuestion[]> {
    logger.log('[CadernoApi] Buscando esqueleto do caderno:', cadernoCode, 'simulado:', simuladoId);
    const { data, error } = await rpc('get_caderno_skeleton', {
      p_simulado_id: simuladoId,
      p_caderno_code: cadernoCode,
    });
    if (error) {
      logger.error('[CadernoApi] Erro ao buscar esqueleto do caderno:', error);
      throw error;
    }
    const rows = ((data as unknown[]) ?? []) as CadernoSkeletonRow[];
    return rows.map(row => ({
      question_id: row.question_id,
      number: row.position,
      options: OPTION_LABELS.map(label => ({
        id: row[`option_${label.toLowerCase()}` as keyof CadernoSkeletonRow] as string,
        label,
      })),
    }));
  },

  /**
   * Grava qual caderno o aluno escolheu no attempt offline atual. Idempotente
   * — pode ser chamada de novo se o aluno trocar de caderno na Tela 0.
   */
  async setAttemptCaderno(attemptId: string, cadernoCode: string): Promise<void> {
    logger.log('[CadernoApi] Definindo caderno do attempt:', attemptId, cadernoCode);
    const { error } = await rpc('set_attempt_caderno_guarded', {
      p_attempt_id: attemptId,
      p_caderno_code: cadernoCode,
    });
    if (error) {
      logger.error('[CadernoApi] Erro ao definir caderno do attempt:', error);
      throw error;
    }
  },
};
