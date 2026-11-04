import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAnalysisEditions, useEditionRanking } from '@/hooks/useEditionAnalysis';
import { Button } from '@/components/ui/button';

export function EditionRankingSection({ initialEditionId = '' }: { initialEditionId?: string }) {
  const { user } = useAuth();
  const catalog = useAnalysisEditions();
  const [selected, setSelected] = useState(initialEditionId);
  const [offset, setOffset] = useState(0);
  const edition = catalog.data?.find(item => item.id === selected);
  const query = useEditionRanking(edition?.id ?? null, offset);
  const data = query.data;
  return <section className="min-w-0 space-y-5" aria-label="Ranking por edição">
    <div className="max-w-lg"><label htmlFor="edition-ranking-filter" className="mb-2 block text-caption font-semibold">Edição</label><select id="edition-ranking-filter" value={selected} onChange={event => { setSelected(event.target.value); setOffset(0); }} className="min-h-11 w-full rounded-lg border border-input bg-background px-3 text-body focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
      <option value="">Escolha uma edição</option>{catalog.data?.map(item => <option key={item.id} value={item.id}>{item.label} ({item.code})</option>)}
    </select></div>
    {catalog.isError ? <div role="alert" className="rounded-xl border border-border bg-card p-6"><p>Não foi possível carregar as edições.</p><Button variant="outline" className="mt-3 min-h-11" onClick={() => void catalog.refetch()}>Tentar novamente</Button></div>
      : catalog.isPending || query.isPending ? <div role="status" className="min-h-64 rounded-xl border border-border bg-card p-6">Carregando ranking da edição...</div>
      : !edition ? <div className="rounded-xl border border-dashed border-border bg-card p-6"><h2 className="text-heading-3 font-semibold">Selecione uma edição</h2><p className="mt-2 text-body text-muted-foreground">A regra de participação e a classificação pertencem à edição escolhida.</p></div>
      : query.isError || !data ? <div role="alert" className="rounded-xl border border-border bg-card p-6"><h2 className="text-heading-3 font-semibold">Não foi possível carregar o ranking da edição</h2><Button variant="outline" className="mt-4 min-h-11" onClick={() => void query.refetch()}>Tentar novamente</Button></div>
      : data.status === 'unconfigured' ? <div className="rounded-xl border border-dashed border-border bg-card p-6"><h2 className="text-heading-3 font-semibold">Ranking da edição ainda não configurado</h2><p className="mt-2 text-body text-muted-foreground">A regra de participação precisa estar definida e ativa. Nenhuma classificação está disponível.</p></div>
      : data.status === 'insufficient_offered' ? <div className="rounded-xl border border-dashed border-border bg-card p-6"><h2 className="text-heading-3 font-semibold">A edição ainda não oferece simulados suficientes</h2><p className="mt-2 text-body text-muted-foreground">Há {data.offered_simulados} simulado(s) disponível(is) neste contexto; a política exige ao menos {data.policy.minimum_simulados}. O ranking estará disponível quando houver oferta suficiente.</p></div>
      : <div className="min-w-0 rounded-xl border border-border bg-card p-5 md:p-6">
        <h2 className="break-words text-heading-3 font-semibold">Ranking de {edition.label}</h2>
        <p className="mt-2 text-caption text-muted-foreground">Até {data.policy.best_n} melhores simulados, mínimo de {data.policy.minimum_simulados} participações. {data.population} participantes elegíveis; {data.offered_simulados} simulados disponíveis neste contexto.</p>
        <p className="my-5 border-l-2 border-primary bg-primary/5 p-3 text-caption">Média bruta apenas dentro desta edição. A quantidade realmente considerada aparece em cada linha; não há equivalência de escala entre edições.</p>
        {data.items.length === 0 ? <p className="py-6 text-body text-muted-foreground">Nenhuma participação elegível nesta página.</p> : <table className="w-full table-fixed text-caption"><caption className="sr-only">Classificação da edição</caption><thead className="sr-only md:not-sr-only"><tr>{['Posição','Participante','Média bruta','Considerados','Concluídos'].map(label => <th scope="col" key={label} className="border-b border-border py-3 text-left font-medium text-muted-foreground">{label}</th>)}</tr></thead>
          <tbody>{data.items.map(item => <tr key={item.user_id} className={`block border-b border-border py-3 last:border-0 md:table-row ${item.user_id === user?.id ? 'bg-primary/5' : ''}`}>
            {[['Posição',item.position],['Participante',item.user_id === user?.id ? 'Você' : `Candidato #${item.position}`],['Média bruta',`${item.average_score.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`],['Considerados',`${item.used_simulados} de até ${data.policy.best_n}`],['Concluídos',item.completed_simulados]].map(([label,value]) => <td key={String(label)} className="grid grid-cols-[104px_minmax(0,1fr)] gap-3 py-1.5 pr-2 tabular-nums md:table-cell md:py-3"><span className="text-muted-foreground md:hidden">{label}</span><span>{value}</span></td>)}
          </tr>)}</tbody></table>}
        <p className="mt-4 text-caption text-muted-foreground">Desempate: média, maior nota considerada, conclusão mais antiga e identificador.</p>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3"><p className="text-caption text-muted-foreground">Página {Math.floor(offset / 50) + 1} • 50 por página • {data.population} participantes</p><div className="flex gap-2"><Button variant="outline" className="min-h-11" disabled={offset === 0} onClick={() => setOffset(value => Math.max(0,value-50))}>Anterior</Button><Button variant="outline" className="min-h-11" disabled={offset + 50 >= data.population} onClick={() => setOffset(value => value+50)}>Próxima</Button></div></div>
      </div>}
  </section>;
}
