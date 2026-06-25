import { NavLink, useNavigate } from 'react-router-dom'
import { Search, LogOut, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { useAdminAccess } from '@/admin/contexts/AdminAccessContext'
import { visibleNav } from '@/admin/lib/navigation'
import { getInitials } from '@/admin/lib/format'
import { ROLE_META } from '@/admin/lib/constants'
import { logger } from '@/lib/logger'
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip'

interface AdminSidebarProps {
  collapsed: boolean
  onToggle: () => void
  onOpenPalette: () => void
}

/**
 * Barra lateral do painel. SEMPRE escura nos dois temas (não acompanha o tema),
 * por isso usa valores fixos (#1A1715 / #C9C4BF) em vez de tokens admin.
 * Redesign 2026-06 (Fundação · Shell do app).
 */
export function AdminSidebar({ collapsed, onToggle, onOpenPalette }: AdminSidebarProps) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { roles, capabilities } = useAdminAccess()
  const nav = visibleNav(capabilities)
  const roleLabel = roles.map(r => ROLE_META[r]?.label ?? r).join(' · ')
  const userName = user?.user_metadata?.full_name ?? user?.email

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut()
    } catch (error) {
      logger.error('[AdminSidebar] Erro ao sair:', error)
    }
    navigate('/admin/login')
  }

  return (
    <TooltipProvider delayDuration={100}>
      <aside
        className={cn(
          'shrink-0 h-screen z-20 flex flex-col bg-[#1A1715] text-[#C9C4BF] border-r border-[#2A2522]',
          'motion-safe:transition-[width] motion-safe:duration-200',
          collapsed ? 'w-14' : 'w-60',
        )}
      >
        {/* Marca */}
        <div className={cn('flex items-center gap-2.5 px-3.5 pt-4 pb-3', collapsed && 'justify-center px-0')}>
          <div
            className="w-[30px] h-[30px] rounded-lg bg-[#AB2350] flex items-center justify-center shrink-0"
            style={{ boxShadow: '0 1px 2px rgba(171,35,80,0.4)' }}
          >
            <span className="text-white text-[15px] font-extrabold leading-none">A</span>
          </div>
          {!collapsed && (
            <div className="min-w-0 flex flex-col leading-tight">
              <span className="text-[13.5px] font-bold text-white tracking-tight truncate">Arena Admin</span>
              <span className="text-[11px] font-medium text-[#8A8580] truncate">ENAMED</span>
            </div>
          )}
        </div>

        {/* Busca (abre paleta de comandos) */}
        <div className={cn('px-3 pb-3', collapsed && 'px-2')}>
          <button
            type="button"
            onClick={onOpenPalette}
            aria-label="Buscar (Ctrl K)"
            className={cn(
              'flex items-center gap-2 w-full rounded-lg border border-[#332E2B] bg-[#221E1B]',
              'text-[#8A8580] hover:border-[#403A36] hover:text-[#C9C4BF] motion-safe:transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#AB2350]/60',
              collapsed ? 'h-9 justify-center' : 'h-9 px-2.5',
            )}
          >
            <Search className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {!collapsed && (
              <>
                <span className="text-[12.5px] flex-1 text-left">Buscar…</span>
                <kbd className="text-[10px] bg-[#1A1715] border border-[#332E2B] rounded px-1.5 py-0.5 text-[#8A8580] font-medium">
                  Ctrl K
                </kbd>
              </>
            )}
          </button>
        </div>

        {/* Navegação */}
        <nav aria-label="Navegação administrativa" className="flex-1 overflow-y-auto px-2.5 flex flex-col gap-5 py-1">
          {nav.map(group => (
            <div key={group.title}>
              {!collapsed && (
                <p
                  className="text-[9.5px] font-bold text-[#6B6661] uppercase px-2 mb-1.5"
                  style={{ letterSpacing: '0.13em' }}
                >
                  {group.title}
                </p>
              )}
              <div className="flex flex-col gap-0.5">
                {group.items.map(item => {
                  const Icon = item.icon
                  const link = (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.end}
                      aria-label={item.label}
                      className={({ isActive }) =>
                        cn(
                          'relative flex items-center gap-2.5 rounded-lg motion-safe:transition-colors',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#AB2350]/60',
                          collapsed ? 'h-9 justify-center' : 'px-[11px] py-2',
                          isActive
                            ? 'bg-[#AB2350] text-white'
                            : 'text-[#C9C4BF] hover:bg-white/[0.04] hover:text-white',
                        )
                      }
                      style={({ isActive }) =>
                        isActive ? { boxShadow: '0 1px 3px rgba(171,35,80,0.4)' } : undefined
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <Icon
                            className={cn('h-4 w-4 shrink-0', isActive ? 'text-white' : 'text-[#8A8580]')}
                            aria-hidden
                          />
                          {!collapsed && (
                            <span className="text-[13px] font-medium truncate">{item.label}</span>
                          )}
                        </>
                      )}
                    </NavLink>
                  )
                  return collapsed ? (
                    <Tooltip key={item.to}>
                      <TooltipTrigger asChild>{link}</TooltipTrigger>
                      <TooltipContent side="right" className="text-xs">{item.label}</TooltipContent>
                    </Tooltip>
                  ) : link
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Rodapé: perfil + sair */}
        <div className="border-t border-[#2A2522] p-2.5 flex flex-col gap-1">
          <div className={cn('flex items-center gap-2.5 px-1 py-1', collapsed && 'justify-center px-0')}>
            <div className="w-8 h-8 rounded-full bg-[#332E2B] border border-[#403A36] flex items-center justify-center shrink-0">
              <span className="text-[11px] font-bold text-[#C9C4BF] leading-none">
                {getInitials(userName)}
              </span>
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-semibold text-white truncate">{userName}</p>
                <p className="text-[10.5px] text-[#8A8580] truncate">{roleLabel || 'Sem perfil'}</p>
              </div>
            )}
            {!collapsed && (
              <button
                type="button"
                aria-label="Sair do painel"
                title="Sair"
                onClick={handleLogout}
                className="w-8 h-8 shrink-0 rounded-lg flex items-center justify-center text-[#8A8580] hover:bg-white/[0.06] hover:text-white motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#AB2350]/60"
              >
                <LogOut className="h-3.5 w-3.5" aria-hidden />
              </button>
            )}
          </div>

          <div className={cn('flex gap-1', collapsed && 'flex-col items-center')}>
            {collapsed && (
              <button
                type="button"
                aria-label="Sair do painel"
                title="Sair"
                onClick={handleLogout}
                className="h-8 flex-1 w-full rounded-lg flex items-center justify-center text-[#8A8580] hover:bg-white/[0.06] hover:text-white motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#AB2350]/60"
              >
                <LogOut className="h-3.5 w-3.5" aria-hidden />
              </button>
            )}
            <button
              type="button"
              aria-label={collapsed ? 'Expandir menu (Ctrl B)' : 'Recolher menu (Ctrl B)'}
              title={collapsed ? 'Expandir (Ctrl B)' : 'Recolher (Ctrl B)'}
              onClick={onToggle}
              className="h-8 flex-1 w-full rounded-lg flex items-center justify-center text-[#8A8580] hover:bg-white/[0.06] hover:text-white motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#AB2350]/60"
            >
              {collapsed
                ? <ChevronsRight className="h-3.5 w-3.5" aria-hidden />
                : <ChevronsLeft className="h-3.5 w-3.5" aria-hidden />}
            </button>
          </div>
        </div>
      </aside>
    </TooltipProvider>
  )
}
