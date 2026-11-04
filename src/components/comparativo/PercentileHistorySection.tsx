import { usePercentileHistory } from '@/hooks/useEditionAnalysis';
import { Button } from '@/components/ui/button';
import type { PercentileHistoryItem } from '@/types/edition-analysis';

function validPercentile(value: number) { return Number.isInteger(value) && value >= 1 && value <= 99; }
function dateLabel(value: string) { const date = new Date(value); return Number.isFinite(date.getTime()) ? date.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : 'Data indisponível'; }

function EditionChart({ items }: { items: PercentileHistoryItem[] }) {
  const points = items.filter(item => validPercentile(item.top_percentile));
  const x = (index: number) => points.length <= 1 ? 220 : 64 + index * 360 / (points.length - 1);
  const y = (value: number) => 20 + (value - 1) * 1.2;
  return <div className="min-w-0 border-l border-border pl-4">
    <h3 className="break-words text-body font-semibold">{items[0].label} <span className="text-caption font-normal text-muted-foreground">{items[0].code}</span></h3>
    <svg viewBox="0 0 460 165" className="mt-3 h-44 w-full" role="img" aria-label={`Histórico de percentil de ${items[0].label}; valores completos na tabela`}>
      {[1, 50, 99].map(value => <g key={value}><line x1="38" x2="445" y1={y(value)} y2={y(value)} stroke="hsl(var(--border))" /><text x="0" y={y(value) + 4} fill="hsl(var(--muted-foreground))" fontSize="11">{value}%</text></g>)}
      <polyline points={points.map((p,index) => `${x(index)},${y(p.top_percentile)}`).join(' ')} fill="none" stroke="hsl(var(--primary))" strokeWidth="2" />
      {points.map((point,index) => <circle key={point.simulado_id} cx={x(index)} cy={y(point.top_percentile)} r="5" fill="hsl(var(--card))" stroke="hsl(var(--primary))" strokeWidth="3"><title>{dateLabel(point.date)}: Top {point.top_percentile}%, posição {point.position} de {point.population}</title></circle>)}
      {points.length > 0 && <><text x="40" y="160" fill="hsl(var(--muted-foreground))" fontSize="11">{dateLabel(points[0].date)}</text><text x="445" y="160" textAnchor="end" fill="hsl(var(--muted-foreground))" fontSize="11">{points.length > 1 ? dateLabel(points[points.length-1].date) : ''}</text></>}
    </svg>
  </div>;
}

export function PercentileHistorySection() {
  const query = usePercentileHistory();
  if (query.isPending) return <section role="status" className="min-h-64 rounded-xl border border-border bg-card p-6">Carregando histórico por percentil...</section>;
  if (query.isError) return <section role="alert" className="rounded-xl border border-border bg-card p-6"><h2 className="text-heading-3 font-semibold">Não foi possível carregar o histórico</h2><Button variant="outline" className="mt-4 min-h-11" onClick={() => void query.refetch()}>Tentar novamente</Button></section>;
  const items = query.data?.items ?? [];
  if (!items.length) return <section className="rounded-xl border border-dashed border-border bg-card p-6"><h2 className="text-heading-3 font-semibold">Ainda não há resultados elegíveis</h2><p className="mt-2 text-body text-muted-foreground">Seu histórico aparecerá após a liberação dos resultados das participações elegíveis.</p></section>;
  const editions = new Map<string, PercentileHistoryItem[]>();
  for (const item of items) editions.set(item.edition_id, [...(editions.get(item.edition_id) ?? []), item]);
  return <section className="min-w-0 rounded-xl border border-border bg-card p-5 md:p-6" aria-labelledby="percentile-history-title">
    <h2 id="percentile-history-title" className="text-heading-3 font-semibold">Sua posição ao longo das edições</h2>
    <p className="mt-2 max-w-[75ch] text-caption text-muted-foreground">Menor Top X% indica melhor posição relativa na população daquele simulado. Grupos de edições permanecem separados; isto não é uma nota de proficiência.</p>
    <div className="mt-6 grid gap-6 md:grid-cols-2">{[...editions].map(([id,group]) => <EditionChart key={id} items={group} />)}</div>
    {items.some(item => item.metadata?.small_sample || item.population < 30) && <p className="my-5 border-l-2 border-primary bg-primary/5 p-3 text-caption">Amostra pequena em um ou mais resultados: menos de 30 participantes. Variações de posição exigem cautela.</p>}
    <details open className="mt-5"><summary className="min-h-11 cursor-pointer py-3 text-body font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">Ver dados em tabela</summary>
      <table className="w-full table-fixed text-caption"><caption className="sr-only">Resultados por população e edição</caption><thead className="sr-only md:not-sr-only"><tr>{['Edição e simulado','Data','Posição','População','Top X%'].map(label => <th key={label} scope="col" className="border-b border-border py-3 text-left font-medium text-muted-foreground">{label}</th>)}</tr></thead>
        <tbody>{items.map(item => <tr key={item.simulado_id} className="block border-b border-border py-3 last:border-0 md:table-row">
          {[['Resultado',<span key="result" className="break-words">{item.label}<span className="mt-1 block text-muted-foreground">{item.code} / Simulado {item.sequence}</span></span>],['Data',dateLabel(item.date)],['Posição',item.position],['População',item.population],['Top X%', validPercentile(item.top_percentile) ? `Top ${item.top_percentile}%` : 'Percentil indisponível']].map(([label,value]) => <td key={String(label)} className="grid grid-cols-[104px_minmax(0,1fr)] gap-3 py-1.5 pr-2 tabular-nums md:table-cell md:py-3"><span className="text-muted-foreground md:hidden">{label}</span><span>{value}</span></td>)}
        </tr>)}</tbody>
      </table>
    </details>
  </section>;
}
