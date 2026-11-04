import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useLocation } from 'react-router-dom'
import { useAppConfig } from '@/hooks/useAppConfig'
import { useAdminCan } from '@/admin/contexts/AdminAccessContext'
import { useAdminPeriod } from '@/admin/contexts/AdminPeriodContext'
import { adminEditionsApi } from '@/admin/services/adminEditionsApi'
import { brtToday, customRange, rangeLabel } from '@/admin/lib/adminPeriod'

const CONTROL = 'min-h-11 w-full min-w-0 rounded-md border border-admin-line-strong bg-admin-surface px-3 text-sm text-admin-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-admin-accent focus-visible:ring-offset-2 focus-visible:ring-offset-admin-surface'
const ACTION = 'min-h-11 rounded-md border border-admin-line-strong px-4 text-sm font-semibold text-admin-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-admin-accent focus-visible:ring-offset-2'
const displayDate = (date: string) => date.split('-').reverse().join('/')
const isoDate = (date: string) => /^\d{2}\/\d{2}\/\d{4}$/.test(date) ? date.split('/').reverse().join('-') : ''

function ReportFiltersContent() {
  const { reportEditionId, reportRange, setReportEditionId, setReportRange, reportUserId,
    setReportCatalog, reportError, reportWarning } = useAdminPeriod()
  const catalog = useQuery({
    queryKey: ['admin', 'report-editions', reportUserId],
    queryFn: () => adminEditionsApi.list(),
    enabled: !!reportUserId,
    staleTime: 300_000,
    retry: false,
  })
  const { data, isError, isPending } = catalog
  useEffect(() => {
    setReportCatalog({ status: isError ? 'error' : isPending ? 'loading' : 'ready', editions: data ?? [] })
  }, [data, isError, isPending, setReportCatalog])
  const [editing, setEditing] = useState(false)
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [error, setError] = useState<{ field: 'start' | 'end'; message: string } | null>(null)
  const fromRef = useRef<HTMLInputElement>(null)
  const toRef = useRef<HTMLInputElement>(null)
  const periodRef = useRef<HTMLSelectElement>(null)
  const open = () => {
    if (reportRange.kind === 'custom') { setStart(displayDate(reportRange.start)); setEnd(displayDate(reportRange.end)) }
    else { setStart(''); setEnd('') }
    setError(null); setEditing(true)
  }
  const close = () => { setEditing(false); setError(null); periodRef.current?.focus() }
  const apply = () => {
    let field: 'start' | 'end' = 'start'
    try {
      customRange(isoDate(start), isoDate(start))
      field = 'end'
      customRange(isoDate(end), isoDate(end))
      customRange(isoDate(start), isoDate(end))
      setReportRange({ kind: 'custom', start: isoDate(start), end: isoDate(end) })
      close()
    } catch (failure) {
      setError({ field, message: (failure as Error).message })
      ;(field === 'start' ? fromRef : toRef).current?.focus()
    }
  }
  const selected = data?.find(e => e.id === reportEditionId)
  const unknown = reportEditionId !== null && !selected
  return <section aria-label="Filtros dos relatórios" className="border-b border-admin-line bg-admin-surface px-4 py-5 sm:px-6">
    <div className="grid max-w-[840px] grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="min-w-0">
        <label htmlFor="admin-report-edition" className="mb-1 block text-xs font-semibold text-admin-text">Edição</label>
        <select id="admin-report-edition" className={CONTROL} value={reportEditionId ?? ''} disabled={isPending || isError} aria-busy={isPending} onChange={e => setReportEditionId(e.target.value || null)}>
          <option value="">Todas as edições</option>
          {unknown && <option value={reportEditionId!}>Edição indisponível: escolha novamente</option>}
          {data?.map(edition => <option key={edition.id} value={edition.id}>{edition.label}</option>)}
        </select>
      </div>
      <div className="min-w-0">
        <label htmlFor="admin-report-period" className="mb-1 block text-xs font-semibold text-admin-text">Período</label>
        <select id="admin-report-period" ref={periodRef} className={CONTROL} value={editing ? 'custom' : reportRange.kind === 'preset' ? String(reportRange.days) : reportRange.kind} onChange={e => {
          if (e.target.value === 'custom') { open(); return }
          setEditing(false); setError(null)
          setReportRange(e.target.value === 'all' ? { kind: 'all' } : { kind: 'preset', days: Number(e.target.value) as 7 | 30 | 90, anchor: brtToday() })
        }}>
          <option value="7">Últimos 7 dias</option><option value="30">Últimos 30 dias</option><option value="90">Últimos 90 dias</option>
          <option value="custom">Intervalo livre</option><option value="all">Todo o período</option>
        </select>
      </div>
    </div>
    {isPending && <p role="status" className="mt-3 text-sm text-admin-muted">Carregando edições…</p>}
    {isError && <div className="mt-3"><p role="alert" className="text-sm text-admin-destructive">Não foi possível carregar as edições.</p><button type="button" className={ACTION} onClick={() => catalog.refetch()}>Tentar novamente</button></div>}
    {!isPending && !isError && data?.length === 0 && <div className="mt-3"><p className="text-sm text-admin-muted">Nenhuma edição disponível no catálogo.</p><button type="button" className={ACTION} onClick={() => catalog.refetch()}>Atualizar catálogo</button></div>}
    {!isPending && !isError && reportError && <p role="alert" className="mt-3 text-sm text-admin-destructive">{reportError}</p>}
    {reportWarning && <p role="status" className="mt-3 text-sm text-admin-muted">{reportWarning}</p>}
    {editing && <form className="mt-4 max-w-[840px]" noValidate onSubmit={e => { e.preventDefault(); apply() }}>
      <p id="admin-report-date-help" className="mb-3 text-xs text-admin-muted">Datas inclusivas, dd/mm/aaaa, no Horário de Brasília.</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div><label htmlFor="admin-report-from" className="mb-1 block text-xs font-semibold text-admin-text">De</label>
          <input autoFocus ref={fromRef} id="admin-report-from" inputMode="numeric" placeholder="dd/mm/aaaa" className={CONTROL} value={start} onChange={e => setStart(e.target.value)} aria-invalid={error?.field === 'start'} aria-describedby={`admin-report-date-help${error?.field === 'start' ? ' admin-report-date-error' : ''}`} /></div>
        <div><label htmlFor="admin-report-to" className="mb-1 block text-xs font-semibold text-admin-text">Até</label>
          <input ref={toRef} id="admin-report-to" inputMode="numeric" placeholder="dd/mm/aaaa" className={CONTROL} value={end} onChange={e => setEnd(e.target.value)} aria-invalid={error?.field === 'end'} aria-describedby={`admin-report-date-help${error?.field === 'end' ? ' admin-report-date-error' : ''}`} /></div>
      </div>
      {error && <p id="admin-report-date-error" role="alert" className="mt-2 text-sm text-admin-destructive">{error.message}</p>}
      <div className="mt-3 flex flex-wrap gap-2"><button type="submit" className={ACTION}>Aplicar intervalo</button><button type="button" className={ACTION} onClick={close}>Cancelar</button></div>
    </form>}
    {!editing && reportRange.kind === 'custom' && <button type="button" className={`${ACTION} mt-3`} onClick={open}>Editar intervalo</button>}
    <div aria-label="Escopo aplicado" className="mt-4 max-w-[840px] break-words rounded-md border border-admin-line bg-admin-raised p-3 text-sm text-admin-text">
      <p className="font-semibold">{unknown ? 'Seleção de edição pendente' : selected?.label ?? 'Todas as edições'}</p>
      <p>{rangeLabel(reportRange)}</p>
      <p className="mt-1 text-xs text-admin-muted">Aplica-se aos relatórios desta página. Engajamento mantém seu período legado independente.</p>
    </div>
  </section>
}

export function AdminReportFilters() {
  const flag = useAppConfig('editions_ui')
  const canView = useAdminCan('intel.view')
  const { pathname } = useLocation()
  return flag && canView && /^\/admin\/inteligencia\/?$/.test(pathname) ? <ReportFiltersContent /> : null
}
