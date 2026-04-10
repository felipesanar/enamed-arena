/**
 * Conteúdo compartilhado entre Ranking (aluno) e preview admin.
 */

import React, { useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { PremiumCard } from '@/components/PremiumCard';
import { SectionHeader } from '@/components/SectionHeader';
import { EmptyState } from '@/components/EmptyState';
import { Skeleton } from '@/components/ui/skeleton';
import { SimuladoResultNav } from '@/components/simulado/SimuladoResultNav';
import { cn } from '@/lib/utils';
import { Trophy, Medal, Filter, Users, Stethoscope, Building, Globe, Crown } from 'lucide-react';
import {
  type SegmentFilter,
  type RankingParticipant,
  type RankingStats,
  type RankingComparisonSelection,
  rankingComparisonAnalyticsLabel,
  RANKING_COMPARISON_DEFAULT,
} from '@/services/rankingApi';
import { trackEvent } from '@/lib/analytics';
const SEGMENT_OPTIONS: Array<{ key: SegmentFilter; label: string; icon: React.ElementType }> = [
  { key: 'all', label: 'Todos', icon: Globe },
  { key: 'sanarflix', label: 'Aluno SanarFlix padrão', icon: Users },
  { key: 'pro', label: 'Aluno PRO', icon: Crown },
];

function PositionBadge({ position }: { position: number }) {
  if (position <= 3) {
    const colors: Record<number, string> = {
      1: 'bg-warning/20 text-warning',
      2: 'bg-muted text-muted-foreground',
      3: 'bg-warning/10 text-warning',
    };
    return (
      <div className={`h-8 w-8 rounded-full flex items-center justify-center ${colors[position]}`}>
        <Medal className="h-4 w-4" />
      </div>
    );
  }
  return (
    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-caption font-bold text-muted-foreground">
      {position}
    </div>
  );
}

function RankingSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-24 w-full rounded-xl" />
      <Skeleton className="h-16 w-full rounded-xl" />
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}

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
  header: { title: string; subtitle: string; badge: string };
  trackSource: RankingTrackSource;
  /** public: mascara outros como Candidato #n; admin: exibe nome do perfil quando houver */
  participantDisplay: 'public' | 'admin';
  toolbar?: React.ReactNode;
}

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
  header,
  trackSource,
  participantDisplay,
  toolbar,
}: RankingViewProps) {
  const mountedAtRef = useRef<number>(Date.now());
  const visibleSegmentOptions = SEGMENT_OPTIONS.filter((o) => allowedSegments.includes(o.key));

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

  const handleSelectAllComparison = () => {
    applyComparisonUpdate(RANKING_COMPARISON_DEFAULT);
  };

  const handleToggleSpecialtyComparison = () => {
    if (!userSpecialty) return;
    applyComparisonUpdate({
      ...rankingComparison,
      bySpecialty: !rankingComparison.bySpecialty,
    });
  };

  const handleToggleInstitutionComparison = () => {
    if (userInstitutions.length === 0) return;
    applyComparisonUpdate({
      ...rankingComparison,
      byInstitution: !rankingComparison.byInstitution,
    });
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
    if (!allowedSegments.includes(segmentFilter)) {
      setSegmentFilter('all');
    }
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
    if (participantDisplay === 'admin') {
      return item.name || `Candidato #${item.position}`;
    }
    return item.isCurrentUser ? item.name : `Candidato #${item.position}`;
  }

  return (
    <>
      <PageHeader title={header.title} subtitle={header.subtitle} badge={header.badge} />

      {toolbar && <div className="mb-4">{toolbar}</div>}

      {loading && <RankingSkeleton />}

      {!loading && (
        <>
          {selectedSimuladoId && (
            <div className="mb-6">
              <SimuladoResultNav
                simuladoId={selectedSimuladoId}
                variant={trackSource === 'admin_preview' ? 'admin' : 'public'}
              />
            </div>
          )}

          {simuladosWithResults.length > 1 && (
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
              {simuladosWithResults.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSelectedSimuladoId(s.id)}
                  className={cn(
                    'px-4 py-2 rounded-xl text-body-sm font-medium transition-all whitespace-nowrap',
                    s.id === selectedSimuladoId
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-secondary-foreground hover:bg-muted',
                  )}
                >
                  {s.title}
                </button>
              ))}
            </div>
          )}

          {currentUser && (
            <PremiumCard
              variant="hero"
              className="mb-6 border-primary/20 bg-gradient-to-r from-accent/50 to-transparent"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Trophy className="h-7 w-7 text-primary" aria-hidden />
                  </div>
                  <div>
                    <p className="text-overline uppercase text-muted-foreground tracking-wide mb-0.5">
                      Sua posição
                    </p>
                    <p className="text-display font-bold text-foreground tabular-nums">
                      #{currentUser.position}
                      <span className="text-heading-2 font-semibold text-muted-foreground ml-1">
                        de {filteredParticipants.length}
                      </span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-8 sm:gap-10">
                  <div className="text-center sm:text-right">
                    <p className="text-caption text-muted-foreground">Sua nota</p>
                    <p className="text-heading-1 font-bold text-primary tabular-nums">{currentUser.score}%</p>
                  </div>
                  {stats.totalCandidatos > 1 && (
                    <div className="text-center sm:text-right hidden sm:block">
                      <p className="text-caption text-muted-foreground">Média geral</p>
                      <p className="text-heading-2 font-semibold text-muted-foreground tabular-nums">
                        {stats.notaMedia}%
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </PremiumCard>
          )}

          {filteredParticipants.length === 0 && !currentUser && (
            <EmptyState
              icon={Users}
              title="Sem participantes"
              description="Ainda não há participantes suficientes para exibir o ranking deste simulado."
            />
          )}

          {filteredParticipants.length > 0 && (
            <>
              <PremiumCard className="p-4 md:p-5 mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <span className="text-body font-semibold text-foreground">Filtrar ranking</span>
                </div>

                <div className="flex flex-wrap gap-3">
                  <div className="min-w-0 flex-1 basis-[min(100%,20rem)]">
                    <p className="text-caption text-muted-foreground mb-1.5">Comparar com</p>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={handleSelectAllComparison}
                        aria-pressed={!rankingComparison.bySpecialty && !rankingComparison.byInstitution}
                        aria-label="Todos os candidatos"
                        className={cn(
                          'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-caption font-medium transition-all',
                          !rankingComparison.bySpecialty && !rankingComparison.byInstitution
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground hover:bg-muted/80',
                        )}
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
                          'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-caption font-medium transition-all',
                          rankingComparison.bySpecialty
                            ? 'bg-primary text-primary-foreground'
                            : !userSpecialty
                              ? 'bg-muted/50 text-muted-foreground/50 cursor-not-allowed'
                              : 'bg-muted text-muted-foreground hover:bg-muted/80',
                        )}
                        title={!userSpecialty ? 'Configure nas Configurações' : undefined}
                      >
                        <Stethoscope className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        <span className="hidden sm:inline">{userSpecialty || 'Especialidade'}</span>
                      </button>
                    </div>

                    {userInstitutions.length > 0 && (
                      <div className="mt-2 flex flex-col gap-1.5 border-t border-border pt-2.5">
                        <span className="text-caption text-muted-foreground leading-snug">
                          Também filtrar pela minha 1ª instituição-alvo (opcional)
                        </span>
                        <button
                          type="button"
                          onClick={handleToggleInstitutionComparison}
                          aria-pressed={rankingComparison.byInstitution}
                          aria-label={`Filtrar também por instituição: ${userInstitutions[0]}`}
                          className={cn(
                            'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-caption font-medium transition-all w-fit max-w-full',
                            rankingComparison.byInstitution
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted text-muted-foreground hover:bg-muted/80',
                          )}
                          title={
                            rankingComparison.byInstitution
                              ? 'Desative para ver a mesma especialidade em todas as instituições'
                              : 'Ative para restringir também à instituição do seu perfil (ex.: Pediatria na UFBA)'
                          }
                        >
                          <Building className="h-3.5 w-3.5 shrink-0" aria-hidden />
                          <span className="hidden sm:inline truncate">{userInstitutions[0]}</span>
                        </button>
                      </div>
                    )}
                  </div>

                  <div>
                    <p className="text-caption text-muted-foreground mb-1.5">Segmento</p>
                    <div className="flex gap-1.5">
                      {visibleSegmentOptions.map((f) => (
                        <button
                          key={f.key}
                          type="button"
                          onClick={() => handleSegmentFilterChange(f.key)}
                          className={cn(
                            'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-caption font-medium transition-all',
                            segmentFilter === f.key
                              ? 'bg-primary text-primary-foreground'
                              : f.key === 'pro'
                                ? 'bg-muted text-[#c4b5fd] hover:bg-muted/80'
                                : 'bg-muted text-muted-foreground hover:bg-muted/80',
                          )}
                        >
                          <f.icon className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">{f.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {(rankingComparison.bySpecialty || rankingComparison.byInstitution) && (
                  <p className="text-caption text-muted-foreground mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-1">
                    {rankingComparison.bySpecialty &&
                      userSpecialty &&
                      rankingComparison.byInstitution &&
                      userInstitutions[0] && (
                        <>
                          <Stethoscope className="h-3.5 w-3.5 shrink-0" aria-hidden />
                          <span>
                            Filtrando por <strong className="text-foreground">{userSpecialty}</strong> na{' '}
                            <strong className="text-foreground">{userInstitutions[0]}</strong>.
                          </span>
                        </>
                      )}
                    {rankingComparison.bySpecialty && userSpecialty && !rankingComparison.byInstitution && (
                      <>
                        <Stethoscope className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        <span>
                          Filtrando por especialidade: <strong className="text-foreground">{userSpecialty}</strong>
                          <span className="text-muted-foreground"> (todas as instituições).</span>
                        </span>
                      </>
                    )}
                    {!rankingComparison.bySpecialty && rankingComparison.byInstitution && userInstitutions[0] && (
                      <>
                        <Building className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        <span>
                          Filtrando por instituição: <strong className="text-foreground">{userInstitutions[0]}</strong>
                          <span className="text-muted-foreground"> (todas as especialidades).</span>
                        </span>
                      </>
                    )}
                    {rankingComparison.bySpecialty && !userSpecialty && (
                      <span>Configure sua especialidade nas Configurações para usar este filtro.</span>
                    )}
                  </p>
                )}
              </PremiumCard>

              <SectionHeader
                title="Ranking Completo"
                action={
                  <span className="text-body-sm text-muted-foreground">
                    {filteredParticipants.length}{' '}
                    {filteredParticipants.length === 1 ? 'candidato' : 'candidatos'}
                  </span>
                }
              />
              <PremiumCard className="p-0 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left text-overline uppercase text-muted-foreground px-5 py-3.5 w-16">
                          #
                        </th>
                        <th className="text-left text-overline uppercase text-muted-foreground px-5 py-3.5">
                          Participante
                        </th>
                        <th className="text-left text-overline uppercase text-muted-foreground px-5 py-3.5 hidden sm:table-cell">
                          Especialidade
                        </th>
                        <th className="text-left text-overline uppercase text-muted-foreground px-5 py-3.5 hidden md:table-cell">
                          Instituição
                        </th>
                        <th className="text-right text-overline uppercase text-muted-foreground px-5 py-3.5">
                          Nota
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredParticipants.map((item) => (
                        <tr
                          key={`${item.userId}-${item.position}`}
                          className={cn(
                            'border-b border-border/50 last:border-0 transition-colors',
                            item.isCurrentUser
                              ? 'bg-accent/50 hover:bg-accent/70'
                              : 'hover:bg-muted/30',
                          )}
                        >
                          <td className="px-5 py-3.5">
                            <PositionBadge position={item.position} />
                          </td>
                          <td className="px-5 py-3.5">
                            <span
                              className={cn(
                                'text-body font-medium',
                                item.isCurrentUser ? 'text-primary font-semibold' : 'text-foreground',
                              )}
                            >
                              {participantLabel(item)}
                            </span>
                            {item.isCurrentUser && (
                              <span className="ml-2 text-caption bg-primary/10 text-primary px-1.5 py-0.5 rounded font-semibold">
                                Você
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-3.5 hidden sm:table-cell">
                            <span className="text-body-sm text-muted-foreground">{item.specialty}</span>
                          </td>
                          <td className="px-5 py-3.5 hidden md:table-cell">
                            <span className="text-body-sm text-muted-foreground">{item.institution}</span>
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <span
                              className={cn(
                                'text-body font-semibold',
                                item.isCurrentUser ? 'text-primary' : 'text-foreground',
                              )}
                            >
                              {item.score}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </PremiumCard>
            </>
          )}
        </>
      )}
    </>
  );
}

/** Re-export para uso em páginas que só precisam do skeleton */
export { RankingSkeleton };
