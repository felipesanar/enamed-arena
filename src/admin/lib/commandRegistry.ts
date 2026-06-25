import {
  FilePlus, Upload, SunMoon, PanelLeftClose, type LucideIcon,
} from 'lucide-react'
import { ADMIN_NAV } from '@/admin/lib/navigation'

export interface AdminCommand {
  id: string
  label: string
  icon: LucideIcon
  group: 'Navegação' | 'Ações'
  /** null = disponível para qualquer usuário com acesso ao admin */
  capability: string | null
  keywords: string[]
  /** rota para navegar OU id de ação tratada pelo consumidor */
  route?: string
  actionId?: 'toggle-theme' | 'toggle-sidebar'
}

const NAV_COMMANDS: AdminCommand[] = ADMIN_NAV.flatMap(group =>
  group.items.map(item => ({
    id: `nav.${item.to.replace('/admin', '').replace(/^\//, '') || 'dashboard'}`,
    label: item.label,
    icon: item.icon,
    group: 'Navegação' as const,
    capability: item.capability,
    keywords: [item.label.toLowerCase(), group.title.toLowerCase()],
    route: item.to,
  })),
)

const ACTION_COMMANDS: AdminCommand[] = [
  {
    id: 'action.create-simulado',
    label: 'Novo simulado',
    icon: FilePlus,
    group: 'Ações',
    capability: 'content.manage',
    keywords: ['novo', 'criar', 'simulado', 'prova'],
    route: '/admin/simulados/novo',
  },
  {
    id: 'action.upload-questions',
    label: 'Subir questões por planilha',
    icon: Upload,
    group: 'Ações',
    capability: 'content.manage',
    keywords: ['subir', 'enviar', 'importar', 'questões', 'xlsx', 'csv', 'planilha'],
    route: '/admin/simulados',
  },
  {
    id: 'action.toggle-theme',
    label: 'Trocar entre tema claro e escuro',
    icon: SunMoon,
    group: 'Ações',
    capability: null,
    keywords: ['tema', 'claro', 'escuro'],
    actionId: 'toggle-theme',
  },
  {
    id: 'action.toggle-sidebar',
    label: 'Recolher ou expandir o menu',
    icon: PanelLeftClose,
    group: 'Ações',
    capability: null,
    keywords: ['menu', 'lateral', 'recolher', 'expandir'],
    actionId: 'toggle-sidebar',
  },
]

/** Comandos disponíveis para um conjunto de capabilities. */
export function getAvailableCommands(capabilities: Set<string>): AdminCommand[] {
  return [...NAV_COMMANDS, ...ACTION_COMMANDS].filter(
    c => c.capability === null || capabilities.has(c.capability),
  )
}
