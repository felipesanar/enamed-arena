import { AdminCapabilityGate } from '@/admin/components/AdminCapabilityGate'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { AdminPageHeader } from '@/admin/components/ui/AdminPageHeader'
import { AdminEmptyState } from '@/admin/components/ui/AdminEmptyState'
import { RankingView } from '@/components/ranking/RankingView'
import { useRankingAdminPreview } from '@/hooks/useRankingAdminPreview'
import { getAllowedRankingSegmentFilters } from '@/services/rankingApi'
import { useUser } from '@/contexts/UserContext'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Trophy, Eye, ChevronLeft } from 'lucide-react'

function BackToPreviewLink() {
  return (
    <Link
      to="/admin/previews"
      className="inline-flex items-center gap-1.5 text-xs text-admin-muted hover:text-admin-text motion-safe:transition-colors"
    >
      <ChevronLeft className="h-3.5 w-3.5" aria-hidden /> Voltar para a prévia do aluno
    </Link>
  )
}

/** Selo que deixa claro que o conteúdo é a tela do aluno, não a do admin. */
function VisaoDoAlunoBadge() {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-admin-text px-2.5 py-1 text-[10.5px] font-bold text-admin-surface">
        <Eye className="h-3 w-3" aria-hidden /> Visão do aluno
      </span>
      <span className="text-[11px] text-admin-faint">Ranking exatamente como o aluno enxerga</span>
    </div>
  )
}

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
        eyebrow="Vazio"
        title="Nenhum simulado com tentativas finalizadas"
        description="Quando houver provas concluídas no projeto, elas aparecerão aqui na prévia."
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
        userSpecialtyId={null}
        userInstitutionIds={[]}
        allowedSegments={allowedSegments}
        trackSource="admin_preview"
        participantDisplay="admin"
        showApprovalPanel={false}
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
        title="Prévia do ranking"
        subtitle="Mesma experiência do ranking público, sem depender da liberação de resultados."
        actions={<BackToPreviewLink />}
      />
      <VisaoDoAlunoBadge />
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
