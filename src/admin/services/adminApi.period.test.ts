import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: vi.fn() } }))
import { supabase } from '@/integrations/supabase/client'
import { adminApi } from './adminApi'
import type { AdminReportScope } from '@/types/admin-period'

const cases = [
  ['admin_cohort_retention', (s?: AdminReportScope) => adminApi.getCohortRetention(6, s), { p_months: 6 }],
  ['admin_performance_by_area', (s?: AdminReportScope) => adminApi.getPerformanceByArea(null, 'all', s), { p_simulado_id: null, p_segment: 'all' }],
  ['admin_performance_by_theme', (s?: AdminReportScope) => adminApi.getPerformanceByTheme(null, null, 12, s), { p_simulado_id: null, p_area: null, p_limit: 12 }],
  ['admin_score_distribution', (s?: AdminReportScope) => adminApi.getScoreDistribution(null, s), { p_simulado_id: null }],
  ['admin_score_evolution', (s?: AdminReportScope) => adminApi.getScoreEvolution(s), undefined],
  ['admin_segment_breakdown', (s?: AdminReportScope) => adminApi.getSegmentBreakdown(s), undefined],
  ['admin_intel_insights', (s?: AdminReportScope) => adminApi.getIntelInsights(s), undefined],
] as const
describe('seven opt-in RPC scopes', () => {
  beforeEach(() => { vi.mocked(supabase.rpc).mockReset().mockResolvedValue({ data: [], error: null } as never) })
  for (const [name, call, legacy] of cases) {
    it(`${name}: preserves legacy argument arity`, async () => {
      await call()
      expect(supabase.rpc).toHaveBeenCalledWith(...(legacy ? [name, legacy] : [name]))
    })
    for (const scope of [
      { editionId: null, startAt: null, endAt: null },
      { editionId: 'edition-a', startAt: null, endAt: null },
      { editionId: 'edition-b', startAt: '2026-10-01T03:00:00.000Z', endAt: '2026-11-01T03:00:00.000Z' },
    ]) {
      it(`${name}: sends explicit scope ${JSON.stringify(scope)}`, async () => {
        await call(scope)
        expect(supabase.rpc).toHaveBeenCalledWith(name, { ...legacy, p_edition_id: scope.editionId, p_start_at: scope.startAt, p_end_at: scope.endAt })
      })
    }
  }
  it('fixed-id results calls remain legacy without a scope', async () => {
    await adminApi.getScoreDistribution('fixed-simulado')
    expect(supabase.rpc).toHaveBeenCalledWith('admin_score_distribution', { p_simulado_id: 'fixed-simulado' })
  })
})
