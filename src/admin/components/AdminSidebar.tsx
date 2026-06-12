import { NavLink, useNavigate } from 'react-router-dom'
import { Search, LogOut, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { useAdminAccess } from '@/admin/contexts/AdminAccessContext'
import { visibleNav } from '@/admin/lib/navigation'
import { getInitials } from '@/admin/lib/format'
import { ROLE_META } from '@/admin/lib/constants'
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip'

interface AdminSidebarProps {
  collapsed: boolean
  onToggle: () => void
  onOpenPalette: () => void
}

export function AdminSidebar({ collapsed, onToggle, onOpenPalette }: AdminSidebarProps) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { roles, capabilities } = useAdminAccess()
  const nav = visibleNav(capabilities)
  const roleLabel = roles.map(r => ROLE_META[r]?.label ?? r).join(' · ')

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/admin/login')
  }

  return (
    <TooltipProvider delayDuration={100}>
      <aside
        className={cn(
          'shrink-0 min-h-screen z-20 flex flex-col bg-admin-surface border-r border-admin-line',
          'motion-safe:transition-[width] motion-safe:duration-200',
          collapsed ? 'w-14' : 'w-[232px]',
        )}
      >
        <div className={cn('flex items-center gap-2.5 px-3 pt-4 pb-3', collapsed && 'justify-center px-0')}>
          <div className="w-8 h-8 rounded-lg bg-admin-accent flex items-center justify-center shrink-0">
            <span className="text-admin-accent-contrast text-sm font-black">A</span>
          </div>
          {!collapsed && (
            <span className="text-sm font-semibold text-admin-text truncate">Arena Admin</span>
          )}
        </div>

        <div className={cn('px-3 pb-3', collapsed && 'px-2')}>
          <button
            type="button"
            onClick={onOpenPalette}
            aria-label="Buscar (Ctrl+K)"
            className={cn(
              'flex items-center gap-2 w-full rounded-md border border-admin-line bg-admin-raised/60',
              'text-admin-faint hover:border-admin-line-strong hover:text-admin-muted motion-safe:transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-admin-accent/50',
              collapsed ? 'h-9 justify-center' : 'h-8 px-2.5',
            )}
          >
            <Search className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {!collapsed && (
              <>
                <span className="text-xs flex-1 text-left">Buscar…</span>
                <kbd className="text-[10px] bg-admin-raised border border-admin-line rounded px-1 py-0.5 text-admin-faint">
                  Ctrl K
                </kbd>
              </>
            )}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 flex flex-col gap-4">
          {nav.map(group => (
            <div key={group.title}>
              {!collapsed && (
                <p className="text-[10px] font-semibold text-admin-faint uppercase tracking-widest px-2 mb-1">
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
                      className={({ isActive }) =>
                        cn(
                          'relative flex items-center gap-2.5 rounded-md motion-safe:transition-colors',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-admin-accent/50',
                          collapsed ? 'h-9 justify-center' : 'h-8 px-2.5',
                          isActive
                            ? 'bg-admin-accent/10 text-admin-accent'
                            : 'text-admin-muted hover:bg-admin-raised hover:text-admin-text',
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          {isActive && (
                            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-admin-accent rounded-r" />
                          )}
                          <Icon className="h-4 w-4 shrink-0" aria-hidden />
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

        <div className="border-t border-admin-line p-2 flex flex-col gap-1">
          <div className={cn('flex items-center gap-2 px-1.5 py-1', collapsed && 'justify-center px-0')}>
            <div className="w-7 h-7 rounded-full bg-admin-raised border border-admin-line flex items-center justify-center shrink-0">
              <span className="text-[10px] font-bold text-admin-muted leading-none">
                {getInitials(user?.user_metadata?.full_name ?? user?.email)}
              </span>
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium text-admin-text truncate">
                  {user?.user_metadata?.full_name ?? user?.email}
                </p>
                <p className="text-[10px] text-admin-faint truncate">{roleLabel || '—'}</p>
              </div>
            )}
          </div>
          <div className={cn('flex gap-1', collapsed && 'flex-col items-center')}>
            <button
              type="button"
              title="Sair"
              onClick={handleLogout}
              className="h-7 flex-1 rounded-md flex items-center justify-center text-admin-faint hover:bg-admin-raised hover:text-admin-text motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-admin-accent/50"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden />
            </button>
            <button
              type="button"
              title={collapsed ? 'Expandir (Ctrl+B)' : 'Colapsar (Ctrl+B)'}
              onClick={onToggle}
              className="h-7 flex-1 rounded-md flex items-center justify-center text-admin-faint hover:bg-admin-raised hover:text-admin-text motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-admin-accent/50"
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
