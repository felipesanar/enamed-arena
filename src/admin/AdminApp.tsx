// src/admin/AdminApp.tsx
import { useState, useCallback } from 'react'
import { Outlet } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import { AdminRail, type RailGroup } from './components/AdminRail'
import { AdminFlyout } from './components/AdminFlyout'
import { AdminTopbar } from './components/AdminTopbar'
import { AdminPeriodProvider } from './contexts/AdminPeriodContext'

export function AdminApp() {
  const [activeGroup, setActiveGroup] = useState<RailGroup | null>(null)

  const handleGroupClick = useCallback((group: RailGroup) => {
    setActiveGroup(prev => (prev === group ? null : group))
  }, [])

  const handleFlyoutClose = useCallback(() => {
    setActiveGroup(null)
  }, [])

  return (
    <AdminPeriodProvider>
      <div className="flex min-h-screen bg-background antialiased">
        <AdminRail activeGroup={activeGroup} onGroupClick={handleGroupClick} />
        <AdminFlyout activeGroup={activeGroup} onClose={handleFlyoutClose} />
        <div className="flex flex-col flex-1 min-w-0">
          <AdminTopbar />
          <div
            role="note"
            className="md:hidden flex items-center gap-2 border-b border-warning/30 bg-warning/10 px-4 py-2 text-[11px] font-medium text-warning-foreground/90"
          >
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-warning" aria-hidden />
            <span className="text-foreground/80">
              Painel admin otimizado para desktop. Recomendamos usar uma tela maior.
            </span>
          </div>
          <main className="flex-1 p-5 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </AdminPeriodProvider>
  )
}
