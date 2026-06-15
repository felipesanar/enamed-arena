import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { AdminAccessProvider, useAdminCan, useAdminAccess } from '@/admin/contexts/AdminAccessContext'
import type { ReactNode } from 'react'

const wrapper = (caps: string[], roles: string[] = ['support']) =>
  ({ children }: { children: ReactNode }) => (
    <AdminAccessProvider roles={roles} capabilities={caps}>{children}</AdminAccessProvider>
  )

describe('AdminAccessContext', () => {
  it('useAdminCan responde por capability', () => {
    const { result } = renderHook(() => useAdminCan('users.manage'), {
      wrapper: wrapper(['users.view', 'users.manage']),
    })
    expect(result.current).toBe(true)
  })

  it('useAdminCan nega capability ausente', () => {
    const { result } = renderHook(() => useAdminCan('roles.manage'), {
      wrapper: wrapper(['users.view']),
    })
    expect(result.current).toBe(false)
  })

  it('expõe roles e capabilities como Set', () => {
    const { result } = renderHook(() => useAdminAccess(), {
      wrapper: wrapper(['intel.view'], ['analyst']),
    })
    expect(result.current.roles).toEqual(['analyst'])
    expect(result.current.capabilities.has('intel.view')).toBe(true)
  })

  it('fora do provider, nega tudo (default seguro)', () => {
    const { result } = renderHook(() => useAdminCan('dashboard.view'))
    expect(result.current).toBe(false)
  })
})
