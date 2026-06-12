/**
 * Conteúdo compartilhado entre Ranking (aluno) e preview admin.
 * Direção B: "aprovação em foco" — painel de aprovação + stats row, tokens semânticos.
 */

import React, {
  useState,
  useEffect,
  useRef,
  type Dispatch,
  type SetStateAction,
} from 'react';
import { EmptyState } from '@/components/EmptyState';
import {
  Users,
  Globe,
  Crown,
} from 'lucide-react';
import {
  type SegmentFilter,
  type RankingParticipant,
  type RankingStats,
  type RankingComparisonSelection,
  rankingComparisonAnalyticsLabel,
  RANKING_COMPARISON_DEFAULT,
} from '@/services/rankingApi';
import { useCutoffScores } from '@/hooks/useCutoffScores';
import { deriveApprovalEntries } from '@/lib/ranking-approval';
import { CutoffScoreModal } from './CutoffScoreModal';
import { trackEvent } from '@/lib/analytics';
import { RankingSkeleton } from './RankingSkeleton';
import { RankingSimuladoSelector } from './RankingSimuladoSelector';
import { RankingApprovalPanel, type ApprovalPanelState } from './RankingApprovalPanel';
import { RankingStatsRow } from './RankingStatsRow';
import { RankingLowConfidenceBanner } from './RankingLowConfidenceBanner';
import { RankingFilterBar } from './RankingFilterBar';
import { RankingTable } from './RankingTable';

// ─── Table row types ──────────────────────────────────────────────────────────

type SeparatorRow = { type: 'separator'; from: number; to: number };
type TableRow = RankingParticipant | SeparatorRow;

// ─── buildTableRows ───────────────────────────────────────────────────────────

/**
 * Builds the display rows for the ranking table.
 *
 * - No currentUser → returns all participants.
 * - currentUser in top 10 → returns all participants (row highlighted inline).
 * - currentUser outside top 10 → top 10 + optional separator + vicinity (±2).
 *   Separator shown only when there are more than 3 positions between end of
 *   top 10 (position 10) and start of vicinity (position currentUser.position - 2).
 *   Separator text: "posições 11 – {vicinityStart - 1}".
 */
export function buildTableRows(
  filteredParticipants: RankingParticipant[],
  currentUser: RankingParticipant | undefined,
): TableRow[] {
  if (!currentUser || currentUser.position <= 10) {
    return filteredParticipants;
  }

  const userPos = currentUser.position;
  const top10 = filteredParticipants.filter((p) => p.position <= 10);
  const vicinityStart = Math.max(11, userPos - 2);
  const vicinity = filteredParticipants.filter(
    (p) => p.position >= vicinityStart && p.position <= userPos + 2,
  );

  const result: TableRow[] = [...top10];

  // Show separator only when there are more than 3 skipped positions
  // gap = vicinityStart - 11 (positions between top10 end and vicinity start)
  if (vicinityStart - 11 > 3) {
    result.push({ type: 'separator', from: 11, to: vicinityStart - 1 });
  }

  result.push(...vicinity);
  return result;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SEGMENT_OPTIONS: Array<{ key: SegmentFilter; label: string; icon: React.ElementType }> = [
  { key: 'all', label: 'Todos', icon: Globe },
  { key: 'sanarflix', label: 'SanarFlix', icon: Users },
  { key: 'pro', label: 'PRO', icon: Crown },
];

// ─── RankingViewProps ─────────────────────────────────────────────────────────

export type RankingTrackSource = 'page' | 'admin_preview';

export interface RankingViewProps {
  loading: boolean;
  simuladosWithResults: Array<{ id: string; title: string; sequence_number: number }>;
  selectedSimuladoId: string | null;
  setSelectedSimuladoId: (id: string) => void;
  filteredParticipants: RankingParticipant[];
  currentUser: RankingParticipant | undefined;
  stats: RankingStats;
  rankingComparison: RankingComparisonSelection;
  setRankingComparison: Dispatch<SetStateAction<RankingComparisonSelection>>;
  segmentFilter: SegmentFilter;
  setSegmentFilter: (f: SegmentFilter) => void;
  userSpecialty: string;
  userInstitutions: string[];
  userSpecialtyId: string | null;
  userInstitutionIds: string[];
  allowedSegments: SegmentFilter[];
  trackSource: RankingTrackSource;
  /** public: masks others as Candidato #n; admin: shows profile name when available */
  participantDisplay: 'public' | 'admin';
  /** Oculta o painel "Você passaria?" (ex.: preview admin). Default: true */
  showApprovalPanel?: boolean;
  toolbar?: React.ReactNode;
}

// ─── RankingView ──────────────────────────────────────────────────────────────

export function RankingView({
  loading,
  simuladosWithResults,
  selectedSimuladoId,
  setSelectedSimuladoId,
  filteredParticipants,
  currentUser,
  stats,
  rankingComparison,
  setRankingComparison,
  segmentFilter,
  setSegmentFilter,
  userSpecialty,
  userInstitutions,
  userSpecialtyId,
  userInstitutionIds,
  allowedSegments,
  trackSource,
  participantDisplay,
  showApprovalPanel = true,
  toolbar,
}: RankingViewProps) {
  const mountedAtRef = useRef<number>(Date.now());
  const visibleSegmentOptions = SEGMENT_OPTIONS.filter((o) => allowedSegments.includes(o.key));
  const [cutoffModalOpen, setCutoffModalOpen] = useState(false);

  // Must be called unconditionally (Rules of Hooks)
  const { loading: cutoffLoading, cutoffs } = useCutoffScores(userSpecialtyId, userInstitutionIds);

  // ── Approval panel derivations ────────────────────────────────────────────

  const userInstitutionSelections = userInstitutionIds.map((id, i) => ({
    id,
    name: userInstitutions[i] ?? '',
  }));

  const approvalEntries = deriveApprovalEntries(
    userInstitutionSelections,
    cutoffs,
    currentUser ? currentUser.score : null,
  );

  const approvalState: ApprovalPanelState =
    !userSpecialtyId || userInstitutionIds.length === 0
      ? 'no_profile'
      : cutoffLoading
        ? 'loading'
        : 'ready';

  // ── Filter handlers ───────────────────────────────────────────────────────

  const applyComparisonUpdate = (next: RankingComparisonSelection) => {
    const oldLabel = rankingComparisonAnalyticsLabel(rankingComparison);
    const newLabel = rankingComparisonAnalyticsLabel(next);
    if (oldLabel !== newLabel) {
      trackEvent('ranking_filter_changed', {
        simulado_id: selectedSimuladoId ?? '',
        filter_type: 'comparison',
        old_value: oldLabel,
        new_value: newLabel,
        source: trackSource,
      });
    }
    setRankingComparison(next);
  };

  const handleSelectAllComparison = () => applyComparisonUpdate(RANKING_COMPARISON_DEFAULT);

  const handleToggleSpecialtyComparison = () => {
    if (!userSpecialty) return;
    const next = { ...rankingComparison, bySpecialty: !rankingComparison.bySpecialty };
    // When turning specialty off, also clear institution (institution pill becomes hidden)
    if (!next.bySpecialty) next.byInstitution = false;
    applyComparisonUpdate(next);
  };

  const handleToggleInstitutionComparison = () => {
    if (userInstitutions.length === 0) return;
    applyComparisonUpdate({ ...rankingComparison, byInstitution: !rankingComparison.byInstitution });
  };

  const handleSegmentFilterChange = (newValue: SegmentFilter) => {
    trackEvent('ranking_filter_changed', {
      simulado_id: selectedSimuladoId ?? '',
      filter_type: 'segment',
      old_value: segmentFilter,
      new_value: newValue,
      source: trackSource,
    });
    setSegmentFilter(newValue);
  };

  useEffect(() => {
    if (!allowedSegments.includes(segmentFilter)) setSegmentFilter('all');
  }, [allowedSegments, segmentFilter, setSegmentFilter]);

  useEffect(() => {
    trackEvent('ranking_viewed', {
      selected_simulado_id: selectedSimuladoId,
      comparison_filter: rankingComparisonAnalyticsLabel(rankingComparison),
      segment_filter: segmentFilter,
      source: trackSource,
    });
  }, [selectedSimuladoId, rankingComparison, segmentFilter, trackSource]);

  useEffect(() => {
    // Capture into a local so the cleanup function reads the timestamp from
    // when the effect ran, not whatever the ref points to at unmount time
    // (the React lint rule's concern). For this analytics event they're
    // effectively the same — but the local makes that invariant explicit.
    const startedAt = mountedAtRef.current;
    return () => {
      const seconds = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
      trackEvent('ranking_engagement_time', { seconds, source: trackSource });
    };
  }, [trackSource]);

  function participantLabel(item: RankingParticipant): string {
    if (participantDisplay === 'admin') return item.name || `Candidato #${item.position}`;
    return item.isCurrentUser ? item.name : `Candidato #${item.position}`;
  }

  // ── Derived values ────────────────────────────────────────────────────────

  const lowConfidence = filteredParticipants.length > 0 && filteredParticipants.length < 30;
  const tableRows = buildTableRows(filteredParticipants, currentUser);

  const hasActiveFilters =
    rankingComparison.bySpecialty ||
    rankingComparison.byInstitution ||
    segmentFilter !== 'all';

  const handleClearAllFilters = () => {
    if (rankingComparison.bySpecialty || rankingComparison.byInstitution) {
      applyComparisonUpdate(RANKING_COMPARISON_DEFAULT);
    }
    if (segmentFilter !== 'all') {
      handleSegmentFilterChange('all');
    }
  };

  return (
    <>
      {toolbar && <div className="mb-4">{toolbar}</div>}

      <div className="rounded-2xl bg-background p-5">
        {loading && <RankingSkeleton />}

        {!loading && (
          <>
            {/* ── Simulado selector chips ──────────────────────────────────── */}
            <RankingSimuladoSelector
              simuladosWithResults={simuladosWithResults}
              selectedSimuladoId={selectedSimuladoId}
              setSelectedSimuladoId={setSelectedSimuladoId}
            />

            {/* ── Approval panel ("Você passaria?") ────────────────────────── */}
            {showApprovalPanel && (
              <RankingApprovalPanel
                state={approvalState}
                entries={approvalEntries}
                userScore={currentUser ? currentUser.score : null}
                onOpenCutoffTable={() => setCutoffModalOpen(true)}
              />
            )}

            {/* ── Stats row (posição / percentil / vs. média) ──────────────── */}
            {currentUser && (
              <RankingStatsRow
                currentUser={currentUser}
                totalParticipants={filteredParticipants.length}
                stats={stats}
              />
            )}

            {/* ── Low confidence banner ────────────────────────────────────── */}
            {lowConfidence && (
              <RankingLowConfidenceBanner setCutoffModalOpen={setCutoffModalOpen} />
            )}

            {/* ── Empty state ──────────────────────────────────────────────── */}
            {filteredParticipants.length === 0 && !currentUser && !hasActiveFilters && (
              <EmptyState
                icon={Users}
                title="Sem participantes"
                description="Ainda não há participantes suficientes para exibir o ranking deste simulado."
              />
            )}

            {(filteredParticipants.length > 0 || hasActiveFilters) && (
              <>
                {/* ── Filter bar ──────────────────────────────────────────── */}
                <RankingFilterBar
                  rankingComparison={rankingComparison}
                  segmentFilter={segmentFilter}
                  userSpecialty={userSpecialty}
                  userInstitutions={userInstitutions}
                  visibleSegmentOptions={visibleSegmentOptions}
                  onSelectAllComparison={handleSelectAllComparison}
                  onToggleSpecialtyComparison={handleToggleSpecialtyComparison}
                  onToggleInstitutionComparison={handleToggleInstitutionComparison}
                  onSegmentFilterChange={handleSegmentFilterChange}
                />

                {/* ── Table ───────────────────────────────────────────────── */}
                <RankingTable
                  tableRows={tableRows}
                  filteredParticipants={filteredParticipants}
                  currentUser={currentUser}
                  participantLabel={participantLabel}
                  handleClearAllFilters={handleClearAllFilters}
                />
              </>
            )}
          </>
        )}

        {/* ── CutoffScoreModal ─────────────────────────────────────────────── */}
        <CutoffScoreModal
          open={cutoffModalOpen}
          onClose={() => setCutoffModalOpen(false)}
          userSpecialty={userSpecialty}
          userInstitutions={userInstitutions}
          currentUserScore={currentUser?.score}
        />
      </div>
    </>
  );
}
