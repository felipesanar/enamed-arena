import type { AdminReportFilters, AdminReportRange, AdminReportScope } from '@/types/admin-period'

const DAY = 86_400_000
function calendar(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Informe uma data válida.')
  const ms = Date.parse(`${value}T00:00:00.000Z`)
  if (!Number.isFinite(ms) || new Date(ms).toISOString().slice(0, 10) !== value || value < '1900-01-01' || value > '9998-12-31') throw new Error('Informe uma data real entre 1900 e 9998.')
  return ms
}
export function brtToday(now = new Date()): string {
  return new Date(now.getTime() - 3 * 3_600_000).toISOString().slice(0, 10)
}
export function customRange(start: string, end: string) {
  const from = calendar(start)
  const to = calendar(end)
  if (from > to) throw new Error('A data final deve ser igual ou posterior à inicial.')
  return { startAt: new Date(from + 3 * 3_600_000).toISOString(), endAt: new Date(to + DAY + 3 * 3_600_000).toISOString() }
}
export function presetRange(days: 7 | 30 | 90, anchor: string) {
  return customRange(new Date(calendar(anchor) - (days - 1) * DAY).toISOString().slice(0, 10), anchor)
}
export function rangeScope(range: AdminReportRange) {
  return range.kind === 'all' ? { startAt: null, endAt: null } : range.kind === 'preset' ? presetRange(range.days, range.anchor) : customRange(range.start, range.end)
}
export function scopeArgs(scope?: AdminReportScope) {
  return scope === undefined ? {} : { p_edition_id: scope.editionId, p_start_at: scope.startAt, p_end_at: scope.endAt }
}
export function rangeLabel(range: AdminReportRange): string {
  if (range.kind === 'all') return 'Todo o período'
  const { startAt, endAt } = rangeScope(range)
  const format = (value: string) => new Date(value).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
  return `${format(startAt!)} até ${format(new Date(Date.parse(endAt!) - DAY).toISOString())} · Horário de Brasília`
}
export function restoreReportFilters(raw: string | null, today = brtToday()): AdminReportFilters {
  const fallback: AdminReportFilters = { editionId: null, range: { kind: 'preset', days: 7, anchor: today }, warning: null }
  if (!raw) return fallback
  try {
    const value = JSON.parse(raw)
    if (!value || (value.editionId !== null && (typeof value.editionId !== 'string' || !value.editionId.trim()))) throw new Error()
    const range = value.range
    if (!range || !['all', 'preset', 'custom'].includes(range.kind)) throw new Error()
    if (range.kind === 'preset') {
      if (![7, 30, 90].includes(range.days)) throw new Error()
      range.anchor = today
    }
    rangeScope(range)
    return { editionId: value.editionId, range, warning: null }
  } catch {
    return { ...fallback, warning: 'Filtros salvos inválidos. Escolha novamente a edição e o período.' }
  }
}
