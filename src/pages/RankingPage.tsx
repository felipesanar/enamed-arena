/**
 * RankingPage — real Supabase ranking data.
 * Architecture mirrored from Ranking ENAMED's Ranking.tsx.
 * Uses useRanking hook backed by get_ranking_for_simulado() security definer function.
 */

import React, { useEffect, useRef, useMemo } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { PremiumCard } from '@/components/PremiumCard';
import { SectionHeader } from '@/components/SectionHeader';
import { EmptyState } from '@/components/EmptyState';
import { Skeleton } from '@/components/ui/skeleton';
import { SimuladoResultNav } from '@/components/simulado/SimuladoResultNav';
import { useRanking } from '@/hooks/useRanking';
import { cn } from '@/lib/utils';
import { Trophy, Medal, Filter, Users, Stethoscope, Building, Globe, Crown } from 'lucide-react';
import {
  getAllowedRankingSegmentFilters,
  type ComparisonFilter,
  type SegmentFilter,
} from '@/services/rankingApi';
import { trackEvent } from '@/lib/analytics';
import { useUser } from '@/contexts/UserContext';

// ─── Module-scope constants ───

const SEGMENT_OPTIONS: Array<{ key: SegmentFilter; label: string; icon: React.ElementType }> = [
  { key: 'all',       label: 'Todos',                    icon: Globe },
  { key: 'sanarflix', label: 'Aluno SanarFlix padrão',   icon: Users },
  { key: 'pro',       label: 'Aluno PRO',                icon: Crown },
];

// ─── Sub-components ───

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

// ─── Main Page ───

export default function RankingPage() {
  const mountedAtRef = useRef<number>(Date.now());
  const {
    loading,
    simuladosWithResults,
    selectedSimuladoId,
    setSelectedSimuladoId,
    filteredParticipants,
    currentUser,
    stats,
    comparisonFilter,
    setComparisonFilter,
    segmentFilter,
    setSegmentFilter,
    userSpecialty,
    userInstitutions,
  } = useRanking();

  const { profile } = useUser();
  const segment = profile?.segment ?? 'guest';

  const allowedSegments = useMemo(
    () => getAllowedRankingSegmentFilters(segment),
    [segment],
  );

  const visibleSegmentOptions = SEGMENT_OPTIONS.filter(o => allowedSegments.includes(o.key));

  useEffect(() => {
    if (!allowedSegments.includes(segmentFilter)) {
      setSegmentFilter('all');
    }
  }, [allowedSegments, segmentFilter, setSegmentFilter]);

  useEffect(() => {
    trackEvent('ranking_viewed', {
      selectedSimuladoId,
      comparisonFilter,
      segmentFilter,
    });
  }, [selectedSimuladoId, comparisonFilter, segmentFilter]);

  useEffect(() => {
    return () => {
      const seconds = Math.max(1, Math.round((Date.now() - mountedAtRef.current) / 1000));
      trackEvent('ranking_engagement_time', { seconds });
    };
  }, []);

  // Empty state: no simulados with results
  if (!loading && simuladosWithResults.length === 0) {
    return (
      <>
        <PageHeader
          title="Ranking ENAMED"
          subtitle="Compare seu desempenho com milhares de candidatos."
          badge="Ranking Geral"
        />
        <EmptyState
          icon={Trophy}
          title="Ranking indisponível"
          description="Complete um simulado e aguarde a liberação do resultado para acessar o ranking."
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Ranking ENAMED"
        subtitle="Compare seu desempenho com milhares de candidatos."
        badge="Ranking Geral"
      />

      {/* Loading state */}
      {loading && <RankingSkeleton />}

      {!loading && (
        <>
          {selectedSimuladoId && (
            <div className="mb-6">
              <SimuladoResultNav simuladoId={selectedSimuladoId} />
            </div>
          )}

          {/* Simulado selector */}
          {simuladosWithResults.length > 1 && (
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
              {simuladosWithResults.map((s) => (
                <button
                  key={s.id}
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

          {/* Hero: sua posição em destaque (Fase D) */}
          {currentUser && (
            <PremiumCard variant="hero" className="mb-6 border-primary/20 bg-gradient-to-r from-accent/50 to-transparent">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Trophy className="h-7 w-7 text-primary" aria-hidden />
                  </div>
                  <div>
                    <p className="text-overline uppercase text-muted-foreground tracking-wide mb-0.5">Sua posição</p>
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
                      <p className="text-heading-2 font-semibold text-muted-foreground tabular-nums">{stats.notaMedia}%</p>
                    </div>
                  )}
                </div>
              </div>
            </PremiumCard>
          )}

          {/* Empty ranking state */}
          {filteredParticipants.length === 0 && !currentUser && (
            <EmptyState
              icon={Users}
              title="Sem participantes"
              description="Ainda não há participantes suficientes para exibir o ranking deste simulado."
            />
          )}

          {filteredParticipants.length > 0 && (
            <>
               {/* Filters — exclusive: specialty OR institution */}
               <PremiumCard className="p-4 md:p-5 mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <span className="text-body font-semibold text-foreground">Filtrar ranking</span>
                </div>

                <div className="flex flex-wrap gap-3">
                  {/* Comparison filter */}
                  <div>
                    <p className="text-caption text-muted-foreground mb-1.5">Comparar com</p>
                    <div className="flex gap-1.5">
                      {([
                        { key: 'all' as ComparisonFilter,           label: 'Todos',       icon: Users,        disabled: false },
                        { key: 'same_specialty' as ComparisonFilter, label: userSpecialty || 'Especialidade', icon: Stethoscope, disabled: !userSpecialty },
                      ]).map((f) => (
                        <button
                          key={f.key}
                          onClick={() => !f.disabled && setComparisonFilter(f.key)}
                          disabled={f.disabled}
                          className={cn(
                            'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-caption font-medium transition-all',
                            (comparisonFilter === f.key ||
                              (f.key === 'same_specialty' && comparisonFilter === 'same_institution'))
                              ? 'bg-primary text-primary-foreground'
                              : f.disabled
                              ? 'bg-muted/50 text-muted-foreground/50 cursor-not-allowed'
                              : 'bg-muted text-muted-foreground hover:bg-muted/80',
                          )}
                          title={f.disabled ? 'Configure nas Configurações' : undefined}
                        >
                          <f.icon className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">{f.label}</span>
                        </button>
                      ))}
                    </div>

                    {/* Sub-filtro de instituição — só quando especialidade está ativo */}
                    {comparisonFilter !== 'all' && (
                      <div className="mt-2 flex items-center gap-2 border-t border-border pt-2.5">
                        <span className="text-caption text-muted-foreground">Restringir à:</span>
                        <button
                          onClick={() =>
                            setComparisonFilter(
                              comparisonFilter === 'same_institution' ? 'same_specialty' : 'same_institution'
                            )
                          }
                          disabled={userInstitutions.length === 0}
                          className={cn(
                            'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-caption font-medium transition-all',
                            comparisonFilter === 'same_institution'
                              ? 'bg-primary text-primary-foreground'
                              : userInstitutions.length === 0
                              ? 'bg-muted/50 text-muted-foreground/50 cursor-not-allowed'
                              : 'bg-muted text-muted-foreground hover:bg-muted/80',
                          )}
                          title={userInstitutions.length === 0 ? 'Configure nas Configurações' : undefined}
                        >
                          <Building className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">{userInstitutions[0] || 'Instituição'}</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Segment filter */}
                  <div>
                    <p className="text-caption text-muted-foreground mb-1.5">Segmento</p>
                    <div className="flex gap-1.5">
                      {visibleSegmentOptions.map((f) => (
                        <button
                          key={f.key}
                          onClick={() => setSegmentFilter(f.key)}
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

                {comparisonFilter !== 'all' && (
                  <p className="text-caption text-muted-foreground mt-3 flex items-center gap-1.5">
                    {comparisonFilter === 'same_specialty' && userSpecialty && (
                      <><Stethoscope className="h-3.5 w-3.5" /> Filtrando por especialidade: <strong>{userSpecialty}</strong></>
                    )}
                    {comparisonFilter === 'same_institution' && userInstitutions.length > 0 && (
                      <><Building className="h-3.5 w-3.5" /> Filtrando por instituição: <strong>{userInstitutions[0]}</strong></>
                    )}
                    {comparisonFilter === 'same_specialty' && !userSpecialty && (
                      <>Configure sua especialidade nas Configurações para usar este filtro.</>
                    )}
                    {comparisonFilter === 'same_institution' && userInstitutions.length === 0 && (
                      <>Configure suas instituições-alvo nas Configurações para usar este filtro.</>
                    )}
                  </p>
                )}
              </PremiumCard>

              {/* Ranking table */}
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
                                item.isCurrentUser
                                  ? 'text-primary font-semibold'
                                  : 'text-foreground',
                              )}
                            >
                              {item.isCurrentUser ? item.name : `Candidato #${item.position}`}
                            </span>
                            {item.isCurrentUser && (
                              <span className="ml-2 text-caption bg-primary/10 text-primary px-1.5 py-0.5 rounded font-semibold">
                                Você
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-3.5 hidden sm:table-cell">
                            <span className="text-body-sm text-muted-foreground">
                              {item.specialty}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 hidden md:table-cell">
                            <span className="text-body-sm text-muted-foreground">
                              {item.institution}
                            </span>
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
