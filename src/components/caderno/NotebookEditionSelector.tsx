import type { useNotebookEditionFilter } from '@/hooks/useNotebookEditionFilter';

export const notebookControlClass = 'min-h-11 w-full min-w-0 rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] px-3 py-2 text-sm text-[var(--c-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--c-wine-400)]';

export function NotebookEditionSelector({ filter }: { filter: ReturnType<typeof useNotebookEditionFilter> }) {
  return <section className="rounded-[20px] border border-[var(--c-border)] bg-[var(--c-surface)] p-5" aria-label="Escopo do caderno">
    <div className="grid gap-4 md:grid-cols-[minmax(220px,320px)_1fr] md:items-center">
      <div><label htmlFor="notebook-edition" className="mb-1.5 block text-sm font-semibold">Edição do caderno</label>
        <select id="notebook-edition" value={filter.editionId ?? ''} onChange={e => filter.setEdition(e.target.value || null)} disabled={filter.catalog.isPending} className={notebookControlClass}>
          <option value="">Todas as edições</option>
          {filter.invalid && <option value={filter.editionId ?? ''}>Edição não disponível</option>}
          {(filter.catalog.data ?? []).map(e => <option key={e.id} value={e.id}>{e.label}</option>)}
        </select></div>
      <p className="text-sm text-[var(--c-muted)]">{filter.editionId ? 'Somente entradas vinculadas à edição selecionada.' : 'Seu histórico completo, incluindo entradas manuais.'}</p>
    </div>
    {filter.catalog.isPending && <p role="status">Carregando edições…</p>}
    {(filter.catalog.isError || filter.invalid) && <div role="alert" className="mt-3 text-sm">
      <p>{filter.catalog.isError ? 'Não foi possível carregar as edições' : 'Edição não disponível'}. Nenhum dado cumulativo foi carregado.</p>
      <button className="mr-4 min-h-11 underline" onClick={() => filter.catalog.refetch()}>Tentar novamente</button>
      <button className="min-h-11 underline" onClick={() => filter.setEdition(null)}>Limpar edição</button>
    </div>}
  </section>;
}
