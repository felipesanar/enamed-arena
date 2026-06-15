import { AdminCapabilityGate } from '@/admin/components/AdminCapabilityGate'
import { useState, useCallback } from 'react'
import { ScrollText } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AdminPageHeader } from '@/admin/components/ui/AdminPageHeader'
import { AdminDataTable } from '@/admin/components/ui/AdminDataTable'
import { AdminEmptyState } from '@/admin/components/ui/AdminEmptyState'
import { PERIOD_OPTIONS } from '@/admin/lib/constants'
import { formatInt } from '@/admin/lib/format'
import { useDebounce } from '@/hooks/useDebounce'
import { useAdminAudit } from '@/admin/hooks/useAdminAudit'
import type { AuditLogRow } from '@/admin/types'

const PAGE_SIZE = 50

const ACTION_LABELS: Record<string, string> = {
  grant_role: 'Papel concedido',
  revoke_role: 'Papel revogado',
  set_segment: 'Segmento alterado',
  reset_onboarding: 'Onboarding reiniciado',
  cancel_attempt: 'Tentativa cancelada',
  delete_attempt: 'Tentativa excluída',
  INSERT: 'Criação',
  UPDATE: 'Edição',
  DELETE: 'Exclusão',
}

const ENTITY_LABELS: Record<string, string> = {
  user: 'Usuário',
  attempt: 'Tentativa',
  simulado: 'Simulado',
  question: 'Questão',
  question_option: 'Alternativa',
}

const ACTION_OPTIONS = [
  { label: 'Todas as ações', value: 'all' },
  ...Object.entries(ACTION_LABELS).map(([value, label]) => ({ value, label })),
]

const ENTITY_OPTIONS = [
  { label: 'Todas as entidades', value: 'all' },
  ...Object.entries(ENTITY_LABELS).map(([value, label]) => ({ value, label })),
]

const selectCls =
  'bg-admin-surface border border-admin-line-strong rounded-md px-3 py-1.5 text-xs text-admin-text focus:outline-none focus:ring-1 focus:ring-admin-accent/50'

function AdminAuditoriaContent() {
  const [days, setDays] = useState(30)
  const [action, setAction] = useState('all')
  const [entityType, setEntityType] = useState('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const debouncedSearch = useDebounce(search, 300)

  const { data = [], isLoading, isError } = useAdminAudit({
    days,
    action,
    entityType,
    search: debouncedSearch,
    page,
    pageSize: PAGE_SIZE,
  })

  const rows: AuditLogRow[] = data
  const total = rows[0]?.total_count ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const resetPage = useCallback(() => setPage(1), [])

  const columns = [
    {
      key: 'created_at',
      label: 'Quando',
      width: '150px',
      render: (row: AuditLogRow) => (
        <span className="text-admin-muted">{new Date(row.created_at).toLocaleString('pt-BR')}</span>
      ),
    },
    {
      key: 'actor_email',
      label: 'Autor',
      width: '1.4fr',
      render: (row: AuditLogRow) => (
        <span className={row.actor_email ? 'text-admin-text' : 'text-admin-faint italic'}>
          {row.actor_email ?? 'sistema'}
        </span>
      ),
    },
    {
      key: 'action',
      label: 'Ação',
      width: '130px',
      render: (row: AuditLogRow) => ACTION_LABELS[row.action] ?? row.action,
    },
    {
      key: 'entity_type',
      label: 'Entidade',
      width: '110px',
      render: (row: AuditLogRow) => (
        <span className="text-admin-muted">{ENTITY_LABELS[row.entity_type] ?? row.entity_type}</span>
      ),
    },
    {
      key: 'summary',
      label: 'Resumo',
      width: '2fr',
      render: (row: AuditLogRow) => (
        <span className="text-admin-text">{row.summary ?? '—'}</span>
      ),
    },
    {
      key: 'details',
      label: '',
      width: '90px',
      render: (row: AuditLogRow) => (
        <button
          onClick={() => setExpandedId(prev => (prev === row.id ? null : row.id))}
          className={cn(
            'px-2 py-1 rounded text-[11px] font-medium border transition-colors',
            expandedId === row.id
              ? 'bg-admin-accent text-admin-accent-contrast border-admin-accent'
              : 'border-admin-line text-admin-muted hover:text-admin-text hover:bg-admin-raised',
          )}
        >
          Detalhes
        </button>
      ),
    },
  ]

  const expandedRow = expandedId ? rows.find(r => r.id === expandedId) : null

  return (
    <div className="space-y-4 max-w-[1400px]">
      <AdminPageHeader
        title="Auditoria"
        subtitle="Registro de ações administrativas."
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={days}
              onChange={e => { setDays(Number(e.target.value)); resetPage() }}
              className={selectCls}
            >
              {PERIOD_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <select
              value={action}
              onChange={e => { setAction(e.target.value); resetPage() }}
              className={selectCls}
            >
              {ACTION_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <select
              value={entityType}
              onChange={e => { setEntityType(e.target.value); resetPage() }}
              className={selectCls}
            >
              {ENTITY_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <input
              type="text"
              value={search}
              onChange={e => { setSearch(e.target.value); resetPage() }}
              placeholder="Buscar…"
              className="bg-admin-surface border border-admin-line-strong rounded-md px-3 py-1.5 text-xs text-admin-text placeholder:text-admin-muted focus:outline-none focus:ring-1 focus:ring-admin-accent/50"
            />
          </div>
        }
      />

      {isError ? (
        <p className="text-sm text-admin-destructive">Erro ao carregar o registro de auditoria.</p>
      ) : !isLoading && rows.length === 0 ? (
        <AdminEmptyState
          icon={ScrollText}
          title="Nenhum registro"
          description="Nenhuma ação no período/filtros selecionados."
        />
      ) : (
        <>
          <AdminDataTable<AuditLogRow>
            columns={columns}
            data={rows}
            isLoading={isLoading}
            compact
            emptyMessage="Nenhum registro encontrado."
          />

          {expandedRow && (
            <div className="bg-admin-surface rounded-lg border border-admin-line p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold text-admin-muted uppercase tracking-wide">
                  Metadados — {ACTION_LABELS[expandedRow.action] ?? expandedRow.action}
                </p>
                <button
                  onClick={() => setExpandedId(null)}
                  className="text-admin-muted hover:text-admin-text text-xs"
                >
                  Fechar ✕
                </button>
              </div>
              <pre className="text-[11px] bg-admin-raised rounded p-2 overflow-auto">
                {JSON.stringify(expandedRow.metadata, null, 2)}
              </pre>
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-admin-muted">
                {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, total)} de {formatInt(total)}
              </p>
              <div className="flex gap-1">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="w-7 h-7 rounded border border-admin-line text-xs text-admin-muted disabled:opacity-30 hover:bg-admin-raised transition-colors"
                >‹</button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="w-7 h-7 rounded border border-admin-line text-xs text-admin-muted disabled:opacity-30 hover:bg-admin-raised transition-colors"
                >›</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default function AdminAuditoria() {
  return (
    <AdminCapabilityGate capability="audit.view">
      <AdminAuditoriaContent />
    </AdminCapabilityGate>
  )
}
