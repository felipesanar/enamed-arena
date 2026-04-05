import { useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { AdminStatCard } from '@/admin/components/ui/AdminStatCard'
import {
  useAdminAttemptKpis,
  useAdminAttemptList,
  useAdminSimuladoList,
  useAdminCancelAttempt,
  useAdminDeleteAttempt,
} from '@/admin/hooks/useAdminTentativas'
import type { AttemptListRow } from '@/admin/types'

const STATUS_OPTIONS = [
  { label: 'Todos', value: 'all' },
  { label: 'Em andamento', value: 'in_progress' },
  { label: 'Concluído', value: 'submitted' },
  { label: 'Expirado', value: 'expired' },
]

const PERIOD_OPTIONS = [
  { label: '7 dias', value: 7 },
  { label: '30 dias', value: 30 },
  { label: '90 dias', value: 90 },
  { label: 'Todos', value: 0 },
]

const STATUS_CLASSES: Record<string, string> = {
  submitted:       'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
  in_progress:     'bg-blue-500/10 text-blue-400 border border-blue-500/20',
  expired:         'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20',
  offline_pending: 'bg-muted text-muted-foreground border border-border',
}

const STATUS_LABELS: Record<string, string> = {
  submitted: 'Concluída', in_progress: 'Em andamento',
  expired: 'Expirada', offline_pending: 'Offline',
}

function getInitials(name: string | null): string {
  if (!name) return '?'
  return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

type ConfirmAction = { type: 'cancel' | 'delete'; attemptId: string } | null

export default function AdminTentativas() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [simuladoId, setSimuladoId] = useState<string>('')
  const [status, setStatus] = useState('all')
  const [days, setDays] = useState(30)
  const [page, setPage] = useState(1)
  const [confirm, setConfirm] = useState<ConfirmAction>(null)

  const debouncedSearch = useDebounce(search, 300)

  const { data: kpis, isLoading: kpisLoading } = useAdminAttemptKpis(days)
  const { data, isLoading } = useAdminAttemptList(debouncedSearch, simuladoId || null, status, days, page)
  const { data: simulados } = useAdminSimuladoList()
  const cancelMutation = useAdminCancelAttempt()
  const deleteMutation = useAdminDeleteAttempt()

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
      {/* Header */}
      <div>
        <h1 className="text-heading-1 text-foreground">Tentativas</h1>
        <p className="text-caption text-muted-foreground">{totalCount.toLocaleString('pt-BR')} no total</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-3">
        <AdminStatCard label="Total" value={kpis?.total ?? '—'} isLoading={kpisLoading} />
        <AdminStatCard label="Em andamento" value={kpis?.in_progress ?? '—'} isLoading={kpisLoading} />
        <AdminStatCard label="Concluídas" value={kpis?.submitted ?? '—'} isLoading={kpisLoading} />
        <AdminStatCard label="Expiradas" value={kpis?.expired ?? '—'} isLoading={kpisLoading} />
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <input
          type="text"
          value={search}
          onChange={handleSearch}
          placeholder="Buscar por usuário ou e-mail…"
          className="flex-1 min-w-[200px] bg-card border border-border rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <select
          value={simuladoId}
          onChange={e => { setSimuladoId(e.target.value); setPage(1) }}
          className="bg-card border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="">Todos os simulados</option>
          {(simulados ?? []).map((s: any) => (
            <option key={s.id} value={s.id}>#{s.sequence_number} — {s.title}</option>
          ))}
        </select>
        {STATUS_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => handleStatus(opt.value)}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
              status === opt.value
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-card text-muted-foreground border-border hover:text-foreground hover:bg-muted',
            )}
          >{opt.label}</button>
        ))}
        <select
          value={days}
          onChange={e => { setDays(Number(e.target.value)); setPage(1) }}
          className="bg-card border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        >
          {PERIOD_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2 animate-pulse">
          {[1,2,3,4,5].map(i => <div key={i} className="h-12 bg-muted/60 rounded" />)}
        </div>
      ) : (
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          <div
            className="grid text-[9px] font-bold text-muted-foreground/60 uppercase tracking-wide border-b border-border"
            style={{ gridTemplateColumns: '2fr 1.4fr 80px 90px 70px 80px 80px' }}
          >
            {['Usuário', 'Simulado', 'Início', 'Status', 'Nota', 'Posição', ''].map(h => (
              <div key={h} className="px-4 py-2">{h}</div>
            ))}
          </div>

          {rows.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              Nenhuma tentativa encontrada.
            </div>
          ) : (
            rows.map((row: AttemptListRow) => (
              <div
                key={row.attempt_id}
                className="grid border-b border-border/40 last:border-0 hover:bg-muted/30 transition-colors items-center"
                style={{ gridTemplateColumns: '2fr 1.4fr 80px 90px 70px 80px 80px' }}
              >
                {/* Usuário */}
                <div className="px-4 py-2.5 flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold shrink-0">
                    {getInitials(row.full_name)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{row.full_name ?? '—'}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{row.email}</p>
                  </div>
                </div>
                {/* Simulado */}
                <div className="px-4 py-2.5 text-[10px] text-muted-foreground truncate">
                  <span className="text-muted-foreground/60">#{row.sequence_number} — </span>
                  {row.simulado_title}
                </div>
                {/* Início */}
                <div className="px-4 py-2.5 text-[10px] text-muted-foreground">
                  {new Date(row.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                </div>
                {/* Status */}
                <div className="px-4 py-2.5">
                  <span className={cn('inline-flex px-2 py-0.5 rounded text-[9px] font-semibold', STATUS_CLASSES[row.status] ?? STATUS_CLASSES.expired)}>
                    {STATUS_LABELS[row.status] ?? row.status}
                  </span>
                </div>
                {/* Nota */}
                <div className="px-4 py-2.5 text-xs font-semibold text-foreground text-right">
                  {row.score_percentage != null ? `${row.score_percentage.toFixed(1)}%` : '—'}
                </div>
                {/* Posição */}
                <div className="px-4 py-2.5 text-[10px] text-muted-foreground text-right">
                  {row.ranking_position != null ? `${row.ranking_position}º` : '—'}
                </div>
                {/* Ações */}
                <div className="px-3 py-2.5 flex items-center gap-1">
                  <button
                    title="Ver usuário"
                    onClick={() => navigate(`/admin/usuarios/${row.user_id}`)}
                    className="w-7 h-7 rounded flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors text-sm"
                  >→</button>
                  {row.status === 'in_progress' && (
                    <button
                      aria-label="Cancelar"
                      title="Cancelar"
                      onClick={() => setConfirm({ type: 'cancel', attemptId: row.attempt_id })}
                      className="w-7 h-7 rounded flex items-center justify-center text-muted-foreground hover:text-yellow-400 hover:bg-yellow-400/10 transition-colors text-xs"
                    >✕</button>
                  )}
                  <button
                    aria-label="Excluir"
                    title="Excluir"
                    onClick={() => setConfirm({ type: 'delete', attemptId: row.attempt_id })}
                    className="w-7 h-7 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors text-xs"
                  >🗑</button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {((page - 1) * 25) + 1}–{Math.min(page * 25, totalCount)} de {totalCount.toLocaleString('pt-BR')}
          </p>
          <div className="flex gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="w-7 h-7 rounded border border-border text-xs text-muted-foreground disabled:opacity-30 hover:bg-muted transition-colors"
            >‹</button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const p = Math.max(1, Math.min(page - 2, totalPages - 4)) + i
              return (
                <button key={p} onClick={() => setPage(p)}
                  className={cn('w-7 h-7 rounded border text-xs transition-colors',
                    page === p ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:bg-muted'
                  )}
                >{p}</button>
              )
            })}
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="w-7 h-7 rounded border border-border text-xs text-muted-foreground disabled:opacity-30 hover:bg-muted transition-colors"
            >›</button>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-card border border-border rounded-lg p-6 w-80 shadow-xl">
            <h3 className="text-sm font-semibold text-foreground mb-2">
              {confirm.type === 'cancel' ? 'Confirmar cancelamento' : 'Confirmar exclusão'}
            </h3>
            <p className="text-xs text-muted-foreground mb-5">
              {confirm.type === 'cancel'
                ? 'A tentativa será marcada como expirada. O usuário não poderá continuar.'
                : 'A tentativa será removida permanentemente. O usuário poderá tentar novamente.'}
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirm(null)}
                className="px-4 py-2 text-xs rounded border border-border text-muted-foreground hover:bg-muted transition-colors"
              >Cancelar</button>
              <button
                onClick={handleConfirm}
                disabled={cancelMutation.isPending || deleteMutation.isPending}
                className="px-4 py-2 text-xs rounded bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50"
              >
                {confirm.type === 'cancel' ? 'Cancelar tentativa' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
