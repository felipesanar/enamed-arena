import { useLocation } from 'react-router-dom'
import { Bell, ChevronRight, Moon, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { ADMIN_NAV } from '@/admin/lib/navigation'

function getBreadcrumb(pathname: string): { group: string | null; label: string } {
  for (const group of ADMIN_NAV) {
    for (const item of group.items) {
      if (pathname === item.to) {
        return { group: group.title, label: item.label }
      }
    }
  }
  if (pathname.includes('/admin/preview/simulados/')) {
    if (pathname.endsWith('/correcao'))   return { group: 'Ferramentas', label: 'Preview correção' }
    if (pathname.endsWith('/desempenho')) return { group: 'Ferramentas', label: 'Preview desempenho' }
  }
  if (pathname.startsWith('/admin/usuarios/'))  return { group: 'Gestão', label: 'Usuários' }
  if (pathname.startsWith('/admin/simulados'))  return { group: 'Gestão', label: 'Simulados' }
  if (pathname.startsWith('/admin/tentativas')) return { group: 'Gestão', label: 'Tentativas' }
  return { group: null, label: 'Admin' }
}

function AdminThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  if (!mounted) return <span className="w-7 h-7 rounded-md shrink-0" aria-hidden />
  const isDark = resolvedTheme === 'dark'
  return (
    <button
      type="button"
      aria-label={isDark ? 'Ativar tema claro' : 'Ativar tema escuro'}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="w-7 h-7 rounded-md flex items-center justify-center text-admin-muted hover:bg-admin-raised motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-admin-accent/50"
    >
      {isDark ? <Sun className="h-3.5 w-3.5" aria-hidden /> : <Moon className="h-3.5 w-3.5" aria-hidden />}
    </button>
  )
}

export function AdminTopbar() {
  const { pathname } = useLocation()
  const { group, label } = getBreadcrumb(pathname)

  return (
    <header className="h-11 border-b border-admin-line bg-admin-bg/80 backdrop-blur-sm flex items-center justify-between px-4 shrink-0">
      <div className="flex items-center gap-1.5 min-w-0">
        {group && (
          <>
            <span className="text-xs text-admin-faint">{group}</span>
            <ChevronRight className="h-3 w-3 text-admin-faint/60" aria-hidden />
          </>
        )}
        <span className="text-[13px] font-semibold text-admin-text truncate">{label}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <AdminThemeToggle />
        <button
          type="button"
          title="Alertas (em breve)"
          aria-label="Alertas (em breve)"
          disabled
          className="w-7 h-7 rounded-md flex items-center justify-center text-admin-faint opacity-50 cursor-not-allowed"
        >
          <Bell className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
    </header>
  )
}
