import { AdminCapabilityGate } from '@/admin/components/AdminCapabilityGate'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AdminPageHeader } from '@/admin/components/ui/AdminPageHeader'
import { AdminEmptyState } from '@/admin/components/ui/AdminEmptyState'
import { supabase } from '@/integrations/supabase/client'
import { RankingPreviewContent } from '@/admin/pages/AdminRankingPreviewPage'

function useSimuladosForPreview() {
  return useQuery({
    queryKey: ['admin', 'previews', 'simulados'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_list_simulados_for_ranking_preview')
      if (error) throw error
      return data ?? []
    },
  })
}

function SimuladoPicker({ onPick, cta }: { onPick: (id: string) => void; cta: string }) {
  const { data: simulados = [], isLoading } = useSimuladosForPreview()
  const [selected, setSelected] = useState('')

  if (isLoading) return <p className="text-xs text-admin-muted py-8 text-center">Carregando simulados…</p>
  if (simulados.length === 0) return <AdminEmptyState title="Nenhum simulado disponível" />

  return (
    <div className="flex items-center gap-2 py-4">
      <select
        value={selected}
        onChange={e => setSelected(e.target.value)}
        className="h-8 rounded-md border border-admin-line bg-admin-surface text-admin-text text-xs px-2"
        aria-label="Selecionar simulado"
      >
        <option value="">Selecione um simulado…</option>
        {simulados.map((s: { id: string; title: string }) => (
          <option key={s.id} value={s.id}>{s.title}</option>
        ))}
      </select>
      <button
        type="button"
        disabled={!selected}
        onClick={() => onPick(selected)}
        className="h-8 px-3 rounded-md bg-admin-accent text-admin-accent-contrast text-xs font-medium disabled:opacity-40"
      >
        {cta}
      </button>
    </div>
  )
}

function AdminPreviewsContent() {
  const navigate = useNavigate()

  return (
    <div>
      <AdminPageHeader
        title="Previews"
        subtitle="Visualize as telas do aluno (ranking, desempenho e correção) sem precisar de uma conta de teste."
      />
      <Tabs defaultValue="ranking">
        <TabsList className="bg-admin-raised border border-admin-line">
          <TabsTrigger value="ranking">Ranking</TabsTrigger>
          <TabsTrigger value="desempenho">Desempenho</TabsTrigger>
          <TabsTrigger value="correcao">Correção</TabsTrigger>
        </TabsList>
        <TabsContent value="ranking" className="mt-4">
          <RankingPreviewContent />
        </TabsContent>
        <TabsContent value="desempenho" className="mt-4">
          <SimuladoPicker cta="Abrir preview de desempenho"
            onPick={id => navigate(`/admin/preview/simulados/${id}/desempenho`)} />
        </TabsContent>
        <TabsContent value="correcao" className="mt-4">
          <SimuladoPicker cta="Abrir preview de correção"
            onPick={id => navigate(`/admin/preview/simulados/${id}/correcao`)} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default function AdminPreviews() {
  return (
    <AdminCapabilityGate capability="previews.view">
      <AdminPreviewsContent />
    </AdminCapabilityGate>
  )
}
