/**
 * useRanking hook — real Supabase ranking data.
 * Architecture mirrored from Ranking ENAMED's useRanking.ts.
 * Uses get_ranking_for_simulado() security definer function.
 */

import {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  type Dispatch,
  type SetStateAction,
} from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAppConfig } from '@/hooks/useAppConfig';
import { useUserEdition } from '@/hooks/useUserEdition';
import type { RankingQueryOptions, RankingSimuladoOption } from '@/types/ranking';
import { usePersistedState, clearPersistedState } from '@/hooks/usePersistedState';
import { useAuth } from '@/contexts/AuthContext';
import { useUser } from '@/contexts/UserContext';
import {
  fetchRankingForSimulado,
  fetchSimuladosWithResults,
  transformRankingData,
  computeRankingStats,
  applyRankingFilters,
  migrateLegacyRankingComparison,
  RANKING_COMPARISON_DEFAULT,
  type RankingRow,
  type RankingParticipant,
  type RankingStats,
  type RankingComparisonSelection,
  type SegmentFilter,
} from '@/services/rankingApi';

interface UseRankingReturn {
  // Loading states
  loading: boolean;
  /** Human-readable error message (null = no error). Consumers should surface it. */
  error: string | null;

  // Simulado selection
  simuladosWithResults: RankingSimuladoOption[];
  selectedSimuladoId: string | null;
  setSelectedSimuladoId: (id: string) => void;

  // Ranking data
  allParticipants: RankingParticipant[];
  filteredParticipants: RankingParticipant[];
  currentUser: RankingParticipant | undefined;
  stats: RankingStats;

  // Filters
  rankingComparison: RankingComparisonSelection;
  setRankingComparison: Dispatch<SetStateAction<RankingComparisonSelection>>;
  segmentFilter: SegmentFilter;
  setSegmentFilter: (f: SegmentFilter) => void;

  // User context
  userSpecialty: string;
  userInstitutions: string[];
  userSpecialtyId: string | null;
  userInstitutionIds: string[];

  // Actions
  refetch: () => void;
}

export function useRanking(options: RankingQueryOptions = {}): UseRankingReturn {
  const { user, loading: authLoading } = useAuth();
  const { onboarding } = useUser();
  const editionsUi = useAppConfig('editions_ui');
  const { userEdition } = useUserEdition(editionsUi);
  const editionId = options.editionId !== undefined ? options.editionId : userEdition?.id;
  const userId = user?.id;
  const enabled = !!userId && !authLoading && (!editionsUi || !!editionId);
  const scope = editionsUi ? editionId ?? null : 'legacy';
  const storageKey = `enamed_ui_ranking:simuladoId:${userId}:${scope}`;
  const [explicitChoice, setExplicitChoice] = useState<{ key: string; id: string } | null>(null);
  const list = useQuery({
    queryKey: ['ranking-simulados', userId, scope], enabled, staleTime: 5 * 60 * 1000,
    queryFn: () => editionsUi ? fetchSimuladosWithResults(true) : fetchSimuladosWithResults(),
  });
  const simuladosWithResults = useMemo(() => enabled ? list.data ?? [] : [], [enabled, list.data]);
  let saved: unknown = null;
  if (options.selection !== 'latest-in-edition' && enabled) {
    try { saved = JSON.parse(sessionStorage.getItem(storageKey) ?? 'null'); } catch { /* Invalid storage is not a selection. */ }
    if (explicitChoice?.key === storageKey) saved = explicitChoice.id;
  }
  const preferred = simuladosWithResults.find(sim => sim.id === saved);
  const candidates = editionsUi ? simuladosWithResults.filter(sim => sim.editionId === editionId)
    .sort((a, b) => (Date.parse(b.resultsReleaseAt ?? '') || 0) - (Date.parse(a.resultsReleaseAt ?? '') || 0)
      || b.sequence_number - a.sequence_number || a.id.localeCompare(b.id)) : simuladosWithResults;
  const selectedSimuladoId = preferred?.id ?? candidates[0]?.id ?? null;
  const setSelectedSimuladoId = useCallback((id: string) => {
    if (!enabled || options.selection === 'latest-in-edition' || !simuladosWithResults.some(sim => sim.id === id)) return;
    setExplicitChoice({ key: storageKey, id });
    try { sessionStorage.setItem(storageKey, JSON.stringify(id)); } catch { /* Storage is optional. */ }
  }, [enabled, options.selection, simuladosWithResults, storageKey]);
  const ranking = useQuery({
    queryKey: ['ranking', userId, scope, selectedSimuladoId],
    enabled: enabled && !!selectedSimuladoId, staleTime: 5 * 60 * 1000,
    queryFn: () => fetchRankingForSimulado(selectedSimuladoId!),
  });
  const rawRanking: RankingRow[] = useMemo(() => enabled && selectedSimuladoId ? ranking.data ?? [] : [],
    [enabled, selectedSimuladoId, ranking.data]);
  const loading = enabled && (list.isLoading || (!!selectedSimuladoId && ranking.isLoading));
  const queryError = enabled ? list.error ?? ranking.error : null;
  const error = queryError ? queryError instanceof Error ? queryError.message : 'Não foi possível carregar o ranking.' : null;
  const [rankingComparison, setRankingComparison] = usePersistedState<RankingComparisonSelection>(
    'ranking:comparisonFlags',
    RANKING_COMPARISON_DEFAULT,
  );
  const legacyRankingMigratedRef = useRef(false);

  useEffect(() => {
    if (legacyRankingMigratedRef.current) return;
    legacyRankingMigratedRef.current = true;
    try {
      const raw = sessionStorage.getItem('enamed_ui_ranking:comparison');
      if (raw === null) return;
      const parsed = JSON.parse(raw) as string;
      if (parsed === 'all' || parsed === 'same_specialty' || parsed === 'same_institution') {
        setRankingComparison(migrateLegacyRankingComparison(parsed));
        clearPersistedState('ranking:comparison');
      }
    } catch {
      legacyRankingMigratedRef.current = false;
    }
  }, [setRankingComparison]);
  const [segmentFilter, setSegmentFilter] = usePersistedState<SegmentFilter>('ranking:segment', 'all');
  
  const userSpecialty = onboarding?.specialty || '';
  // Memoize so downstream useMemo deps don't see a fresh `[]` every render.
  const userInstitutions = useMemo(
    () => onboarding?.targetInstitutions || [],
    [onboarding?.targetInstitutions],
  );
  const userSpecialtyId = onboarding?.specialtyId ?? null;
  const userInstitutionIds = useMemo(
    () => onboarding?.targetInstitutionIds || [],
    [onboarding?.targetInstitutionIds],
  );

  // Transform raw data
  const allParticipants = useMemo(
    () => transformRankingData(rawRanking, user?.id || null),
    [rawRanking, user?.id],
  );

  // Stats
  const stats = useMemo(
    () => computeRankingStats(rawRanking),
    [rawRanking],
  );

  // Apply filters
  const filteredParticipants = useMemo(
    () =>
      applyRankingFilters(
        allParticipants,
        rankingComparison,
        segmentFilter,
        userSpecialty,
        userInstitutions,
      ),
    [allParticipants, rankingComparison, segmentFilter, userSpecialty, userInstitutions],
  );

  const currentUser = useMemo(
    () => filteredParticipants.find((p) => p.isCurrentUser),
    [filteredParticipants],
  );

  const { refetch: refetchList } = list;
  const { refetch: refetchRanking } = ranking;
  const refetch = useCallback(() => {
    if (!enabled) return;
    void refetchList();
    if (selectedSimuladoId) void refetchRanking();
  }, [enabled, selectedSimuladoId, refetchList, refetchRanking]);

  return {
    loading,
    error,
    simuladosWithResults,
    selectedSimuladoId,
    setSelectedSimuladoId,
    allParticipants,
    filteredParticipants,
    currentUser,
    stats: options.selection === 'latest-in-edition' ? { ...stats, totalCandidatos: filteredParticipants.length } : stats,
    rankingComparison,
    setRankingComparison,
    segmentFilter,
    setSegmentFilter,
    userSpecialty,
    userInstitutions,
    userSpecialtyId,
    userInstitutionIds,
    refetch,
  };
}
