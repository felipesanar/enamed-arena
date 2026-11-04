import { useCutoffHistory } from '@/hooks/useEditionAnalysis';
import { Button } from '@/components/ui/button';

export function CutoffHistorySection({ reference }: { reference: { institutionId: string; specialtyId: string; practiceScenario?: string | null } | null }) {
  const query = useCutoffHistory(reference);
  if (!reference) return <div className="py-6"><h3 className="text-body font-semibold">Histórico indisponível para esta referência</h3><p className="mt-2 text-caption text-muted-foreground">Selecione uma linha com instituição e especialidade identificadas. Nenhum dado será associado por semelhança de nome.</p></div>;
  if (query.isPending) return <p role="status" className="min-h-40 py-6 text-body">Carregando histórico da referência...</p>;
  if (query.isError) return <div role="alert" className="py-6"><p>Não foi possível carregar o histórico da referência.</p><Button variant="outline" className="mt-4 min-h-11" onClick={() => void query.refetch()}>Tentar novamente</Button></div>;
  const data = query.data;
  return <div className="min-w-0 space-y-4 py-4">
    <p className="border-l-2 border-primary bg-primary/5 p-3 text-caption leading-relaxed">Estas referências não são comparáveis. Processos e escalas distintos permanecem separados; não indicam tendência nem previsão de aprovação.</p>
    {!data?.items.length && <p className="py-4 text-caption text-muted-foreground">Nenhuma referência com fonte confirmada disponível neste contexto.</p>}
    {data?.items.map(item => <article key={item.id} className="min-w-0 rounded-xl border border-border bg-card p-4">
      <h3 className="break-words text-body font-semibold">{item.reference_label || item.reference_edition_label}</h3>
      <p className="mt-2 break-words text-caption text-muted-foreground">{item.reference_edition_code} • Ano {item.year}{item.term ? `, ${item.term}º período` : ', período indisponível'}</p>
      <p className="mt-2 break-words text-caption">Fonte: {item.source}</p>
      <p className="mt-1 break-words text-caption text-muted-foreground">Cenário: {item.practice_scenario || 'Não informado'}</p>
      <dl className="mt-4 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-x-4 gap-y-2 text-caption tabular-nums"><dt>Ampla concorrência</dt><dd className="font-semibold">{item.value_general ?? 'Indisponível'}</dd><dt>Cotas</dt><dd>{item.value_quota ?? 'Indisponível'}</dd><dt>Vagas</dt><dd>{item.vagas ?? 'Indisponível'}</dd></dl>
      <p className="mt-3 text-caption text-muted-foreground">Versão da fonte indisponível. Escala não certificada.</p>
    </article>)}
    {!!data?.legacy_unknown_count && <aside className="rounded-xl border border-dashed border-border p-4"><h3 className="text-body font-semibold">Origem não confirmada</h3><p className="mt-2 text-caption text-muted-foreground">{data.legacy_unknown_count} registro(s) legado(s) sem referência confirmada, separado(s) deste histórico. Nenhum processo ou ano foi atribuído.</p></aside>}
  </div>;
}
