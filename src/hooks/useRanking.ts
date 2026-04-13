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
import { usePersistedState, clearPersistedState } from '@/hooks/usePersistedState';
import { useAuth } from '@/contexts/AuthContext';
import { useUser } from '@/contexts/UserContext';
import { logger } from '@/lib/logger';
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
  
  // Simulado selection
  simuladosWithResults: Array<{ id: string; title: string; sequence_number: number }>;
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
  
  // Actions
  refetch: () => void;
}

export function useRanking(): UseRankingReturn {
  const { user } = useAuth();
  const { onboarding } = useUser();
  
  const [loading, setLoading] = useState(true);
  const [simuladosWithResults, setSimuladosWithResults] = useState<
    Array<{ id: string; title: string; sequence_number: number }>
  >([]);
  const [selectedSimuladoId, setSelectedSimuladoId] = usePersistedState<string | null>('ranking:simuladoId', null);
  const [rawRanking, setRawRanking] = useState<RankingRow[]>([]);
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
  const userInstitutions = onboarding?.targetInstitutions || [];

  // Fetch available simulados
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    
    let cancelled = false;
    
    async function load() {
      logger.log('[useRanking] Loading simulados with results');
      try {
        const sims = await fetchSimuladosWithResults();
        if (cancelled) return;
        
        setSimuladosWithResults(sims);
        if (sims.length > 0 && !selectedSimuladoId) {
          setSelectedSimuladoId(sims[0].id);
        } else if (sims.length === 0) {
          setLoading(false);
        }
      } catch (err) {
        console.error('[useRanking] Error loading simulados:', err);
        if (!cancelled) setLoading(false);
      }
    }
    
    load();
    return () => { cancelled = true; };
  }, [user]);

  // Fetch ranking when simulado changes
  useEffect(() => {
    if (!selectedSimuladoId) return;
    
    let cancelled = false;
    
    async function loadRanking() {
      setLoading(true);
      try {
        const data = await fetchRankingForSimulado(selectedSimuladoId!);
        if (cancelled) return;
        setRawRanking(data);
      } catch (err) {
        console.error('[useRanking] Error loading ranking:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    
    loadRanking();
    return () => { cancelled = true; };
  }, [selectedSimuladoId]);

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

  const refetch = useCallback(() => {
    if (selectedSimuladoId) {
      setRawRanking([]);
      setLoading(true);
      fetchRankingForSimulado(selectedSimuladoId)
        .then(setRawRanking)
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [selectedSimuladoId]);

  return {
    loading,
    simuladosWithResults,
    selectedSimuladoId,
    setSelectedSimuladoId,
    allParticipants,
    filteredParticipants,
    currentUser,
    stats,
    rankingComparison,
    setRankingComparison,
    segmentFilter,
    setSegmentFilter,
    userSpecialty,
    userInstitutions,
    refetch,
  };
}
