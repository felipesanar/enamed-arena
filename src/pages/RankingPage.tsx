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
import { RankingView } from '@/components/ranking/RankingView';

export default function RankingPage() {
  const {
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
  } = useRanking();

  const { profile } = useUser();
  const segment = profile?.segment ?? 'guest';

  const allowedSegments = useMemo(() => getAllowedRankingSegmentFilters(segment), [segment]);

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
    <PageTransition>
      <RankingView
        loading={loading}
        simuladosWithResults={simuladosWithResults}
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
        allowedSegments={allowedSegments}
        trackSource="page"
        participantDisplay="public"
      />
    </PageTransition>
  );
}
