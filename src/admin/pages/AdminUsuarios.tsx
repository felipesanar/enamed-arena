import { AdminCapabilityGate } from '@/admin/components/AdminCapabilityGate'
import { useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Users, Search, Download, MoreVertical, Eye, RefreshCw, Trash2, ArrowRightLeft,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  useAdminUserList,
  useAdminResetUserOnboarding,
  useAdminDeleteUser,
} from '@/admin/hooks/useAdminUsuarios'
import { useAdminCan } from '@/admin/contexts/AdminAccessContext'
import { adminApi } from '@/admin/services/adminApi'
import { AdminPageHeader } from '@/admin/components/ui/AdminPageHeader'
import { AdminStatCard } from '@/admin/components/ui/AdminStatCard'
import { AdminBadge } from '@/admin/components/ui/AdminBadge'
import { AdminEmptyState } from '@/admin/components/ui/AdminEmptyState'
import { AdminConfirmDialog } from '@/admin/components/ui/AdminConfirmDialog'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { getInitials, formatInt } from '@/admin/lib/format'
import { useDebounce } from '@/hooks/useDebounce'
import { logger } from '@/lib/logger'
import { toast } from '@/hooks/use-toast'
import type { UserListRow } from '@/admin/types'

const PAGE_SIZE = 25

const SEGMENTS = [
  { label: 'Todos', value: 'all' },
  { label: 'Visitante', value: 'guest' },
  { label: 'SanarFlix', value: 'standard' },
  { label: 'PRO', value: 'pro' },
] as const

const GRID = '2.2fr 120px 110px 1fr 120px 44px'

/** Avatar de iniciais com cor estável por usuário (paleta neutra + accent). */
const AVATAR_TONES = [
  'bg-admin-accent text-admin-accent-contrast',
  'bg-admin-info/15 text-admin-info',
  'bg-admin-success/15 text-admin-success',
  'bg-admin-raised text-admin-muted',
]
function avatarTone(seed: string): string {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return AVATAR_TONES[h % AVATAR_TONES.length]
}

function formatDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

function AdminUsuariosContent() {
  const navigate = useNavigate()
  const canManage = useAdminCan('users.manage')

  const [search, setSearch] = useState('')
  const [segment, setSegment] = useState('all')
  const [page, setPage] = useState(1)
  const debouncedSearch = useDebounce(search, 300)

  const { data, isLoading, isError, refetch } = useAdminUserList(debouncedSearch, segment, page)
  const users = useMemo(() => data ?? [], [data])
  const totalCount = users[0]?.total_count ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const hasSearch = debouncedSearch.trim().length > 0

  // Cards de resumo: reaproveita o mesmo hook por segmento (sem RPC novo).
  // Sempre sem busca, para refletir a base inteira independente do filtro ativo.
  const totalAll = useAdminUserList('', 'all', 1)
  const totalPro = useAdminUserList('', 'pro', 1)
  const totalStandard = useAdminUserList('', 'standard', 1)
  const cardTotal = totalAll.data?.[0]?.total_count
  const cardPro = totalPro.data?.[0]?.total_count
  const cardStandard = totalStandard.data?.[0]?.total_count

  // "Novos (7 dias)": a lista vem ordenada do cadastro mais recente para o mais
  // antigo, então os mais novos estão sempre no topo da primeira página. Contamos
  // quem entrou na última semana entre as linhas já carregadas. Sem um RPC próprio
  // para isso, se a página inteira couber dentro do recorte o total real pode ser
  // maior — nesse caso mostramos "+N+" deixando claro que é um piso.
  const recent = useMemo(() => {
    const rows = totalAll.data ?? []
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000
    const count = rows.filter(r => new Date(r.created_at).getTime() >= cutoff).length
    const isFloor = rows.length > 0 && count === rows.length && count < (cardTotal ?? count)
    return { count, isFloor }
  }, [totalAll.data, cardTotal])

  // Ações de linha
  const resetOnboarding = useAdminResetUserOnboarding()
  const deleteUser = useAdminDeleteUser()
  const [toDelete, setToDelete] = useState<UserListRow | null>(null)

  const handleSegment = useCallback((val: string) => {
    setSegment(val)
    setPage(1)
  }, [])

  const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value)
    setPage(1)
  }, [])

  const clearSearch = useCallback(() => {
    setSearch('')
    setSegment('all')
    setPage(1)
  }, [])

  const goToDetail = useCallback((userId: string) => {
    navigate(`/admin/usuarios/${userId}`)
  }, [navigate])

  const handleResetOnboarding = useCallback(async (user: UserListRow) => {
    try {
      await resetOnboarding.mutateAsync(user.user_id)
      toast({ title: 'Tour reaberto', description: `${user.full_name ?? user.email} vai ver o tour de boas-vindas de novo.` })
    } catch (err) {
      logger.error('[AdminUsuarios] Erro ao reabrir tour:', err)
      toast({ title: 'Não foi possível reabrir o tour', description: 'Tente de novo em instantes.', variant: 'destructive' })
    }
  }, [resetOnboarding])

  const handleConfirmDelete = useCallback(async () => {
    if (!toDelete) return
    const name = toDelete.full_name ?? toDelete.email
    try {
      await deleteUser.mutateAsync(toDelete.user_id)
      toast({ title: 'Conta excluída', description: `A conta de ${name} foi removida.` })
      setToDelete(null)
    } catch (err) {
      logger.error('[AdminUsuarios] Erro ao excluir conta:', err)
      toast({ title: 'Não foi possível excluir a conta', description: 'Tente de novo em instantes.', variant: 'destructive' })
    }
  }, [toDelete, deleteUser])

  const handleExport = useCallback(async () => {
    try {
      toast({ title: 'Preparando a lista', description: 'Buscando os usuários com os filtros atuais.' })
      const all = await adminApi.listUsers(debouncedSearch, segment, 10000, 0)
      if (!all.length) {
        toast({ title: 'Nada para exportar', description: 'Nenhum usuário com os filtros atuais.', variant: 'destructive' })
        return
      }
      const header = 'Nome,E-mail,Segmento,Especialidade,Cadastro,Desempenho medio,Tentativas'
      const rows = all.map(u => {
        const name = (u.full_name ?? '').replace(/"/g, '""')
        const email = (u.email ?? '').replace(/"/g, '""')
        const spec = (u.specialty ?? '').replace(/"/g, '""')
        return `"${name}","${email}","${u.segment}","${spec}","${formatDateShort(u.created_at)}","${u.avg_score.toFixed(1)}%","${u.total_attempts}"`
      })
      const blob = new Blob([header + '\n' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `usuarios_${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
      toast({ title: 'Lista exportada', description: `${all.length} usuários no arquivo.` })
    } catch (err) {
      logger.error('[AdminUsuarios] Erro ao exportar lista:', err)
      toast({ title: 'Não foi possível exportar', description: 'Tente de novo em instantes.', variant: 'destructive' })
    }
  }, [debouncedSearch, segment])

  return (
    <div className="max-w-[1400px] space-y-4">
      <AdminPageHeader
        title="Usuários"
        subtitle="Encontre uma pessoa para ver o perfil, o desempenho e gerenciar o acesso."
        actions={
          <button
            type="button"
            onClick={handleExport}
            className={cn(
              'inline-flex items-center gap-2 rounded-lg border border-admin-line-strong bg-admin-surface',
              'px-3.5 py-2 text-[13px] font-semibold text-admin-text',
              'transition-colors hover:bg-admin-raised',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-admin-accent/25',
            )}
          >
            <Download className="h-3.5 w-3.5 text-admin-muted" aria-hidden />
            Exportar lista
          </button>
        }
      />

      {/* Cards de resumo */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <AdminStatCard
          label="Total"
          value={cardTotal !== undefined ? formatInt(cardTotal) : '—'}
          isLoading={totalAll.isLoading}
        />
        <AdminStatCard
          label="Aluno PRO"
          value={cardPro !== undefined ? formatInt(cardPro) : '—'}
          valueTone="accent"
          isLoading={totalPro.isLoading}
        />
        <AdminStatCard
          label="SanarFlix"
          value={cardStandard !== undefined ? formatInt(cardStandard) : '—'}
          isLoading={totalStandard.isLoading}
        />
        <AdminStatCard
          label="Novos (7 dias)"
          value={`+${formatInt(recent.count)}${recent.isFloor ? '+' : ''}`}
          valueTone="success"
          isLoading={totalAll.isLoading}
        />
      </div>

      {/* Toolbar: busca + segmentado + contador */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative w-full max-w-[340px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-admin-faint" aria-hidden />
          <input
            type="text"
            value={search}
            onChange={handleSearch}
            placeholder="Buscar por nome ou e-mail"
            aria-label="Buscar por nome ou e-mail"
            className={cn(
              'w-full rounded-lg border border-admin-line-strong bg-admin-surface py-2 pl-9 pr-3',
              'text-[13px] text-admin-text placeholder:text-admin-faint',
              'transition-shadow focus-visible:outline-none focus-visible:border-admin-accent',
              'focus-visible:ring-[3px] focus-visible:ring-admin-accent/15',
            )}
          />
        </div>

        <div
          role="group"
          aria-label="Filtrar por segmento"
          className="inline-flex rounded-lg border border-admin-line bg-admin-raised p-[3px]"
        >
          {SEGMENTS.map(s => {
            const active = segment === s.value
            return (
              <button
                key={s.value}
                type="button"
                aria-pressed={active}
                onClick={() => handleSegment(s.value)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-admin-accent/25',
                  active
                    ? 'bg-admin-surface text-admin-text shadow-sm shadow-black/[0.06]'
                    : 'text-admin-muted hover:text-admin-text',
                )}
              >
                {s.label}
              </button>
            )
          })}
        </div>

        <span className="ml-auto text-[12px] tabular-nums text-admin-faint">
          {formatInt(totalCount)} {totalCount === 1 ? 'pessoa' : 'pessoas'}
        </span>
      </div>

      {/* Tabela */}
      <div className="overflow-hidden rounded-xl border border-admin-line bg-admin-surface">
        <div className="overflow-x-auto">
          <div className="min-w-[760px]">
            {/* Cabeçalho */}
            <div
              className="grid border-b border-admin-line bg-admin-bg"
              style={{ gridTemplateColumns: GRID }}
            >
              {['Usuário', 'Segmento', 'Cadastro', 'Desempenho médio', 'Tentativas', ''].map((h, i) => (
                <div
                  key={i}
                  className="px-4 py-3 text-[10.5px] font-bold uppercase leading-none tracking-[0.06em] text-admin-faint"
                >
                  {h}
                </div>
              ))}
            </div>

            {/* Corpo */}
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  data-skeleton-row=""
                  className={cn(
                    'grid items-center border-b border-admin-line-subtle last:border-0',
                    i % 2 === 1 && 'bg-admin-bg',
                  )}
                  style={{ gridTemplateColumns: GRID }}
                >
                  <div className="flex items-center gap-3 px-4 py-3">
                    <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-[9px] bg-admin-raised">
                      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.4s_infinite] bg-gradient-to-r from-transparent via-admin-surface/70 to-transparent" />
                    </div>
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 w-1/2 rounded bg-admin-raised" />
                      <div className="h-2.5 w-2/3 rounded bg-admin-raised/70" />
                    </div>
                  </div>
                  {[1, 2, 3, 4, 5].map(c => (
                    <div key={c} className="px-4 py-3">
                      <div className="h-3 w-3/4 rounded bg-admin-raised" />
                    </div>
                  ))}
                </div>
              ))
            ) : isError ? (
              <AdminEmptyState
                tone="error"
                eyebrow="Erro"
                title="Não foi possível carregar os usuários"
                description="Verifique a conexão e tente de novo."
                action={
                  <button
                    type="button"
                    onClick={() => refetch()}
                    className="rounded-md border border-admin-line bg-admin-surface px-4 py-2 text-[12.5px] font-semibold text-admin-text transition-colors hover:bg-admin-raised"
                  >
                    Tentar de novo
                  </button>
                }
              />
            ) : users.length === 0 ? (
              hasSearch ? (
                <AdminEmptyState
                  icon={Search}
                  title="Ninguém encontrado"
                  description="Nenhuma pessoa corresponde à busca atual. Tente outro nome ou e-mail."
                  action={
                    <button
                      type="button"
                      onClick={clearSearch}
                      className="rounded-md border border-admin-line bg-admin-surface px-4 py-2 text-[12.5px] font-semibold text-admin-text transition-colors hover:bg-admin-raised"
                    >
                      Limpar busca
                    </button>
                  }
                />
              ) : (
                <AdminEmptyState
                  icon={Users}
                  title="Ninguém por aqui ainda"
                  description="Quando alguém se cadastrar, vai aparecer nesta lista."
                />
              )
            ) : (
              users.map((user: UserListRow, i: number) => {
                const score = Math.max(0, Math.min(100, user.avg_score))
                const hasAttempts = user.total_attempts > 0
                return (
                  <div
                    key={user.user_id}
                    role="button"
                    tabIndex={0}
                    onClick={() => goToDetail(user.user_id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goToDetail(user.user_id) }
                    }}
                    className={cn(
                      'group grid cursor-pointer items-center border-b border-admin-line-subtle last:border-0',
                      'transition-colors hover:bg-admin-raised focus-within:bg-admin-raised/70',
                      'focus-visible:outline-none',
                      i % 2 === 1 && 'bg-admin-bg',
                    )}
                    style={{ gridTemplateColumns: GRID }}
                  >
                    {/* Usuário */}
                    <div className="flex min-w-0 items-center gap-3 px-4 py-3">
                      <span
                        className={cn(
                          'flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] text-[12px] font-bold',
                          avatarTone(user.user_id),
                        )}
                        aria-hidden
                      >
                        {getInitials(user.full_name)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-semibold text-admin-text">
                          {user.full_name ?? 'Sem nome'}
                        </p>
                        <p className="truncate text-[11.5px] text-admin-faint">{user.email}</p>
                      </div>
                    </div>

                    {/* Segmento */}
                    <div className="px-4 py-3">
                      <AdminBadge kind="segment" value={user.segment} />
                    </div>

                    {/* Cadastro */}
                    <div className="px-4 py-3 font-mono text-[12px] tabular-nums text-admin-muted">
                      {formatDateShort(user.created_at)}
                    </div>

                    {/* Desempenho médio */}
                    <div className="px-4 py-3">
                      {hasAttempts ? (
                        <div className="flex items-center gap-2.5">
                          <div className="h-[5px] w-full max-w-[64px] overflow-hidden rounded-full bg-admin-raised">
                            <div
                              className="h-full rounded-full bg-admin-accent"
                              style={{ width: `${score}%` }}
                            />
                          </div>
                          <span className="text-[12.5px] font-semibold tabular-nums text-admin-text">
                            {score.toFixed(1).replace('.', ',')}%
                          </span>
                        </div>
                      ) : (
                        <span className="text-[12px] text-admin-faint">sem tentativas</span>
                      )}
                    </div>

                    {/* Tentativas */}
                    <div
                      className={cn(
                        'px-4 py-3 text-[12.5px] tabular-nums',
                        hasAttempts ? 'text-admin-text' : 'text-admin-faint',
                      )}
                    >
                      {user.total_attempts}
                    </div>

                    {/* Menu de ações */}
                    <div className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            aria-label={`Ações para ${user.full_name ?? user.email}`}
                            className={cn(
                              'flex h-7 w-7 items-center justify-center rounded-md text-admin-faint',
                              'transition-colors hover:bg-admin-raised hover:text-admin-text',
                              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-admin-accent/25',
                              'data-[state=open]:bg-admin-raised data-[state=open]:text-admin-text',
                            )}
                          >
                            <MoreVertical className="h-4 w-4" aria-hidden />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="w-[200px] rounded-xl border-admin-line bg-admin-surface p-1.5 text-admin-text shadow-[0_4px_14px_rgba(26,23,21,0.1)]"
                        >
                          <DropdownMenuItem
                            onClick={() => goToDetail(user.user_id)}
                            className="gap-2.5 rounded-lg px-2.5 py-2 text-[13px] text-admin-text focus:bg-admin-raised focus:text-admin-text"
                          >
                            <Eye className="h-4 w-4 text-admin-muted" aria-hidden />
                            Ver perfil
                          </DropdownMenuItem>
                          {canManage && (
                            <>
                              <DropdownMenuItem
                                onClick={() => goToDetail(user.user_id)}
                                className="gap-2.5 rounded-lg px-2.5 py-2 text-[13px] text-admin-text focus:bg-admin-raised focus:text-admin-text"
                              >
                                <ArrowRightLeft className="h-4 w-4 text-admin-muted" aria-hidden />
                                Mudar segmento
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleResetOnboarding(user)}
                                disabled={resetOnboarding.isPending}
                                className="gap-2.5 rounded-lg px-2.5 py-2 text-[13px] text-admin-text focus:bg-admin-raised focus:text-admin-text"
                              >
                                <RefreshCw className="h-4 w-4 text-admin-muted" aria-hidden />
                                Reabrir tour
                              </DropdownMenuItem>
                              <DropdownMenuSeparator className="my-1 bg-admin-line-subtle" />
                              <DropdownMenuItem
                                onClick={() => setToDelete(user)}
                                className="gap-2.5 rounded-lg px-2.5 py-2 text-[13px] text-admin-destructive focus:bg-admin-destructive/10 focus:text-admin-destructive"
                              >
                                <Trash2 className="h-4 w-4" aria-hidden />
                                Excluir conta
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                )
              })
            )}

            {/* Rodapé: contagem + paginação */}
            {!isLoading && !isError && users.length > 0 && (
              <div className="flex items-center justify-between border-t border-admin-line bg-admin-bg px-4 py-2.5">
                <span className="text-[11.5px] tabular-nums text-admin-faint">
                  {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, totalCount)} de {formatInt(totalCount)}
                </span>
                {totalPages > 1 && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      aria-label="Página anterior"
                      className="flex h-[26px] w-[26px] items-center justify-center rounded-md border border-admin-line text-[13px] text-admin-muted transition-colors hover:bg-admin-raised disabled:opacity-30"
                    >
                      ‹
                    </button>
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      const start = Math.max(1, Math.min(page - 2, totalPages - 4))
                      const p = start + i
                      return (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setPage(p)}
                          aria-label={`Página ${p}`}
                          aria-current={page === p ? 'page' : undefined}
                          className={cn(
                            'flex h-[26px] w-[26px] items-center justify-center rounded-md border text-[12px] font-medium tabular-nums transition-colors',
                            page === p
                              ? 'border-admin-accent bg-admin-accent text-admin-accent-contrast'
                              : 'border-admin-line text-admin-muted hover:bg-admin-raised',
                          )}
                        >
                          {p}
                        </button>
                      )
                    })}
                    <button
                      type="button"
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      aria-label="Próxima página"
                      className="flex h-[26px] w-[26px] items-center justify-center rounded-md border border-admin-line text-[13px] text-admin-muted transition-colors hover:bg-admin-raised disabled:opacity-30"
                    >
                      ›
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirmação de exclusão (digitar EXCLUIR) */}
      <AdminConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => { if (!open) setToDelete(null) }}
        title={toDelete ? `Excluir conta de ${toDelete.full_name ?? toDelete.email}` : 'Excluir conta'}
        description={
          toDelete
            ? `Isto apaga a pessoa e as ${toDelete.total_attempts} tentativas dela. Não dá para desfazer.`
            : ''
        }
        confirmText="EXCLUIR"
        confirmLabel="Excluir conta"
        destructive
        loading={deleteUser.isPending}
        onConfirm={handleConfirmDelete}
      />
    </div>
  )
}

export default function AdminUsuarios() {
  return (
    <AdminCapabilityGate capability="users.view">
      <AdminUsuariosContent />
    </AdminCapabilityGate>
  )
}
