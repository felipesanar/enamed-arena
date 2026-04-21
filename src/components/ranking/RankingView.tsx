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
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { EmptyState } from '@/components/EmptyState';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  Trophy,
  Users,
  Stethoscope,
  Building,
  Globe,
  Crown,
  AlertTriangle,
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

// ─── PositionBadge ────────────────────────────────────────────────────────────

function PositionBadge({
  position,
  isCurrentUser,
  isDark,
}: {
  position: number;
  isCurrentUser?: boolean;
  isDark: boolean;
}) {
  if (isCurrentUser) {
    return (
      <div
        className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
        style={{ background: 'rgba(255,150,170,0.15)', color: '#ff9ab0' }}
        aria-label={`${position}ª posição (você)`}
      >
        {position}
      </div>
    );
  }
  const medals: Record<number, { bg: string; color: string; label: string }> = {
    1: { bg: 'rgba(251,191,36,0.15)', color: '#fbbf24', label: '1º lugar' },
    2: { bg: 'rgba(156,163,175,0.15)', color: '#9ca3af', label: '2º lugar' },
    3: { bg: 'rgba(180,83,9,0.15)', color: '#d97706', label: '3º lugar' },
  };
  const medal = medals[position];
  return (
    <div
      className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
      style={
        medal
          ? { background: medal.bg, color: medal.color }
          : isDark
          ? { background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.45)' }
          : { background: 'rgba(0,0,0,0.07)', color: 'rgba(0,0,0,0.45)' }
      }
      aria-label={medal?.label}
    >
      {position}
    </div>
  );
}

// ─── RankingSkeleton ──────────────────────────────────────────────────────────

function RankingSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-32 w-full rounded-[22px]" />
      <div className="grid grid-cols-2 gap-2.5">
        <Skeleton className="h-28 rounded-[18px]" />
        <Skeleton className="h-28 rounded-[18px]" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}

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
    return () => {
      const seconds = Math.max(1, Math.round((Date.now() - mountedAtRef.current) / 1000));
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
          {simuladosWithResults.length > 1 && (
            <div className="flex gap-2 mb-5 overflow-x-auto pb-2">
              {simuladosWithResults.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSelectedSimuladoId(s.id)}
                  className="px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap shrink-0"
                  style={s.id === selectedSimuladoId ? t.chipActive : t.chipInactive}
                >
                  {s.title}
                </button>
              ))}
            </div>
          )}

          {/* ── Top section: hero + KPI (desktop 2-col, mobile stacked) ────── */}
          {currentUser && (
            <div className="md:grid md:grid-cols-2 md:gap-5 mb-5">
              {/* Hero card */}
              <div
                className="rounded-[22px] p-5 mb-4 md:mb-0 relative overflow-hidden"
                style={{
                  background:
                    'linear-gradient(155deg, #7a1a32 0%, #5c1225 45%, #3d0b18 100%)',
                  boxShadow:
                    '0 24px 56px -14px rgba(142,31,61,0.65), inset 0 1px 0 rgba(255,255,255,0.08)',
                }}
              >
                <div
                  className="absolute pointer-events-none"
                  style={{
                    top: '-50px',
                    right: '-50px',
                    width: '200px',
                    height: '200px',
                    background:
                      'radial-gradient(circle, rgba(255,255,255,0.06) 0%, transparent 70%)',
                  }}
                  aria-hidden
                />
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="h-[46px] w-[46px] rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: 'rgba(255,255,255,0.12)' }}
                    >
                      <Trophy className="h-5 w-5 text-white" aria-hidden />
                    </div>
                    <div>
                      <p
                        className="text-xs font-semibold uppercase tracking-widest mb-0.5"
                        style={{ color: 'rgba(255,255,255,0.45)' }}
                      >
                        Sua posição
                      </p>
                      <p
                        className="font-bold text-white md:text-5xl text-3xl tabular-nums leading-none"
                        aria-label={`Posição ${currentUser.position} de ${filteredParticipants.length}`}
                      >
                        #{currentUser.position}
                        <span
                          className="text-base font-semibold ml-1"
                          style={{ color: 'rgba(255,255,255,0.45)' }}
                        >
                          de {filteredParticipants.length}
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p
                      className="text-xs font-semibold uppercase tracking-widest mb-0.5"
                      style={{ color: 'rgba(255,255,255,0.45)' }}
                    >
                      Sua nota
                    </p>
                    <p
                      className="font-bold tabular-nums md:text-4xl text-2xl leading-none"
                      style={{ color: '#ffcbd8' }}
                      aria-label={`Nota ${currentUser.score}%`}
                    >
                      {currentUser.score}%
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>
                      Média: {stats.notaMedia}%
                    </p>
                    <p
                      className="text-xs font-semibold mt-0.5"
                      style={{ color: deltaColor }}
                    >
                      {deltaPrefix} {Math.abs(delta)}% {delta >= 0 ? 'acima da média' : 'abaixo da média'}
                    </p>
                  </div>
                </div>
              </div>

              {/* KPI cards */}
              <div className="grid grid-cols-2 gap-2.5">
                {/* Card 1: Desempenho */}
                <div
                  className="rounded-[18px] relative overflow-hidden flex flex-col justify-between"
                  style={{
                    padding: '15px 13px 13px',
                    minHeight: '110px',
                    background: perfState === 'good' ? t.kpiPerfGoodBg : t.kpiPerfBadBg,
                    border: perfState === 'good' ? t.kpiPerfGoodBorder : t.kpiPerfBadBorder,
                    boxShadow: perfState === 'good' ? t.kpiPerfGoodShadow : t.kpiPerfBadShadow,
                  }}
                >
                  <div
                    className="absolute pointer-events-none"
                    style={{
                      top: '-30px',
                      right: '-30px',
                      width: '100px',
                      height: '100px',
                      borderRadius: '50%',
                      background: perfState === 'good' ? t.kpiPerfGoodOrb : t.kpiPerfBadOrb,
                    }}
                    aria-hidden
                  />
                  <div className="relative z-10">
                    <p
                      className="font-bold uppercase mb-[7px]"
                      style={{
                        fontSize: '0.56rem',
                        letterSpacing: '.09em',
                        color: perfState === 'good' ? t.kpiPerfGoodTag : t.kpiPerfBadTag,
                      }}
                    >
                      Seu desempenho
                    </p>
                    <p
                      className="font-bold leading-snug mb-[5px]"
                      style={{
                        fontSize: '0.95rem',
                        color: perfState === 'good' ? t.kpiPerfGoodVal : t.kpiPerfBadVal,
                      }}
                    >
                      {perfMessage}
                    </p>
                    <p
                      className="leading-snug"
                      style={{ fontSize: '0.62rem', color: t.kpiPerfSubtext }}
                    >
                      {perfSubtext}
                    </p>
                  </div>
                </div>

                {/* Card 2: Nota de Corte */}
                {(cutoffState === 'no_profile' || cutoffState === 'no_match') && (
                  <div
                    className="rounded-[18px] relative overflow-hidden flex flex-col"
                    style={{
                      padding: '15px 13px 13px',
                      minHeight: '110px',
                      background: t.kpiEmptyBg,
                      border: t.kpiEmptyBorder,
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
                    }}
                  >
                    <p
                      className="font-bold uppercase mb-[7px] relative z-10"
                      style={{
                        fontSize: '0.56rem',
                        letterSpacing: '.09em',
                        color: t.kpiEmptyTag,
                      }}
                    >
                      Nota de corte
                    </p>
                    <div className="relative z-10 flex flex-col gap-[5px] flex-1 justify-center">
                      <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>🎯</span>
                      {cutoffState === 'no_profile' ? (
                        <>
                          <p
                            className="leading-snug"
                            style={{ fontSize: '0.62rem', color: t.kpiEmptyText }}
                          >
                            Preencha sua especialidade e instituição para ver se você passaria.
                          </p>
                          <Link
                            to="/configuracoes"
                            className="font-semibold inline-flex items-center gap-[3px]"
                            style={{ fontSize: '0.6rem', color: t.kpiEmptyCta }}
                          >
                            Completar perfil →
                          </Link>
                        </>
                      ) : (
                        <>
                          <p
                            className="leading-snug"
                            style={{ fontSize: '0.62rem', color: t.kpiEmptyText }}
                          >
                            Não encontramos nota de corte para sua combinação.
                          </p>
                          <button
                            type="button"
                            onClick={() => setCutoffModalOpen(true)}
                            className="font-semibold inline-flex items-center gap-[3px] text-left"
                            style={{ fontSize: '0.6rem', color: t.kpiEmptyCta }}
                          >
                            Ver todas →
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {cutoffState === 'loading' && (
                  <div
                    className="rounded-[18px] flex items-center justify-center"
                    style={{
                      padding: '15px 13px 13px',
                      minHeight: '110px',
                      background: t.kpiEmptyBg,
                      border: t.kpiEmptyBorder,
                    }}
                  >
                    <p style={{ fontSize: '0.62rem', color: t.kpiEmptyText }}>
                      Carregando...
                    </p>
                  </div>
                )}

                {cutoffState === 'pass' && cutoff && (
                  <div
                    className="rounded-[18px] relative overflow-hidden flex flex-col justify-between"
                    style={{
                      padding: '15px 13px 13px',
                      minHeight: '110px',
                      background: t.kpiCutPassBg,
                      border: t.kpiCutPassBorder,
                      boxShadow: t.kpiCutPassShadow,
                    }}
                  >
                    <div
                      className="absolute pointer-events-none"
                      style={{
                        top: '-30px',
                        right: '-30px',
                        width: '100px',
                        height: '100px',
                        borderRadius: '50%',
                        background: t.kpiCutPassOrb,
                      }}
                      aria-hidden
                    />
                    <div className="relative z-10">
                      <p
                        className="font-bold uppercase mb-[7px]"
                        style={{
                          fontSize: '0.56rem',
                          letterSpacing: '.09em',
                          color: t.kpiCutPassTag,
                        }}
                      >
                        Nota de corte
                      </p>
                      <p
                        className="font-bold leading-snug mb-[5px]"
                        style={{ fontSize: '0.95rem', color: t.kpiCutPassVal }}
                      >
                        Passaria ✓
                      </p>
                      <p
                        className="leading-snug"
                        style={{ fontSize: '0.62rem', color: t.kpiCutPassSub }}
                      >
                        Corte geral:{' '}
                        <strong style={{ color: t.kpiCutPassStrong }}>
                          {cutoff.cutoff_score_general}%
                        </strong>
                        {cutoff.cutoff_score_quota != null && (
                          <>
                            {' '}
                            · Cotas:{' '}
                            <strong style={{ color: t.kpiCutPassStrong }}>
                              {cutoff.cutoff_score_quota}%
                            </strong>
                          </>
                        )}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCutoffModalOpen(true)}
                      className="relative z-10 inline-flex items-center gap-[3px] mt-[7px]"
                      style={{ fontSize: '0.58rem', color: t.kpiCutPassLink }}
                    >
                      Ver todas as notas ↗
                    </button>
                  </div>
                )}

                {cutoffState === 'fail' && cutoff && currentUser && (
                  <div
                    className="rounded-[18px] relative overflow-hidden flex flex-col justify-between"
                    style={{
                      padding: '15px 13px 13px',
                      minHeight: '110px',
                      background: t.kpiCutFailBg,
                      border: t.kpiCutFailBorder,
                      boxShadow: t.kpiCutFailShadow,
                    }}
                  >
                    <div
                      className="absolute pointer-events-none"
                      style={{
                        top: '-30px',
                        right: '-30px',
                        width: '100px',
                        height: '100px',
                        borderRadius: '50%',
                        background: t.kpiCutFailOrb,
                      }}
                      aria-hidden
                    />
                    <div className="relative z-10">
                      <p
                        className="font-bold uppercase mb-[7px]"
                        style={{
                          fontSize: '0.56rem',
                          letterSpacing: '.09em',
                          color: t.kpiCutFailTag,
                        }}
                      >
                        Nota de corte
                      </p>
                      <p
                        className="font-bold leading-snug mb-[4px]"
                        style={{ fontSize: '0.95rem', color: t.kpiCutFailVal }}
                      >
                        Ainda não passou
                      </p>
                      <p
                        className="leading-snug mb-[5px]"
                        style={{ fontSize: '0.62rem', color: t.kpiCutFailSub }}
                      >
                        Sua nota é{' '}
                        <strong style={{ color: t.kpiCutFailGap }}>
                          {cutoff.cutoff_score_general - currentUser.score}% abaixo
                        </strong>{' '}
                        do corte geral de{' '}
                        <strong style={{ color: t.kpiCutFailStrong }}>
                          {cutoff.cutoff_score_general}%
                        </strong>
                      </p>
                      <p
                        className="leading-snug"
                        style={{ fontSize: '0.6rem', color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)', fontStyle: 'italic' }}
                      >
                        {cutoffComfortMessage(cutoff.cutoff_score_general - currentUser.score).body}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCutoffModalOpen(true)}
                      className="relative z-10 inline-flex items-center gap-[3px] mt-[7px]"
                      style={{ fontSize: '0.58rem', color: t.kpiCutFailLink }}
                    >
                      Ver todas as notas ↗
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Low confidence banner ─────────────────────────────────────── */}
          {lowConfidence && (
            <div
              className="flex items-start gap-3 mb-4 rounded-[13px]"
              style={{
                padding: '11px 13px',
                background: 'rgba(251,146,60,0.07)',
                border: '1px solid rgba(251,146,60,0.22)',
              }}
            >
              <AlertTriangle
                className="h-4 w-4 mt-0.5 shrink-0"
                style={{ color: '#fb923c' }}
                aria-hidden
              />
              <p className="text-xs leading-relaxed" style={{ color: t.bannerText }}>
                <strong style={{ color: t.text1 }}>Poucos candidatos nesse recorte</strong> — com menos de 30 inscritos, esses dados podem não ser estatisticamente representativos.{' '}
                Nesse caso, o dado mais valioso é a{' '}
                <button
                  type="button"
                  onClick={() => setCutoffModalOpen(true)}
                  className="underline underline-offset-2 transition-colors font-semibold"
                  style={{ color: '#fb923c' }}
                >
                  nota de corte do ano passado →
                </button>
              </p>
            </div>
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
              <div
                className="px-5 py-4 mb-4 rounded-[16px]"
                style={{ background: t.surfaceBg, border: t.surfaceBorder }}
              >
                <div className="flex flex-wrap items-center gap-2.5">

                  {/* ─ Comparar group ─ */}
                  <span
                    className="shrink-0 whitespace-nowrap"
                    style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: t.filterLabel }}
                  >
                    Comparar
                  </span>

                  {/* Todos comparison pill */}
                  <motion.button
                    type="button"
                    onClick={() => {
                      if (rankingComparison.bySpecialty || rankingComparison.byInstitution) triggerShimmer('comp-all');
                      handleSelectAllComparison();
                    }}
                    aria-pressed={!rankingComparison.bySpecialty && !rankingComparison.byInstitution}
                    aria-label="Todos os candidatos"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[0.82rem] font-medium"
                    style={getPillStyle(!rankingComparison.bySpecialty && !rankingComparison.byInstitution)}
                    data-shimmer={shimmeringPillId === 'comp-all' ? '1' : undefined}
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: 0.95 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                  >
                    <motion.span
                      className="inline-flex shrink-0"
                      whileHover={{ scale: 1.15 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                    >
                      <Users className="h-4 w-4" aria-hidden />
                    </motion.span>
                    Todos
                  </motion.button>

                  {/* Specialty pill — only when user has a configured specialty */}
                  {userSpecialty && (
                    <motion.button
                      type="button"
                      onClick={() => {
                        if (!rankingComparison.bySpecialty) triggerShimmer('comp-specialty');
                        handleToggleSpecialtyComparison();
                      }}
                      aria-pressed={rankingComparison.bySpecialty}
                      aria-label={`Filtrar por especialidade: ${userSpecialty}`}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[0.82rem] font-medium"
                      style={getPillStyle(rankingComparison.bySpecialty)}
                      data-shimmer={shimmeringPillId === 'comp-specialty' ? '1' : undefined}
                      whileHover={{ y: -1 }}
                      whileTap={{ scale: 0.95 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                    >
                      <motion.span
                        className="inline-flex shrink-0"
                        whileHover={{ scale: 1.15 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                      >
                        <Stethoscope className="h-4 w-4" aria-hidden />
                      </motion.span>
                      {userSpecialty}
                    </motion.button>
                  )}

                  {/* Institution pill — slides in when specialty filter is active */}
                  <AnimatePresence>
                    {rankingComparison.bySpecialty && userInstitutions.length > 0 && (
                      <motion.button
                        key="institution-pill"
                        type="button"
                        onClick={() => {
                          if (!rankingComparison.byInstitution) triggerShimmer('comp-institution');
                          handleToggleInstitutionComparison();
                        }}
                        aria-pressed={rankingComparison.byInstitution}
                        aria-label={`Filtrar também por instituição: ${userInstitutions[0]}`}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[0.82rem] font-medium max-w-[14rem]"
                        style={getPillStyle(rankingComparison.byInstitution)}
                        data-shimmer={shimmeringPillId === 'comp-institution' ? '1' : undefined}
                        initial={{ opacity: 0, x: -8, scale: 0.88 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, x: -8, scale: 0.88 }}
                        whileHover={{ y: -1 }}
                        whileTap={{ scale: 0.95 }}
                        transition={{ type: 'spring', stiffness: 380, damping: 18 }}
                      >
                        <motion.span
                          className="inline-flex shrink-0"
                          whileHover={{ scale: 1.15 }}
                          transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                        >
                          <Building className="h-4 w-4" aria-hidden />
                        </motion.span>
                        <span className="truncate">{userInstitutions[0]}</span>
                      </motion.button>
                    )}
                  </AnimatePresence>

                  {/* Vertical divider */}
                  <div
                    className="shrink-0"
                    style={{ width: '1px', height: '26px', background: t.borderColor, borderRadius: '1px' }}
                    aria-hidden
                  />

                  {/* ─ Segmento group ─ */}
                  <span
                    className="shrink-0 whitespace-nowrap"
                    style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: t.filterLabel }}
                  >
                    Segmento
                  </span>

                  {visibleSegmentOptions.map((f) => (
                    <motion.button
                      key={f.key}
                      type="button"
                      onClick={() => {
                        if (segmentFilter !== f.key) triggerShimmer(`seg-${f.key}`);
                        handleSegmentFilterChange(f.key);
                      }}
                      aria-pressed={segmentFilter === f.key}
                      aria-label={f.label}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[0.82rem] font-medium"
                      style={getPillStyle(segmentFilter === f.key, f.key === 'pro' && segmentFilter !== f.key)}
                      data-shimmer={shimmeringPillId === `seg-${f.key}` ? '1' : undefined}
                      whileHover={{ y: -1 }}
                      whileTap={{ scale: 0.95 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                    >
                      <motion.span
                        className="inline-flex shrink-0"
                        whileHover={{ scale: 1.15 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                      >
                        <f.icon className="h-4 w-4" aria-hidden />
                      </motion.span>
                      <span className="hidden sm:inline">{f.label}</span>
                    </motion.button>
                  ))}

                </div>

                {/* Active filter summary */}
                {rankingComparison.bySpecialty && (
                  <p
                    className="text-xs mt-2.5 leading-snug"
                    style={{ color: t.filterLabel }}
                  >
                    <span style={{ color: '#7a1a32', marginRight: '4px' }}>●</span>
                    {rankingComparison.byInstitution && userInstitutions[0] ? (
                      <>
                        Comparando com candidatos de{' '}
                        <span style={{ color: t.text2 }}>{userSpecialty}</span>
                        {' · '}
                        <span style={{ color: t.text2 }}>{userInstitutions[0]}</span>
                      </>
                    ) : (
                      <>
                        Comparando com candidatos de{' '}
                        <span style={{ color: t.text2 }}>{userSpecialty}</span>
                        <span style={{ color: t.filterLabel }}> (todas as instituições)</span>
                      </>
                    )}
                  </p>
                )}
              </div>

              {/* ── Table ─────────────────────────────────────────────────── */}
              <div
                className="relative overflow-hidden"
                style={{
                  background: t.surfaceBg,
                  border: t.surfaceBorder,
                  borderRadius: '15px',
                }}
              >
                <table className="w-full">
                  <thead>
                    <tr style={{ borderBottom: t.tableHeaderBorder }}>
                      <th className="text-left w-10 px-4 py-3" style={{ fontSize: '0.58rem', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: t.tableHeaderText }}>#</th>
                      <th className="text-left px-2 py-3" style={{ fontSize: '0.58rem', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: t.tableHeaderText }}>Candidato</th>
                      <th className="text-left px-2 py-3 hidden md:table-cell" style={{ fontSize: '0.58rem', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: t.tableHeaderText }}>Especialidade</th>
                      <th className="text-left px-2 py-3 hidden md:table-cell" style={{ fontSize: '0.58rem', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: t.tableHeaderText }}>Instituição</th>
                      <th className="text-right px-4 py-3" style={{ fontSize: '0.58rem', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: t.tableHeaderText }}>Nota</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableRows.map((row, i) => {
                      if (isSeparator(row)) {
                        return (
                          <tr key={`sep-${i}`} style={{ borderBottom: t.tableRowBorder }}>
                            <td colSpan={5} className="px-4 py-2 text-center">
                              <span style={{ fontSize: '0.6rem', color: t.tableSeparator }}>
                                posições {row.from} – {row.to}
                              </span>
                            </td>
                          </tr>
                        );
                      }

                      return (
                        <tr
                          key={`${row.userId}-${row.position}`}
                          className="transition-colors"
                          style={{
                            background: row.isCurrentUser ? t.tableUserBg : undefined,
                            borderBottom:
                              i < tableRows.length - 1
                                ? t.tableRowBorder
                                : undefined,
                          }}
                        >
                          <td className="w-10 pl-4 py-3">
                            <PositionBadge
                              position={row.position}
                              isCurrentUser={row.isCurrentUser}
                              isDark={isDark}
                            />
                          </td>
                          <td className="pr-2 py-3">
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className="text-sm truncate"
                                style={{
                                  color: row.isCurrentUser ? t.tableUserText : t.tableText,
                                  fontWeight: row.isCurrentUser ? 600 : 400,
                                }}
                              >
                                {participantLabel(row)}
                              </span>
                              {row.isCurrentUser && (
                                <span
                                  className="text-[0.56rem] font-bold px-1.5 py-0.5 rounded shrink-0"
                                  style={{
                                    background: 'rgba(122,26,50,0.6)',
                                    color: '#ff9ab0',
                                    border: '1px solid rgba(255,150,170,0.2)',
                                  }}
                                >
                                  Você
                                </span>
                              )}
                            </div>
                          </td>
                          <td
                            className="pr-2 py-3 hidden md:table-cell"
                            style={{ fontSize: '0.8rem', color: t.tableSpecialty }}
                          >
                            {row.specialty}
                          </td>
                          <td
                            className="pr-2 py-3 hidden md:table-cell"
                            style={{ fontSize: '0.8rem', color: t.tableSpecialty }}
                          >
                            {row.institution}
                          </td>
                          <td className="pr-4 py-3 text-right">
                            <span
                              className="text-sm font-semibold tabular-nums"
                              style={{
                                color: row.isCurrentUser ? t.tableUserScore : t.tableScore,
                              }}
                            >
                              {row.score}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Sticky bar */}
                {currentUser && (
                  <div
                    className="sticky bottom-0 flex items-center justify-between px-4 py-2.5"
                    style={{
                      background:
                        'linear-gradient(135deg, rgba(122,26,50,0.72), rgba(60,12,24,0.82))',
                      borderTop: '1px solid rgba(255,150,170,0.14)',
                    }}
                    aria-hidden
                  >
                    <span className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>
                      Sua posição
                    </span>
                    <span className="text-sm font-bold text-white">
                      #{currentUser.position} de {filteredParticipants.length}
                    </span>
                    <span
                      className="text-sm font-semibold"
                      style={{ color: '#ffcbd8' }}
                    >
                      {currentUser.score}%
                    </span>
                  </div>
                )}
              </div>
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
