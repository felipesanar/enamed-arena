export function NotebookPagination({ offset, total, busy, onPage }: { offset: number; total: number; busy?: boolean; onPage: (offset: number) => void }) {
  return <nav aria-label="Paginação do caderno" className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
    <span role="status" aria-live="polite">{total ? offset + 1 : 0}–{Math.min(offset + 50, total)} de {total} entradas</span>
    <div className="flex gap-3">{[['Anterior', Math.max(0, offset - 50), offset === 0], ['Próxima', offset + 50, offset + 50 >= total]].map(([label, value, disabled]) =>
      <button key={String(label)} disabled={busy || !!disabled} onClick={() => onPage(Number(value))} className="min-h-11 flex-1 rounded-xl border border-[var(--c-border)] px-4 text-sm disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--c-wine-400)]">{label}</button>)}</div>
  </nav>;
}
