// src/admin/components/AdminTopbar.tsx
import { useLocation } from 'react-router-dom'
import { Search, Bell } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

const ROUTE_LABELS: Record<string, string> = {
  '/admin':            'Dashboard',
  '/admin/simulados':  'Simulados',
  '/admin/usuarios':   'Usuários',
  '/admin/suporte':    'Suporte',
  '/admin/tentativas': 'Tentativas',
  '/admin/analytics':  'Analytics',
  '/admin/marketing':  'Marketing',
  '/admin/produto':    'Produto',
  '/admin/tecnologia': 'Tecnologia',
  '/admin/auditoria':  'Auditoria',
}

function getLabel(pathname: string): string {
  if (ROUTE_LABELS[pathname]) return ROUTE_LABELS[pathname]
  if (pathname.includes('/simulados/')) return 'Simulados'
  return 'Admin'
}

function getInitials(name: string | null | undefined): string {
  if (!name) return 'A'
  return name
    .split(' ')
    .slice(0, 2)
    .map(n => n[0])
    .join('')
    .toUpperCase()
}

export function AdminTopbar() {
  const { pathname } = useLocation()
  const { user } = useAuth()
  const label = getLabel(pathname)

  return (
    <header className="h-12 border-b border-border bg-background/80 backdrop-blur-sm flex items-center justify-between px-4 shrink-0">
      <div>
        <span className="text-sm font-semibold text-foreground">{label}</span>
        <span className="text-muted-foreground text-xs mx-1.5">·</span>
        <span className="text-xs text-muted-foreground">ENAMED Arena</span>
      </div>

      <div className="flex items-center gap-1.5">
        <button
          title="Busca global (em breve)"
          className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors opacity-40 cursor-not-allowed"
        >
          <Search className="h-3.5 w-3.5" />
        </button>
        <button
          title="Notificações (em breve)"
          className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors opacity-40 cursor-not-allowed"
        >
          <Bell className="h-3.5 w-3.5" />
        </button>
        <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center ml-1">
          <span className="text-primary-foreground text-xs font-bold leading-none">
            {getInitials(user?.user_metadata?.full_name ?? user?.email)}
          </span>
        </div>
      </div>
    </header>
  )
}
