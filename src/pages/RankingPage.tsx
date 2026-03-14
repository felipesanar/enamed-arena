import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { PremiumCard } from '@/components/PremiumCard';
import { SectionHeader } from '@/components/SectionHeader';
import { EmptyState } from '@/components/EmptyState';
import { useUser } from '@/contexts/UserContext';
import { getSimulados } from '@/data/mock';
import { getQuestionsForSimulado } from '@/data/mock-questions';
import { useExamStorage } from '@/hooks/useExamStorage';
import { canViewResults } from '@/lib/simulado-helpers';
import { computeSimuladoScore, generateMockRanking, type RankingParticipant } from '@/lib/result-helpers';
import { cn } from '@/lib/utils';
import { Trophy, Medal, TrendingUp, Filter, Users, Stethoscope, Building } from 'lucide-react';

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

type RankingFilter = 'all' | 'same_specialty' | 'same_institution';
type SegmentFilter = 'all' | 'sanarflix' | 'pro';

export default function RankingPage() {
  console.log('[RankingPage] Rendering');

  const { onboarding } = useUser();
  const userSpecialty = onboarding?.specialty || 'Clínica Médica';
  const userInstitution = onboarding?.targetInstitutions?.[0] || 'USP';

  // Find simulados with results
  const simulados = useMemo(() => getSimulados(), []);
  const simuladosWithResults = simulados.filter(s => canViewResults(s.status));

  const [selectedSimuladoId, setSelectedSimuladoId] = useState<string | null>(
    simuladosWithResults[0]?.id ?? null
  );
  const [rankingFilter, setRankingFilter] = useState<RankingFilter>('all');
  const [segmentFilter, setSegmentFilter] = useState<SegmentFilter>('all');

  // Compute user score
  const questions = useMemo(() => selectedSimuladoId ? getQuestionsForSimulado(selectedSimuladoId) : [], [selectedSimuladoId]);
  const storage = useExamStorage(selectedSimuladoId || '');
  const examState = useMemo(() => selectedSimuladoId ? storage.loadState() : null, [selectedSimuladoId]);

  const userScore = useMemo(() => {
    if (!examState || (examState.status !== 'submitted' && examState.status !== 'expired')) return null;
    return computeSimuladoScore(examState, questions);
  }, [examState, questions]);

  // Generate ranking
  const fullRanking = useMemo(() => {
    if (!userScore) return [];
    return generateMockRanking(userScore.percentageScore, userSpecialty, userInstitution, 50);
  }, [userScore, userSpecialty, userInstitution]);

  // Apply filters
  const filteredRanking = useMemo(() => {
    let data = fullRanking;

    if (rankingFilter === 'same_specialty') {
      data = data.filter(p => p.specialty === userSpecialty || p.isCurrentUser);
    } else if (rankingFilter === 'same_institution') {
      data = data.filter(p => p.institution === userInstitution || p.isCurrentUser);
    }

    if (segmentFilter === 'sanarflix') {
      data = data.filter(p => p.segment !== 'guest' || p.isCurrentUser);
    } else if (segmentFilter === 'pro') {
      data = data.filter(p => p.segment === 'pro' || p.isCurrentUser);
    }

    // Re-rank after filtering
    return data
      .sort((a, b) => b.score - a.score)
      .map((p, i) => ({ ...p, position: i + 1 }));
  }, [fullRanking, rankingFilter, segmentFilter, userSpecialty, userInstitution]);

  const currentUser = filteredRanking.find(p => p.isCurrentUser);

  if (simuladosWithResults.length === 0 || !userScore) {
    return (
      <AppLayout>
        <PageHeader title="Ranking ENAMED" subtitle="Compare seu desempenho com milhares de candidatos." badge="Ranking Geral" />
        <EmptyState
          icon={Trophy}
          title="Ranking indisponível"
          description="Complete um simulado e aguarde a liberação do resultado para acessar o ranking."
        />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageHeader
        title="Ranking ENAMED"
        subtitle="Compare seu desempenho com milhares de candidatos."
        badge="Ranking Geral"
      />

      {/* Simulado selector */}
      {simuladosWithResults.length > 1 && (
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {simuladosWithResults.map(s => (
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

      {/* Your position */}
      {currentUser && (
        <PremiumCard className="mb-6 p-5 md:p-6 border-primary/20 bg-gradient-to-r from-accent to-transparent">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Trophy className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-body-sm text-muted-foreground">Sua posição</p>
                <p className="text-heading-2 text-foreground">
                  #{currentUser.position} de {filteredRanking.length}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-body-sm text-muted-foreground">Sua nota</p>
                <p className="text-heading-2 text-primary">{currentUser.score}%</p>
              </div>
            </div>
          </div>
        </PremiumCard>
      )}

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
              {[
                { key: 'all' as const, label: 'Todos', icon: Users },
                { key: 'same_specialty' as const, label: 'Mesma especialidade', icon: Stethoscope },
                { key: 'same_institution' as const, label: 'Mesma instituição', icon: Building },
              ].map(f => (
                <button
                  key={f.key}
                  onClick={() => setRankingFilter(f.key)}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-caption font-medium transition-all',
                    rankingFilter === f.key
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
              {[
                { key: 'all' as const, label: 'Todos' },
                { key: 'sanarflix' as const, label: 'SanarFlix' },
                { key: 'pro' as const, label: 'PRO: ENAMED' },
              ].map(f => (
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
            {filteredRanking.length} {filteredRanking.length === 1 ? 'candidato' : 'candidatos'}
          </span>
        }
      />
      <PremiumCard className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-overline uppercase text-muted-foreground px-5 py-3.5 w-16">#</th>
                <th className="text-left text-overline uppercase text-muted-foreground px-5 py-3.5">Participante</th>
                <th className="text-left text-overline uppercase text-muted-foreground px-5 py-3.5 hidden sm:table-cell">Especialidade</th>
                <th className="text-left text-overline uppercase text-muted-foreground px-5 py-3.5 hidden md:table-cell">Instituição</th>
                <th className="text-right text-overline uppercase text-muted-foreground px-5 py-3.5">Nota</th>
              </tr>
            </thead>
            <tbody>
              {filteredRanking.slice(0, 50).map((item) => (
                <tr
                  key={`${item.name}-${item.position}`}
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
                    <span className={cn(
                      'text-body font-medium',
                      item.isCurrentUser ? 'text-primary font-semibold' : 'text-foreground',
                    )}>
                      {item.name}
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
                    <span className={cn(
                      'text-body font-semibold',
                      item.isCurrentUser ? 'text-primary' : 'text-foreground',
                    )}>
                      {item.score}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PremiumCard>
    </AppLayout>
  );
}
