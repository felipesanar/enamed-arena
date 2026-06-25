import { AdminCapabilityGate } from '@/admin/components/AdminCapabilityGate'
import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Eye, CheckCircle2, BarChart3, Trophy } from 'lucide-react'
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

/** Selo que deixa claro que o conteúdo é a tela do aluno, não a do admin. */
function VisaoDoAlunoBadge({ context }: { context?: string }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-admin-text px-2.5 py-1 text-[10.5px] font-bold text-admin-surface">
        <Eye className="h-3 w-3" aria-hidden /> Visão do aluno
      </span>
      {context && <span className="text-[11px] text-admin-faint">{context}</span>}
    </div>
  )
}

function SimuladoPickerForm({
  onPick,
  cta,
}: {
  onPick: (id: string) => void
  cta: string
}) {
  const { data: simulados = [], isLoading, isError } = useSimuladosForPreview()
  const [selected, setSelected] = useState('')

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 motion-safe:animate-pulse">
        <div className="h-8 w-64 rounded-md bg-admin-raised" />
        <div className="h-8 w-40 rounded-md bg-admin-raised" />
      </div>
    )
  }

  if (isError) {
    return (
      <p className="text-xs text-admin-destructive">
        Não foi possível carregar a lista de simulados. Tente novamente.
      </p>
    )
  }

  if (simulados.length === 0) {
    return (
      <AdminEmptyState
        eyebrow="Vazio"
        title="Nenhum simulado disponível"
        description="Crie um simulado em Conteúdo para visualizar a prévia do aluno aqui."
      />
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={selected}
        onChange={e => setSelected(e.target.value)}
        className="h-8 rounded-md border border-admin-line-strong bg-admin-surface px-2 text-xs text-admin-text focus:outline-none focus:ring-1 focus:ring-admin-accent/50"
        aria-label="Selecionar simulado"
      >
        <option value="">Selecione um simulado</option>
        {simulados.map((s: { id: string; title: string }) => (
          <option key={s.id} value={s.id}>{s.title}</option>
        ))}
      </select>
      <button
        type="button"
        disabled={!selected}
        onClick={() => onPick(selected)}
        className="h-8 rounded-md bg-admin-accent px-3 text-xs font-semibold text-admin-accent-contrast transition-opacity disabled:opacity-40"
      >
        {cta}
      </button>
    </div>
  )
}

/** Moldura de uma aba: descrição + selo "Visão do aluno" + conteúdo. */
function PreviewFrame({
  icon: Icon,
  description,
  badgeContext,
  children,
}: {
  icon: typeof Eye
  description: string
  badgeContext?: string
  children: ReactNode
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-admin-line bg-admin-surface shadow-sm shadow-black/[0.04] dark:shadow-black/30">
      <div className="flex items-start gap-3 border-b border-admin-line-subtle px-5 py-4">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-admin-accent-soft text-admin-accent">
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <p className="text-[13px] leading-relaxed text-admin-muted">{description}</p>
      </div>
      <div className="bg-admin-bg p-5">
        <VisaoDoAlunoBadge context={badgeContext} />
        {children}
      </div>
    </div>
  )
}

function AdminPreviewsContent() {
  const navigate = useNavigate()

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="Prévia do aluno"
        subtitle="Veja a prova, a correção e o ranking exatamente como o aluno vê, antes de publicar."
      />
      <Tabs defaultValue="correcao">
        <TabsList className="border border-admin-line bg-admin-raised">
          <TabsTrigger value="correcao">Correção</TabsTrigger>
          <TabsTrigger value="desempenho">Desempenho</TabsTrigger>
          <TabsTrigger value="ranking">Ranking</TabsTrigger>
        </TabsList>

        <TabsContent value="correcao" className="mt-4">
          <PreviewFrame
            icon={CheckCircle2}
            description="Abra a correção de uma prova do jeito que o aluno enxerga: enunciado, alternativas e a resposta certa marcada."
            badgeContext="Escolha um simulado para abrir"
          >
            <SimuladoPickerForm
              cta="Abrir correção do aluno"
              onPick={id => navigate(`/admin/preview/simulados/${id}/correcao`)}
            />
          </PreviewFrame>
        </TabsContent>

        <TabsContent value="desempenho" className="mt-4">
          <PreviewFrame
            icon={BarChart3}
            description="Veja a análise de desempenho por área e acertos, igual à tela de resultado do aluno."
            badgeContext="Escolha um simulado para abrir"
          >
            <SimuladoPickerForm
              cta="Abrir desempenho do aluno"
              onPick={id => navigate(`/admin/preview/simulados/${id}/desempenho`)}
            />
          </PreviewFrame>
        </TabsContent>

        <TabsContent value="ranking" className="mt-4">
          <PreviewFrame
            icon={Trophy}
            description="A mesma experiência do ranking público, sem depender da liberação de resultados."
          >
            <RankingPreviewContent />
          </PreviewFrame>
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
