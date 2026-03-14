/**
 * Hook to load a single simulado + its questions from Supabase.
 * Used by exam, result, correction, and detail pages.
 */
import { useState, useEffect, useCallback } from 'react';
import { simuladosApi } from '@/services/simuladosApi';
import { useAuth } from '@/contexts/AuthContext';
import type { SimuladoConfig, Question, SimuladoWithStatus, SimuladoUserState } from '@/types';
import { enrichSimulado } from '@/lib/simulado-helpers';

interface UseSimuladoDetailReturn {
  simulado: SimuladoWithStatus | null;
  questions: Question[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useSimuladoDetail(simuladoId: string | undefined): UseSimuladoDetailReturn {
  const [simulado, setSimulado] = useState<SimuladoWithStatus | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const fetchData = useCallback(async () => {
    if (!simuladoId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [config, questionData, attempt] = await Promise.all([
        simuladosApi.getSimulado(simuladoId),
        simuladosApi.getQuestions(simuladoId),
        user ? simuladosApi.getAttempt(simuladoId, user.id) : Promise.resolve(null),
      ]);

      if (!config) {
        setError('Simulado não encontrado');
        setLoading(false);
        return;
      }

      const userState: SimuladoUserState | undefined = attempt
        ? {
            simuladoId: attempt.simulado_id,
            started: true,
            startedAt: attempt.started_at,
            finished: attempt.status === 'submitted' || attempt.status === 'expired',
            finishedAt: attempt.finished_at || undefined,
            score: attempt.score_percentage != null ? Math.round(Number(attempt.score_percentage)) : undefined,
          }
        : undefined;

      setSimulado(enrichSimulado(config, userState));
      setQuestions(questionData);
      console.log('[useSimuladoDetail] Loaded simulado:', config.title, 'questions:', questionData.length);
    } catch (err: any) {
      console.error('[useSimuladoDetail] Error:', err);
      setError(err.message || 'Erro ao carregar simulado');
    } finally {
      setLoading(false);
    }
  }, [simuladoId, user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { simulado, questions, loading, error, refetch: fetchData };
}
