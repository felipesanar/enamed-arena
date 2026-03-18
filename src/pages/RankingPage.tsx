/**
 * RankingPage — real Supabase ranking data.
 * Architecture mirrored from Ranking ENAMED's Ranking.tsx.
 * Uses useRanking hook backed by get_ranking_for_simulado() security definer function.
 */

import { useMemo } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { PremiumCard } from '@/components/PremiumCard';
import { SectionHeader } from '@/components/SectionHeader';
import { EmptyState } from '@/components/EmptyState';
import { Skeleton } from '@/components/ui/skeleton';
import { useRanking } from '@/hooks/useRanking';
import { cn } from '@/lib/utils';
import { Trophy, Medal, Filter, Users, Stethoscope, Building } from 'lucide-react';
import type { ComparisonFilter, SegmentFilter } from '@/services/rankingApi';

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
    userInstitution,
  } = useRanking();

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
              {/* Filters */}
              <PremiumCard className="p-4 md:p-5 mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <span className="text-body font-semibold text-foreground">Filtros</span>
                </div>
                <div className="flex flex-wrap gap-3">
                  {/* Comparison filter */}
                  <div>
                    <p className="text-caption text-muted-foreground mb-1.5">Comparar com</p>
                    <div className="flex gap-1.5">
                      {([
                        { key: 'all' as ComparisonFilter, label: 'Todos', icon: Users },
                        { key: 'same_specialty' as ComparisonFilter, label: 'Mesma especialidade', icon: Stethoscope },
                        { key: 'same_institution' as ComparisonFilter, label: 'Mesma instituição', icon: Building },
                      ]).map((f) => (
                        <button
                          key={f.key}
                          onClick={() => setComparisonFilter(f.key)}
                          className={cn(
                            'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-caption font-medium transition-all',
                            comparisonFilter === f.key
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted text-muted-foreground hover:bg-muted/80',
                          )}
                        >
                          <f.icon className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">{f.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Segment filter */}
                  <div>
                    <p className="text-caption text-muted-foreground mb-1.5">Segmento</p>
                    <div className="flex gap-1.5">
                      {([
                        { key: 'all' as SegmentFilter, label: 'Todos' },
                        { key: 'sanarflix' as SegmentFilter, label: 'SanarFlix' },
                        { key: 'pro' as SegmentFilter, label: 'PRO: ENAMED' },
                      ]).map((f) => (
                        <button
                          key={f.key}
                          onClick={() => setSegmentFilter(f.key)}
                          className={cn(
                            'px-3 py-2 rounded-lg text-caption font-medium transition-all',
                            segmentFilter === f.key
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted text-muted-foreground hover:bg-muted/80',
                          )}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
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
