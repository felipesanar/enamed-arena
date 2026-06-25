import {
  LayoutDashboard, FileText, Database, Users, ClipboardList,
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

/**
 * Navegação Opção B (redesign 2026-06): organizada por intenção de quem usa,
 * não por tipo de objeto. Rótulos diretos, sem jargão.
 * Rotas existentes permanecem; só "Banco de questões" é destino novo.
 */
export const ADMIN_NAV: AdminNavGroup[] = [
  {
    title: 'Início',
    items: [
      { to: '/admin', label: 'Início', icon: LayoutDashboard, capability: 'dashboard.view', end: true },
    ],
  },
  {
    title: 'Conteúdo',
    items: [
      { to: '/admin/simulados', label: 'Simulados',         icon: FileText, capability: 'content.manage' },
      { to: '/admin/questoes',  label: 'Banco de questões', icon: Database, capability: 'content.manage' },
    ],
  },
  {
    title: 'Pessoas',
    items: [
      { to: '/admin/usuarios',   label: 'Usuários',   icon: Users,         capability: 'users.view' },
      { to: '/admin/tentativas', label: 'Tentativas', icon: ClipboardList, capability: 'attempts.view' },
    ],
  },
  {
    title: 'Análise',
    items: [
      { to: '/admin/inteligencia', label: 'Visão geral', icon: Gauge,    capability: 'intel.view' },
      { to: '/admin/analytics',    label: 'Jornada',     icon: Route,     capability: 'intel.view' },
      { to: '/admin/marketing',    label: 'Aquisição',   icon: Megaphone, capability: 'intel.view' },
      { to: '/admin/produto',      label: 'Produto',     icon: Compass,   capability: 'intel.view' },
    ],
  },
  {
    title: 'Sistema',
    items: [
      { to: '/admin/previews',  label: 'Prévia do aluno', icon: Eye,        capability: 'previews.view' },
      { to: '/admin/auditoria', label: 'Auditoria',       icon: ScrollText, capability: 'audit.view' },
    ],
  },
]

/** Grupos visíveis para um conjunto de capabilities (grupo some se vazio). */
export function visibleNav(capabilities: Set<string>): AdminNavGroup[] {
  return ADMIN_NAV
    .map(g => ({ ...g, items: g.items.filter(i => capabilities.has(i.capability)) }))
    .filter(g => g.items.length > 0)
}
