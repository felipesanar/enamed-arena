/**
 * Hook for loading simulados from Supabase.
 * Replaces mock data imports from data/mock.ts.
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { simuladosApi, type AttemptRow } from '@/services/simuladosApi';
import { useAuth } from '@/contexts/AuthContext';
import type { SimuladoConfig, SimuladoWithStatus, SimuladoUserState } from '@/types';
import { enrichSimulado } from '@/lib/simulado-helpers';

export function useSimulados() {
  const [configs, setConfigs] = useState<SimuladoConfig[]>([]);
  const [attempts, setAttempts] = useState<AttemptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [simuladoConfigs, userAttempts] = await Promise.all([
        simuladosApi.listSimulados(),
        user ? simuladosApi.getUserAttempts(user.id) : Promise.resolve([]),
      ]);
      setConfigs(simuladoConfigs);
      setAttempts(userAttempts);
      console.log('[useSimulados] Loaded', simuladoConfigs.length, 'simulados,', userAttempts.length, 'attempts');
    } catch (err: any) {
      console.error('[useSimulados] Error:', err);
      setError(err.message || 'Erro ao carregar simulados');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Convert attempt rows to SimuladoUserState for enrichment
  const attemptToUserState = useCallback((attempt: AttemptRow): SimuladoUserState => ({
    simuladoId: attempt.simulado_id,
    started: true,
    startedAt: attempt.started_at,
    finished: attempt.status === 'submitted' || attempt.status === 'expired',
    finishedAt: attempt.finished_at || undefined,
    score: attempt.score_percentage != null ? Math.round(Number(attempt.score_percentage)) : undefined,
  }), []);

  const simulados: SimuladoWithStatus[] = useMemo(() => {
    return configs.map(config => {
      const attempt = attempts.find(a => a.simulado_id === config.id);
      const userState = attempt ? attemptToUserState(attempt) : undefined;
      return enrichSimulado(config, userState);
    });
  }, [configs, attempts, attemptToUserState]);

  const getSimuladoById = useCallback((id: string): SimuladoWithStatus | null => {
    return simulados.find(s => s.id === id) || null;
  }, [simulados]);

  return {
    simulados,
    loading,
    error,
    refetch: fetchData,
    getSimuladoById,
    /** Data source: always 'supabase' now */
    dataSource: 'supabase' as const,
  };
}
