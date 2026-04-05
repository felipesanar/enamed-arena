// src/admin/components/AdminRail.tsx
import { useNavigate } from 'react-router-dom'
import { LayoutDashboard, Database, BarChart3, Settings2, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { supabase } from '@/integrations/supabase/client'

export type RailGroup = 'operacional' | 'dados' | 'inteligencia' | 'sistema'

interface RailGroupConfig {
  id: RailGroup
  label: string
  icon: React.ElementType
}

const GROUPS: RailGroupConfig[] = [
  { id: 'operacional',  label: 'Operacional',  icon: LayoutDashboard },
  { id: 'dados',        label: 'Dados',         icon: Database },
  { id: 'inteligencia', label: 'Inteligência',  icon: BarChart3 },
  { id: 'sistema',      label: 'Sistema',       icon: Settings2 },
]

interface AdminRailProps {
  activeGroup: RailGroup | null
  onGroupClick: (group: RailGroup) => void
}

export function AdminRail({ activeGroup, onGroupClick }: AdminRailProps) {
  const navigate = useNavigate()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/admin/login')
  }

  return (
    <aside className="w-14 shrink-0 bg-card border-r border-border flex flex-col items-center py-3 gap-1 min-h-screen z-20">
      {/* Logo */}
      <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center mb-3 shrink-0">
        <span className="text-primary-foreground text-sm font-black">E</span>
      </div>

      {GROUPS.map((g, i) => {
        const Icon = g.icon
        const isActive = activeGroup === g.id
        return (
          <div key={g.id}>
            {i > 0 && <div className="w-6 h-px bg-border my-1" />}
            <button
              title={g.label}
              onClick={() => onGroupClick(g.id)}
              className={cn(
                'w-9 h-9 rounded-lg flex items-center justify-center transition-colors relative',
                isActive
                  ? 'bg-primary/10 border border-primary/30 text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-primary rounded-r" />
              )}
              <Icon className="h-4 w-4" />
            </button>
          </div>
        )
      })}

      <div className="flex-1" />

      <button
        title="Sair"
        onClick={handleLogout}
        className="w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
      >
        <LogOut className="h-4 w-4" />
      </button>
    </aside>
  )
}
