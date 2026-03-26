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
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<UserPerformanceSummaryRow | null>(null);
  const [history, setHistory] = useState<UserPerformanceHistoryRow[]>([]);

  const refetch = useCallback(async () => {
    if (!user) {
      setSummary(null);
      setHistory([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [summaryRow, historyRows] = await Promise.all([
        simuladosApi.getUserPerformanceSummary(user.id),
        simuladosApi.getUserPerformanceHistory(user.id, 12),
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
  }, [user]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { loading, summary, history, refetch };
}
