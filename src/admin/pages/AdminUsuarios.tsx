import { useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useAdminUserList } from '@/admin/hooks/useAdminUsuarios'
import type { UserListRow } from '@/admin/types'

const SEGMENTS = [
  { label: 'Todos', value: 'all' },
  { label: 'Guest', value: 'guest' },
  { label: 'Standard', value: 'standard' },
  { label: 'PRO', value: 'pro' },
] as const

const SEGMENT_LABELS: Record<string, string> = {
  pro: 'PRO', standard: 'Standard', guest: 'Guest',
}

const SEGMENT_CLASSES: Record<string, string> = {
  pro: 'bg-primary/10 text-primary border border-primary/20',
  standard: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
  guest: 'bg-muted text-muted-foreground border border-border',
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

export default function AdminUsuarios() {
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

  if (isLoading) {
    return (
      <div className="space-y-3 animate-pulse">
        <div className="h-8 bg-muted rounded w-1/3" />
        <div className="h-10 bg-muted rounded" />
        {[1,2,3,4,5].map(i => (
          <div key={i} className="h-12 bg-muted/60 rounded" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4 max-w-[1400px]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-heading-1 text-foreground">Usuários</h1>
          <p className="text-caption text-muted-foreground">{totalCount.toLocaleString('pt-BR')} cadastrados</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <input
          type="text"
          value={search}
          onChange={handleSearch}
          placeholder="Buscar por nome ou e-mail..."
          className="flex-1 min-w-[200px] bg-card border border-border rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
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
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-card text-muted-foreground border-border hover:text-foreground hover:bg-muted',
            )}
          />
        ))}
      </div>

      {isError && (
        <p className="text-xs text-destructive">Erro ao carregar usuários.</p>
      )}

      {/* Table */}
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <div className="grid text-[9px] font-bold text-muted-foreground/60 uppercase tracking-wide border-b border-border"
          style={{ gridTemplateColumns: '2fr 80px 120px 100px 120px 40px' }}>
          {['Usuário', 'Segmento', 'Especialidade', 'Cadastro', 'Média / Provas', ''].map(h => (
            <div key={h} className="px-4 py-2">{h}</div>
          ))}
        </div>

        {users.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            Nenhum usuário encontrado.
          </div>
        ) : (
          users.map((user: UserListRow) => (
            <div
              key={user.user_id}
              className="grid border-b border-border/40 last:border-0 hover:bg-muted/30 transition-colors items-center"
              style={{ gridTemplateColumns: '2fr 80px 120px 100px 120px 40px' }}
            >
              {/* Avatar + nome */}
              <div className="px-4 py-2.5 flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold shrink-0">
                  {getInitials(user.full_name)}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{user.full_name ?? '—'}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{user.email}</p>
                </div>
              </div>
              {/* Segmento */}
              <div className="px-4 py-2.5">
                <span className={cn('inline-flex px-2 py-0.5 rounded text-[10px] font-semibold', SEGMENT_CLASSES[user.segment])}>
                  {SEGMENT_LABELS[user.segment]}
                </span>
              </div>
              {/* Especialidade */}
              <div className="px-4 py-2.5 text-[11px] text-muted-foreground truncate">
                {user.specialty ?? '—'}
              </div>
              {/* Cadastro */}
              <div className="px-4 py-2.5 text-[10px] text-muted-foreground">
                {new Date(user.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
              </div>
              {/* Média / Provas */}
              <div className="px-4 py-2.5">
                <p className="text-xs font-semibold text-foreground">{user.avg_score.toFixed(1)}%</p>
                <p className="text-[10px] text-muted-foreground">{user.total_attempts} provas</p>
              </div>
              {/* Ação */}
              <div className="px-2 py-2.5">
                <button
                  onClick={() => navigate(`/admin/usuarios/${user.user_id}`)}
                  className="w-7 h-7 rounded flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors text-sm"
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
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={cn(
                    'w-7 h-7 rounded border text-xs transition-colors',
                    page === p
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border text-muted-foreground hover:bg-muted',
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
    </div>
  )
}
