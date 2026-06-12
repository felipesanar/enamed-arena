import { createContext, useContext, useMemo, type ReactNode } from 'react'

interface AdminAccessValue {
  roles: string[]
  capabilities: Set<string>
}

const AdminAccessContext = createContext<AdminAccessValue>({
  roles: [],
  capabilities: new Set(),
})

interface AdminAccessProviderProps {
  roles: string[]
  capabilities: string[]
  children: ReactNode
}

export function AdminAccessProvider({ roles, capabilities, children }: AdminAccessProviderProps) {
  const value = useMemo(
    () => ({ roles, capabilities: new Set(capabilities) }),
    [roles, capabilities],
  )
  return <AdminAccessContext.Provider value={value}>{children}</AdminAccessContext.Provider>
}

export function useAdminAccess() {
  return useContext(AdminAccessContext)
}

/** Gate de UI por capability. Fora do provider → false (default seguro). */
export function useAdminCan(capability: string): boolean {
  return useAdminAccess().capabilities.has(capability)
}
