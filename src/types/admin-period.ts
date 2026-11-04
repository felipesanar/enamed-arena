export type AdminReportRange =
  | { kind: 'preset'; days: 7 | 30 | 90; anchor: string }
  | { kind: 'custom'; start: string; end: string }
  | { kind: 'all' }

export interface AdminReportScope {
  editionId: string | null
  startAt: string | null
  endAt: string | null
}

export interface AdminReportFilters {
  editionId: string | null
  range: AdminReportRange
  warning: string | null
}

export interface AdminReportCatalog {
  status: 'loading' | 'error' | 'ready'
  editions: { id: string; label: string; code?: string }[]
}
