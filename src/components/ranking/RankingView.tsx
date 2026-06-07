/**
 * Conteúdo compartilhado entre Ranking (aluno) e preview admin.
 */

import React, {
  useState,
  useEffect,
  useRef,
  type Dispatch,
  type SetStateAction,
} from 'react';
import { EmptyState } from '@/components/EmptyState';
import { cn } from '@/lib/utils';
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
import { useCutoffScore } from '@/hooks/useCutoffScore';
import { CutoffScoreModal } from './CutoffScoreModal';
import { trackEvent } from '@/lib/analytics';
import { PositionBadge } from './PositionBadge';
import { RankingSkeleton } from './RankingSkeleton';
import { RankingSimuladoSelector } from './RankingSimuladoSelector';
import { RankingHeroStats } from './RankingHeroStats';
import { RankingLowConfidenceBanner } from './RankingLowConfidenceBanner';
import { RankingFilterBar } from './RankingFilterBar';
import { RankingTable } from './RankingTable';

// ─── Table row types ──────────────────────────────────────────────────────────

type SeparatorRow = { type: 'separator'; from: number; to: number };
type TableRow = RankingParticipant | SeparatorRow;

function isSeparator(row: TableRow): row is SeparatorRow {
  return 'type' in row && (row as SeparatorRow).type === 'separator';
}

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

const PILL_TRANSITION =
  'background 0.22s cubic-bezier(0.34,1.56,0.64,1), border-color 0.22s cubic-bezier(0.34,1.56,0.64,1), color 0.18s ease, box-shadow 0.2s ease';

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
  allowedSegments: SegmentFilter[];
  trackSource: RankingTrackSource;
  /** public: masks others as Candidato #n; admin: shows profile name when available */
  participantDisplay: 'public' | 'admin';
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
  allowedSegments,
  trackSource,
  participantDisplay,
  toolbar,
}: RankingViewProps) {
  const mountedAtRef = useRef<number>(Date.now());
  const shimmerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isDark, setIsDark] = useState(
    () => typeof document !== 'undefined' && document.documentElement.classList.contains('dark'),
  );
  useEffect(() => {
    const update = () => setIsDark(document.documentElement.classList.contains('dark'));
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);
  const visibleSegmentOptions = SEGMENT_OPTIONS.filter((o) => allowedSegments.includes(o.key));
  const [cutoffModalOpen, setCutoffModalOpen] = useState(false);
  const [shimmeringPillId, setShimmeringPillId] = useState<string | null>(null);

  // Must be called unconditionally (Rules of Hooks)
  const { loading: cutoffLoading, cutoff } = useCutoffScore(
    userSpecialty,
    userInstitutions[0] || '',
  );

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

  useEffect(() => {
    return () => {
      if (shimmerTimerRef.current) clearTimeout(shimmerTimerRef.current);
    };
  }, []);

  function participantLabel(item: RankingParticipant): string {
    if (participantDisplay === 'admin') return item.name || `Candidato #${item.position}`;
    return item.isCurrentUser ? item.name : `Candidato #${item.position}`;
  }

  // ── Derived values ────────────────────────────────────────────────────────

  const percentil = currentUser
    ? Math.min(99, Math.round((currentUser.position / Math.max(1, filteredParticipants.length)) * 100))
    : 0;

  const perfState: 'good' | 'bad' = percentil <= 50 ? 'good' : 'bad';

  const perfMessage =
    percentil <= 25
      ? 'Entre os melhores 🏆'
      : percentil <= 50
        ? 'Acima da média 💪'
        : 'Em desenvolvimento 💪';

  const perfSubtext =
    perfState === 'good'
      ? `Você está no ${percentil}º percentil — acima de ${100 - percentil}% dos candidatos.`
      : currentUser && currentUser.score < 40
        ? `Você está formando sua base — cada questão revisada é progresso real. Todo aprovado passou por aqui.`
        : currentUser && currentUser.score < 60
          ? `Você está em desenvolvimento — com simulados regulares a nota sobe consistentemente. Não desanime!`
          : `Você está abaixo de ${percentil}% dos candidatos nesse recorte — é aqui que começa a virada!`;

  const delta = currentUser ? currentUser.score - stats.notaMedia : 0;
  const deltaPrefix = delta >= 0 ? '▲' : '▼';
  const deltaColor = delta >= 0 ? 'rgba(74,222,128,0.7)' : 'rgba(248,113,113,0.7)';

  const hasProfile = Boolean(userSpecialty && userInstitutions[0]);
  const cutoffState: 'no_profile' | 'loading' | 'no_match' | 'pass' | 'fail' = !hasProfile
    ? 'no_profile'
    : cutoffLoading
      ? 'loading'
      : cutoff === null
        ? 'no_match'
        : currentUser && currentUser.score >= cutoff.cutoff_score_general
          ? 'pass'
          : 'fail';

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

  // ── Cutoff comfort messages (fail state, categorized by gap) ─────────────

  function cutoffComfortMessage(gap: number): { body: string } {
    if (gap <= 5) {
      return { body: 'Você está muito perto do corte. Mais uma rodada focada e você chega lá — o esforço já é visível!' };
    }
    if (gap <= 15) {
      return { body: 'Você está no caminho certo. Cada simulado te aproxima do corte — continue com consistência e não desanime.' };
    }
    return { body: 'Toda aprovação começa exatamente aqui. A distância de hoje é o combustível de amanhã — você está construindo sua base.' };
  }

  // ── Theme tokens ──────────────────────────────────────────────────────────

  const t = {
    containerBg: isDark ? '#100910' : '#ffffff',
    text1: isDark ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.85)',
    text2: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.5)',
    text3: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.35)',
    textMuted: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.3)',
    surfaceBg: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.025)',
    surfaceBorder: isDark ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(0,0,0,0.08)',
    borderColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)',
    chipActive: {
      background: 'rgba(122,26,50,0.85)',
      border: '1px solid rgba(255,150,170,0.25)',
      color: 'white',
    } as React.CSSProperties,
    chipInactive: isDark
      ? { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)', color: 'rgba(255,255,255,0.5)' } as React.CSSProperties
      : { background: 'rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.1)', color: 'rgba(0,0,0,0.55)' } as React.CSSProperties,
    kpiPerfGoodBg: isDark
      ? 'linear-gradient(135deg, rgba(34,197,94,0.14) 0%, rgba(16,185,129,0.06) 100%)'
      : 'linear-gradient(135deg, rgba(34,197,94,0.10) 0%, rgba(16,185,129,0.04) 100%)',
    kpiPerfGoodBorder: isDark ? '1px solid rgba(34,197,94,0.25)' : '1px solid rgba(34,197,94,0.28)',
    kpiPerfGoodShadow: isDark
      ? '0 8px 24px -6px rgba(34,197,94,0.1), inset 0 1px 0 rgba(255,255,255,0.05)'
      : '0 4px 16px -4px rgba(34,197,94,0.12)',
    kpiPerfGoodOrb: isDark
      ? 'radial-gradient(circle, rgba(74,222,128,0.12) 0%, transparent 70%)'
      : 'radial-gradient(circle, rgba(74,222,128,0.14) 0%, transparent 70%)',
    kpiPerfGoodTag: isDark ? 'rgba(74,222,128,0.7)' : 'rgba(22,163,74,0.85)',
    kpiPerfGoodVal: isDark ? '#4ade80' : '#15803d',
    kpiPerfBadBg: isDark
      ? 'linear-gradient(135deg, rgba(251,146,60,0.1) 0%, rgba(239,68,68,0.05) 100%)'
      : 'linear-gradient(135deg, rgba(251,146,60,0.08) 0%, rgba(239,68,68,0.04) 100%)',
    kpiPerfBadBorder: isDark ? '1px solid rgba(251,146,60,0.2)' : '1px solid rgba(251,146,60,0.25)',
    kpiPerfBadShadow: isDark
      ? '0 8px 24px -6px rgba(251,146,60,0.08), inset 0 1px 0 rgba(255,255,255,0.04)'
      : '0 4px 16px -4px rgba(251,146,60,0.1)',
    kpiPerfBadOrb: isDark
      ? 'radial-gradient(circle, rgba(251,146,60,0.1) 0%, transparent 70%)'
      : 'radial-gradient(circle, rgba(251,146,60,0.12) 0%, transparent 70%)',
    kpiPerfBadTag: isDark ? 'rgba(251,146,60,0.7)' : 'rgba(194,65,12,0.85)',
    kpiPerfBadVal: isDark ? '#fb923c' : '#c2410c',
    kpiPerfSubtext: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.5)',
    kpiCutPassBg: isDark
      ? 'linear-gradient(135deg, rgba(99,179,237,0.12) 0%, rgba(139,92,246,0.06) 100%)'
      : 'linear-gradient(135deg, rgba(56,189,248,0.10) 0%, rgba(139,92,246,0.04) 100%)',
    kpiCutPassBorder: isDark ? '1px solid rgba(99,179,237,0.22)' : '1px solid rgba(56,189,248,0.28)',
    kpiCutPassShadow: isDark
      ? '0 8px 24px -6px rgba(99,179,237,0.1), inset 0 1px 0 rgba(255,255,255,0.05)'
      : '0 4px 16px -4px rgba(56,189,248,0.12)',
    kpiCutPassOrb: isDark
      ? 'radial-gradient(circle, rgba(125,211,252,0.1) 0%, transparent 70%)'
      : 'radial-gradient(circle, rgba(56,189,248,0.12) 0%, transparent 70%)',
    kpiCutPassTag: isDark ? 'rgba(125,211,252,0.7)' : 'rgba(3,105,161,0.85)',
    kpiCutPassVal: isDark ? '#7dd3fc' : '#0369a1',
    kpiCutPassSub: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.5)',
    kpiCutPassStrong: isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.7)',
    kpiCutPassLink: isDark ? 'rgba(125,211,252,0.6)' : 'rgba(3,105,161,0.7)',
    kpiCutFailBg: isDark
      ? 'linear-gradient(135deg, rgba(239,68,68,0.10) 0%, rgba(220,38,38,0.05) 100%)'
      : 'linear-gradient(135deg, rgba(239,68,68,0.08) 0%, rgba(220,38,38,0.04) 100%)',
    kpiCutFailBorder: isDark ? '1px solid rgba(239,68,68,0.20)' : '1px solid rgba(239,68,68,0.25)',
    kpiCutFailShadow: isDark
      ? '0 8px 24px -6px rgba(239,68,68,0.08), inset 0 1px 0 rgba(255,255,255,0.04)'
      : '0 4px 16px -4px rgba(239,68,68,0.1)',
    kpiCutFailOrb: isDark
      ? 'radial-gradient(circle, rgba(248,113,113,0.1) 0%, transparent 70%)'
      : 'radial-gradient(circle, rgba(248,113,113,0.12) 0%, transparent 70%)',
    kpiCutFailTag: isDark ? 'rgba(248,113,113,0.7)' : 'rgba(185,28,28,0.85)',
    kpiCutFailVal: isDark ? '#f87171' : '#b91c1c',
    kpiCutFailGap: isDark ? '#f87171' : '#dc2626',
    kpiCutFailSub: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.5)',
    kpiCutFailStrong: isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.7)',
    kpiCutFailLink: isDark ? 'rgba(248,113,113,0.6)' : 'rgba(185,28,28,0.7)',
    kpiEmptyBg: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
    kpiEmptyBorder: isDark ? '1px solid rgba(255,255,255,0.09)' : '1px solid rgba(0,0,0,0.09)',
    kpiEmptyTag: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.35)',
    kpiEmptyText: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.45)',
    kpiEmptyCta: isDark ? 'rgba(255,150,170,0.65)' : 'rgba(122,26,50,0.7)',
    bannerText: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.65)',
    tableHeaderBorder: isDark ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(0,0,0,0.07)',
    tableHeaderText: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.3)',
    tableRowBorder: isDark ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(0,0,0,0.06)',
    tableUserBg: isDark ? 'rgba(122,26,50,0.28)' : 'rgba(122,26,50,0.07)',
    tableText: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)',
    tableUserText: isDark ? '#fff' : 'rgba(0,0,0,0.85)',
    tableUserScore: isDark ? '#ffcbd8' : '#7a1a32',
    tableScore: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)',
    tableSpecialty: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)',
    tableSeparator: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.25)',
    filterLabel: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.4)',
  };

  const triggerShimmer = (id: string) => {
    if (shimmerTimerRef.current) clearTimeout(shimmerTimerRef.current);
    setShimmeringPillId(id);
    shimmerTimerRef.current = setTimeout(
      () => setShimmeringPillId((cur) => (cur === id ? null : cur)),
      750,
    );
  };

  const getPillStyle = (isActive: boolean, isPro = false): React.CSSProperties => {
    if (isActive)
      return {
        background: 'linear-gradient(135deg, #8b1a35 0%, #5c1225 100%)',
        border: '1px solid rgba(255,150,170,0.2)',
        color: '#fff',
        boxShadow: '0 4px 14px rgba(122,26,50,0.35), inset 0 1px 0 rgba(255,255,255,0.12)',
        transition: PILL_TRANSITION,
        position: 'relative',
        overflow: 'hidden',
      };
    if (isPro)
      return {
        background: 'rgba(122,26,50,0.08)',
        border: '1px solid rgba(122,26,50,0.2)',
        color: '#7a1a32',
        transition: PILL_TRANSITION,
        position: 'relative',
        overflow: 'hidden',
      };
    return {
      ...t.chipInactive,
      transition: PILL_TRANSITION,
      position: 'relative',
      overflow: 'hidden',
    };
  };

  return (
    <>
      {toolbar && <div className="mb-4">{toolbar}</div>}

      <div
        className="rounded-2xl p-5"
        style={{ background: t.containerBg }}
      >
      {loading && <RankingSkeleton />}

      {!loading && (
        <>
          {/* ── Simulado selector chips ────────────────────────────────────── */}
          <RankingSimuladoSelector
            simuladosWithResults={simuladosWithResults}
            selectedSimuladoId={selectedSimuladoId}
            setSelectedSimuladoId={setSelectedSimuladoId}
            chipActive={t.chipActive}
            chipInactive={t.chipInactive}
          />

          {/* ── Top section: hero + KPI (desktop 2-col, mobile stacked) ────── */}
          {currentUser && (
            <RankingHeroStats
              currentUser={currentUser}
              filteredParticipants={filteredParticipants}
              stats={stats}
              delta={delta}
              deltaPrefix={deltaPrefix}
              deltaColor={deltaColor}
              perfState={perfState}
              perfMessage={perfMessage}
              perfSubtext={perfSubtext}
              cutoffState={cutoffState}
              cutoff={cutoff}
              isDark={isDark}
              t={t}
              setCutoffModalOpen={setCutoffModalOpen}
              cutoffComfortMessage={cutoffComfortMessage}
            />
          )}

          {/* ── Low confidence banner ─────────────────────────────────────── */}
          {lowConfidence && (
            <RankingLowConfidenceBanner
              bannerText={t.bannerText}
              text1={t.text1}
              setCutoffModalOpen={setCutoffModalOpen}
            />
          )}

          {/* ── Empty state ───────────────────────────────────────────────── */}
          {filteredParticipants.length === 0 && !currentUser && !hasActiveFilters && (
            <EmptyState
              icon={Users}
              title="Sem participantes"
              description="Ainda não há participantes suficientes para exibir o ranking deste simulado."
            />
          )}

          {(filteredParticipants.length > 0 || hasActiveFilters) && (
            <>
              {/* ── Filter bar ────────────────────────────────────────────── */}
              <RankingFilterBar
                rankingComparison={rankingComparison}
                segmentFilter={segmentFilter}
                userSpecialty={userSpecialty}
                userInstitutions={userInstitutions}
                visibleSegmentOptions={visibleSegmentOptions}
                shimmeringPillId={shimmeringPillId}
                surfaceBg={t.surfaceBg}
                surfaceBorder={t.surfaceBorder}
                borderColor={t.borderColor}
                filterLabel={t.filterLabel}
                text2={t.text2}
                getPillStyle={getPillStyle}
                triggerShimmer={triggerShimmer}
                handleSelectAllComparison={handleSelectAllComparison}
                handleToggleSpecialtyComparison={handleToggleSpecialtyComparison}
                handleToggleInstitutionComparison={handleToggleInstitutionComparison}
                handleSegmentFilterChange={handleSegmentFilterChange}
              />

              {/* ── Table ─────────────────────────────────────────────────── */}
              <RankingTable
                tableRows={tableRows}
                filteredParticipants={filteredParticipants}
                currentUser={currentUser}
                isDark={isDark}
                t={t}
                participantLabel={participantLabel}
                handleClearAllFilters={handleClearAllFilters}
              />
            </>
          )}
        </>
      )}

      {/* ── CutoffScoreModal ───────────────────────────────────────────────── */}
      <CutoffScoreModal
        open={cutoffModalOpen}
        onClose={() => setCutoffModalOpen(false)}
        userSpecialty={userSpecialty}
        userInstitution={userInstitutions[0]}
        currentUserScore={currentUser?.score}
      />
      </div>
    </>
  );
}

/** Re-export para uso em páginas que só precisam do skeleton */
export { RankingSkeleton };
