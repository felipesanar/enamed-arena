import { AdminCapabilityGate } from '@/admin/components/AdminCapabilityGate'
import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClipboardList, Search, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AdminStatCard } from '@/admin/components/ui/AdminStatCard'
import { AdminPageHeader } from '@/admin/components/ui/AdminPageHeader'
import { AdminBadge } from '@/admin/components/ui/AdminBadge'
import { AdminEmptyState } from '@/admin/components/ui/AdminEmptyState'
import { AdminConfirmDialog } from '@/admin/components/ui/AdminConfirmDialog'
import { PERIOD_OPTIONS } from '@/admin/lib/constants'
import { getInitials, formatInt } from '@/admin/lib/format'
import { useDebounce } from '@/hooks/useDebounce'
import { useAdminCan } from '@/admin/contexts/AdminAccessContext'
import {
  useAdminAttemptKpis,
  useAdminAttemptList,
  useAdminSimuladoList,
  useAdminCancelAttempt,
  useAdminDeleteAttempt,
} from '@/admin/hooks/useAdminTentativas'
import type { AttemptListRow } from '@/admin/types'

// Segmentado da toolbar: rótulos que um operador novo entende.
// "Todas" mostra tudo; "Concluídas" filtra pelas que viraram nota.
const SEGMENTS = [
  { label: 'Todas', value: 'all' },
  { label: 'Em andamento', value: 'in_progress' },
  { label: 'Concluídas', value: 'submitted' },
  { label: 'Offline/pendente', value: 'offline_pending' },
] as const

const DAYS_OPTIONS = [...PERIOD_OPTIONS, { label: 'Todo o período', value: 0 }]

const GRID = '1.8fr 1.6fr 110px 130px 80px 130px'

type ConfirmAction = { type: 'cancel' | 'delete'; attemptId: string } | null

/** Início legível: data curta para tentativas mais antigas. */
function formatStart(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function AdminTentativasContent() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [simuladoId, setSimuladoId] = useState<string>('')
  const [status, setStatus] = useState('all')
  const [days, setDays] = useState(30)
  const [page, setPage] = useState(1)
  const [confirm, setConfirm] = useState<ConfirmAction>(null)

  const debouncedSearch = useDebounce(search, 300)

  const { data: kpis, isLoading: kpisLoading } = useAdminAttemptKpis(days)
  const { data, isLoading, isError } = useAdminAttemptList(debouncedSearch, simuladoId || null, status, days, page)
  const { data: simulados } = useAdminSimuladoList()
  const cancelMutation = useAdminCancelAttempt()
  const deleteMutation = useAdminDeleteAttempt()
  const canManage = useAdminCan('attempts.manage')

  const rows: AttemptListRow[] = data ?? []
  const totalCount = rows[0]?.total_count ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / 25))

  const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value)
    setPage(1)
  }, [])

  const handleStatus = useCallback((val: string) => {
    setStatus(val)
    setPage(1)
  }, [])

  const handleConfirm = () => {
    if (!confirm) return
    if (confirm.type === 'cancel') {
      cancelMutation.mutate(confirm.attemptId, { onSuccess: () => setConfirm(null) })
    } else {
      deleteMutation.mutate(confirm.attemptId, { onSuccess: () => setConfirm(null) })
    }
  }

  return (
    <div className="space-y-4 max-w-[1400px]">
      <AdminPageHeader
        title="Tentativas"
        subtitle="Acompanhe as provas e dê suporte: encerre o que travou ou exclua o que está errado."
        actions={
          <select
            aria-label="Período"
            value={days}
            onChange={e => { setDays(Number(e.target.value)); setPage(1) }}
            className="bg-admin-surface border border-admin-line-strong rounded-md px-3 py-1.5 text-xs text-admin-text focus:outline-none focus-visible:ring-2 focus-visible:ring-admin-accent/30 focus-visible:border-admin-accent"
          >
            {DAYS_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        }
      />

      {/* KPIs — os buckets fecham com o Total: em andamento + concluídas + offline/pendente + expiradas. */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <AdminStatCard label="Total" value={kpis?.total ?? '—'} isLoading={kpisLoading} />
        <AdminStatCard label="Em andamento" value={kpis?.in_progress ?? '—'} valueTone="info" isLoading={kpisLoading} />
        <AdminStatCard
          label="Concluídas"
          value={kpis?.submitted ?? '—'}
          valueTone="success"
          hint={kpis ? `${formatInt(kpis.submitted_valid)} válidas` : undefined}
          isLoading={kpisLoading}
        />
        <AdminStatCard label="Offline/pendente" value={kpis?.offline_pending ?? '—'} valueTone="warning" isLoading={kpisLoading} />
        <AdminStatCard label="Expiradas" value={kpis?.expired ?? '—'} valueTone="warning" isLoading={kpisLoading} />
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-[340px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-admin-faint" aria-hidden />
          <input
            type="text"
            value={search}
            onChange={handleSearch}
            placeholder="Buscar por aluno ou simulado"
            className="w-full bg-admin-surface border border-admin-line-strong rounded-md py-2 pl-9 pr-3 text-sm text-admin-text placeholder:text-admin-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-admin-accent/30 focus-visible:border-admin-accent"
          />
        </div>

        <select
          aria-label="Filtrar por simulado"
          value={simuladoId}
          onChange={e => { setSimuladoId(e.target.value); setPage(1) }}
          className="bg-admin-surface border border-admin-line-strong rounded-md px-3 py-2 text-sm text-admin-text focus:outline-none focus-visible:ring-2 focus-visible:ring-admin-accent/30 focus-visible:border-admin-accent"
        >
          <option value="">Todos os simulados</option>
          {(simulados ?? []).map((s: any) => (
            <option key={s.id} value={s.id}>#{s.sequence_number} — {s.title}</option>
          ))}
        </select>

        {/* Segmentado */}
        <div
          role="tablist"
          aria-label="Filtrar por status"
          className="inline-flex rounded-lg border border-admin-line bg-admin-raised p-0.5"
        >
          {SEGMENTS.map(opt => {
            const active = status === opt.value
            return (
              <button
                key={opt.value}
                role="tab"
                aria-selected={active}
                onClick={() => handleStatus(opt.value)}
                className={cn(
                  'rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-admin-accent/40',
                  active
                    ? 'bg-admin-surface text-admin-text shadow-sm shadow-black/[0.06] dark:shadow-black/30'
                    : 'text-admin-muted hover:text-admin-text',
                )}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Erro */}
      {isError && !isLoading && (
        <div className="bg-admin-surface rounded-lg border border-admin-line overflow-hidden">
          <AdminEmptyState
            tone="error"
            icon={ClipboardList}
            eyebrow="Erro"
            title="Não foi possível carregar as tentativas"
            description="Verifique sua conexão e tente novamente em instantes."
          />
        </div>
      )}

      {/* Tabela */}
      {isLoading ? (
        <div className="bg-admin-surface rounded-lg border border-admin-line overflow-hidden">
          <div
            className="grid text-[9px] font-bold text-admin-faint uppercase tracking-wide border-b border-admin-line"
            style={{ gridTemplateColumns: GRID }}
          >
            {['Aluno', 'Simulado', 'Início', 'Status', 'Nota', 'Ações'].map((h, i) => (
              <div key={h} className={cn('px-4 py-2', i === 5 && 'text-right')}>{h}</div>
            ))}
          </div>
          {[0, 1, 2, 3, 4].map(i => (
            <div
              key={i}
              className="grid items-center border-b border-admin-line/40 last:border-0"
              style={{ gridTemplateColumns: GRID }}
            >
              <div className="px-4 py-3 flex items-center gap-2.5">
                <div className="relative h-7 w-7 overflow-hidden rounded-md bg-admin-raised">
                  <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.4s_infinite] bg-gradient-to-r from-transparent via-admin-surface/70 to-transparent" />
                </div>
                <div className="relative h-3 w-28 overflow-hidden rounded bg-admin-raised">
                  <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.4s_infinite] bg-gradient-to-r from-transparent via-admin-surface/70 to-transparent" />
                </div>
              </div>
              {[0, 1, 2, 3].map(c => (
                <div key={c} className="px-4 py-3">
                  <div className="relative h-3 w-16 overflow-hidden rounded bg-admin-raised">
                    <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.4s_infinite] bg-gradient-to-r from-transparent via-admin-surface/70 to-transparent" />
                  </div>
                </div>
              ))}
              <div className="px-4 py-3 flex justify-end">
                <div className="relative h-7 w-20 overflow-hidden rounded-md bg-admin-raised">
                  <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.4s_infinite] bg-gradient-to-r from-transparent via-admin-surface/70 to-transparent" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : !isError && (
        <div className="bg-admin-surface rounded-lg border border-admin-line overflow-hidden">
          <div
            className="grid text-[9px] font-bold text-admin-faint uppercase tracking-wide border-b border-admin-line"
            style={{ gridTemplateColumns: GRID }}
          >
            {['Aluno', 'Simulado', 'Início', 'Status', 'Nota', 'Ações'].map((h, i) => (
              <div key={h} className={cn('px-4 py-2', i === 5 && 'text-right')}>{h}</div>
            ))}
          </div>

          {rows.length === 0 ? (
            <AdminEmptyState
              icon={ClipboardList}
              eyebrow="Vazio"
              title="Nenhuma tentativa encontrada"
              description="Ajuste a busca, o simulado, o status ou o período."
            />
          ) : (
            rows.map((row: AttemptListRow) => {
              const isOngoing = row.status === 'in_progress'
              return (
                <div
                  key={row.attempt_id}
                  className="grid border-b border-admin-line/40 last:border-0 hover:bg-admin-raised/30 transition-colors items-center"
                  style={{ gridTemplateColumns: GRID }}
                >
                  {/* Aluno */}
                  <div className="px-4 py-3 flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-md bg-admin-accent flex items-center justify-center text-admin-accent-contrast text-xs font-bold shrink-0">
                      {getInitials(row.full_name)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-admin-text truncate">{row.full_name ?? '—'}</p>
                      <p className="text-[10px] text-admin-muted truncate">{row.email}</p>
                    </div>
                  </div>
                  {/* Simulado */}
                  <div className="px-4 py-3 text-[11px] text-admin-muted truncate">
                    <span className="text-admin-faint">#{row.sequence_number} — </span>
                    {row.simulado_title}
                  </div>
                  {/* Início */}
                  <div className="px-4 py-3 text-[10px] text-admin-muted tabular-nums">
                    {formatStart(row.created_at)}
                  </div>
                  {/* Status */}
                  <div className="px-4 py-3">
                    <AdminBadge kind="attemptStatus" value={row.status} dot />
                  </div>
                  {/* Nota */}
                  <div className="px-4 py-3 text-xs font-semibold text-admin-text tabular-nums">
                    {row.score_percentage != null ? `${row.score_percentage.toFixed(0)}%` : <span className="text-admin-faint">—</span>}
                  </div>
                  {/* Ações */}
                  <div className="px-4 py-3 flex items-center justify-end gap-2">
                    <button
                      aria-label={`Ver aluno ${row.full_name ?? ''}`.trim()}
                      title="Ver aluno"
                      onClick={() => navigate(`/admin/usuarios/${row.user_id}`)}
                      className="w-7 h-7 rounded-md flex items-center justify-center text-admin-muted hover:text-admin-accent hover:bg-admin-accent/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-admin-accent/40"
                    >
                      <ArrowRight className="h-4 w-4" aria-hidden />
                    </button>

                    {canManage && isOngoing && (
                      <button
                        onClick={() => setConfirm({ type: 'cancel', attemptId: row.attempt_id })}
                        className="rounded-md border border-admin-line-strong bg-admin-surface px-3 py-1.5 text-xs font-semibold text-admin-text hover:bg-admin-raised transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-admin-accent/40"
                      >
                        Encerrar
                      </button>
                    )}

                    {canManage && !isOngoing && (
                      <button
                        onClick={() => setConfirm({ type: 'delete', attemptId: row.attempt_id })}
                        className="rounded-md border border-admin-destructive/30 bg-admin-surface px-3 py-1.5 text-xs font-semibold text-admin-destructive hover:bg-admin-destructive/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-admin-destructive/40"
                      >
                        Excluir
                      </button>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* Legenda fixa: explica a diferença ANTES de qualquer clique. */}
      {!isLoading && !isError && (
        <div className="flex flex-col gap-3 rounded-xl border border-admin-line bg-admin-surface px-4 py-3 text-[12px] leading-relaxed sm:flex-row sm:gap-5">
          <div className="flex items-start gap-2">
            <span className="shrink-0 font-bold text-admin-text">Encerrar</span>
            <span className="text-admin-muted">
              finaliza a prova em andamento e registra o que já foi respondido. O aluno pode tentar de novo na próxima janela.
            </span>
          </div>
          <div className="hidden w-px self-stretch bg-admin-line sm:block" aria-hidden />
          <div className="flex items-start gap-2">
            <span className="shrink-0 font-bold text-admin-destructive">Excluir</span>
            <span className="text-admin-muted">
              apaga a tentativa e a nota do histórico. Não pode ser desfeito.
            </span>
          </div>
        </div>
      )}

      {/* Paginação */}
      {totalPages > 1 && !isLoading && !isError && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-admin-muted tabular-nums">
            {((page - 1) * 25) + 1}–{Math.min(page * 25, totalCount)} de {formatInt(totalCount)}
          </p>
          <div className="flex gap-1">
            <button
              aria-label="Página anterior"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="w-7 h-7 rounded border border-admin-line text-xs text-admin-muted disabled:opacity-30 hover:bg-admin-raised transition-colors"
            >‹</button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const p = Math.max(1, Math.min(page - 2, totalPages - 4)) + i
              return (
                <button key={p} onClick={() => setPage(p)}
                  className={cn('w-7 h-7 rounded border text-xs transition-colors tabular-nums',
                    page === p
                      ? 'bg-admin-accent text-admin-accent-contrast border-admin-accent'
                      : 'border-admin-line text-admin-muted hover:bg-admin-raised'
                  )}
                >{p}</button>
              )
            })}
            <button
              aria-label="Próxima página"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="w-7 h-7 rounded border border-admin-line text-xs text-admin-muted disabled:opacity-30 hover:bg-admin-raised transition-colors"
            >›</button>
          </div>
        </div>
      )}

      {/* Confirmação encerrar/excluir */}
      <AdminConfirmDialog
        open={!!confirm}
        onOpenChange={open => { if (!open) setConfirm(null) }}
        title={confirm?.type === 'cancel' ? 'Encerrar esta tentativa?' : 'Excluir esta tentativa?'}
        description={confirm?.type === 'cancel'
          ? 'A prova será finalizada com o que já foi respondido. O aluno poderá tentar de novo na próxima janela.'
          : 'A tentativa e a nota saem do histórico de forma definitiva. Não dá para desfazer.'}
        confirmLabel={confirm?.type === 'cancel' ? 'Encerrar' : 'Excluir'}
        destructive={confirm?.type === 'delete'}
        loading={cancelMutation.isPending || deleteMutation.isPending}
        onConfirm={handleConfirm}
      />
    </div>
  )
}

export default function AdminTentativas() {
  return (
    <AdminCapabilityGate capability="attempts.view">
      <AdminTentativasContent />
    </AdminCapabilityGate>
  )
}
