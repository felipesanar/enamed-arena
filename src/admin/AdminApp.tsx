// src/admin/AdminApp.tsx
import { useCallback, useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import { AdminSidebar } from './components/AdminSidebar'
import { AdminTopbar } from './components/AdminTopbar'
import { AdminCommandPalette } from './components/AdminCommandPalette'
import { AdminPeriodProvider } from './contexts/AdminPeriodContext'

const SIDEBAR_KEY = 'admin.sidebar.collapsed'

export function AdminApp() {
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(SIDEBAR_KEY) === '1' } catch { return false }
  })
  const [paletteOpen, setPaletteOpen] = useState(false)

  const toggleSidebar = useCallback(() => {
    setCollapsed(prev => {
      const next = !prev
      try { localStorage.setItem(SIDEBAR_KEY, next ? '1' : '0') } catch { /* noop */ }
      return next
    })
  }, [])

  const openPalette = useCallback(() => setPaletteOpen(true), [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen(open => !open)
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault()
        toggleSidebar()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [toggleSidebar])

  return (
    <AdminPeriodProvider>
      <div className="admin-root flex min-h-screen antialiased">
        <AdminSidebar collapsed={collapsed} onToggle={toggleSidebar} onOpenPalette={openPalette} />
        <div className="flex flex-col flex-1 min-w-0">
          <AdminTopbar />
          <div
            role="note"
            className="md:hidden flex items-center gap-2 border-b border-admin-warning/30 bg-admin-warning/10 px-4 py-2 text-[11px] font-medium"
          >
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-admin-warning" aria-hidden />
            <span className="text-admin-text/80">
              Painel admin otimizado para desktop. Recomendamos usar uma tela maior.
            </span>
          </div>
          <main className="flex-1 p-5 overflow-auto">
            <Outlet />
          </main>
        </div>
        <AdminCommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      </div>
    </AdminPeriodProvider>
  )
}
