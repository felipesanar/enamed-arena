// src/admin/components/AdminFlyout.tsx
import { useEffect, useRef } from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Headphones, Users, FileText, ClipboardList,
  BarChart3, Megaphone, Compass, Monitor, Shield, Trophy,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { RailGroup } from './AdminRail'

interface FlyoutItem {
  to: string
  label: string
  description: string
  icon: React.ElementType
  phase: 'live' | 'p0' | 'p1'
}

const FLYOUT_GROUPS: Record<RailGroup, { title: string; items: FlyoutItem[] }> = {
  operacional: {
    title: 'Operacional',
    items: [
      { to: '/admin',     label: 'Dashboard', description: 'Central de comando', icon: LayoutDashboard, phase: 'live' },
      { to: '/admin/suporte', label: 'Suporte', description: 'Tickets e chamados', icon: Headphones, phase: 'p0' },
    ],
  },
  dados: {
    title: 'Dados',
    items: [
      { to: '/admin/usuarios',   label: 'Usuários',   description: 'Gestão e perfis',      icon: Users,          phase: 'p0' },
      { to: '/admin/simulados',  label: 'Simulados',  description: 'Gestão e analytics',   icon: FileText,       phase: 'live' },
      { to: '/admin/tentativas', label: 'Tentativas', description: 'Histórico e detalhes', icon: ClipboardList,  phase: 'live' },
      { to: '/admin/ranking-preview', label: 'Preview ranking', description: 'UI do ranking (liberado)', icon: Trophy, phase: 'live' },
    ],
  },
  inteligencia: {
    title: 'Inteligência',
    items: [
      { to: '/admin/analytics', label: 'Analytics', description: 'Produto e jornada',   icon: BarChart3,  phase: 'live' },
      { to: '/admin/marketing', label: 'Marketing', description: 'Aquisição e coortes', icon: Megaphone,  phase: 'live' },
      { to: '/admin/produto',   label: 'Produto',   description: 'Funil e fricções',    icon: Compass,    phase: 'live' },
    ],
  },
  sistema: {
    title: 'Sistema',
    items: [
      { to: '/admin/tecnologia', label: 'Tecnologia', description: 'Saúde e erros',     icon: Monitor, phase: 'p1' },
      { to: '/admin/auditoria',  label: 'Auditoria',  description: 'Permissões e logs', icon: Shield,  phase: 'p1' },
    ],
  },
}

interface AdminFlyoutProps {
  activeGroup: RailGroup | null
  onClose: () => void
}

export function AdminFlyout({ activeGroup, onClose }: AdminFlyoutProps) {
  const ref = useRef<HTMLDivElement>(null)
  const isOpen = activeGroup !== null
  const group = activeGroup ? FLYOUT_GROUPS[activeGroup] : null

  // Fecha ao clicar fora
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [isOpen, onClose])

  // Fecha com ESC
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  return (
    <div
      ref={ref}
      className={cn(
        'shrink-0 bg-card/90 backdrop-blur-sm border-r border-border overflow-hidden',
        'motion-safe:transition-[width] motion-safe:duration-200 motion-reduce:duration-0',
        isOpen ? 'w-52' : 'w-0',
      )}
    >
      <div className="w-52 h-full flex flex-col p-3 pt-4">
        {group && (
          <>
            <p className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest mb-3 px-1">
              {group.title}
            </p>
            <nav className="flex flex-col gap-0.5 flex-1">
              {group.items.map(item => {
                const Icon = item.icon
                const isDisabled = item.phase === 'p1'

                if (isDisabled) {
                  return (
                    <div
                      key={item.to}
                      className="flex items-center gap-2.5 px-2.5 py-2 rounded-md opacity-35 cursor-not-allowed"
                    >
                      <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[12px] font-medium text-muted-foreground truncate">
                            {item.label}
                          </span>
                          <span className="text-[8px] bg-muted text-muted-foreground px-1 py-0.5 rounded">
                            em breve
                          </span>
                        </div>
                        <p className="text-[9px] text-muted-foreground/60 truncate">{item.description}</p>
                      </div>
                    </div>
                  )
                }

                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/admin'}
                    onClick={onClose}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-2.5 px-2.5 py-2 rounded-md motion-safe:transition-colors',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
                        isActive
                          ? 'bg-primary/10 text-primary'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                      )
                    }
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[12px] font-medium truncate leading-tight">{item.label}</p>
                      <p className="text-[9px] text-muted-foreground/70 truncate">{item.description}</p>
                    </div>
                  </NavLink>
                )
              })}
            </nav>
            <p className="text-[8px] text-muted-foreground/25 text-center pt-2 border-t border-border/50">
              ESC para fechar
            </p>
          </>
        )}
      </div>
    </div>
  )
}
