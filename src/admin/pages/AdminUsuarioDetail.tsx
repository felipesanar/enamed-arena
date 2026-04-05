import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
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
import type { UserAttemptRow } from '@/admin/types'

function getInitials(name: string | null): string {
  if (!name) return '?'
  return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
}

const SEGMENT_CLASSES: Record<string, string> = {
  pro: 'bg-primary/10 text-primary border border-primary/20',
  standard: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
  guest: 'bg-muted text-muted-foreground border border-border',
}
const SEGMENT_LABELS: Record<string, string> = { pro: 'PRO', standard: 'Standard', guest: 'Guest' }

const STATUS_CLASSES: Record<string, string> = {
  submitted: 'bg-success/10 text-success border border-success/20',
  expired: 'bg-warning/10 text-warning border border-warning/20',
  in_progress: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
}
const STATUS_LABELS: Record<string, string> = {
  submitted: 'Concluído', expired: 'Expirado', in_progress: 'Em andamento',
}

export default function AdminUsuarioDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [showDeleteModal, setShowDeleteModal] = useState(false)

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

  const handleRoleToggle = async () => {
    if (!user) return
    try {
      await setRole.mutateAsync({ userId: id!, role: 'admin', grant: !user.is_admin })
      toast({ title: user.is_admin ? 'Papel admin revogado' : 'Papel admin concedido' })
    } catch {
      toast({ title: 'Erro ao alterar papel', variant: 'destructive' })
    }
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
        <div className="h-8 bg-muted rounded w-1/4" />
        <div className="grid grid-cols-[280px_1fr] gap-4">
          <div className="h-64 bg-muted rounded-lg" />
          <div className="h-64 bg-muted rounded-lg" />
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-[1200px]">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
        <Link to="/admin/usuarios" className="hover:text-foreground transition-colors">Usuários</Link>
        <span>›</span>
        <span className="text-foreground font-medium" aria-hidden="true">{user.full_name ?? user.email}</span>
      </div>

      <div className="grid grid-cols-[280px_1fr] gap-4">

        {/* LEFT: Perfil + Ações */}
        <div className="space-y-3">
          {/* Perfil */}
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="w-14 h-14 rounded-xl bg-primary flex items-center justify-center text-primary-foreground text-2xl font-bold mb-3">
              {getInitials(user.full_name)}
            </div>
            <p className="text-base font-semibold text-foreground">{user.full_name ?? '—'}</p>
            <p className="text-xs text-muted-foreground mb-3">{user.email}</p>
            <span className={cn('inline-flex px-2 py-1 rounded text-xs font-semibold', SEGMENT_CLASSES[user.segment])}>
              {SEGMENT_LABELS[user.segment]}
            </span>

            <div className="border-t border-border mt-4 pt-4 mb-3">
              <p className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest mb-3">Performance</p>
              <div className="grid grid-cols-2 gap-1.5">
                <AdminStatCard label="Média geral" value={`${user.avg_score.toFixed(1)}%`} />
                <AdminStatCard label="Melhor nota" value={`${user.best_score.toFixed(1)}%`} />
                <AdminStatCard label="Provas feitas" value={user.total_attempts} />
                <AdminStatCard label="Última nota" value={`${user.last_score.toFixed(1)}%`} />
              </div>
            </div>

            <div className="border-t border-border pt-3 space-y-1.5">
              <p className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest mb-2">Cadastro</p>
              <div className="flex justify-between text-[10px]">
                <span className="text-muted-foreground">Cadastrado em</span>
                <span className="text-foreground">{new Date(user.created_at).toLocaleDateString('pt-BR')}</span>
              </div>
              {user.last_sign_in_at && (
                <div className="flex justify-between text-[10px]">
                  <span className="text-muted-foreground">Último acesso</span>
                  <span className="text-foreground">{new Date(user.last_sign_in_at).toLocaleDateString('pt-BR')}</span>
                </div>
              )}
              <div className="flex justify-between text-[10px]">
                <span className="text-muted-foreground">User ID</span>
                <span className="text-muted-foreground/60 font-mono text-[9px]">{user.user_id.slice(0, 8)}…</span>
              </div>
            </div>
          </div>

          {/* Ações */}
          <div className="bg-card border border-border rounded-lg p-4">
            <p className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest mb-3">Ações</p>

            {/* Alterar segmento */}
            <div className="flex items-start justify-between py-2.5 border-b border-border">
              <div>
                <p className="text-xs text-foreground">Segmento</p>
                <p className="text-[9px] text-muted-foreground">Alterar acesso do usuário</p>
              </div>
              <select
                value={user.segment}
                onChange={e => handleSegmentChange(e.target.value as any)}
                className="bg-card border border-border rounded text-[10px] text-primary px-2 py-1 cursor-pointer"
              >
                <option value="guest">Guest</option>
                <option value="standard">Standard</option>
                <option value="pro">PRO</option>
              </select>
            </div>

            {/* Admin */}
            <div className="flex items-start justify-between py-2.5 border-b border-border">
              <div>
                <p className="text-xs text-foreground">Papel admin</p>
                <p className="text-[9px] text-muted-foreground">Acesso ao painel admin</p>
              </div>
              <button
                onClick={handleRoleToggle}
                className="text-[10px] px-2 py-1 rounded border border-warning/30 text-warning bg-warning/5 hover:bg-warning/10 transition-colors"
              >
                {user.is_admin ? 'Revogar' : 'Conceder'}
              </button>
            </div>

            {/* Reset onboarding */}
            <div className="flex items-start justify-between py-2.5 border-b border-border">
              <div>
                <p className="text-xs text-foreground">Reset onboarding</p>
                <p className="text-[9px] text-muted-foreground">Força reconfiguração de perfil</p>
              </div>
              <button
                onClick={handleResetOnboarding}
                className="text-[10px] px-2 py-1 rounded border border-border text-muted-foreground bg-card hover:bg-muted transition-colors"
              >
                Resetar
              </button>
            </div>

            {/* Exportar */}
            <div className="flex items-start justify-between py-2.5 border-b border-border">
              <div>
                <p className="text-xs text-foreground">Exportar dados</p>
                <p className="text-[9px] text-muted-foreground">CSV com tentativas</p>
              </div>
              <button
                onClick={handleExportCsv}
                className="text-[10px] px-2 py-1 rounded border border-border text-muted-foreground bg-card hover:bg-muted transition-colors"
              >
                Exportar
              </button>
            </div>

            {/* Excluir */}
            <div className="flex items-start justify-between py-2.5">
              <div>
                <p className="text-xs text-foreground">Excluir conta</p>
                <p className="text-[9px] text-muted-foreground">Ação irreversível</p>
              </div>
              <button
                onClick={() => setShowDeleteModal(true)}
                className="text-[10px] px-2 py-1 rounded border border-destructive/30 text-destructive bg-destructive/5 hover:bg-destructive/10 transition-colors"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT: Onboarding + Histórico */}
        <div className="space-y-3">
          {/* Onboarding */}
          <div className="bg-card border border-border rounded-lg p-4">
            <p className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest mb-3">Onboarding</p>
            {user.specialty ? (
              <>
                <p className="text-[10px] text-muted-foreground uppercase mb-2">Especialidade alvo</p>
                <div className="flex flex-wrap gap-1.5 mb-4">
                  <span className="px-2 py-1 bg-primary/10 border border-primary/20 text-primary text-[10px] rounded">
                    {user.specialty}
                  </span>
                </div>
                {user.target_institutions?.length ? (
                  <>
                    <p className="text-[10px] text-muted-foreground uppercase mb-2">Instituições alvo</p>
                    <div className="flex flex-wrap gap-1.5">
                      {user.target_institutions.map(inst => (
                        <span key={inst} className="px-2 py-1 bg-card border border-border text-muted-foreground text-[10px] rounded">
                          {inst}
                        </span>
                      ))}
                    </div>
                  </>
                ) : null}
              </>
            ) : (
              <p className="text-xs text-muted-foreground">Onboarding não realizado.</p>
            )}
          </div>

          {/* Histórico de tentativas */}
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <p className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest">Histórico de tentativas</p>
              <span className="text-[9px] text-muted-foreground">últimas 10</span>
            </div>
            {attempts.length === 0 ? (
              <p className="px-4 py-6 text-xs text-muted-foreground text-center">Nenhuma tentativa encontrada.</p>
            ) : (
              <table className="w-full">
                <thead>
                  <tr>
                    {['Simulado', 'Data', 'Status', 'Nota', 'Posição'].map(h => (
                      <th key={h} className="px-4 py-2 text-[9px] font-bold text-muted-foreground/60 uppercase tracking-wide text-left border-b border-border">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {attempts.map((a: UserAttemptRow) => (
                    <tr key={a.attempt_id} className="border-b border-border/40 last:border-0 hover:bg-muted/20">
                      <td className="px-4 py-2.5 text-xs text-foreground">
                        <span className="text-muted-foreground mr-1">#{a.sequence_number} —</span>
                        <span>{a.simulado_title}</span>
                      </td>
                      <td className="px-4 py-2.5 text-[10px] text-muted-foreground">
                        {new Date(a.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={cn('inline-flex px-1.5 py-0.5 rounded text-[9px] font-semibold', STATUS_CLASSES[a.status] ?? 'bg-muted text-muted-foreground border border-border')}>
                          {STATUS_LABELS[a.status] ?? a.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-xs font-semibold text-foreground">
                        {a.score_percentage != null ? `${a.score_percentage.toFixed(1)}%` : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">
                        {a.score_percentage != null ? `${a.ranking_position}º` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Modal de confirmação de exclusão */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl">
            <h3 className="text-sm font-semibold text-foreground mb-2">Confirmar exclusão</h3>
            <p className="text-xs text-muted-foreground mb-4">
              Tem certeza que deseja excluir a conta de <strong>{user.full_name ?? user.email}</strong>? Esta ação é irreversível.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 text-xs border border-border rounded-md text-muted-foreground hover:bg-muted transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteUser?.isPending}
                className="px-4 py-2 text-xs bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90 disabled:opacity-50 transition-colors"
              >
                {deleteUser?.isPending ? 'Excluindo...' : 'Excluir conta'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
