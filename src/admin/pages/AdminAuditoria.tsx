import { AdminCapabilityGate } from '@/admin/components/AdminCapabilityGate'
import { useState, useCallback, type ReactNode } from 'react'
import { ScrollText } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AdminPageHeader } from '@/admin/components/ui/AdminPageHeader'
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

// Ações que removem dados de forma definitiva — destacadas em vermelho no feed.
const DESTRUCTIVE_ACTIONS = new Set([
  'delete_attempt',
  'revoke_role',
  'DELETE',
  'cancel_attempt',
])

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

/** Nome legível a partir do e-mail do autor (parte antes do @, capitalizada). */
function actorName(email: string | null): string {
  if (!email) return 'Sistema'
  const local = email.split('@')[0]
  if (!local) return email
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

/** Iniciais (até 2) do autor para o avatar. */
function actorInitials(email: string | null): string {
  if (!email) return 'SY'
  const name = actorName(email)
  return (
    name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map(p => p[0])
      .join('')
      .toUpperCase() || 'A'
  )
}

/** Timestamp curto em pt-BR ("hoje 14:02", "ontem 18:20" ou "14/06 09:10"). */
function relativeStamp(iso: string): string {
  const d = new Date(iso)
  const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const now = new Date()
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const dayMs = 86_400_000
  const diffDays = Math.round((startOf(now) - startOf(d)) / dayMs)
  if (diffDays === 0) return `hoje ${time}`
  if (diffDays === 1) return `ontem ${time}`
  return `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} ${time}`
}

/**
 * Monta a frase legível do evento. Prioriza o `summary` vindo do servidor;
 * quando não há, cai num texto a partir de ação + entidade.
 */
function eventPhrase(row: AuditLogRow): { lead: string; rest: ReactNode } {
  const lead = actorName(row.actor_email)
  const destructive = DESTRUCTIVE_ACTIONS.has(row.action)

  if (row.summary) {
    return {
      lead,
      rest: destructive ? (
        <span className="font-semibold text-admin-destructive">{row.summary}</span>
      ) : (
        <span>{row.summary}</span>
      ),
    }
  }

  const actionLabel = (ACTION_LABELS[row.action] ?? row.action).toLowerCase()
  const entityLabel = (ENTITY_LABELS[row.entity_type] ?? row.entity_type).toLowerCase()
  return {
    lead,
    rest: (
      <span className={destructive ? 'font-semibold text-admin-destructive' : undefined}>
        registrou {actionLabel} em {entityLabel}
      </span>
    ),
  }
}

function SkeletonFeed() {
  return (
    <div className="divide-y divide-admin-line-subtle rounded-xl border border-admin-line bg-admin-surface">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-start gap-3 p-3.5 motion-safe:animate-pulse">
          <div className="h-[30px] w-[30px] shrink-0 rounded-lg bg-admin-raised" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-3/4 rounded bg-admin-raised" />
            <div className="h-2.5 w-24 rounded bg-admin-raised" />
          </div>
        </div>
      ))}
    </div>
  )
}

function AuditFeedRow({
  row,
  expanded,
  onToggle,
}: {
  row: AuditLogRow
  expanded: boolean
  onToggle: () => void
}) {
  const destructive = DESTRUCTIVE_ACTIONS.has(row.action)
  const { lead, rest } = eventPhrase(row)
  const isSystem = !row.actor_email
  const hasMetadata = row.metadata && Object.keys(row.metadata).length > 0

  return (
    <div className="px-3.5 py-3">
      <div className="flex items-start gap-3">
        <span
          className={cn(
            'flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg text-[11px] font-bold',
            destructive
              ? 'bg-admin-destructive/10 text-admin-destructive'
              : isSystem
                ? 'bg-admin-raised text-admin-muted'
                : 'bg-admin-accent-soft text-admin-accent',
          )}
          aria-hidden
        >
          {actorInitials(row.actor_email)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] leading-snug text-admin-text">
            <span className={cn('font-semibold', isSystem && 'text-admin-muted')}>{lead}</span>{' '}
            {rest}
          </p>
          <div className="mt-0.5 flex items-center gap-2">
            <time className="font-mono text-[11px] text-admin-faint" dateTime={row.created_at}>
              {relativeStamp(row.created_at)}
            </time>
            {hasMetadata && (
              <button
                type="button"
                onClick={onToggle}
                aria-expanded={expanded}
                className="text-[11px] text-admin-muted underline-offset-2 transition-colors hover:text-admin-text hover:underline"
              >
                {expanded ? 'Ocultar detalhes' : 'Ver detalhes'}
              </button>
            )}
          </div>
          {expanded && hasMetadata && (
            <pre className="mt-2 overflow-auto rounded-md border border-admin-line bg-admin-raised p-2.5 font-mono text-[11px] leading-relaxed text-admin-muted">
              {JSON.stringify(row.metadata, null, 2)}
            </pre>
          )}
        </div>
      </div>
    </div>
  )
}

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

  return (
    <div className="max-w-[1100px] space-y-4">
      <AdminPageHeader
        title="Auditoria"
        subtitle="Quem fez o quê no painel, e quando. Cada ação sensível fica registrada."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={days}
              onChange={e => { setDays(Number(e.target.value)); resetPage() }}
              className={selectCls}
              aria-label="Período"
            >
              {PERIOD_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <select
              value={action}
              onChange={e => { setAction(e.target.value); resetPage() }}
              className={selectCls}
              aria-label="Ação"
            >
              {ACTION_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <select
              value={entityType}
              onChange={e => { setEntityType(e.target.value); resetPage() }}
              className={selectCls}
              aria-label="Entidade"
            >
              {ENTITY_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <input
              type="text"
              value={search}
              onChange={e => { setSearch(e.target.value); resetPage() }}
              placeholder="Buscar por autor ou resumo"
              className="rounded-md border border-admin-line-strong bg-admin-surface px-3 py-1.5 text-xs text-admin-text placeholder:text-admin-faint focus:outline-none focus:ring-1 focus:ring-admin-accent/50"
              aria-label="Buscar no registro"
            />
          </div>
        }
      />

      {isError ? (
        <AdminEmptyState
          icon={ScrollText}
          tone="error"
          eyebrow="Erro"
          title="Não foi possível carregar o registro"
          description="Houve uma falha ao buscar a auditoria. Tente novamente em instantes."
        />
      ) : isLoading ? (
        <SkeletonFeed />
      ) : rows.length === 0 ? (
        <AdminEmptyState
          icon={ScrollText}
          eyebrow="Vazio"
          title="Nenhum registro no período"
          description="Nenhuma ação foi registrada com o período e os filtros selecionados."
        />
      ) : (
        <>
          <div className="divide-y divide-admin-line-subtle overflow-hidden rounded-xl border border-admin-line bg-admin-surface shadow-sm shadow-black/[0.04] dark:shadow-black/30">
            {rows.map(row => (
              <AuditFeedRow
                key={row.id}
                row={row}
                expanded={expandedId === row.id}
                onToggle={() => setExpandedId(prev => (prev === row.id ? null : row.id))}
              />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-admin-muted">
                {((page - 1) * PAGE_SIZE) + 1} a {Math.min(page * PAGE_SIZE, total)} de {formatInt(total)}
              </p>
              <div className="flex gap-1">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  aria-label="Página anterior"
                  className="h-7 w-7 rounded border border-admin-line text-xs text-admin-muted transition-colors hover:bg-admin-raised disabled:opacity-30"
                >‹</button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  aria-label="Próxima página"
                  className="h-7 w-7 rounded border border-admin-line text-xs text-admin-muted transition-colors hover:bg-admin-raised disabled:opacity-30"
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
