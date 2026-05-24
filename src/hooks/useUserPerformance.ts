import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  simuladosApi,
  type UserPerformanceHistoryRow,
  type UserPerformanceSummaryRow,
} from '@/services/simuladosApi';
import { logger } from '@/lib/logger';

export function useUserPerformance() {
  const { user } = useAuth();
  const userId = user?.id;
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<UserPerformanceSummaryRow | null>(null);
  const [history, setHistory] = useState<UserPerformanceHistoryRow[]>([]);

  // Dep é user.id (não o objeto user) — Supabase recria o user em token refresh
  // e nesse caso não queremos refetch desnecessário.
  const refetch = useCallback(async () => {
    if (!userId) {
      setSummary(null);
      setHistory([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [summaryRow, historyRows] = await Promise.all([
        simuladosApi.getUserPerformanceSummary(userId),
        simuladosApi.getUserPerformanceHistory(userId, 12),
      ]);
      setSummary(summaryRow);
      setHistory(historyRows);
    } catch (error) {
      logger.error('[useUserPerformance] Failed to load performance', error);
      setSummary(null);
      setHistory([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { loading, summary, history, refetch };
}
