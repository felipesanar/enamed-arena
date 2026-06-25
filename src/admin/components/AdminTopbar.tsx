import { useLocation } from 'react-router-dom'
import { ChevronRight, Moon, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { ADMIN_NAV } from '@/admin/lib/navigation'
import { AdminAlertsBell } from '@/admin/components/AdminAlertsBell'

/**
 * Trilha de navegação a partir da rota atual, usando os grupos novos
 * (Início / Conteúdo / Pessoas / Análise / Sistema) e os rótulos do redesign.
 */
function getBreadcrumb(pathname: string): { group: string | null; label: string } {
  for (const group of ADMIN_NAV) {
    for (const item of group.items) {
      if (pathname === item.to) {
        return { group: group.title, label: item.label }
      }
    }
  }
  if (pathname.includes('/admin/preview/simulados/')) {
    if (pathname.endsWith('/correcao'))   return { group: 'Sistema', label: 'Prévia do aluno' }
    if (pathname.endsWith('/desempenho')) return { group: 'Sistema', label: 'Prévia do aluno' }
    if (pathname.endsWith('/ranking'))    return { group: 'Sistema', label: 'Prévia do aluno' }
    return { group: 'Sistema', label: 'Prévia do aluno' }
  }
  if (pathname.startsWith('/admin/usuarios/'))   return { group: 'Pessoas',  label: 'Usuários' }
  if (pathname.startsWith('/admin/simulados/novo')) return { group: 'Conteúdo', label: 'Novo simulado' }
  if (pathname.startsWith('/admin/simulados'))   return { group: 'Conteúdo', label: 'Simulados' }
  if (pathname.startsWith('/admin/questoes'))    return { group: 'Conteúdo', label: 'Banco de questões' }
  if (pathname.startsWith('/admin/tentativas'))  return { group: 'Pessoas',  label: 'Tentativas' }
  if (pathname.startsWith('/admin/inteligencia')) return { group: 'Análise', label: 'Visão geral' }
  if (pathname.startsWith('/admin/analytics'))   return { group: 'Análise',  label: 'Jornada' }
  if (pathname.startsWith('/admin/marketing'))   return { group: 'Análise',  label: 'Aquisição' }
  if (pathname.startsWith('/admin/produto'))     return { group: 'Análise',  label: 'Produto' }
  if (pathname.startsWith('/admin/previews'))    return { group: 'Sistema',  label: 'Prévia do aluno' }
  if (pathname.startsWith('/admin/auditoria'))   return { group: 'Sistema',  label: 'Auditoria' }
  return { group: null, label: 'Painel' }
}

function AdminThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  if (!mounted) return <span className="w-8 h-8 rounded-lg shrink-0" aria-hidden />
  const isDark = resolvedTheme === 'dark'
  return (
    <button
      type="button"
      aria-label={isDark ? 'Ativar tema claro' : 'Ativar tema escuro'}
      title={isDark ? 'Tema claro' : 'Tema escuro'}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="w-8 h-8 rounded-lg flex items-center justify-center text-admin-muted hover:bg-admin-raised hover:text-admin-text motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-admin-accent/50"
    >
      {isDark ? <Sun className="h-4 w-4" aria-hidden /> : <Moon className="h-4 w-4" aria-hidden />}
    </button>
  )
}

export function AdminTopbar() {
  const { pathname } = useLocation()
  const { group, label } = getBreadcrumb(pathname)

  return (
    <header className="h-[54px] border-b border-admin-line bg-admin-surface flex items-center justify-between px-6 shrink-0">
      <nav aria-label="Trilha de navegação" className="flex items-center gap-1.5 min-w-0">
        {group && (
          <>
            <span className="text-[12.5px] text-admin-faint">{group}</span>
            <ChevronRight className="h-3.5 w-3.5 text-admin-faint/70 shrink-0" aria-hidden />
          </>
        )}
        <span className="text-[12.5px] font-semibold text-admin-text truncate">{label}</span>
      </nav>
      <div className="flex items-center gap-1.5">
        <AdminAlertsBell />
        <AdminThemeToggle />
      </div>
    </header>
  )
}
