import { AdminCapabilityGate } from '@/admin/components/AdminCapabilityGate'
import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ChevronLeft, ChevronDown, Download, Mail, Calendar, Trash2,
  RotateCcw, ShieldOff, AlertTriangle, Inbox,
} from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { logger } from '@/lib/logger'
import {
  useAdminUser,
  useAdminUserAttempts,
  useAdminSetUserSegment,
  useAdminSetUserRole,
  useAdminResetUserOnboarding,
  useAdminDeleteUser,
} from '@/admin/hooks/useAdminUsuarios'
import { AdminStatCard } from '@/admin/components/ui/AdminStatCard'
import { AdminBadge } from '@/admin/components/ui/AdminBadge'
import { AdminConfirmDialog } from '@/admin/components/ui/AdminConfirmDialog'
import { AdminEmptyState } from '@/admin/components/ui/AdminEmptyState'
import { AdminSegmentPopover } from '@/admin/components/AdminSegmentPopover'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { useAdminCan } from '@/admin/contexts/AdminAccessContext'
import { ROLE_META } from '@/admin/lib/constants'
import { getInitials } from '@/admin/lib/format'
import { cn } from '@/lib/utils'
import type { UserAttemptRow, UserDetail } from '@/admin/types'

type DetailTab = 'historico' | 'acesso'

/** "há X dias / hoje / ontem" a partir de uma data ISO. */
function formatRelativeDays(iso: string | null): string {
  if (!iso) return 'sem registro'
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return 'sem registro'
  const days = Math.floor((Date.now() - then) / 86_400_000)
  if (days <= 0) return 'hoje'
  if (days === 1) return 'ontem'
  if (days < 30) return `há ${days} dias`
  const months = Math.floor(days / 30)
  if (months === 1) return 'há 1 mês'
  if (months < 12) return `há ${months} meses`
  const years = Math.floor(months / 12)
  return years === 1 ? 'há 1 ano' : `há ${years} anos`
}

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

function AdminUsuarioDetailContent() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [tab, setTab] = useState<DetailTab>('historico')
  const canManageRoles = useAdminCan('roles.manage')

  const { data: user, isLoading, isError, refetch } = useAdminUser(id!)
  const { data: attempts = [] } = useAdminUserAttempts(id!)
  const setSegment = useAdminSetUserSegment()
  const setRole = useAdminSetUserRole()
  const resetOnboarding = useAdminResetUserOnboarding()
  const deleteUser = useAdminDeleteUser()

  const handleSegmentChange = async (segment: 'guest' | 'standard' | 'pro') => {
    if (segment === user?.segment) return
    try {
      await setSegment.mutateAsync({ userId: id!, segment })
      toast({ title: 'Segmento atualizado' })
    } catch (error) {
      logger.error('[AdminUsuarioDetail] Erro ao mudar segmento:', error)
      toast({ title: 'Não deu para mudar o segmento', description: 'Tente de novo em instantes.', variant: 'destructive' })
    }
  }

  const handleRoleChange = (role: string, grant: boolean) => {
    setRole.mutate({ userId: id!, role, grant }, {
      onSuccess: () => {
        toast({ title: grant ? 'Acesso concedido' : 'Acesso removido' })
      },
      onError: (error: Error) => {
        const msg = String(error?.message ?? '')
        logger.error('[AdminUsuarioDetail] Erro ao alterar acesso:', error)
        if (msg.includes('cannot_revoke_own_admin')) {
          toast({
            title: 'Ação bloqueada',
            description: 'Você não pode remover o seu próprio acesso de administrador.',
            variant: 'destructive',
          })
        } else if (msg.includes('cannot_remove_last_admin')) {
          toast({
            title: 'Ação bloqueada',
            description: 'Não dá para remover o último administrador do painel. Promova outra pessoa antes.',
            variant: 'destructive',
          })
        } else {
          toast({ title: 'Não deu para mudar o acesso', description: 'Tente de novo em instantes.', variant: 'destructive' })
        }
      },
    })
  }

  const handleResetOnboarding = async () => {
    try {
      await resetOnboarding.mutateAsync(id!)
      toast({ title: 'Tour reaberto', description: 'A pessoa verá o tour inicial no próximo acesso.' })
    } catch (error) {
      logger.error('[AdminUsuarioDetail] Erro ao reabrir tour:', error)
      toast({ title: 'Não deu para reabrir o tour', description: 'Tente de novo em instantes.', variant: 'destructive' })
    }
  }

  const handleDelete = async () => {
    try {
      await deleteUser.mutateAsync(id!)
      setShowDeleteModal(false)
      toast({ title: 'Conta excluída', description: `${user?.full_name ?? 'A pessoa'} foi removida. Você voltou para a lista.` })
      navigate('/admin/usuarios')
    } catch (error) {
      logger.error('[AdminUsuarioDetail] Erro ao excluir conta:', error)
      toast({ title: 'Não deu para excluir a conta', description: 'Tente de novo em instantes.', variant: 'destructive' })
    }
  }

  const handleExportCsv = () => {
    if (!attempts.length) {
      toast({ title: 'Nada para exportar', description: 'Esta pessoa ainda não tem tentativas.' })
      return
    }
    const rows = [
      ['Simulado', 'Sequência', 'Data', 'Status', 'Nota (%)', 'Posição'],
      ...attempts.map((a: UserAttemptRow) => [
        a.simulado_title,
        a.sequence_number,
        new Date(a.created_at).toLocaleDateString('pt-BR'),
        a.status,
        a.score_percentage ?? '',
        a.score_percentage != null ? a.ranking_position : '',
      ]),
    ]
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `usuario-${id}-tentativas.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Carregando (skeleton com shimmer) ──
  if (isLoading) {
    return <DetailSkeleton />
  }

  // ── Erro de carregamento ──
  if (isError || !user) {
    return (
      <div className="max-w-[1200px]">
        <BackLink />
        <div className="rounded-xl border border-admin-line/80 bg-admin-surface">
          <AdminEmptyState
            icon={ShieldOff}
            eyebrow="Erro"
            title="Não deu para carregar esta pessoa"
            description="Pode ser uma falha de conexão ou a conta não existe mais. Tente de novo."
            tone="error"
            action={
              <button
                onClick={() => refetch()}
                className="rounded-md border border-admin-line bg-admin-surface px-3 py-1.5 text-[12.5px] font-semibold text-admin-text transition-colors hover:bg-admin-raised"
              >
                Tentar de novo
              </button>
            }
          />
        </div>
      </div>
    )
  }

  const name = user.full_name ?? user.email
  const bestPosition = attempts
    .filter((a: UserAttemptRow) => a.score_percentage != null && a.ranking_position > 0)
    .reduce<number | null>((best, a) => (best == null || a.ranking_position < best ? a.ranking_position : best), null)

  return (
    <div className="max-w-[1200px]">
      <BackLink />

      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <span
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-admin-accent text-xl font-bold text-admin-accent-contrast"
            aria-hidden
          >
            {getInitials(user.full_name)}
          </span>
          <div className="min-w-0">
            <div className="mb-1.5 flex flex-wrap items-center gap-2.5">
              <h1 className="text-[22px] font-extrabold leading-tight tracking-[-0.02em] text-admin-text">{name}</h1>
              <AdminBadge kind="segment" value={user.segment} />
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-admin-muted">
              <span className="inline-flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-admin-faint" aria-hidden />
                {user.email}
              </span>
              <span className="inline-flex items-center gap-1.5 font-mono">
                <Calendar className="h-3.5 w-3.5 text-admin-faint" aria-hidden />
                desde {formatShortDate(user.created_at)}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 rounded-md border border-admin-line-strong bg-admin-surface px-3.5 py-2 text-[13px] font-semibold text-admin-text transition-colors hover:bg-admin-raised"
          >
            <Download className="h-3.5 w-3.5 text-admin-muted" aria-hidden />
            Exportar tentativas
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="inline-flex items-center gap-1.5 rounded-md border border-admin-line-strong bg-admin-surface px-3 py-2 text-[13px] font-semibold text-admin-text transition-colors hover:bg-admin-raised">
                Ações
                <ChevronDown className="h-3.5 w-3.5 text-admin-muted" aria-hidden />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-56 rounded-xl border-admin-line bg-admin-surface p-1.5 text-admin-text shadow-[0_4px_14px_rgba(26,23,21,0.1)] dark:shadow-black/50"
            >
              <DropdownMenuItem
                onSelect={() => setTab('acesso')}
                className="cursor-pointer gap-2 rounded-lg px-2.5 py-2 text-[13px] text-admin-text focus:bg-admin-raised"
              >
                <RotateCcw className="h-4 w-4 text-admin-muted" aria-hidden />
                Acesso e perfil
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={handleExportCsv}
                className="cursor-pointer gap-2 rounded-lg px-2.5 py-2 text-[13px] text-admin-text focus:bg-admin-raised"
              >
                <Download className="h-4 w-4 text-admin-muted" aria-hidden />
                Exportar tentativas
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-admin-line" />
              <DropdownMenuItem
                onSelect={() => setShowDeleteModal(true)}
                className="cursor-pointer gap-2 rounded-lg px-2.5 py-2 text-[13px] text-admin-destructive focus:bg-admin-destructive/10 focus:text-admin-destructive"
              >
                <Trash2 className="h-4 w-4" aria-hidden />
                Excluir conta
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* 4 stat cards */}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <AdminStatCard label="Desempenho médio" value={`${user.avg_score.toFixed(1)}%`} />
        <AdminStatCard label="Tentativas" value={user.total_attempts} />
        <AdminStatCard label="Melhor posição" value={bestPosition != null ? `${bestPosition}º` : '—'} />
        <AdminStatCard label="Última atividade" value={formatRelativeDays(user.last_finished_at ?? user.last_sign_in_at)} />
      </div>

      {/* Abas */}
      <div className="mb-5 flex gap-1 border-b border-admin-line">
        <TabButton active={tab === 'historico'} onClick={() => setTab('historico')}>
          Histórico de tentativas
        </TabButton>
        <TabButton active={tab === 'acesso'} onClick={() => setTab('acesso')}>
          Acesso e perfil
        </TabButton>
      </div>

      {tab === 'historico' ? (
        <HistoricoTab attempts={attempts} />
      ) : (
        <AcessoTab
          user={user}
          canManageRoles={canManageRoles}
          onSegmentChange={handleSegmentChange}
          segmentPending={setSegment.isPending}
          onResetOnboarding={handleResetOnboarding}
          resetPending={resetOnboarding.isPending}
          onRoleChange={handleRoleChange}
          rolePending={setRole.isPending}
          onAskDelete={() => setShowDeleteModal(true)}
        />
      )}

      {/* Confirmação de exclusão (digitar EXCLUIR) */}
      <AdminConfirmDialog
        open={showDeleteModal}
        onOpenChange={setShowDeleteModal}
        title={`Excluir conta de ${name}`}
        description={
          <>
            Isto remove a pessoa e as{' '}
            <strong className="text-admin-text">
              {user.total_attempts} {user.total_attempts === 1 ? 'tentativa' : 'tentativas'}
            </strong>{' '}
            dela do sistema. A ação não pode ser desfeita.
          </>
        }
        confirmText="EXCLUIR"
        confirmLabel="Excluir conta"
        destructive
        loading={deleteUser.isPending}
        onConfirm={handleDelete}
      />
    </div>
  )
}

// ─────────────────────────── Subcomponentes ───────────────────────────

function BackLink() {
  return (
    <Link
      to="/admin/usuarios"
      className="mb-4 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-admin-muted transition-colors hover:text-admin-text"
    >
      <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
      Voltar para Usuários
    </Link>
  )
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={cn(
        '-mb-px border-b-2 px-3 py-2.5 text-[13px] transition-colors',
        active
          ? 'border-admin-accent font-semibold text-admin-accent'
          : 'border-transparent font-medium text-admin-muted hover:text-admin-text',
      )}
    >
      {children}
    </button>
  )
}

function HistoricoTab({ attempts }: { attempts: UserAttemptRow[] }) {
  if (attempts.length === 0) {
    return (
      <div className="rounded-xl border border-admin-line/80 bg-admin-surface">
        <AdminEmptyState
          icon={Inbox}
          eyebrow="Vazio"
          title="Nenhuma tentativa ainda"
          description="Quando esta pessoa fizer um simulado, as provas aparecem aqui."
        />
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-admin-line/80 bg-admin-surface shadow-sm shadow-black/[0.04] dark:shadow-black/30">
      <table className="w-full">
        <thead>
          <tr className="bg-admin-bg">
            {['Simulado', 'Seq.', 'Data', 'Status', 'Nota', 'Posição'].map(h => (
              <th
                key={h}
                className="border-b border-admin-line px-4 py-2.5 text-left text-[10.5px] font-bold uppercase tracking-[0.06em] text-admin-faint"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {attempts.map((a, i) => {
            const scored = a.score_percentage != null
            return (
              <tr
                key={a.attempt_id}
                className={cn('border-b border-admin-line-subtle last:border-0', i % 2 === 1 && 'bg-admin-bg/40')}
              >
                <td className="px-4 py-3 text-[13px] font-medium text-admin-text">{a.simulado_title}</td>
                <td className="px-4 py-3 font-mono text-[12px] text-admin-muted">#{a.sequence_number}</td>
                <td className="px-4 py-3 font-mono text-[12px] text-admin-muted">{formatShortDate(a.created_at)}</td>
                <td className="px-4 py-3">
                  <AdminBadge kind="attemptStatus" value={a.status} />
                </td>
                <td className="px-4 py-3 text-[13px] font-semibold tabular-nums text-admin-text">
                  {scored ? `${a.score_percentage!.toFixed(0)}%` : <span className="text-admin-faint">—</span>}
                </td>
                <td className="px-4 py-3 text-[13px] font-semibold tabular-nums text-admin-text">
                  {scored && a.ranking_position > 0 ? `${a.ranking_position}º` : <span className="text-admin-faint">—</span>}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

interface AcessoTabProps {
  user: UserDetail
  canManageRoles: boolean
  onSegmentChange: (segment: 'guest' | 'standard' | 'pro') => void
  segmentPending: boolean
  onResetOnboarding: () => void
  resetPending: boolean
  onRoleChange: (role: string, grant: boolean) => void
  rolePending: boolean
  onAskDelete: () => void
}

function AcessoTab({
  user, canManageRoles, onSegmentChange, segmentPending,
  onResetOnboarding, resetPending, onRoleChange, rolePending, onAskDelete,
}: AcessoTabProps) {
  return (
    <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[1.45fr_1fr] lg:items-start">
      {/* Coluna esquerda: cards de ação */}
      <div className="flex flex-col gap-3.5">
        {/* Segmento */}
        <div className="rounded-xl border border-admin-line/80 bg-admin-surface p-[18px] shadow-sm shadow-black/[0.04] dark:shadow-black/30">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h3 className="mb-1 text-[14px] font-bold text-admin-text">Segmento</h3>
              <p className="max-w-[42ch] text-[12.5px] leading-relaxed text-admin-muted">
                Define o que a pessoa acessa na plataforma. Mudar agora vale na próxima vez que ela entrar.
              </p>
            </div>
            <div className="shrink-0">
              <AdminSegmentPopover value={user.segment} onChange={onSegmentChange} disabled={segmentPending} />
            </div>
          </div>
        </div>

        {/* Boas-vindas */}
        <div className="flex items-center justify-between gap-4 rounded-xl border border-admin-line/80 bg-admin-surface p-[18px] shadow-sm shadow-black/[0.04] dark:shadow-black/30">
          <div className="min-w-0">
            <h3 className="mb-1 text-[14px] font-bold text-admin-text">Boas-vindas</h3>
            <p className="max-w-[46ch] text-[12.5px] leading-relaxed text-admin-muted">
              Reabre o tour inicial para a pessoa. Útil quando ela pede ajuda para reencontrar algo.
            </p>
          </div>
          <button
            onClick={onResetOnboarding}
            disabled={resetPending}
            className="shrink-0 whitespace-nowrap rounded-md border border-admin-line-strong bg-admin-surface px-3.5 py-2 text-[13px] font-semibold text-admin-text transition-colors hover:bg-admin-raised disabled:opacity-50 disabled:pointer-events-none"
          >
            {resetPending ? 'Reabrindo…' : 'Reabrir tour'}
          </button>
        </div>

        {/* Zona de perigo: excluir conta */}
        <div className="flex items-center justify-between gap-4 rounded-xl border border-admin-destructive/30 bg-admin-surface p-[18px]">
          <div className="min-w-0">
            <h3 className="mb-1 text-[14px] font-bold text-admin-destructive">Excluir conta</h3>
            <p className="max-w-[46ch] text-[12.5px] leading-relaxed text-admin-muted">
              Remove a pessoa e todas as tentativas dela. Não dá para desfazer.
            </p>
          </div>
          <button
            onClick={onAskDelete}
            className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border border-admin-destructive/35 bg-admin-surface px-3.5 py-2 text-[13px] font-semibold text-admin-destructive transition-colors hover:bg-admin-destructive/10"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
            Excluir conta
          </button>
        </div>
      </div>

      {/* Coluna direita: gerenciar acesso ao painel */}
      <div className="flex flex-col gap-3.5">
        {canManageRoles ? (
          <div className="overflow-hidden rounded-xl border border-admin-line/80 bg-admin-surface shadow-sm shadow-black/[0.04] dark:shadow-black/30">
            <div className="border-b border-admin-line-subtle px-5 py-4">
              <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-admin-faint">
                Gerenciar acesso ao painel
              </span>
            </div>
            <div className="bg-admin-bg p-5">
              <p className="mb-3.5 text-[12.5px] leading-relaxed text-admin-muted">
                Quem do time pode entrar no painel e o que pode fazer. Cada perfil liga um conjunto de permissões.
              </p>
              <div className="overflow-hidden rounded-xl border border-admin-line/80 bg-admin-surface">
                {Object.entries(ROLE_META).map(([role, meta], i, arr) => {
                  const granted = (user.roles ?? []).includes(role)
                  return (
                    <label
                      key={role}
                      className={cn(
                        'flex cursor-pointer items-center justify-between gap-3 px-4 py-3',
                        i < arr.length - 1 && 'border-b border-admin-line-subtle',
                      )}
                    >
                      <span className="min-w-0">
                        <span className="block text-[13px] font-semibold text-admin-text">{meta.label}</span>
                        <span className="block text-[11.5px] text-admin-muted">{meta.description}</span>
                      </span>
                      <input
                        type="checkbox"
                        checked={granted}
                        disabled={rolePending}
                        onChange={() => onRoleChange(role, !granted)}
                        className="h-4 w-4 shrink-0 cursor-pointer accent-[hsl(var(--admin-accent))] disabled:opacity-50"
                      />
                    </label>
                  )
                })}
              </div>
              <p className="mt-3.5 flex items-start gap-2 text-[11.5px] leading-relaxed text-admin-muted">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-admin-warning" aria-hidden />
                O painel protege contra o erro mais grave: ficar sem ninguém com acesso total. Não dá para remover o último administrador.
              </p>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-admin-line/80 bg-admin-surface">
            <AdminEmptyState
              icon={ShieldOff}
              title="Acesso ao painel é restrito"
              description="Só quem administra o painel pode ver e mudar os perfis de acesso do time."
            />
          </div>
        )}
      </div>
    </div>
  )
}

function DetailSkeleton() {
  const shimmer = (
    <span className="absolute inset-0 -translate-x-full animate-[shimmer_1.4s_infinite] bg-gradient-to-r from-transparent via-admin-surface/70 to-transparent" />
  )
  return (
    <div className="max-w-[1200px]" aria-busy="true" aria-label="Carregando">
      <div className="relative mb-4 h-4 w-40 overflow-hidden rounded bg-admin-raised">{shimmer}</div>
      <div className="mb-6 flex items-center gap-4">
        <div className="relative h-14 w-14 overflow-hidden rounded-2xl bg-admin-raised">{shimmer}</div>
        <div className="space-y-2">
          <div className="relative h-6 w-48 overflow-hidden rounded bg-admin-raised">{shimmer}</div>
          <div className="relative h-3.5 w-64 overflow-hidden rounded bg-admin-raised">{shimmer}</div>
        </div>
      </div>
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map(i => (
          <AdminStatCard key={i} label="" value="" isLoading />
        ))}
      </div>
      <div className="relative h-48 overflow-hidden rounded-xl border border-admin-line/80 bg-admin-raised">{shimmer}</div>
    </div>
  )
}

export default function AdminUsuarioDetail() {
  return (
    <AdminCapabilityGate capability="users.view">
      <AdminUsuarioDetailContent />
    </AdminCapabilityGate>
  )
}
