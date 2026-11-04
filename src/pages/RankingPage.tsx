/**
 * RankingPage — real Supabase ranking data.
 * Uses useRanking hook backed by get_ranking_for_simulado() security definer function.
 */

import React, { useMemo } from 'react';
import { PageTransition } from '@/components/premium/PageTransition';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { useRanking } from '@/hooks/useRanking';
import { Trophy } from 'lucide-react';
import { getAllowedRankingSegmentFilters } from '@/services/rankingApi';
import { useUser } from '@/contexts/UserContext';
import { useAuth } from '@/contexts/AuthContext';
import { computePercentile } from '@/lib/ranking-percentile';
import { useRankingEvolution } from '@/hooks/useRankingEvolution';
import { RankingView } from '@/components/ranking/RankingView';
import { ProfSanorRanking } from '@/components/ranking/ProfSanorRanking';
import { FloatingProfSan } from '@/components/FloatingProfSan';
import { PresencialEntryCard } from '@/components/presencial/PresencialEntryCard';
import { useSimulados } from '@/hooks/useSimulados';
import { editionBadge } from '@/lib/edition-groups';
import { CutoffScopeContext, useCutoffContext } from '@/hooks/useCutoffContext';

export default function RankingPage() {
  const {
    loading,
    error,
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
    userSpecialtyId,
    userInstitutionIds,
    comparisonContext,
    refetch,
  } = useRanking();
  const { simulados, editionsUi } = useSimulados();
  const options = simuladosWithResults.map(option => {
    const metadata = editionsUi ? simulados.find(sim => sim.id === option.id) : undefined;
    return { ...option, ...(metadata ? { editionId: metadata.editionId, editionCode: metadata.editionCode, editionLabel: metadata.editionLabel } : {}) };
  });
  const selectedSimulado = options.find(option => option.id === selectedSimuladoId);
  const { cutoffContext } = useCutoffContext({ editionsUi, referenceEditionId: selectedSimulado?.editionId, enabled: editionsUi });

  const { profile } = useUser();
  const { user } = useAuth();
  const segment = profile?.segment ?? 'guest';

  const allowedSegments = useMemo(() => getAllowedRankingSegmentFilters(segment), [segment]);

  // Standing GLOBAL do hero (recorte "todos") — independente dos filtros aplicados na tabela.
  const heroStanding = useMemo(() => {
    const me = allParticipants.find((p) => p.isCurrentUser);
    if (!me) return null;
    const total = allParticipants.length;
    return {
      position: me.position,
      total,
      percentil: computePercentile(me.position, total),
      score: me.score,
    };
  }, [allParticipants]);

  const { data: heroEvolution } = useRankingEvolution(
    user?.id ?? null,
    simuladosWithResults,
    selectedSimuladoId,
    heroStanding?.percentil ?? null,
  );

  if (!loading && error && simuladosWithResults.length === 0) {
    return (
      <>
        <PageHeader
          title="Ranking"
          subtitle="Veja sua posição entre todos os candidatos que realizaram o simulado."
          subtitlePlacement="inline-end"
          badge={editionBadge(selectedSimulado)}
        />
        <PresencialEntryCard />
        <EmptyState
          variant="error"
          title="Não foi possível carregar o ranking"
          description="Houve um problema de conexão com o servidor. Verifique sua internet e tente novamente."
          onRetry={refetch}
        />
      </>
    );
  }

  if (!loading && simuladosWithResults.length === 0) {
    return (
      <>
        <PageHeader
          title="Ranking"
          subtitle="Veja sua posição entre todos os candidatos que realizaram o simulado."
          subtitlePlacement="inline-end"
          badge={editionBadge(selectedSimulado)}
        />
        <PresencialEntryCard />
        <EmptyState
          icon={Trophy}
          title="Ranking indisponível"
          description="Complete um simulado e aguarde a liberação do resultado para acessar o ranking."
        />
      </>
    );
  }

  return (
    <PageTransition>
      <PageHeader
        title="Ranking"
        subtitle="Veja sua posição entre todos os candidatos que realizaram o simulado."
        subtitlePlacement="inline-end"
        badge={editionBadge(selectedSimulado)}
      />
      <PresencialEntryCard />
      {currentUser && (
        <FloatingProfSan storageKey="profsan:ranking:open">
          <ProfSanorRanking
            compact
            studentName={profile?.name ?? 'Aluno'}
            simuladoId={selectedSimuladoId}
            editionId={selectedSimulado?.editionId}
            simuladoTitle={simuladosWithResults.find((s) => s.id === selectedSimuladoId)?.title}
            currentUser={allParticipants.find(participant => participant.isCurrentUser)}
            stats={stats}
            userSpecialty={userSpecialty}
            userInstitutions={userInstitutions}
          />
        </FloatingProfSan>
      )}
      <CutoffScopeContext.Provider value={{ editionsUi, referenceEditionId: selectedSimulado?.editionId ?? null, cutoffContext }}>
      <RankingView
        loading={loading}
        simuladosWithResults={options}
        editionsUi={editionsUi}
        selectedSimuladoId={selectedSimuladoId}
        setSelectedSimuladoId={setSelectedSimuladoId}
        filteredParticipants={filteredParticipants}
        currentUser={currentUser}
        stats={stats}
        rankingComparison={rankingComparison}
        setRankingComparison={setRankingComparison}
        segmentFilter={segmentFilter}
        setSegmentFilter={setSegmentFilter}
        userSpecialty={userSpecialty}
        userInstitutions={userInstitutions}
        userSpecialtyId={userSpecialtyId}
        userInstitutionIds={userInstitutionIds}
        comparisonContext={comparisonContext}
        allowedSegments={allowedSegments}
        trackSource="page"
        participantDisplay="public"
        heroStanding={heroStanding}
        heroEvolution={heroEvolution}
      />
      </CutoffScopeContext.Provider>
    </PageTransition>
  );
}
