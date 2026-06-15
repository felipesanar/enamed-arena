import {
  LayoutDashboard, FileText, Users, ClipboardList,
  Route, Megaphone, Compass, Eye, Gauge, ScrollText, type LucideIcon,
} from 'lucide-react'

export interface AdminNavItem {
  to: string
  label: string
  icon: LucideIcon
  capability: string
  /** NavLink end (rota index) */
  end?: boolean
}

export interface AdminNavGroup {
  title: string
  items: AdminNavItem[]
}

export const ADMIN_NAV: AdminNavGroup[] = [
  {
    title: 'Visão',
    items: [
      { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, capability: 'dashboard.view', end: true },
    ],
  },
  {
    title: 'Gestão',
    items: [
      { to: '/admin/simulados',  label: 'Simulados',  icon: FileText,      capability: 'content.manage' },
      { to: '/admin/usuarios',   label: 'Usuários',   icon: Users,         capability: 'users.view' },
      { to: '/admin/tentativas', label: 'Tentativas', icon: ClipboardList, capability: 'attempts.view' },
    ],
  },
  {
    title: 'Inteligência',
    items: [
      { to: '/admin/inteligencia', label: 'Panorama', icon: Gauge,    capability: 'intel.view' },
      { to: '/admin/analytics', label: 'Jornada',   icon: Route,      capability: 'intel.view' },
      { to: '/admin/marketing', label: 'Aquisição', icon: Megaphone,  capability: 'intel.view' },
      { to: '/admin/produto',   label: 'Produto',   icon: Compass,    capability: 'intel.view' },
    ],
  },
  {
    title: 'Ferramentas',
    items: [
      { to: '/admin/previews', label: 'Previews', icon: Eye, capability: 'previews.view' },
    ],
  },
  {
    title: 'Governança',
    items: [
      { to: '/admin/auditoria', label: 'Auditoria', icon: ScrollText, capability: 'audit.view' },
    ],
  },
]

/** Grupos visíveis para um conjunto de capabilities (grupo some se vazio). */
export function visibleNav(capabilities: Set<string>): AdminNavGroup[] {
  return ADMIN_NAV
    .map(g => ({ ...g, items: g.items.filter(i => capabilities.has(i.capability)) }))
    .filter(g => g.items.length > 0)
}
