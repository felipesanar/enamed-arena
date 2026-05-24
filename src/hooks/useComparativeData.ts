import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAdminAuth } from '@/admin/hooks/useAdminAuth';
import { useSimulados } from '@/hooks/useSimulados';
import { canViewResultsOrAdminPreview } from '@/lib/simulado-helpers';
import {
  simuladosApi,
  type UserAreaScoreRow,
  type UserAttemptBehaviorRow,
} from '@/services/simuladosApi';
import {
  computeComparativeInsights,
  type SimuladoComparativeEntry,
  type ComparativeInsight,
} from '@/lib/resultHelpers';
import { logger } from '@/lib/logger';

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
}

/**
 * Centraliza todos os dados necessários para a tela de Comparativo:
 *  - simulados completos do usuário (com admin preview)
 *  - score por (simulado, área) via RPC
 *  - estatísticas comportamentais por attempt via RPC
 *  - insights derivados
 */
export function useComparativeData(): UseComparativeDataResult {
  const { simulados, loading: loadingSimulados } = useSimulados();
  const { user } = useAuth();
  const { isAdmin } = useAdminAuth();

  const [areaRows, setAreaRows] = useState<UserAreaScoreRow[]>([]);
  const [behaviorRows, setBehaviorRows] = useState<UserAttemptBehaviorRow[]>([]);
  const [loadingExtras, setLoadingExtras] = useState(true);

  // Dep é `user?.id` (não `user`) — quando o Supabase emite token refresh / initial
  // session ao voltar o foco da aba, ele cria um NOVO objeto user com o mesmo id.
  // Usar `[user]` faria este efeito re-rodar e colocaria a página em loading,
  // o que desmontava o conteúdo e re-disparava o auto-trigger do Prof. Sanor.
  const userId = user?.id;
  useEffect(() => {
    let cancelled = false;
    if (!userId) {
      setAreaRows([]);
      setBehaviorRows([]);
      setLoadingExtras(false);
      return;
    }
    setLoadingExtras(true);
    Promise.all([
      simuladosApi.getUserAreaScoresBySimulado(userId),
      simuladosApi.getUserAttemptBehaviorStats(userId),
    ])
      .then(([areas, behavior]) => {
        if (cancelled) return;
        setAreaRows(areas);
        setBehaviorRows(behavior);
      })
      .catch(err => {
        logger.error('[useComparativeData] Failed to load:', err);
        if (!cancelled) {
          setAreaRows([]);
          setBehaviorRows([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingExtras(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

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
        }) && s.userState?.score != null,
      ),
    [simulados, isAdmin],
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
    loading: loadingSimulados || loadingExtras,
    allSlots,
  };
}

// re-export type to keep imports stable
export type { ComparativeInsight } from '@/lib/resultHelpers';
