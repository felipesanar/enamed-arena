// src/admin/AdminApp.tsx
import { useState, useCallback } from 'react'
import { Outlet } from 'react-router-dom'
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
      <div className="flex min-h-screen bg-background">
        <AdminRail activeGroup={activeGroup} onGroupClick={handleGroupClick} />
        <AdminFlyout activeGroup={activeGroup} onClose={handleFlyoutClose} />
        <div className="flex flex-col flex-1 min-w-0">
          <AdminTopbar />
          <main className="flex-1 p-5 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </AdminPeriodProvider>
  )
}
