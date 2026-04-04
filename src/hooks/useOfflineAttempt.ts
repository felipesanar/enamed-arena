/**
 * Manages the active offline attempt state.
 *
 * - Fetches offline_pending attempt from DB (React Query)
 * - Mirrors state to localStorage for resilience across page reloads
 * - Computes countdown based on effective_deadline (server-set)
 * - Exposes helpers for AnswerSheetPage and FloatingOfflineTimer
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { offlineApi, type ActiveOfflineAttempt } from '@/services/offlineApi';
import { useAuth } from '@/contexts/AuthContext';
import { logger } from '@/lib/logger';

const STORAGE_KEY = 'enamed_offline_attempt';
const QUERY_KEY = 'offline-attempt';

// ─── Local storage helpers ────────────────────────────────────────────────────

interface StoredAttempt {
  id: string;
  simulado_id: string;
  simulado_slug: string;
  started_at: string;
  effective_deadline: string;
  status: string;
}

function readStorage(): StoredAttempt | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredAttempt) : null;
  } catch {
    return null;
  }
}

function writeStorage(attempt: StoredAttempt): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(attempt));
}

function clearStorage(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function persistOfflineAttempt(attempt: {
  id: string;
  simulado_id: string;
  simulado_slug: string;
  started_at: string;
  exam_duration_seconds: number;
}): void {
  const deadline = new Date(
    new Date(attempt.started_at).getTime() + attempt.exam_duration_seconds * 1000,
  ).toISOString();

  writeStorage({
    id:                 attempt.id,
    simulado_id:        attempt.simulado_id,
    simulado_slug:      attempt.simulado_slug,
    started_at:         attempt.started_at,
    effective_deadline: deadline,
    status:             'offline_pending',
  });

  // Dispatch a synthetic storage event so same-tab listeners pick it up immediately
  window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY }));
}

// ─── Countdown helper ─────────────────────────────────────────────────────────

function calcRemaining(deadline?: string): number {
  if (!deadline) return 0;
  const diff = new Date(deadline).getTime() - Date.now();
  return Math.max(0, Math.floor(diff / 1000));
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useOfflineAttempt() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Reactive localStorage state — re-reads on storage events and short interval
  const [localAttempt, setLocalAttempt] = useState<StoredAttempt | null>(readStorage);

  useEffect(() => {
    // Listen for cross-tab storage events
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY || e.key === null) {
        setLocalAttempt(readStorage());
      }
    };
    window.addEventListener('storage', onStorage);

    // Poll every 2s for same-tab writes (storage event doesn't fire in same tab)
    const poll = setInterval(() => {
      setLocalAttempt(readStorage());
    }, 2000);

    return () => {
      window.removeEventListener('storage', onStorage);
      clearInterval(poll);
    };
  }, []);

  const { data: dbAttempt } = useQuery({
    queryKey: [QUERY_KEY, user?.id],
    queryFn: () => offlineApi.getActiveOfflineAttempt(user!.id),
    enabled: !!user,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  // Sync DB → localStorage
  useEffect(() => {
    if (dbAttempt) {
      const stored = readStorage();
      const merged: StoredAttempt = {
        id:                 dbAttempt.id,
        simulado_id:        dbAttempt.simulado_id,
        simulado_slug:      dbAttempt.simulado_slug || stored?.simulado_slug || '',
        started_at:         dbAttempt.started_at,
        effective_deadline: dbAttempt.effective_deadline,
        status:             dbAttempt.status,
      };
      writeStorage(merged);
      setLocalAttempt(merged);
    } else if (dbAttempt === null) {
      clearStorage();
      setLocalAttempt(null);
    }
  }, [dbAttempt]);

  // Active attempt: prefer DB, fall back to localStorage
  const activeAttempt: ActiveOfflineAttempt | null =
    dbAttempt ?? (localAttempt as ActiveOfflineAttempt | null);

  // Calculate remaining SYNCHRONOUSLY via useMemo to avoid race condition
  // where remaining=0 on first render before useEffect kicks in
  const currentRemaining = useMemo(
    () => (activeAttempt ? calcRemaining(activeAttempt.effective_deadline) : 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeAttempt?.effective_deadline],
  );

  // Countdown timer — ticks every second, initialized from currentRemaining
  const [remaining, setRemaining] = useState<number>(currentRemaining);

  // Keep remaining in sync when activeAttempt changes (synchronous update)
  useEffect(() => {
    setRemaining(currentRemaining);
  }, [currentRemaining]);

  useEffect(() => {
    if (!activeAttempt?.effective_deadline) {
      return;
    }
    const tick = () => setRemaining(calcRemaining(activeAttempt.effective_deadline));
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [activeAttempt?.effective_deadline]);

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: [QUERY_KEY, user?.id] });
  }, [queryClient, user?.id]);

  const clearAttempt = useCallback(() => {
    logger.log('[useOfflineAttempt] Clearing offline attempt from storage');
    clearStorage();
    setLocalAttempt(null);
    queryClient.setQueryData([QUERY_KEY, user?.id], null);
  }, [queryClient, user?.id]);

  // Guard: don't report expired if attempt was just created (< 30s ago)
  const isRecentlyCreated = activeAttempt
    ? (Date.now() - new Date(activeAttempt.started_at).getTime()) < 30_000
    : false;

  return {
    activeAttempt,
    remaining,
    isExpired: !!activeAttempt && remaining === 0 && !isRecentlyCreated,
    invalidate,
    clearAttempt,
  };
}
