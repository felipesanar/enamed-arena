import { AdminCapabilityGate } from '@/admin/components/AdminCapabilityGate'
import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { toast } from '@/hooks/use-toast'
import {
  useAdminUser,
  useAdminUserAttempts,
  useAdminSetUserSegment,
  useAdminSetUserRole,
  useAdminResetUserOnboarding,
  useAdminDeleteUser,
} from '@/admin/hooks/useAdminUsuarios'
import { AdminStatCard } from '@/admin/components/ui/AdminStatCard'
import { AdminPageHeader } from '@/admin/components/ui/AdminPageHeader'
import { AdminBadge } from '@/admin/components/ui/AdminBadge'
import { AdminConfirmDialog } from '@/admin/components/ui/AdminConfirmDialog'
import { AdminAttemptQuestionsDialog } from '@/admin/components/AdminAttemptQuestionsDialog'
import { useAdminCan } from '@/admin/contexts/AdminAccessContext'
import { ROLE_META } from '@/admin/lib/constants'
import { getInitials } from '@/admin/lib/format'
import type { UserAttemptRow } from '@/admin/types'

function AdminUsuarioDetailContent() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [selectedAttempt, setSelectedAttempt] = useState<UserAttemptRow | null>(null)
  const canManageRoles = useAdminCan('roles.manage')

  const { data: user, isLoading } = useAdminUser(id!)
  const { data: attempts = [] } = useAdminUserAttempts(id!)
  const setSegment = useAdminSetUserSegment()
  const setRole = useAdminSetUserRole()
  const resetOnboarding = useAdminResetUserOnboarding()
  const deleteUser = useAdminDeleteUser()

  const handleSegmentChange = async (segment: 'guest' | 'standard' | 'pro') => {
    try {
      await setSegment.mutateAsync({ userId: id!, segment })
      toast({ title: 'Segmento atualizado' })
    } catch {
      toast({ title: 'Erro ao atualizar segmento', variant: 'destructive' })
    }
  }

  const handleRoleChange = (role: string, grant: boolean) => {
    setRole.mutate({ userId: id!, role, grant }, {
      onSuccess: () => {
        toast({ title: grant ? 'Role concedido' : 'Role revogado' })
      },
      onError: (error: Error) => {
        const msg = String(error?.message ?? '')
        if (msg.includes('cannot_revoke_own_admin')) {
          toast({ title: 'Ação bloqueada', description: 'Você não pode revogar seu próprio acesso de admin.', variant: 'destructive' })
        } else if (msg.includes('cannot_remove_last_admin')) {
          toast({ title: 'Ação bloqueada', description: 'Não é possível remover o último admin do painel.', variant: 'destructive' })
        } else {
          toast({ title: 'Erro ao alterar role', variant: 'destructive' })
        }
      },
    })
  }

  const handleResetOnboarding = async () => {
    try {
      await resetOnboarding.mutateAsync(id!)
      toast({ title: 'Onboarding resetado' })
    } catch {
      toast({ title: 'Erro ao resetar onboarding', variant: 'destructive' })
    }
  }

  const handleDelete = async () => {
    try {
      await deleteUser.mutateAsync(id!)
      toast({ title: 'Conta excluída' })
      navigate('/admin/usuarios')
    } catch {
      toast({ title: 'Erro ao excluir conta', variant: 'destructive' })
    }
  }

  const handleExportCsv = () => {
    if (!attempts.length) return
    const rows = [
      ['Simulado', 'Sequência', 'Data', 'Status', 'Nota (%)', 'Posição'],
      ...attempts.map((a: UserAttemptRow) => [
        a.simulado_title,
        a.sequence_number,
        new Date(a.created_at).toLocaleDateString('pt-BR'),
        a.status,
        a.score_percentage ?? '—',
        a.ranking_position,
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

  if (isLoading || !user) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-admin-raised rounded w-1/4" />
        <div className="grid grid-cols-[280px_1fr] gap-4">
          <div className="h-64 bg-admin-raised rounded-lg" />
          <div className="h-64 bg-admin-raised rounded-lg" />
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-[1200px]">
      <AdminPageHeader
        title={user.full_name ?? user.email}
        subtitle={
          <span className="inline-flex items-center gap-2">
            <Link to="/admin/usuarios" className="hover:text-admin-text transition-colors">Usuários</Link>
            <span>›</span>
            <span aria-hidden="true">{user.full_name ?? user.email}</span>
          </span>
        }
        actions={
          <button
            onClick={handleExportCsv}
            className="px-3 py-1.5 rounded-md text-xs font-medium border border-admin-line bg-admin-surface text-admin-muted hover:text-admin-text hover:bg-admin-raised transition-colors"
          >
            Exportar CSV
          </button>
        }
      />

      <div className="grid grid-cols-[280px_1fr] gap-4">

        {/* LEFT: Perfil + Ações */}
        <div className="space-y-3">
          {/* Perfil */}
          <div className="bg-admin-surface border border-admin-line rounded-lg p-4">
            <div className="w-14 h-14 rounded-xl bg-admin-accent flex items-center justify-center text-admin-accent-contrast text-2xl font-bold mb-3">
              {getInitials(user.full_name)}
            </div>
            <p className="text-base font-semibold text-admin-text">{user.full_name ?? '—'}</p>
            <p className="text-xs text-admin-muted mb-3">{user.email}</p>
            <AdminBadge kind="segment" value={user.segment} className="px-2 py-1 text-xs" />

            <div className="border-t border-admin-line mt-4 pt-4 mb-3">
              <p className="text-[9px] font-bold text-admin-faint uppercase tracking-widest mb-3">Performance</p>
              <div className="grid grid-cols-2 gap-1.5">
                <AdminStatCard label="Média geral" value={`${user.avg_score.toFixed(1)}%`} />
                <AdminStatCard label="Melhor nota" value={`${user.best_score.toFixed(1)}%`} />
                <AdminStatCard label="Provas feitas" value={user.total_attempts} />
                <AdminStatCard label="Última nota" value={`${user.last_score.toFixed(1)}%`} />
              </div>
            </div>

            <div className="border-t border-admin-line pt-3 space-y-1.5">
              <p className="text-[9px] font-bold text-admin-faint uppercase tracking-widest mb-2">Cadastro</p>
              <div className="flex justify-between text-[10px]">
                <span className="text-admin-muted">Cadastrado em</span>
                <span className="text-admin-text">{new Date(user.created_at).toLocaleDateString('pt-BR')}</span>
              </div>
              {user.last_sign_in_at && (
                <div className="flex justify-between text-[10px]">
                  <span className="text-admin-muted">Último acesso</span>
                  <span className="text-admin-text">{new Date(user.last_sign_in_at).toLocaleDateString('pt-BR')}</span>
                </div>
              )}
              <div className="flex justify-between text-[10px]">
                <span className="text-admin-muted">User ID</span>
                <span className="text-admin-faint font-mono text-[9px]">{user.user_id.slice(0, 8)}…</span>
              </div>
            </div>
          </div>

          {/* Ações */}
          <div className="bg-admin-surface border border-admin-line rounded-lg p-4">
            <p className="text-[9px] font-bold text-admin-faint uppercase tracking-widest mb-3">Ações</p>

            {/* Alterar segmento */}
            <div className="flex items-start justify-between py-2.5 border-b border-admin-line">
              <div>
                <p className="text-xs text-admin-text">Segmento</p>
                <p className="text-[9px] text-admin-muted">Alterar acesso do usuário</p>
              </div>
              <select
                value={user.segment}
                onChange={e => handleSegmentChange(e.target.value as any)}
                className="bg-admin-surface border border-admin-line-strong rounded text-[10px] text-admin-accent px-2 py-1 cursor-pointer"
              >
                <option value="guest">Guest</option>
                <option value="standard">Standard</option>
                <option value="pro">PRO</option>
              </select>
            </div>

            {/* Reset onboarding */}
            <div className="flex items-start justify-between py-2.5 border-b border-admin-line">
              <div>
                <p className="text-xs text-admin-text">Reset onboarding</p>
                <p className="text-[9px] text-admin-muted">Força reconfiguração de perfil</p>
              </div>
              <button
                onClick={handleResetOnboarding}
                className="text-[10px] px-2 py-1 rounded border border-admin-line text-admin-muted bg-admin-surface hover:bg-admin-raised transition-colors"
              >
                Resetar
              </button>
            </div>

            {/* Excluir */}
            <div className="flex items-start justify-between py-2.5">
              <div>
                <p className="text-xs text-admin-text">Excluir conta</p>
                <p className="text-[9px] text-admin-muted">Ação irreversível</p>
              </div>
              <button
                onClick={() => setShowDeleteModal(true)}
                className="text-[10px] px-2 py-1 rounded border border-admin-destructive/30 text-admin-destructive bg-admin-destructive/5 hover:bg-admin-destructive/10 transition-colors"
              >
                Excluir
              </button>
            </div>
          </div>

          {/* Acesso ao painel (roles) */}
          {canManageRoles && (
            <section className="bg-admin-surface border border-admin-line rounded-lg p-4">
              <h2 className="text-sm font-semibold text-admin-text mb-1">Acesso ao painel</h2>
              <p className="text-xs text-admin-muted mb-3">Roles controlam o que este usuário pode ver e fazer no admin.</p>
              <div className="flex flex-col gap-2">
                {Object.entries(ROLE_META).map(([role, meta]) => {
                  const granted = (user.roles ?? []).includes(role)
                  return (
                    <label key={role} className="flex items-start gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={granted}
                        disabled={setRole.isPending}
                        onChange={() => handleRoleChange(role, !granted)}
                        className="mt-0.5 accent-[hsl(var(--admin-accent))]"
                      />
                      <span>
                        <span className="text-xs font-medium text-admin-text">{meta.label}</span>
                        <span className="block text-[11px] text-admin-muted">{meta.description}</span>
                      </span>
                    </label>
                  )
                })}
              </div>
            </section>
          )}
        </div>

        {/* RIGHT: Onboarding + Histórico */}
        <div className="space-y-3">
          {/* Onboarding */}
          <div className="bg-admin-surface border border-admin-line rounded-lg p-4">
            <p className="text-[9px] font-bold text-admin-faint uppercase tracking-widest mb-3">Onboarding</p>
            {user.specialty ? (
              <>
                <p className="text-[10px] text-admin-muted uppercase mb-2">Especialidade alvo</p>
                <div className="flex flex-wrap gap-1.5 mb-4">
                  <span className="px-2 py-1 bg-admin-accent/10 border border-admin-accent/20 text-admin-accent text-[10px] rounded">
                    {user.specialty}
                  </span>
                </div>
                {user.target_institutions?.length ? (
                  <>
                    <p className="text-[10px] text-admin-muted uppercase mb-2">Instituições alvo</p>
                    <div className="flex flex-wrap gap-1.5">
                      {user.target_institutions.map(inst => (
                        <span key={inst} className="px-2 py-1 bg-admin-surface border border-admin-line text-admin-muted text-[10px] rounded">
                          {inst}
                        </span>
                      ))}
                    </div>
                  </>
                ) : null}
              </>
            ) : (
              <p className="text-xs text-admin-muted">Onboarding não realizado.</p>
            )}
          </div>

          {/* Histórico de tentativas */}
          <div className="bg-admin-surface border border-admin-line rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-admin-line flex items-center justify-between">
              <p className="text-[9px] font-bold text-admin-faint uppercase tracking-widest">Histórico de tentativas</p>
              <span className="text-[9px] text-admin-muted">{attempts.length > 0 ? 'clique para ver as questões · ' : ''}últimas 10</span>
            </div>
            {attempts.length === 0 ? (
              <p className="px-4 py-6 text-xs text-admin-muted text-center">Nenhuma tentativa encontrada.</p>
            ) : (
              <table className="w-full">
                <thead>
                  <tr>
                    {['Simulado', 'Data', 'Status', 'Nota', 'Posição'].map(h => (
                      <th key={h} className="px-4 py-2 text-[9px] font-bold text-admin-faint uppercase tracking-wide text-left border-b border-admin-line">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {attempts.map((a: UserAttemptRow) => (
                    <tr
                      key={a.attempt_id}
                      onClick={() => setSelectedAttempt(a)}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedAttempt(a) } }}
                      tabIndex={0}
                      role="button"
                      aria-label={`Ver questões da tentativa #${a.sequence_number} — ${a.simulado_title}`}
                      className="border-b border-admin-line/40 last:border-0 hover:bg-admin-raised/40 cursor-pointer focus:outline-none focus:bg-admin-raised/40 transition-colors"
                    >
                      <td className="px-4 py-2.5 text-xs text-admin-text">
                        <span className="text-admin-muted mr-1">#{a.sequence_number} —</span>
                        <span>{a.simulado_title}</span>
                      </td>
                      <td className="px-4 py-2.5 text-[10px] text-admin-muted">
                        {new Date(a.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                      </td>
                      <td className="px-4 py-2.5">
                        <AdminBadge kind="attemptStatus" value={a.status} />
                      </td>
                      <td className="px-4 py-2.5 text-xs font-semibold text-admin-text">
                        {a.score_percentage != null ? `${a.score_percentage.toFixed(1)}%` : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-admin-muted">
                        {a.is_within_window && a.ranking_position != null
                          ? `${a.ranking_position}º`
                          : a.score_percentage != null
                            ? <span className="text-admin-faint">treino</span>
                            : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Confirmação de exclusão */}
      <AdminConfirmDialog
        open={showDeleteModal}
        onOpenChange={setShowDeleteModal}
        title="Confirmar exclusão"
        description={<>Tem certeza que deseja excluir a conta de <strong>{user.full_name ?? user.email}</strong>? Esta ação é irreversível.</>}
        confirmLabel="Excluir conta"
        destructive
        loading={deleteUser.isPending}
        onConfirm={handleDelete}
      />

      {/* Drill-down por questão da tentativa */}
      <AdminAttemptQuestionsDialog
        open={selectedAttempt != null}
        onOpenChange={open => { if (!open) setSelectedAttempt(null) }}
        attempt={selectedAttempt}
      />
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
