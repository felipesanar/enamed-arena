import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import type { AdminPeriod } from '@/admin/types'
import type { AdminReportCatalog, AdminReportRange, AdminReportScope } from '@/types/admin-period'
import { brtToday, rangeScope, restoreReportFilters } from '@/admin/lib/adminPeriod'

interface AdminPeriodContextValue {
  period: AdminPeriod
  setPeriod: (p: AdminPeriod) => void
  reportEditionId: string | null
  reportRange: AdminReportRange
  setReportEditionId: (id: string | null) => void
  setReportRange: (range: AdminReportRange) => void
  setReportCatalog: (catalog: AdminReportCatalog) => void
  reportCatalog: AdminReportCatalog
  reportScope: AdminReportScope | undefined
  reportError: string | null
  reportWarning: string | null
  reportUserId: string | null
}
const AdminPeriodContext = createContext<AdminPeriodContextValue | null>(null)

function ReportProvider({ children, userId, period, setPeriod }: {
  children: ReactNode; userId: string | null; period: AdminPeriod; setPeriod: (p: AdminPeriod) => void
}) {
  const key = userId ? `admin-report:${userId}:v1` : null
  const [filters, setFilters] = useState(() => {
    try { return restoreReportFilters(key ? sessionStorage.getItem(key) : null) }
    catch { return { ...restoreReportFilters(null), warning: 'Armazenamento de sessão indisponível. Os filtros ficarão apenas na memória.' } }
  })
  const [catalog, setReportCatalog] = useState<AdminReportCatalog>({ status: 'loading', editions: [] })
  const persist = (next: typeof filters) => {
    try { if (key) sessionStorage.setItem(key, JSON.stringify({ editionId: next.editionId, range: next.range })) }
    catch { next = { ...next, warning: 'Armazenamento de sessão indisponível. Os filtros ficarão apenas na memória.' } }
    setFilters(next)
  }
  // A preset has one calendar anchor, updated only at the BRT day boundary.
  useEffect(() => {
    if (filters.range.kind !== 'preset') return
    const nextMidnight = Date.parse(`${brtToday()}T00:00:00-03:00`) + 86_400_000
    const timer = window.setTimeout(() => {
      setFilters(current => current.range.kind === 'preset'
        ? { ...current, range: { ...current.range, anchor: brtToday() } } : current)
    }, Math.max(1, nextMidnight - Date.now()))
    return () => window.clearTimeout(timer)
  }, [filters.range])
  const reportError = !userId ? 'Entre novamente para consultar os relatórios.'
    : catalog.status !== 'ready' ? 'Aguarde o catálogo de edições ou tente novamente.'
    : filters.editionId !== null && !catalog.editions.some(e => e.id === filters.editionId)
      ? 'A edição selecionada não está disponível. Escolha uma edição para continuar.' : null
  const reportScope = reportError ? undefined : { editionId: filters.editionId, ...rangeScope(filters.range) }
  return <AdminPeriodContext.Provider value={{
    period, setPeriod, reportUserId: userId,
    reportEditionId: filters.editionId, reportRange: filters.range,
    setReportEditionId: editionId => persist({ ...filters, editionId, warning: null }),
    setReportRange: range => { rangeScope(range); persist({ ...filters, range, warning: null }) },
    reportCatalog: catalog, setReportCatalog, reportScope, reportError, reportWarning: filters.warning,
  }}>{children}</AdminPeriodContext.Provider>
}

export function AdminPeriodProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [period, setPeriodState] = useState<AdminPeriod>(() => {
    try {
      const stored = sessionStorage.getItem('admin_period')
      return stored === '7' || stored === '30' || stored === '90' ? Number(stored) as AdminPeriod : 7
    } catch { return 7 }
  })
  const setPeriod = useCallback((p: AdminPeriod) => {
    try { sessionStorage.setItem('admin_period', String(p)) } catch { /* In-memory legacy period still works. */ }
    setPeriodState(p)
  }, [])
  // Remount report state synchronously on identity changes; never render the previous account's filters.
  return <ReportProvider key={user?.id ?? 'anonymous'} userId={user?.id ?? null} period={period} setPeriod={setPeriod}>{children}</ReportProvider>
}

export function useAdminPeriod() {
  const ctx = useContext(AdminPeriodContext)
  if (!ctx) throw new Error('useAdminPeriod must be used inside AdminPeriodProvider')
  return ctx
}
