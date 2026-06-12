import { AdminCapabilityGate } from '@/admin/components/AdminCapabilityGate'
import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClipboardList } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AdminStatCard } from '@/admin/components/ui/AdminStatCard'
import { AdminPageHeader } from '@/admin/components/ui/AdminPageHeader'
import { AdminBadge } from '@/admin/components/ui/AdminBadge'
import { AdminEmptyState } from '@/admin/components/ui/AdminEmptyState'
import { AdminConfirmDialog } from '@/admin/components/ui/AdminConfirmDialog'
import { ATTEMPT_STATUS_META, PERIOD_OPTIONS } from '@/admin/lib/constants'
import { getInitials, formatInt } from '@/admin/lib/format'
import { useDebounce } from '@/hooks/useDebounce'
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
  { label: ATTEMPT_STATUS_META.in_progress.label, value: 'in_progress' },
  { label: ATTEMPT_STATUS_META.submitted.label, value: 'submitted' },
  { label: ATTEMPT_STATUS_META.expired.label, value: 'expired' },
]

const DAYS_OPTIONS = [...PERIOD_OPTIONS, { label: 'Todos', value: 0 }]

type ConfirmAction = { type: 'cancel' | 'delete'; attemptId: string } | null

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
      <AdminPageHeader
        title="Tentativas"
        subtitle={`${formatInt(totalCount)} no total`}
        actions={
          <select
            value={days}
            onChange={e => { setDays(Number(e.target.value)); setPage(1) }}
            className="bg-admin-surface border border-admin-line-strong rounded-md px-3 py-1.5 text-xs text-admin-text focus:outline-none focus:ring-1 focus:ring-admin-accent/50"
          >
            {DAYS_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        }
      />

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
          className="flex-1 min-w-[200px] bg-admin-surface border border-admin-line-strong rounded-md px-3 py-2 text-sm text-admin-text placeholder:text-admin-muted focus:outline-none focus:ring-1 focus:ring-admin-accent/50"
        />
        <select
          value={simuladoId}
          onChange={e => { setSimuladoId(e.target.value); setPage(1) }}
          className="bg-admin-surface border border-admin-line-strong rounded-md px-3 py-2 text-sm text-admin-text focus:outline-none focus:ring-1 focus:ring-admin-accent/50"
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
                ? 'bg-admin-accent text-admin-accent-contrast border-admin-accent'
                : 'bg-admin-surface text-admin-muted border-admin-line hover:text-admin-text hover:bg-admin-raised',
            )}
          >{opt.label}</button>
        ))}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2 animate-pulse">
          {[1,2,3,4,5].map(i => <div key={i} className="h-12 bg-admin-raised/60 rounded" />)}
        </div>
      ) : (
        <div className="bg-admin-surface rounded-lg border border-admin-line overflow-hidden">
          <div
            className="grid text-[9px] font-bold text-admin-faint uppercase tracking-wide border-b border-admin-line"
            style={{ gridTemplateColumns: '2fr 1.4fr 80px 90px 70px 80px 80px' }}
          >
            {['Usuário', 'Simulado', 'Início', 'Status', 'Nota', 'Posição', ''].map(h => (
              <div key={h} className="px-4 py-2">{h}</div>
            ))}
          </div>

          {rows.length === 0 ? (
            <AdminEmptyState
              icon={ClipboardList}
              title="Nenhuma tentativa encontrada"
              description="Ajuste a busca, o simulado ou o período."
            />
          ) : (
            rows.map((row: AttemptListRow) => (
              <div
                key={row.attempt_id}
                className="grid border-b border-admin-line/40 last:border-0 hover:bg-admin-raised/30 transition-colors items-center"
                style={{ gridTemplateColumns: '2fr 1.4fr 80px 90px 70px 80px 80px' }}
              >
                {/* Usuário */}
                <div className="px-4 py-2.5 flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-md bg-admin-accent flex items-center justify-center text-admin-accent-contrast text-xs font-bold shrink-0">
                    {getInitials(row.full_name)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-admin-text truncate">{row.full_name ?? '—'}</p>
                    <p className="text-[10px] text-admin-muted truncate">{row.email}</p>
                  </div>
                </div>
                {/* Simulado */}
                <div className="px-4 py-2.5 text-[10px] text-admin-muted truncate">
                  <span className="text-admin-faint">#{row.sequence_number} — </span>
                  {row.simulado_title}
                </div>
                {/* Início */}
                <div className="px-4 py-2.5 text-[10px] text-admin-muted">
                  {new Date(row.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                </div>
                {/* Status */}
                <div className="px-4 py-2.5">
                  <AdminBadge kind="attemptStatus" value={row.status} />
                </div>
                {/* Nota */}
                <div className="px-4 py-2.5 text-xs font-semibold text-admin-text text-right">
                  {row.score_percentage != null ? `${row.score_percentage.toFixed(1)}%` : '—'}
                </div>
                {/* Posição */}
                <div className="px-4 py-2.5 text-[10px] text-admin-muted text-right">
                  {row.ranking_position != null ? `${row.ranking_position}º` : '—'}
                </div>
                {/* Ações */}
                <div className="px-3 py-2.5 flex items-center gap-1">
                  <button
                    title="Ver usuário"
                    onClick={() => navigate(`/admin/usuarios/${row.user_id}`)}
                    className="w-7 h-7 rounded flex items-center justify-center text-admin-muted hover:text-admin-accent hover:bg-admin-accent/10 transition-colors text-sm"
                  >→</button>
                  {row.status === 'in_progress' && (
                    <button
                      aria-label="Cancelar"
                      title="Cancelar"
                      onClick={() => setConfirm({ type: 'cancel', attemptId: row.attempt_id })}
                      className="w-7 h-7 rounded flex items-center justify-center text-admin-muted hover:text-admin-warning hover:bg-admin-warning/10 transition-colors text-xs"
                    >✕</button>
                  )}
                  <button
                    aria-label="Excluir"
                    title="Excluir"
                    onClick={() => setConfirm({ type: 'delete', attemptId: row.attempt_id })}
                    className="w-7 h-7 rounded flex items-center justify-center text-admin-muted hover:text-admin-destructive hover:bg-admin-destructive/10 transition-colors text-xs"
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
          <p className="text-xs text-admin-muted">
            {((page - 1) * 25) + 1}–{Math.min(page * 25, totalCount)} de {formatInt(totalCount)}
          </p>
          <div className="flex gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="w-7 h-7 rounded border border-admin-line text-xs text-admin-muted disabled:opacity-30 hover:bg-admin-raised transition-colors"
            >‹</button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const p = Math.max(1, Math.min(page - 2, totalPages - 4)) + i
              return (
                <button key={p} onClick={() => setPage(p)}
                  className={cn('w-7 h-7 rounded border text-xs transition-colors',
                    page === p
                      ? 'bg-admin-accent text-admin-accent-contrast border-admin-accent'
                      : 'border-admin-line text-admin-muted hover:bg-admin-raised'
                  )}
                >{p}</button>
              )
            })}
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="w-7 h-7 rounded border border-admin-line text-xs text-admin-muted disabled:opacity-30 hover:bg-admin-raised transition-colors"
            >›</button>
          </div>
        </div>
      )}

      {/* Confirmação cancelar/excluir */}
      <AdminConfirmDialog
        open={!!confirm}
        onOpenChange={open => { if (!open) setConfirm(null) }}
        title={confirm?.type === 'cancel' ? 'Confirmar cancelamento' : 'Confirmar exclusão'}
        description={confirm?.type === 'cancel'
          ? 'A tentativa será marcada como expirada. O usuário não poderá continuar.'
          : 'A tentativa será removida permanentemente. O usuário poderá tentar novamente.'}
        confirmLabel={confirm?.type === 'cancel' ? 'Cancelar tentativa' : 'Excluir'}
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
