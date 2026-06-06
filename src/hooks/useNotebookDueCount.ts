/**
 * useNotebookDueCount — contagem de questões devidas hoje no Caderno (SRS).
 *
 * Fonte única de verdade da contagem "para revisar hoje", reaproveitada pela
 * home (card "Para revisar hoje") e pelo badge de devidas na navegação
 * (sidebar / bottom nav / command palette). Mantém a query key estável para
 * que todos os consumidores compartilhem o mesmo cache.
 *
 * Regra de devida: `srs_due_at <= fim do dia de hoje`. Entradas sem `srs_due_at`
 * (legado) contam como devidas se ainda não resolvidas.
 */

import { useQuery } from '@tanstack/react-query';
import { simuladosApi } from '@/services/simuladosApi';

export const NOTEBOOK_DUE_COUNT_KEY = (userId: string | undefined) =>
  ['notebook-due-count', userId] as const;

const STALE_TIME = 5 * 60 * 1000; // 5 min

/**
 * Conta as entradas devidas hoje. `enabled` deve ser true apenas para PRO com
 * a flag v2 ativa (ou onde o caderno é relevante) para evitar fetch supérfluo.
 */
export function useNotebookDueCount(userId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: NOTEBOOK_DUE_COUNT_KEY(userId),
    queryFn: async () => {
      if (!userId) return 0;
      const entries = await simuladosApi.getErrorNotebook(userId);
      const now = new Date();
      const todayEnd = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        23,
        59,
        59,
        999,
      );
      return entries.filter((e: any) => {
        const srsDueAt = e.srs_due_at as string | null | undefined;
        if (srsDueAt) {
          return new Date(srsDueAt) <= todayEnd;
        }
        // Fallback legado: pendente (não resolvida).
        return !e.resolved_at;
      }).length;
    },
    enabled: enabled && !!userId,
    staleTime: STALE_TIME,
  });
}
