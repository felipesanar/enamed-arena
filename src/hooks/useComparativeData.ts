import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAppConfig } from '@/hooks/useAppConfig';
import { useUserEdition } from '@/hooks/useUserEdition';
import { useAuth } from '@/contexts/AuthContext';
import { useAdminAuth } from '@/admin/hooks/useAdminAuth';
import { useSimulados } from '@/hooks/useSimulados';
import { canViewResultsOrAdminPreview } from '@/lib/simulado-helpers';
import {
  simuladosApi,
  type UserAttemptBehaviorRow,
} from '@/services/simuladosApi';
import {
  computeComparativeInsights,
  type SimuladoComparativeEntry,
  type ComparativeInsight,
} from '@/lib/resultHelpers';

export interface ComparativeEntryRich extends SimuladoComparativeEntry {
  durationSeconds: number | null;
  tabExits: number;
  fullscreenExits: number;
  markedForReview: number;
  highConfidenceTotal: number;
  highConfidenceCorrect: number;
  highConfidenceWrong: number;
}

export interface SimuladoSlot {
  simuladoId: string;
  sequenceNumber: number;
  title: string;
  /** Score do aluno (null se ainda não fez) */
  score: number | null;
}

export interface UseComparativeDataResult {
  entries: ComparativeEntryRich[];
  insights: ComparativeInsight[];
  loading: boolean;
  /** Todos os simulados publicados na plataforma (independente de o aluno ter feito) */
  allSlots: SimuladoSlot[];
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Centraliza todos os dados necessários para a tela de Comparativo:
 *  - simulados completos do usuário (com admin preview)
 *  - score por (simulado, área) via RPC
 *  - estatísticas comportamentais por attempt via RPC
 *  - insights derivados
 */
export function useComparativeData(): UseComparativeDataResult {
  const { simulados: allSimulados, loading: loadingSimulados } = useSimulados();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin } = useAdminAuth();
  const editionsUi = useAppConfig('editions_ui');
  const { userEdition } = useUserEdition(editionsUi);
  const editionId = editionsUi ? userEdition?.id : undefined;
  const userId = user?.id;
  const enabled = !!userId && !authLoading && (!editionsUi || !!editionId);
  const simulados = useMemo(() => enabled
    ? allSimulados.filter(sim => !editionsUi || sim.editionId === editionId) : [],
  [enabled, allSimulados, editionsUi, editionId]);
  const eligibleIds = simulados.filter(sim => canViewResultsOrAdminPreview(sim.status, {
    adminPreview: isAdmin, attemptFinished: !!sim.userState?.finished,
  })).map(sim => sim.id).sort();
  const query = useQuery({
    queryKey: ['comparative', userId, editionsUi ? editionId ?? null : 'legacy', isAdmin, eligibleIds],
    enabled, staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const [areas, behavior] = await Promise.all([
        // This RPC has no edition argument: scope its rows before computing insights.
        simuladosApi.getUserAreaScoresBySimulado(userId!),
        editionId ? simuladosApi.getUserAttemptBehaviorStats(userId!, editionId)
          : simuladosApi.getUserAttemptBehaviorStats(userId!),
      ]);
      return { areas, behavior };
    },
  });
  const { areaRows, behaviorRows } = useMemo(() => {
    const allowedIds = new Set(simulados.map(sim => sim.id));
    return {
      areaRows: enabled ? (query.data?.areas ?? []).filter(row => allowedIds.has(row.simulado_id)) : [],
      behaviorRows: enabled ? (query.data?.behavior ?? []).filter(row => allowedIds.has(row.simulado_id)) : [],
    };
  }, [enabled, simulados, query.data]);
  const { refetch: refetchQuery } = query;
  const refetch = useCallback(async () => { if (enabled) await refetchQuery(); }, [enabled, refetchQuery]);

  const areaBySimulado = useMemo(() => {
    const map = new Map<string, Record<string, number>>();
    areaRows.forEach(row => {
      const bucket = map.get(row.simulado_id) ?? {};
      bucket[row.area] = Math.round(Number(row.score_percentage) || 0);
      map.set(row.simulado_id, bucket);
    });
    return map;
  }, [areaRows]);

  const behaviorBySimulado = useMemo(() => {
    const map = new Map<string, UserAttemptBehaviorRow>();
    behaviorRows.forEach(row => map.set(row.simulado_id, row));
    return map;
  }, [behaviorRows]);

  const completed = useMemo(
    () =>
      simulados.filter(s =>
        canViewResultsOrAdminPreview(s.status, {
          adminPreview: isAdmin,
          attemptFinished: !!s.userState?.finished,
        }) && s.userState?.score != null && (!editionsUi || s.userState.isWithinWindow === true),
      ),
    [simulados, isAdmin, editionsUi],
  );

  const entries: ComparativeEntryRich[] = useMemo(() => {
    return completed.map(sim => {
      const beh = behaviorBySimulado.get(sim.id);
      return {
        simuladoId: sim.id,
        title: sim.title,
        sequenceNumber: sim.sequenceNumber,
        percentageScore: sim.userState!.score!,
        totalCorrect: beh?.total_correct ?? 0,
        totalQuestions: beh?.total_questions ?? sim.questionsCount,
        completedAt: sim.userState!.finishedAt || sim.userState!.startedAt || '',
        areaScores: areaBySimulado.get(sim.id) ?? {},
        durationSeconds: beh?.duration_seconds ?? null,
        tabExits: beh?.tab_exit_count ?? 0,
        fullscreenExits: beh?.fullscreen_exit_count ?? 0,
        markedForReview: beh?.total_marked_for_review ?? 0,
        highConfidenceTotal: beh?.total_high_confidence ?? 0,
        highConfidenceCorrect: beh?.high_confidence_correct ?? 0,
        highConfidenceWrong: beh?.high_confidence_wrong ?? 0,
      };
    });
  }, [completed, areaBySimulado, behaviorBySimulado]);

  const insights = useMemo(() => computeComparativeInsights(entries), [entries]);

  // Todos os slots de simulado da plataforma — usado pra plotar o eixo X
  // completo no chart de evolução (não apenas os que o aluno fez).
  const allSlots: SimuladoSlot[] = useMemo(() => {
    return [...simulados]
      .sort((a, b) => a.sequenceNumber - b.sequenceNumber)
      .map(sim => {
        const matchingEntry = entries.find(e => e.simuladoId === sim.id);
        return {
          simuladoId: sim.id,
          sequenceNumber: sim.sequenceNumber,
          title: sim.title,
          score: matchingEntry?.percentageScore ?? null,
        };
      });
  }, [simulados, entries]);

  return {
    entries,
    insights,
    loading: loadingSimulados || (enabled && query.isLoading),
    allSlots,
    error: enabled && query.error ? (query.error instanceof Error ? query.error.message : 'Erro ao carregar comparativo') : null,
    refetch,
  };
}

// re-export type to keep imports stable
export type { ComparativeInsight } from '@/lib/resultHelpers';
