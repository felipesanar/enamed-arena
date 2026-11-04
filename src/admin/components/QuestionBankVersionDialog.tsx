import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useAdminCan } from '@/admin/contexts/AdminAccessContext';
import { useAnalysisEditions } from '@/hooks/useEditionAnalysis';
import { questionBankApi } from '@/services/questionBankApi';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import type { AddBankVersionToSimuladoResult, QuestionBankPayload } from '@/types/question-bank';
import { invalidateQuestionBankQueries } from '@/lib/exam-query-cache';

function plain(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return 'Indisponível';
  return value.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '').replace(/<[^>]*>/g, '').trim() || 'Indisponível';
}
function observationDate(value: string) { const d = new Date(value); return Number.isFinite(d.getTime()) ? d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : 'Data indisponível'; }
function PayloadSnapshot({ payload, title }: { payload: QuestionBankPayload; title: string }) {
  const q = payload?.question;
  return <section className="min-w-0 rounded-lg border border-border bg-muted/20 p-4"><h4 className="text-body font-semibold">{title}</h4><p className="mt-3 whitespace-pre-wrap break-words text-caption">{plain(q?.text)}</p>
    <dl className="mt-3 space-y-1 text-caption text-muted-foreground">{[['Área',q?.area],['Tema',q?.theme],['Dificuldade',q?.difficulty]].map(([label,value]) => <div key={label} className="break-words"><dt className="inline font-medium">{label}: </dt><dd className="inline">{plain(value)}</dd></div>)}</dl>
    <ol className="mt-4 space-y-2 text-caption">{(Array.isArray(payload?.options) ? payload.options : []).map((option,index) => <li key={`${option.label}:${index}`} className="break-words">{option.label}) {plain(option.text)}{option.is_correct === true && <strong> (resposta correta)</strong>}</li>)}</ol>
    <h5 className="mt-4 text-caption font-semibold">Explicação</h5><p className="mt-1 whitespace-pre-wrap break-words text-caption">{plain(q?.explanation)}</p>
    <p className="mt-3 text-caption text-muted-foreground">Formato: {String(payload?.format?.questions ?? 'indisponível')} questões, {String(payload?.format?.options ?? 'indisponível')} alternativas, {String(payload?.format?.duration_minutes ?? 'indisponível')} minutos.</p>
    {[['Imagem do enunciado',q?.image_url],['Segunda imagem',q?.image_url_2],['Imagem da explicação',q?.explanation_image_url]].filter(([,url]) => !!url).map(([label,url]) => <p key={label} className="mt-2 break-all text-caption text-muted-foreground">{label}: {plain(url)}</p>)}
  </section>;
}

export function QuestionBankVersionDialog({ bank, open, onOpenChange }: { bank: { bank_id: string; title: string }; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { user, loading } = useAuth();
  const canContent = useAdminCan('content.manage');
  const canIntel = useAdminCan('intel.view');
  const userId = user?.id;
  const enabled = open && !!userId && !loading && canContent;
  const client = useQueryClient();
  const [selectedId, setSelectedId] = useState('');
  const [editionId, setEditionId] = useState('');
  const [reuseVisible, setReuseVisible] = useState(false);
  const [draftId, setDraftId] = useState('');
  const [questionNumber, setQuestionNumber] = useState('');
  const [error, setError] = useState('');
  const [locked, setLocked] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [receipt, setReceipt] = useState<AddBankVersionToSimuladoResult | null>(null);
  const submitLock = useRef(false);
  const draftSelect = useRef<HTMLSelectElement>(null);
  const [returnFocusTarget] = useState<HTMLElement | null>(() => typeof document !== 'undefined' && document.activeElement instanceof HTMLElement ? document.activeElement : null);
  const versionQuery = useInfiniteQuery({ queryKey: ['question-bank-versions', userId ?? null, bank.bank_id], enabled,
    initialPageParam: 0, queryFn: ({ pageParam }) => questionBankApi.listVersions(userId!, bank.bank_id, pageParam),
    getNextPageParam: (last, pages) => last.length === 50 ? pages.length * 50 : undefined, staleTime: 5 * 60 * 1000, retry: false });
  const versions = useMemo(() => enabled ? [...new Map((versionQuery.data?.pages.flat() ?? []).map(v => [v.id,v])).values()] : [], [enabled,versionQuery.data]);
  const selected = versions.find(version => version.id === selectedId) ?? versions[0];
  const previous = selected ? versions.find(version => version.version_number === selected.version_number - 1) : undefined;
  const catalog = useAnalysisEditions(enabled && canIntel);
  const analysis = useQuery({ queryKey: ['question-bank-item-analysis', userId ?? null, bank.bank_id, editionId || null], enabled: enabled && canIntel,
    queryFn: () => questionBankApi.getAnalysis(userId!, bank.bank_id, editionId || null), staleTime: 5 * 60 * 1000, retry: false });
  const drafts = useQuery({ queryKey: ['question-bank-drafts', userId ?? null], enabled: enabled && reuseVisible,
    queryFn: () => questionBankApi.getDrafts(userId!), staleTime: 0, retry: false });
  const mutation = useMutation({ retry: false, mutationFn: (input: { versionId: string; simuladoId: string; number: number }) =>
    questionBankApi.reuseVersion(userId!, { p_version_id: input.versionId, p_simulado_id: input.simuladoId, p_question_number: input.number }) });
  useEffect(() => { if (reuseVisible) draftSelect.current?.focus(); }, [reuseVisible]);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!enabled || !selected || selected.state !== 'published' || submitLock.current || uncertain || locked || receipt) return;
    const number = Number(questionNumber);
    if (!draftId || !drafts.data?.some(draft => draft.id === draftId) || !Number.isSafeInteger(number) || number < 1) { setError('Selecione um rascunho e um número de questão válido.'); return; }
    submitLock.current = true; setError('');
    try {
      const result = await mutation.mutateAsync({ versionId: selected.id, simuladoId: draftId, number });
      setReceipt(result);
      invalidateQuestionBankQueries(client);
      void client.invalidateQueries({ queryKey: ['question-bank-drafts'], refetchType: 'none' });
      void client.invalidateQueries({ refetchType: 'none', predicate: ({ queryKey: key }) => key[0] === 'admin'
        && (key[1] === 'simulados-list' || (['questions','simulado-detail-stats','simulado-question-stats'].includes(String(key[1])) && key[2] === result.simulado_id)) });
    } catch (failure) {
      const code = failure && typeof failure === 'object' && 'code' in failure ? String(failure.code) : '';
      setLocked(code === '55P03');
      setUncertain(!['55P03','22023','23505','42501','P0003'].includes(code));
      setError(code === '55P03' ? 'Outro editor está alterando este conteúdo. Atualize os rascunhos e tente novamente.'
        : ['22023','23505'].includes(code) ? 'Destino incompatível, versão incompleta ou número ocupado. Revise o rascunho e a posição da questão.'
        : ['42501','P0003'].includes(code) ? 'Sua permissão não permite esta cópia. Atualize a página.'
        : 'Não foi possível confirmar a cópia. Confira o simulado de destino antes de tentar uma nova operação.');
    } finally { submitLock.current = false; }
  };
  return <Dialog open={open && enabled} onOpenChange={value => { if (!submitLock.current) onOpenChange(value); }}><DialogContent onCloseAutoFocus={event => { if (returnFocusTarget?.isConnected) { event.preventDefault(); returnFocusTarget.focus(); } }} className="max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-5xl overflow-y-auto p-5 md:p-6 [&>button:last-child]:flex [&>button:last-child]:h-11 [&>button:last-child]:w-11 [&>button:last-child]:items-center [&>button:last-child]:justify-center">
    <DialogTitle className="break-words pr-8">Versões da questão</DialogTitle><DialogDescription className="break-words">{bank.title}. O histórico registra observações do conteúdo, sem alterar a identidade original.</DialogDescription>
    {versionQuery.isPending ? <p role="status" className="min-h-44 py-5">Carregando versões...</p> : versionQuery.isError ? <div role="alert"><p>Não foi possível carregar as versões.</p><Button variant="outline" className="mt-3 min-h-11" onClick={() => void versionQuery.refetch()}>Tentar novamente</Button></div> : !selected ? <p className="py-5 text-muted-foreground">Nenhuma versão disponível.</p> : <>
      <div className="grid gap-4 md:grid-cols-2"><div><label htmlFor="bank-version-select" className="mb-2 block text-caption font-semibold">Versão observada</label><select id="bank-version-select" value={selected.id} disabled={mutation.isPending} onChange={event => { setSelectedId(event.target.value); setReuseVisible(false); setReceipt(null); setError(''); setUncertain(false); setLocked(false); }} className="min-h-11 w-full rounded-lg border border-input bg-background px-3"><>{versions.map(version => <option key={version.id} value={version.id}>Versão {version.version_number} / {version.state === 'incomplete' ? 'Incompleta' : 'Completa'}</option>)}</></select></div><p className="self-end text-caption text-muted-foreground">Observada em {observationDate(selected.observed_at)}<span className="mt-1 block">{selected.provenance === 'legacy_snapshot' ? 'Foto do legado' : 'Observação de conteúdo'}</span></p></div>
      <p className="text-caption text-muted-foreground">A observação não representa a data de autoria da questão.</p>
      <div className="grid gap-4 md:grid-cols-2">{previous ? <PayloadSnapshot payload={previous.payload} title={`Versão ${previous.version_number} (anterior)`} /> : <div className="rounded-lg border border-dashed border-border p-4 text-caption text-muted-foreground">{selected.version_number > 1 ? 'Versão anterior ainda não carregada.' : 'Esta é a primeira versão observada.'}</div>}<PayloadSnapshot payload={selected.payload} title={`Versão ${selected.version_number} (selecionada)`} /></div>
      <p className="text-caption text-muted-foreground">{previous && JSON.stringify(previous.payload) === JSON.stringify(selected.payload) ? 'Conteúdo igual na comparação; as versões permanecem distintas.' : previous ? 'Conteúdo diferente entre as versões. Cada versão mantém seu vínculo de uso.' : 'Sem comparação disponível neste contexto.'}</p>
      {versionQuery.hasNextPage && <Button variant="outline" className="min-h-11" disabled={versionQuery.isFetchingNextPage} onClick={() => void versionQuery.fetchNextPage()}>{versionQuery.isFetchingNextPage ? 'Carregando...' : 'Carregar mais versões'}</Button>}
      <div className="border-t border-border pt-4"><Button className="min-h-11" disabled={selected.state === 'incomplete' || mutation.isPending} onClick={() => { setReuseVisible(true); setError(''); }}>Reusar versão {selected.version_number} em rascunho</Button>{selected.state === 'incomplete' && <p className="mt-2 text-caption text-muted-foreground">Versões incompletas não podem ser reutilizadas.</p>}</div>
      {reuseVisible && <form onSubmit={event => void submit(event)} className="space-y-4 rounded-xl border border-border p-4"><h3 className="text-body font-semibold">Reusar versão {selected.version_number} em rascunho</h3><p className="text-caption text-muted-foreground">A cópia preserva o vínculo com a identidade e a versão escolhida. O simulado continua como rascunho.</p>
        {drafts.isPending ? <p role="status">Carregando rascunhos autorizados...</p> : drafts.isError ? <div role="alert"><p>Não foi possível carregar os rascunhos.</p><Button type="button" variant="outline" className="mt-3 min-h-11" onClick={() => void drafts.refetch()}>Tentar novamente</Button></div> : <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_160px]"><div><label htmlFor="bank-reuse-draft" className="mb-2 block text-caption font-semibold">Simulado de destino</label><select ref={draftSelect} id="bank-reuse-draft" value={draftId} disabled={mutation.isPending || !!receipt} onChange={event => setDraftId(event.target.value)} className="min-h-11 w-full rounded-lg border border-input bg-background px-3"><option value="">Selecione um rascunho</option>{drafts.data?.map(draft => <option key={draft.id} value={draft.id}>{draft.title} / Simulado {draft.sequence_number}</option>)}</select>{!drafts.data?.length && <p className="mt-2 text-caption text-muted-foreground">Nenhum rascunho autorizado com contagem de tentativas confirmada disponível.</p>}</div><div><label htmlFor="bank-reuse-number" className="mb-2 block text-caption font-semibold">Número da questão</label><input id="bank-reuse-number" value={questionNumber} onChange={event => setQuestionNumber(event.target.value)} type="number" min="1" step="1" max="2147483647" disabled={mutation.isPending || !!receipt} className="min-h-11 w-full rounded-lg border border-input bg-background px-3" /></div></div>}
        {error && <p role="alert" className="text-caption text-destructive">{error}</p>}
        {locked && <Button type="button" variant="outline" className="min-h-11" onClick={async () => { await drafts.refetch(); setLocked(false); }}>Atualizar rascunhos</Button>}
        {receipt ? <div role="status"><p className="font-semibold">Questão {receipt.question_number} adicionada ao rascunho.</p><Link to={`/admin/simulados/${receipt.simulado_id}/questoes/editar`} className="mt-2 inline-flex min-h-11 items-center text-caption underline">Conferir o simulado de destino</Link></div> : <Button type="submit" className="min-h-11" disabled={mutation.isPending || uncertain || locked || !draftId || !questionNumber || drafts.isFetching}>{mutation.isPending ? 'Adicionando...' : 'Adicionar ao rascunho'}</Button>}
      </form>}
      <section className="space-y-4 border-t border-border pt-5"><h3 className="text-heading-3 font-semibold">Análise por item</h3><p className="text-caption text-muted-foreground">Agregados por versão, edição e participação. Não comprova a versão exibida durante a prova.</p>
        {!canIntel ? <p className="text-caption text-muted-foreground">Análise indisponível para sua permissão. A consulta de versões e o reuso continuam disponíveis.</p> : <><div><label htmlFor="bank-analysis-edition" className="mb-2 block text-caption font-semibold">Edição da análise</label><select id="bank-analysis-edition" value={editionId} onChange={event => setEditionId(event.target.value)} className="min-h-11 w-full rounded-lg border border-input bg-background px-3"><option value="">Todas as edições, separadamente</option>{catalog.data?.map(edition => <option key={edition.id} value={edition.id}>{edition.label} ({edition.code})</option>)}</select></div>
          {analysis.isPending ? <p role="status">Carregando análise...</p> : analysis.isError ? <div role="alert"><p>Não foi possível carregar a análise.</p><Button variant="outline" className="mt-3 min-h-11" onClick={() => void analysis.refetch()}>Tentar novamente</Button></div> : !analysis.data?.length ? <p className="text-caption text-muted-foreground">Nenhum resultado observado e liberado neste contexto.</p> : <div className="space-y-3">{analysis.data.map((row,index) => <article key={`${row.version_id}:${row.edition_id}:${row.is_training}:${row.provenance}:${index}`} className="rounded-lg border border-border p-4 text-caption"><h4 className="break-words font-semibold">{row.version_id ? `Versão ${versions.find(v => v.id === row.version_id)?.version_number ?? 'não carregada'}` : 'Legado não atribuível'} / {catalog.data?.find(e => e.id === row.edition_id)?.label ?? 'Edição não identificada'}</h4><p className="mt-2 text-muted-foreground">{row.is_training ? 'Treino ou fora da janela' : 'Na janela'} / {row.provenance === 'result_observed' ? 'Observada no resultado' : 'Sem atribuição histórica'}</p><dl className="mt-3 grid grid-cols-2 gap-2 tabular-nums"><dt>Resultados observados</dt><dd>{row.n_responses}</dd><dt>Respondidos</dt><dd>{row.n_answered}</dd><dt>Acertos</dt><dd>{row.n_correct}</dd><dt>Acerto observado</dt><dd>{Number.isFinite(row.difficulty_observed) ? `${(row.difficulty_observed*100).toLocaleString('pt-BR',{ maximumFractionDigits:2 })}%` : 'Indisponível'}</dd></dl></article>)}</div>}
          <p className="text-caption text-muted-foreground">Proporção bruta de acertos, incluindo itens em branco. Não é TRI nem calibração psicométrica.</p></>}
      </section>
    </>}
  </DialogContent></Dialog>;
}
