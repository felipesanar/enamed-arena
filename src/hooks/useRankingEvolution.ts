/**
 * useRankingEvolution — série de notas (sparkline) + climb por delta de percentil.
 * Front puro: usa get_user_performance_history (notas por simulado) e, lazy,
 * o ranking do simulado anterior para extrair a posição/percentil do usuário.
 */

import { useQuery } from '@tanstack/react-query';
import { simuladosApi } from '@/services/simuladosApi';
import { fetchRankingForSimulado } from '@/services/rankingApi';
import { computePercentile, computeClimb, type Climb } from '@/lib/ranking-percentile';

export interface RankingEvolution {
  scoreSeries: number[];
  climb: Climb;
}

export function useRankingEvolution(
  userId: string | null,
  simuladosWithResults: Array<{ id: string; sequence_number: number }>,
  selectedSimuladoId: string | null,
  currentPercentil: number | null,
): { data: RankingEvolution | null; loading: boolean } {
  const historyQ = useQuery({
    queryKey: ['ranking-evolution-history', userId],
    queryFn: () => simuladosApi.getUserPerformanceHistory(userId!, 20),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });

  const history = historyQ.data ?? [];
  // ordem cronológica pela sequência dos simulados liberados
  const orderedReleased = [...simuladosWithResults].sort((a, b) => a.sequence_number - b.sequence_number);
  const scoreById = new Map(history.map((h) => [h.simulado_id, Math.round(h.score_percentage)]));
  const scoreSeries = orderedReleased
    .filter((s) => scoreById.has(s.id))
    .map((s) => scoreById.get(s.id)!);

  // simulado imediatamente anterior ao selecionado, que o usuário fez
  const idx = orderedReleased.findIndex((s) => s.id === selectedSimuladoId);
  let previousSimuladoId: string | null = null;
  for (let i = idx - 1; i >= 0; i--) {
    if (scoreById.has(orderedReleased[i].id)) {
      previousSimuladoId = orderedReleased[i].id;
      break;
    }
  }

  const prevQ = useQuery({
    queryKey: ['ranking-evolution-prev', previousSimuladoId, userId],
    queryFn: async () => {
      const rows = await fetchRankingForSimulado(previousSimuladoId!);
      const me = rows.find((r) => r.user_id === userId);
      if (!me) return null;
      return computePercentile(Number(me.posicao), Number(me.total_candidatos));
    },
    enabled: !!previousSimuladoId && !!userId,
    staleTime: 5 * 60 * 1000,
  });

  const loading = historyQ.isLoading || (!!previousSimuladoId && prevQ.isLoading);
  if (currentPercentil == null) return { data: null, loading };

  const prevPercentil = previousSimuladoId ? prevQ.data ?? null : null;
  return {
    data: { scoreSeries, climb: computeClimb(prevPercentil, currentPercentil) },
    loading,
  };
}
