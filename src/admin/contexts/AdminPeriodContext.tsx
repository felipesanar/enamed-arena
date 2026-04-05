// src/admin/contexts/AdminPeriodContext.tsx
import { createContext, useContext, useState } from 'react'
import type { ReactNode } from 'react'
import type { AdminPeriod } from '@/admin/types'

const STORAGE_KEY = 'admin_period'

interface AdminPeriodContextValue {
  period: AdminPeriod
  setPeriod: (p: AdminPeriod) => void
}

const AdminPeriodContext = createContext<AdminPeriodContextValue | null>(null)

export function AdminPeriodProvider({ children }: { children: ReactNode }) {
  const [period, setPeriodState] = useState<AdminPeriod>(() => {
    const stored = sessionStorage.getItem(STORAGE_KEY)
    return (stored === '7' || stored === '30' || stored === '90')
      ? (Number(stored) as AdminPeriod)
      : 7
  })

  const setPeriod = (p: AdminPeriod) => {
    sessionStorage.setItem(STORAGE_KEY, String(p))
    setPeriodState(p)
  }

  return (
    <AdminPeriodContext.Provider value={{ period, setPeriod }}>
      {children}
    </AdminPeriodContext.Provider>
  )
}

export function useAdminPeriod() {
  const ctx = useContext(AdminPeriodContext)
  if (!ctx) throw new Error('useAdminPeriod must be used inside AdminPeriodProvider')
  return ctx
}
