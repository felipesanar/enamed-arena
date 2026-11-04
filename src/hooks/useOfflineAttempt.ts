import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { offlineApi } from '@/services/offlineApi';
import { useAuth } from '@/contexts/AuthContext';
import { isPendingOfflineAttempt, readOfflineAttempts, saveOfflineAttempt, removeOfflineAttempt } from '@/lib/offline-attempt-cache';

const QUERY_KEY = 'offline-attempt';

export function persistOfflineAttempt(userId: string, attempt: {
  id: string; simulado_id: string; simulado_slug: string; started_at: string; exam_duration_seconds: number;
}): boolean {
  const deadline = Date.parse(attempt.started_at) + attempt.exam_duration_seconds * 1000;
  if (!Number.isFinite(deadline)) return false;
  return saveOfflineAttempt(userId, {
    id: attempt.id, simulado_id: attempt.simulado_id, simulado_slug: attempt.simulado_slug,
    started_at: attempt.started_at, effective_deadline: new Date(deadline).toISOString(), status: 'offline_pending',
  });
}

export function useOfflineAttempt(simuladoId?: string) {
  const { user } = useAuth();
  const userId = user?.id;
  const scope = JSON.stringify([userId, simuladoId]);
  const currentScope = useRef(scope);
  currentScope.current = scope;
  const queryClient = useQueryClient();
  const [, refreshStorage] = useState(0);
  const [storageFailed, setStorageFailed] = useState(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    const onStorage = () => refreshStorage(n => n + 1);
    window.addEventListener('storage', onStorage);
    return () => { mounted.current = false; window.removeEventListener('storage', onStorage); };
  }, []);

  const query = useQuery({
    queryKey: [QUERY_KEY, userId, simuladoId ?? null],
    queryFn: async () => {
      const cachedAtStart = readOfflineAttempts(userId!, simuladoId);
      return { scope, cachedAtStart, attempt: await offlineApi.getActiveOfflineAttempt(userId!, simuladoId) };
    },
    enabled: !!userId,
    staleTime: 0,
    retry: false,
    refetchOnWindowFocus: true,
  });
  const resolved = query.data?.scope === scope && !query.isError ? query.data : undefined;
  const confirmed = !!resolved && !query.isFetching;
  useEffect(() => {
    if (!userId || !resolved || currentScope.current !== scope || !confirmed) return;
    const pending = resolved.attempt;
    if (isPendingOfflineAttempt(pending)) {
      setStorageFailed(!saveOfflineAttempt(userId, pending));
    } else if (pending === null) {
      // A late empty response must not erase an attempt created during this read.
      const current = readOfflineAttempts(userId, simuladoId);
      (resolved.cachedAtStart ?? []).forEach(a => {
        if (current.some(c => JSON.stringify(c) === JSON.stringify(a))) removeOfflineAttempt(userId, a.simulado_id, a.id);
      });
    }
  }, [resolved, confirmed, scope, userId, simuladoId]);

  const local = userId ? readOfflineAttempts(userId, simuladoId)[0] ?? null : null;
  const activeAttempt = !userId ? null : resolved
    ? (isPendingOfflineAttempt(resolved.attempt) ? resolved.attempt : null)
    : local;
  const invalidate = useCallback(() => {
    if (currentScope.current === scope && mounted.current) void queryClient.invalidateQueries({ queryKey: [QUERY_KEY, userId, simuladoId ?? null] });
  }, [queryClient, scope, userId, simuladoId]);
  const clearAttempt = useCallback(() => {
    if (!userId || currentScope.current !== scope || !mounted.current || !activeAttempt) return;
    removeOfflineAttempt(userId, activeAttempt.simulado_id, activeAttempt.id);
    queryClient.setQueryData([QUERY_KEY, userId, simuladoId ?? null], (previous: { scope: string; attempt: { id: string } | null } | undefined) =>
      previous?.attempt && previous.attempt.id !== activeAttempt.id ? previous : { scope, attempt: null });
  }, [queryClient, userId, simuladoId, scope, activeAttempt]);
  return { activeAttempt, invalidate, clearAttempt, isLoading: query.isLoading,
    isConfirmed: confirmed && !!activeAttempt, queryError: query.isError, storageFailed,
    retry: query.refetch };
}
