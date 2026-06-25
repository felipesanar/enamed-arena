import { AdminCapabilityGate } from '@/admin/components/AdminCapabilityGate'
import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAdminUserList } from '@/admin/hooks/useAdminUsuarios'
import { adminApi } from '@/admin/services/adminApi'
import { AdminPageHeader } from '@/admin/components/ui/AdminPageHeader'
import { AdminBadge } from '@/admin/components/ui/AdminBadge'
import { AdminEmptyState } from '@/admin/components/ui/AdminEmptyState'
import { getInitials, formatInt } from '@/admin/lib/format'
import { useDebounce } from '@/hooks/useDebounce'
import type { UserListRow } from '@/admin/types'
import { toast } from '@/hooks/use-toast'

const SEGMENTS = [
  { label: 'Todos', value: 'all' },
  { label: 'Guest', value: 'guest' },
  { label: 'Standard', value: 'standard' },
  { label: 'PRO', value: 'pro' },
] as const

function AdminUsuariosContent() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [segment, setSegment] = useState('all')
  const [page, setPage] = useState(1)
  const debouncedSearch = useDebounce(search, 300)

  const { data, isLoading, isError } = useAdminUserList(debouncedSearch, segment, page)
  const users = data ?? []
  const totalCount = users[0]?.total_count ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / 25))

  const handleSegment = useCallback((val: string) => {
    setSegment(val)
    setPage(1)
  }, [])

  const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value)
    setPage(1)
  }, [])

  const handleExportCsv = async () => {
    try {
      toast({ title: 'Exportando…', description: 'Buscando todos os usuários.' })
      // Fetch all users with current filters (no pagination limit)
      const allUsers = await adminApi.listUsers(debouncedSearch, segment, 10000, 0)
      if (!allUsers.length) {
        toast({ title: 'Nenhum usuário', description: 'Nenhum usuário encontrado com os filtros atuais.', variant: 'destructive' })
        return
      }
      const csvHeader = 'Nome Completo,E-mail,Segmento,Especialidade,Cadastro,Média (válidas),Provas válidas'
      const csvRows = allUsers.map(u => {
        const name = (u.full_name ?? '').replace(/"/g, '""')
        const email = (u.email ?? '').replace(/"/g, '""')
        const spec = (u.specialty ?? '').replace(/"/g, '""')
        const date = new Date(u.created_at).toLocaleDateString('pt-BR')
        return `"${name}","${email}","${u.segment}","${spec}","${date}","${u.valid_attempts > 0 ? `${u.avg_score.toFixed(1)}%` : '—'}","${u.valid_attempts}"`
      })
      const blob = new Blob([csvHeader + '\n' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `usuarios_${new Date().toISOString().slice(0,10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
      toast({ title: 'CSV exportado!', description: `${allUsers.length} usuários exportados.` })
    } catch (err) {
      toast({ title: 'Erro ao exportar', description: 'Não foi possível gerar o CSV.', variant: 'destructive' })
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-3 animate-pulse">
        <div className="h-8 bg-admin-raised rounded w-1/3" />
        <div className="h-10 bg-admin-raised rounded" />
        {[1,2,3,4,5].map(i => (
          <div key={i} className="h-12 bg-admin-raised/60 rounded" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4 max-w-[1400px]">
      <AdminPageHeader
        title="Usuários"
        subtitle={`${formatInt(totalCount)} cadastrados`}
        actions={
          <button
            onClick={handleExportCsv}
            className="px-3 py-1.5 rounded-md text-xs font-medium border border-admin-line bg-admin-surface text-admin-muted hover:text-admin-text hover:bg-admin-raised transition-colors"
          >
            Exportar CSV
          </button>
        }
      />

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <input
          type="text"
          value={search}
          onChange={handleSearch}
          placeholder="Buscar por nome ou e-mail..."
          className="flex-1 min-w-[200px] bg-admin-surface border border-admin-line-strong rounded-md px-3 py-2 text-sm text-admin-text placeholder:text-admin-muted focus:outline-none focus:ring-1 focus:ring-admin-accent/50"
        />
        {SEGMENTS.map(s => (
          <button
            key={s.value}
            aria-label={s.label}
            data-label={s.label}
            onClick={() => handleSegment(s.value)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors before:content-[attr(data-label)]",
              segment === s.value
                ? 'bg-admin-accent text-admin-accent-contrast border-admin-accent'
                : 'bg-admin-surface text-admin-muted border-admin-line hover:text-admin-text hover:bg-admin-raised',
            )}
          />
        ))}
      </div>

      {isError && (
        <p className="text-xs text-admin-destructive">Erro ao carregar usuários.</p>
      )}

      {/* Table */}
      <div className="bg-admin-surface rounded-lg border border-admin-line overflow-hidden">
        <div className="grid text-[9px] font-bold text-admin-faint uppercase tracking-wide border-b border-admin-line"
          style={{ gridTemplateColumns: '2fr 80px 120px 100px 120px 40px' }}>
          {['Usuário', 'Segmento', 'Especialidade', 'Cadastro', 'Média / Provas válidas', ''].map(h => (
            <div key={h} className="px-4 py-2">{h}</div>
          ))}
        </div>

        {users.length === 0 ? (
          <AdminEmptyState
            icon={Users}
            title="Nenhum usuário encontrado"
            description="Ajuste a busca ou os filtros de segmento."
          />
        ) : (
          users.map((user: UserListRow) => (
            <div
              key={user.user_id}
              className="grid border-b border-admin-line/40 last:border-0 hover:bg-admin-raised/30 transition-colors items-center"
              style={{ gridTemplateColumns: '2fr 80px 120px 100px 120px 40px' }}
            >
              {/* Avatar + nome */}
              <div className="px-4 py-2.5 flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-md bg-admin-accent flex items-center justify-center text-admin-accent-contrast text-xs font-bold shrink-0">
                  {getInitials(user.full_name)}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-admin-text truncate">{user.full_name ?? '—'}</p>
                  <p className="text-[10px] text-admin-muted truncate">{user.email}</p>
                </div>
              </div>
              {/* Segmento */}
              <div className="px-4 py-2.5">
                <AdminBadge kind="segment" value={user.segment} />
              </div>
              {/* Especialidade */}
              <div className="px-4 py-2.5 text-[11px] text-admin-muted truncate">
                {user.specialty ?? '—'}
              </div>
              {/* Cadastro */}
              <div className="px-4 py-2.5 text-[10px] text-admin-muted">
                {new Date(user.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
              </div>
              {/* Média / Provas válidas */}
              <div className="px-4 py-2.5">
                <p className="text-xs font-semibold text-admin-text">{user.valid_attempts > 0 ? `${user.avg_score.toFixed(1)}%` : '—'}</p>
                <p className="text-[10px] text-admin-muted" title="Provas válidas (exclui treino)">{user.valid_attempts} provas válidas</p>
              </div>
              {/* Ação */}
              <div className="px-2 py-2.5">
                <button
                  onClick={() => navigate(`/admin/usuarios/${user.user_id}`)}
                  className="w-7 h-7 rounded flex items-center justify-center text-admin-muted hover:text-admin-accent hover:bg-admin-accent/10 transition-colors text-sm"
                  title="Ver detalhes"
                >
                  →
                </button>
              </div>
            </div>
          ))
        )}
      </div>

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
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={cn(
                    'w-7 h-7 rounded border text-xs transition-colors',
                    page === p
                      ? 'bg-admin-accent text-admin-accent-contrast border-admin-accent'
                      : 'border-admin-line text-admin-muted hover:bg-admin-raised',
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
