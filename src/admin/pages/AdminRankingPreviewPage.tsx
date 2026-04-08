import { useMemo } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { EmptyState } from '@/components/EmptyState'
import { RankingView } from '@/components/ranking/RankingView'
import { useRankingAdminPreview } from '@/hooks/useRankingAdminPreview'
import { getAllowedRankingSegmentFilters } from '@/services/rankingApi'
import { useUser } from '@/contexts/UserContext'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Trophy } from 'lucide-react'

export default function AdminRankingPreviewPage() {
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
    includeTrain,
    setIncludeTrain,
  } = useRankingAdminPreview()

  const { profile } = useUser()
  const segment = profile?.segment ?? 'guest'
  const allowedSegments = useMemo(() => getAllowedRankingSegmentFilters(segment), [segment])

  if (!loading && simuladosWithResults.length === 0) {
    return (
      <>
        <PageHeader
          title="Preview do ranking"
          subtitle="Lista completa para validação de UI (somente administradores)."
          badge="Admin"
        />
        <EmptyState
          icon={Trophy}
          title="Nenhum simulado com tentativas finalizadas"
          description="Quando houver provas concluídas no projeto, elas aparecerão aqui para preview."
        />
      </>
    )
  }

  return (
    <RankingView
      loading={loading}
      simuladosWithResults={simuladosWithResults}
      selectedSimuladoId={selectedSimuladoId}
      setSelectedSimuladoId={setSelectedSimuladoId}
      filteredParticipants={filteredParticipants}
      currentUser={currentUser}
      stats={stats}
      comparisonFilter={comparisonFilter}
      setComparisonFilter={setComparisonFilter}
      segmentFilter={segmentFilter}
      setSegmentFilter={setSegmentFilter}
      userSpecialty={userSpecialty}
      userInstitutions={userInstitutions}
      allowedSegments={allowedSegments}
      header={{
        title: 'Preview do ranking',
        subtitle: 'Mesma experiência do ranking público, sem depender da liberação de resultados.',
        badge: 'Admin',
      }}
      trackSource="admin_preview"
      participantDisplay="admin"
      toolbar={
        <div className="rounded-xl border border-border bg-muted/40 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="text-caption text-muted-foreground max-w-xl">
            Incluir tentativas fora da janela oficial (treino) recalcula posições e pode divergir do ranking
            público.
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <Switch
              id="admin-ranking-include-train"
              checked={includeTrain}
              onCheckedChange={(v) => setIncludeTrain(v)}
            />
            <Label htmlFor="admin-ranking-include-train" className="text-body-sm cursor-pointer">
              Incluir treino (fora da janela)
            </Label>
          </div>
        </div>
      }
    />
  )
}
