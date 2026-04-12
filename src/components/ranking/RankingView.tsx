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
import { EmptyState } from '@/components/EmptyState';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  Trophy,
  Filter,
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

const SEGMENT_OPTIONS: Array<{ key: SegmentFilter; label: string; icon: React.ElementType }> = [
  { key: 'all', label: 'Todos', icon: Globe },
  { key: 'sanarflix', label: 'Aluno SanarFlix padrão', icon: Users },
  { key: 'pro', label: 'Aluno PRO', icon: Crown },
];

// ─── PositionBadge ────────────────────────────────────────────────────────────

function PositionBadge({
  position,
  isCurrentUser,
}: {
  position: number;
  isCurrentUser?: boolean;
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
          : { background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.45)' }
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
  const visibleSegmentOptions = SEGMENT_OPTIONS.filter((o) => allowedSegments.includes(o.key));
  const [cutoffModalOpen, setCutoffModalOpen] = useState(false);

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
    applyComparisonUpdate({ ...rankingComparison, bySpecialty: !rankingComparison.bySpecialty });
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
      : `Você está abaixo de ${percentil}% dos candidatos — tudo bem, é aqui que começa a virada!`;

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

  // ── Shared inline styles ──────────────────────────────────────────────────

  const chipActive = {
    background: 'rgba(122,26,50,0.6)',
    border: '1px solid rgba(255,150,170,0.25)',
    color: 'white',
  } as React.CSSProperties;

  const chipInactive = {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.09)',
    color: 'rgba(255,255,255,0.5)',
  } as React.CSSProperties;

  return (
    <>
      {toolbar && <div className="mb-4">{toolbar}</div>}

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
                  style={s.id === selectedSimuladoId ? chipActive : chipInactive}
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
                      {deltaPrefix} {Math.abs(delta)}pp {delta >= 0 ? 'acima' : 'abaixo'}
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
                    background:
                      perfState === 'good'
                        ? 'linear-gradient(135deg, rgba(34,197,94,0.14) 0%, rgba(16,185,129,0.06) 100%)'
                        : 'linear-gradient(135deg, rgba(251,146,60,0.1) 0%, rgba(239,68,68,0.05) 100%)',
                    border:
                      perfState === 'good'
                        ? '1px solid rgba(34,197,94,0.25)'
                        : '1px solid rgba(251,146,60,0.2)',
                    boxShadow:
                      perfState === 'good'
                        ? '0 8px 24px -6px rgba(34,197,94,0.1), inset 0 1px 0 rgba(255,255,255,0.05)'
                        : '0 8px 24px -6px rgba(251,146,60,0.08), inset 0 1px 0 rgba(255,255,255,0.04)',
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
                      background:
                        perfState === 'good'
                          ? 'radial-gradient(circle, rgba(74,222,128,0.12) 0%, transparent 70%)'
                          : 'radial-gradient(circle, rgba(251,146,60,0.1) 0%, transparent 70%)',
                    }}
                    aria-hidden
                  />
                  <div className="relative z-10">
                    <p
                      className="font-bold uppercase mb-[7px]"
                      style={{
                        fontSize: '0.56rem',
                        letterSpacing: '.09em',
                        color:
                          perfState === 'good'
                            ? 'rgba(74,222,128,0.7)'
                            : 'rgba(251,146,60,0.7)',
                      }}
                    >
                      Seu desempenho
                    </p>
                    <p
                      className="font-bold leading-snug mb-[5px]"
                      style={{
                        fontSize: '0.95rem',
                        color: perfState === 'good' ? '#4ade80' : '#fb923c',
                      }}
                    >
                      {perfMessage}
                    </p>
                    <p
                      className="leading-snug"
                      style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.4)' }}
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
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.09)',
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
                    }}
                  >
                    <p
                      className="font-bold uppercase mb-[7px] relative z-10"
                      style={{
                        fontSize: '0.56rem',
                        letterSpacing: '.09em',
                        color: 'rgba(255,255,255,0.3)',
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
                            style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.3)' }}
                          >
                            Preencha sua especialidade e instituição para ver se você passaria.
                          </p>
                          <Link
                            to="/configuracoes"
                            className="font-semibold inline-flex items-center gap-[3px]"
                            style={{ fontSize: '0.6rem', color: 'rgba(255,150,170,0.65)' }}
                          >
                            Completar perfil →
                          </Link>
                        </>
                      ) : (
                        <>
                          <p
                            className="leading-snug"
                            style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.3)' }}
                          >
                            Não encontramos nota de corte para sua combinação.
                          </p>
                          <button
                            type="button"
                            onClick={() => setCutoffModalOpen(true)}
                            className="font-semibold inline-flex items-center gap-[3px] text-left"
                            style={{ fontSize: '0.6rem', color: 'rgba(255,150,170,0.65)' }}
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
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.09)',
                    }}
                  >
                    <p style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.3)' }}>
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
                      background:
                        'linear-gradient(135deg, rgba(99,179,237,0.12) 0%, rgba(139,92,246,0.06) 100%)',
                      border: '1px solid rgba(99,179,237,0.22)',
                      boxShadow:
                        '0 8px 24px -6px rgba(99,179,237,0.1), inset 0 1px 0 rgba(255,255,255,0.05)',
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
                        background:
                          'radial-gradient(circle, rgba(125,211,252,0.1) 0%, transparent 70%)',
                      }}
                      aria-hidden
                    />
                    <div className="relative z-10">
                      <p
                        className="font-bold uppercase mb-[7px]"
                        style={{
                          fontSize: '0.56rem',
                          letterSpacing: '.09em',
                          color: 'rgba(125,211,252,0.7)',
                        }}
                      >
                        Nota de corte
                      </p>
                      <p
                        className="font-bold leading-snug mb-[5px]"
                        style={{ fontSize: '0.95rem', color: '#7dd3fc' }}
                      >
                        Passaria ✓
                      </p>
                      <p
                        className="leading-snug"
                        style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.4)' }}
                      >
                        Corte geral:{' '}
                        <strong style={{ color: 'rgba(255,255,255,0.65)' }}>
                          {cutoff.cutoff_score_general}%
                        </strong>
                        {cutoff.cutoff_score_quota != null && (
                          <>
                            {' '}
                            · Cotas:{' '}
                            <strong style={{ color: 'rgba(255,255,255,0.65)' }}>
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
                      style={{ fontSize: '0.58rem', color: 'rgba(125,211,252,0.6)' }}
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
                      background:
                        'linear-gradient(135deg, rgba(239,68,68,0.10) 0%, rgba(220,38,38,0.05) 100%)',
                      border: '1px solid rgba(239,68,68,0.20)',
                      boxShadow:
                        '0 8px 24px -6px rgba(239,68,68,0.08), inset 0 1px 0 rgba(255,255,255,0.04)',
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
                        background:
                          'radial-gradient(circle, rgba(248,113,113,0.1) 0%, transparent 70%)',
                      }}
                      aria-hidden
                    />
                    <div className="relative z-10">
                      <p
                        className="font-bold uppercase mb-[7px]"
                        style={{
                          fontSize: '0.56rem',
                          letterSpacing: '.09em',
                          color: 'rgba(248,113,113,0.7)',
                        }}
                      >
                        Nota de corte
                      </p>
                      <p
                        className="font-bold leading-snug mb-[5px]"
                        style={{ fontSize: '0.95rem', color: '#f87171' }}
                      >
                        Ainda não ✗
                      </p>
                      <p
                        className="leading-snug"
                        style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.4)' }}
                      >
                        Faltam{' '}
                        <strong style={{ color: '#f87171' }}>
                          {cutoff.cutoff_score_general - currentUser.score}pp
                        </strong>{' '}
                        para o corte geral de{' '}
                        <strong style={{ color: 'rgba(255,255,255,0.65)' }}>
                          {cutoff.cutoff_score_general}%
                        </strong>
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCutoffModalOpen(true)}
                      className="relative z-10 inline-flex items-center gap-[3px] mt-[7px]"
                      style={{ fontSize: '0.58rem', color: 'rgba(248,113,113,0.6)' }}
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
              <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.6)' }}>
                <strong className="text-white">Ranking com poucos participantes</strong> — com menos
                de 30 candidatos, os resultados podem não refletir o desempenho real.{' '}
                <button
                  type="button"
                  onClick={() => setCutoffModalOpen(true)}
                  className="underline underline-offset-2 transition-colors hover:text-white"
                  style={{ color: '#fb923c' }}
                >
                  Consulte a nota de corte oficial →
                </button>
              </p>
            </div>
          )}

          {/* ── Empty state ───────────────────────────────────────────────── */}
          {filteredParticipants.length === 0 && !currentUser && (
            <EmptyState
              icon={Users}
              title="Sem participantes"
              description="Ainda não há participantes suficientes para exibir o ranking deste simulado."
            />
          )}

          {filteredParticipants.length > 0 && (
            <>
              {/* ── Filter bar ────────────────────────────────────────────── */}
              <div
                className="p-4 mb-4 rounded-[15px]"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.07)',
                }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <Filter
                    className="h-4 w-4"
                    style={{ color: 'rgba(255,255,255,0.3)' }}
                    aria-hidden
                  />
                  <span className="text-sm font-semibold text-white">Filtrar ranking</span>
                </div>

                <div className="flex flex-wrap gap-3">
                  <div className="min-w-0 flex-1 basis-[min(100%,20rem)]">
                    <p
                      className="text-xs mb-1.5"
                      style={{ color: 'rgba(255,255,255,0.3)' }}
                    >
                      Comparar com
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={handleSelectAllComparison}
                        aria-pressed={
                          !rankingComparison.bySpecialty && !rankingComparison.byInstitution
                        }
                        aria-label="Todos os candidatos"
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all"
                        style={
                          !rankingComparison.bySpecialty && !rankingComparison.byInstitution
                            ? chipActive
                            : chipInactive
                        }
                      >
                        <Users className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        <span className="hidden sm:inline">Todos</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleToggleSpecialtyComparison}
                        disabled={!userSpecialty}
                        aria-pressed={rankingComparison.bySpecialty}
                        aria-label={
                          userSpecialty
                            ? `Filtrar por especialidade: ${userSpecialty}`
                            : 'Especialidade não configurada'
                        }
                        className={cn(
                          'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all',
                          !userSpecialty && 'cursor-not-allowed opacity-40',
                        )}
                        style={rankingComparison.bySpecialty ? chipActive : chipInactive}
                        title={!userSpecialty ? 'Configure nas Configurações' : undefined}
                      >
                        <Stethoscope className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        <span className="hidden sm:inline">{userSpecialty || 'Especialidade'}</span>
                      </button>
                    </div>

                    {userInstitutions.length > 0 && (
                      <div
                        className="mt-2 flex flex-col gap-1.5 pt-2.5"
                        style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}
                      >
                        <span
                          className="text-xs leading-snug"
                          style={{ color: 'rgba(255,255,255,0.3)' }}
                        >
                          Também filtrar pela minha 1ª instituição-alvo (opcional)
                        </span>
                        <button
                          type="button"
                          onClick={handleToggleInstitutionComparison}
                          aria-pressed={rankingComparison.byInstitution}
                          aria-label={`Filtrar também por instituição: ${userInstitutions[0]}`}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all w-fit max-w-full"
                          style={rankingComparison.byInstitution ? chipActive : chipInactive}
                        >
                          <Building className="h-3.5 w-3.5 shrink-0" aria-hidden />
                          <span className="hidden sm:inline truncate">{userInstitutions[0]}</span>
                        </button>
                      </div>
                    )}
                  </div>

                  <div>
                    <p
                      className="text-xs mb-1.5"
                      style={{ color: 'rgba(255,255,255,0.3)' }}
                    >
                      Segmento
                    </p>
                    <div className="flex gap-1.5">
                      {visibleSegmentOptions.map((f) => (
                        <button
                          key={f.key}
                          type="button"
                          onClick={() => handleSegmentFilterChange(f.key)}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all"
                          style={
                            segmentFilter === f.key
                              ? chipActive
                              : {
                                  ...chipInactive,
                                  color:
                                    f.key === 'pro'
                                      ? '#c4b5fd'
                                      : 'rgba(255,255,255,0.5)',
                                }
                          }
                        >
                          <f.icon className="h-3.5 w-3.5" aria-hidden />
                          <span className="hidden sm:inline">{f.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {(rankingComparison.bySpecialty || rankingComparison.byInstitution) && (
                  <p
                    className="text-xs mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-1"
                    style={{ color: 'rgba(255,255,255,0.35)' }}
                  >
                    {rankingComparison.bySpecialty &&
                      userSpecialty &&
                      rankingComparison.byInstitution &&
                      userInstitutions[0] && (
                        <>
                          <Stethoscope className="h-3.5 w-3.5 shrink-0" aria-hidden />
                          <span>
                            Filtrando por{' '}
                            <strong className="text-white">{userSpecialty}</strong> na{' '}
                            <strong className="text-white">{userInstitutions[0]}</strong>.
                          </span>
                        </>
                      )}
                    {rankingComparison.bySpecialty &&
                      userSpecialty &&
                      !rankingComparison.byInstitution && (
                        <>
                          <Stethoscope className="h-3.5 w-3.5 shrink-0" aria-hidden />
                          <span>
                            Filtrando por especialidade:{' '}
                            <strong className="text-white">{userSpecialty}</strong>
                            <span style={{ color: 'rgba(255,255,255,0.3)' }}>
                              {' '}
                              (todas as instituições).
                            </span>
                          </span>
                        </>
                      )}
                    {!rankingComparison.bySpecialty &&
                      rankingComparison.byInstitution &&
                      userInstitutions[0] && (
                        <>
                          <Building className="h-3.5 w-3.5 shrink-0" aria-hidden />
                          <span>
                            Filtrando por instituição:{' '}
                            <strong className="text-white">{userInstitutions[0]}</strong>
                            <span style={{ color: 'rgba(255,255,255,0.3)' }}>
                              {' '}
                              (todas as especialidades).
                            </span>
                          </span>
                        </>
                      )}
                    {rankingComparison.bySpecialty && !userSpecialty && (
                      <span>
                        Configure sua especialidade nas Configurações para usar este filtro.
                      </span>
                    )}
                  </p>
                )}
              </div>

              {/* ── Table ─────────────────────────────────────────────────── */}
              <div
                className="relative overflow-hidden"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: '15px',
                }}
              >
                <table className="w-full">
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                      <th className="text-left w-10 px-4 py-3" style={{ fontSize: '0.58rem', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)' }}>#</th>
                      <th className="text-left px-2 py-3" style={{ fontSize: '0.58rem', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)' }}>Candidato</th>
                      <th className="text-left px-2 py-3 hidden md:table-cell" style={{ fontSize: '0.58rem', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)' }}>Especialidade</th>
                      <th className="text-left px-2 py-3 hidden md:table-cell" style={{ fontSize: '0.58rem', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)' }}>Instituição</th>
                      <th className="text-right px-4 py-3" style={{ fontSize: '0.58rem', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)' }}>Nota</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableRows.map((row, i) => {
                      if (isSeparator(row)) {
                        return (
                          <tr key={`sep-${i}`} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            <td colSpan={5} className="px-4 py-2 text-center">
                              <span style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.2)' }}>
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
                            background: row.isCurrentUser ? 'rgba(122,26,50,0.28)' : undefined,
                            borderBottom:
                              i < tableRows.length - 1
                                ? '1px solid rgba(255,255,255,0.05)'
                                : undefined,
                          }}
                        >
                          <td className="w-10 pl-4 py-3">
                            <PositionBadge
                              position={row.position}
                              isCurrentUser={row.isCurrentUser}
                            />
                          </td>
                          <td className="pr-2 py-3">
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className="text-sm truncate"
                                style={{
                                  color: row.isCurrentUser ? '#fff' : 'rgba(255,255,255,0.7)',
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
                            style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.45)' }}
                          >
                            {row.specialty}
                          </td>
                          <td
                            className="pr-2 py-3 hidden md:table-cell"
                            style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.45)' }}
                          >
                            {row.institution}
                          </td>
                          <td className="pr-4 py-3 text-right">
                            <span
                              className="text-sm font-semibold tabular-nums"
                              style={{
                                color: row.isCurrentUser ? '#ffcbd8' : 'rgba(255,255,255,0.7)',
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
      />
    </>
  );
}

/** Re-export para uso em páginas que só precisam do skeleton */
export { RankingSkeleton };
