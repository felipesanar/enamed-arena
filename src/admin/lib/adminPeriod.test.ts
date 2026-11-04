import { describe, expect, it } from 'vitest'
import { customRange, presetRange, scopeArgs, restoreReportFilters } from './adminPeriod'

describe('report calendar BRT', () => {
  it('rejects impossible dates and reversed intervals without normalization', () => {
    expect(() => customRange('2026-02-31', '2026-03-02')).toThrow()
    expect(() => customRange('2026-10-02', '2026-10-01')).toThrow()
  })
  it('accepts one day and converts inclusive dates to exclusive end in BRT', () => {
    expect(customRange('2026-10-31', '2026-10-31')).toEqual({
      startAt: '2026-10-31T03:00:00.000Z', endAt: '2026-11-01T03:00:00.000Z',
    })
    expect(customRange('2028-02-29', '2028-02-29').endAt).toBe('2028-03-01T03:00:00.000Z')
  })
  it('anchors presets to calendar days in BRT, not browser timezone', () => {
    expect(presetRange(7, '2026-11-04')).toEqual({ startAt: '2026-10-29T03:00:00.000Z', endAt: '2026-11-05T03:00:00.000Z' })
  })
  it('distinguishes legacy undefined from explicit all', () => {
    expect(scopeArgs(undefined)).toEqual({})
    expect(scopeArgs({ editionId: null, startAt: null, endAt: null })).toEqual({ p_edition_id: null, p_start_at: null, p_end_at: null })
  })
  it('validates stored data defensively', () => {
    expect(restoreReportFilters('{', '2026-11-04').warning).toBeTruthy()
    expect(restoreReportFilters(JSON.stringify({ editionId: 'a', range: { kind: 'custom', start: '2026-02-31', end: '2026-03-01' } }), '2026-11-04').warning).toBeTruthy()
    expect(restoreReportFilters(JSON.stringify({ editionId: 'a', range: { kind: 'preset', days: 30, anchor: '2000-01-01' } }), '2026-11-04').range).toEqual({ kind: 'preset', days: 30, anchor: '2026-11-04' })
  })
})
