import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import type { AdminReportScope } from '@/types/admin-period'
const state = vi.hoisted(() => ({ user: 'a' as string | null, can: true }))
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: state.user ? { id: state.user } : null, loading: false }) }))
vi.mock('@/admin/contexts/AdminAccessContext', () => ({ useAdminCan: () => state.can }))
vi.mock('@/admin/services/adminApi', () => ({ adminApi: {
  getCohortRetention: vi.fn(async () => []), getPerformanceByArea: vi.fn(async () => []), getPerformanceByTheme: vi.fn(async () => []),
  getScoreDistribution: vi.fn(async () => []), getScoreEvolution: vi.fn(async () => []), getSegmentBreakdown: vi.fn(async () => []), getIntelInsights: vi.fn(async () => []),
} }))
import { adminApi } from '@/admin/services/adminApi'
import * as hooks from './useAdminInteligencia'
const calls = [
  (s?: AdminReportScope, e = true) => hooks.useAdminCohortRetention(6, s, e),
  (s?: AdminReportScope, e = true) => hooks.useAdminPerformanceByArea(null, 'all', s, e),
  (s?: AdminReportScope, e = true) => hooks.useAdminPerformanceByTheme(null, 'Clínica', e, s),
  (s?: AdminReportScope, e = true) => hooks.useAdminScoreDistribution(null, s, e),
  hooks.useAdminScoreEvolution, hooks.useAdminSegmentBreakdown, hooks.useAdminIntelInsights,
]
const scope = { editionId: 'edition-a', startAt: '2026-10-01T03:00:00.000Z', endAt: '2026-11-01T03:00:00.000Z' }
describe('report hook cache isolation', () => {
  beforeEach(() => { vi.clearAllMocks(); state.user = 'a'; state.can = true })
  for (const [index, hook] of calls.entries()) {
    it(`hook ${index + 1}: normalized scope/account keys and cached back navigation`, async () => {
      const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
      const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
      const view = renderHook(({ s }) => hook(s, true), { wrapper, initialProps: { s: scope } })
      await waitFor(() => expect(view.result.current.isSuccess).toBe(true))
      view.rerender({ s: { ...scope } })
      expect(client.getQueryCache().getAll()).toHaveLength(1)
      view.rerender({ s: { ...scope, editionId: 'edition-b' } })
      await waitFor(() => expect(view.result.current.isSuccess).toBe(true))
      view.rerender({ s: scope })
      expect(view.result.current.isSuccess).toBe(true)
      expect(Object.values(adminApi).reduce((n, fn) => n + vi.mocked(fn).mock.calls.length, 0)).toBe(2)
      state.user = 'b'; view.rerender({ s: scope })
      await waitFor(() => expect(view.result.current.isSuccess).toBe(true))
      expect(client.getQueryCache().getAll()).toHaveLength(3)
      expect(client.getQueryCache().getAll().every(q => q.queryKey.includes(scope.startAt) && q.queryKey.includes(scope.endAt))).toBe(true)
      view.unmount(); client.clear()
    })
  }
  it('disables queries for missing identity/capability and preserves theme enabled', async () => {
    const client = new QueryClient()
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
    state.user = null
    const view = renderHook(() => calls.map(hook => hook(scope, true)), { wrapper })
    expect(view.result.current.every(q => q.fetchStatus === 'idle')).toBe(true)
    state.user = 'a'; state.can = false; view.rerender()
    expect(view.result.current.every(q => q.fetchStatus === 'idle')).toBe(true)
    expect(Object.values(adminApi).every(fn => vi.mocked(fn).mock.calls.length === 0)).toBe(true)
    view.unmount()
    state.can = true
    const theme = renderHook(() => hooks.useAdminPerformanceByTheme(null, 'Clínica', false, scope), { wrapper })
    expect(theme.result.current.fetchStatus).toBe('idle')
    theme.unmount(); client.clear()
  })
})
