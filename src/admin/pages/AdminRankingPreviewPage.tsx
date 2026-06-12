import { AdminCapabilityGate } from '@/admin/components/AdminCapabilityGate'
import { useMemo } from 'react'
import { AdminPageHeader } from '@/admin/components/ui/AdminPageHeader'
import { AdminEmptyState } from '@/admin/components/ui/AdminEmptyState'
import { RankingView } from '@/components/ranking/RankingView'
import { useRankingAdminPreview } from '@/hooks/useRankingAdminPreview'
import { getAllowedRankingSegmentFilters } from '@/services/rankingApi'
import { useUser } from '@/contexts/UserContext'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Trophy } from 'lucide-react'

/**
 * Miolo do preview de ranking, sem header de página — reutilizado pela
 * página standalone (default export) e pela aba "Ranking" em AdminPreviews.
 * O conteúdo do aluno (RankingView) é renderizado "emoldurado" num container
 * com o fundo próprio do aluno (`bg-background`), dentro do chrome admin.
 */
export function RankingPreviewContent() {
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
    includeTrain,
    setIncludeTrain,
  } = useRankingAdminPreview()

  const { profile } = useUser()
  const segment = profile?.segment ?? 'guest'
  const allowedSegments = useMemo(() => getAllowedRankingSegmentFilters(segment), [segment])

  if (!loading && simuladosWithResults.length === 0) {
    return (
      <AdminEmptyState
        icon={Trophy}
        title="Nenhum simulado com tentativas finalizadas"
        description="Quando houver provas concluídas no projeto, elas aparecerão aqui para preview."
      />
    )
  }

  return (
    <div className="bg-background rounded-lg border border-admin-line overflow-hidden p-4">
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
        trackSource="admin_preview"
        participantDisplay="admin"
        toolbar={
          <div className="rounded-xl border border-admin-line bg-admin-surface px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-caption text-admin-muted max-w-xl">
              Incluir tentativas fora da janela oficial (treino) recalcula posições e pode divergir do ranking
              público.
            </p>
            <div className="flex items-center gap-2 shrink-0">
              <Switch
                id="admin-ranking-include-train"
                checked={includeTrain}
                onCheckedChange={(v) => setIncludeTrain(v)}
              />
              <Label htmlFor="admin-ranking-include-train" className="text-body-sm text-admin-text cursor-pointer">
                Incluir treino (fora da janela)
              </Label>
            </div>
          </div>
        }
      />
    </div>
  )
}

function AdminRankingPreviewPageContent() {
  return (
    <>
      <AdminPageHeader
        title="Preview do ranking"
        subtitle="Mesma experiência do ranking público, sem depender da liberação de resultados."
      />
      <RankingPreviewContent />
    </>
  )
}

export default function AdminRankingPreviewPage() {
  return (
    <AdminCapabilityGate capability="previews.view">
      <AdminRankingPreviewPageContent />
    </AdminCapabilityGate>
  )
}
