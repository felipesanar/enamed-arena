/**
 * Ranking preview for admins — admin_get_ranking_for_simulado + listagem sem gate de liberação.
 */

import { useState, useEffect, useMemo, useCallback, useRef, type Dispatch, type SetStateAction } from 'react';
import { usePersistedState, clearPersistedState } from '@/hooks/usePersistedState';
import { useAuth } from '@/contexts/AuthContext';
import { useUser } from '@/contexts/UserContext';
import {
  fetchAdminRankingForSimulado,
  fetchAdminSimuladosForRankingPreview,
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

interface UseRankingAdminPreviewReturn {
  loading: boolean;
  simuladosWithResults: Array<{ id: string; title: string; sequence_number: number }>;
  selectedSimuladoId: string | null;
  setSelectedSimuladoId: (id: string) => void;
  includeTrain: boolean;
  setIncludeTrain: (v: boolean) => void;
  allParticipants: RankingParticipant[];
  filteredParticipants: RankingParticipant[];
  currentUser: RankingParticipant | undefined;
  stats: RankingStats;
  rankingComparison: RankingComparisonSelection;
  setRankingComparison: Dispatch<SetStateAction<RankingComparisonSelection>>;
  segmentFilter: SegmentFilter;
  setSegmentFilter: (f: SegmentFilter) => void;
  userSpecialty: string;
  userInstitutions: string[];
  refetch: () => void;
}

export function useRankingAdminPreview(): UseRankingAdminPreviewReturn {
  const { user } = useAuth();
  const { onboarding } = useUser();

  const [loading, setLoading] = useState(true);
  const [simuladosWithResults, setSimuladosWithResults] = useState<
    Array<{ id: string; title: string; sequence_number: number }>
  >([]);
  const [selectedSimuladoId, setSelectedSimuladoId] = usePersistedState<string | null>(
    'admin-ranking-preview:simuladoId',
    null,
  );
  const [includeTrain, setIncludeTrain] = usePersistedState<boolean>(
    'admin-ranking-preview:includeTrain',
    false,
  );
  const [rawRanking, setRawRanking] = useState<RankingRow[]>([]);
  const [rankingComparison, setRankingComparison] = usePersistedState<RankingComparisonSelection>(
    'admin-ranking-preview:comparisonFlags',
    RANKING_COMPARISON_DEFAULT,
  );
  const legacyAdminComparisonMigratedRef = useRef(false);

  useEffect(() => {
    if (legacyAdminComparisonMigratedRef.current) return;
    legacyAdminComparisonMigratedRef.current = true;
    try {
      const raw = sessionStorage.getItem('enamed_ui_admin-ranking-preview:comparison');
      if (raw === null) return;
      const parsed = JSON.parse(raw) as string;
      if (parsed === 'all' || parsed === 'same_specialty' || parsed === 'same_institution') {
        setRankingComparison(migrateLegacyRankingComparison(parsed));
        clearPersistedState('admin-ranking-preview:comparison');
      }
    } catch {
      legacyAdminComparisonMigratedRef.current = false;
    }
  }, [setRankingComparison]);
  const [segmentFilter, setSegmentFilter] = usePersistedState<SegmentFilter>(
    'admin-ranking-preview:segment',
    'all',
  );

  const userSpecialty = onboarding?.specialty || '';
  const userInstitutions = onboarding?.targetInstitutions || [];

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        const sims = await fetchAdminSimuladosForRankingPreview();
        if (cancelled) return;
        setSimuladosWithResults(sims);
        if (sims.length > 0) {
          setSelectedSimuladoId((prev) => {
            if (prev && sims.some((s) => s.id === prev)) return prev;
            return sims[0].id;
          });
        } else {
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [user, setSelectedSimuladoId]);

  useEffect(() => {
    if (!selectedSimuladoId) return;

    let cancelled = false;

    async function loadRanking() {
      setLoading(true);
      try {
        const data = await fetchAdminRankingForSimulado(selectedSimuladoId!, includeTrain);
        if (cancelled) return;
        setRawRanking(data);
      } catch {
        if (!cancelled) setRawRanking([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadRanking();
    return () => {
      cancelled = true;
    };
  }, [selectedSimuladoId, includeTrain]);

  const allParticipants = useMemo(
    () => transformRankingData(rawRanking, user?.id || null),
    [rawRanking, user?.id],
  );

  const stats = useMemo(() => computeRankingStats(rawRanking), [rawRanking]);

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
      fetchAdminRankingForSimulado(selectedSimuladoId, includeTrain)
        .then(setRawRanking)
        .finally(() => setLoading(false));
    }
  }, [selectedSimuladoId, includeTrain]);

  return {
    loading,
    simuladosWithResults,
    selectedSimuladoId,
    setSelectedSimuladoId,
    includeTrain,
    setIncludeTrain,
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
