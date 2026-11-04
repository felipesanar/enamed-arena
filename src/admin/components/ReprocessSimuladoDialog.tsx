import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useAppConfig } from '@/hooks/useAppConfig';
import { useAdminAccess } from '@/admin/contexts/AdminAccessContext';
import { adminReprocessApi, reprocessErrorMessage } from '@/admin/services/adminReprocessApi';
import { toast } from '@/hooks/use-toast';
import type { ReprocessReport } from '@/types/admin-operations';

function Content({ simuladoId }: { simuladoId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [uncertain, setUncertain] = useState(false);
  const [report, setReport] = useState<ReprocessReport | null>(null);
  const lock = useRef(false);
  const reasonInput = useRef<HTMLTextAreaElement>(null);
  const reportElement = useRef<HTMLDivElement>(null);
  const client = useQueryClient();
  const context = useQuery({ queryKey: ['admin', 'reprocess-context', simuladoId], queryFn: () => adminReprocessApi.context(simuladoId), enabled: open, retry: false, staleTime: 0 });
  const end = Date.parse(context.data?.execution_window_end ?? '');
  const blocked = !context.data?.edition ? 'Edição não disponível. Revise a associação da prova antes de reprocessar.'
    : !Number.isFinite(end) ? 'Janela de execução indisponível. Revise o cadastro da prova.'
    : Date.now() <= end ? 'A janela de execução ainda está aberta. Aguarde o encerramento.' : '';

  const submit = async () => {
    if (lock.current || blocked || context.isFetching || context.isError || uncertain) return;
    if (!reason.trim() || reason.trim().length > 2000) {
      setError('Informe um motivo com 1 a 2000 caracteres.'); reasonInput.current?.focus(); return;
    }
    lock.current = true; setPending(true); setError('');
    try {
      const result = await adminReprocessApi.reprocess(simuladoId, reason);
      setReport(result); setOpen(false);
      // Mark related caches stale without triggering an indiscriminate active refetch.
      void client.invalidateQueries({ predicate: query => {
        const key = query.queryKey;
        if (key[0] === 'admin') return ['simulado-detail-stats', 'simulado-question-stats', 'score-distribution', 'performance-by-area', 'simulado-results-aggregate', 'simulado-results-roster', 'attempts', 'attempt-kpis', 'user-attempts', 'attempt-questions', 'intel', 'reprocess-context'].includes(String(key[1]));
        return ['simulado', 'simulados', 'user-performance', 'user-attempts', 'ranking-simulados', 'ranking', 'comparative', 'exam-result', 'exam-result-access', 'ranking-evolution-history', 'ranking-evolution-prev', 'notebook-page', 'notebook-counts', 'notebook-due-count', 'caderno-pattern-insights', 'caderno-area-score-history', 'caderno-confidence-calibration'].includes(String(key[0]));
      }, refetchType: 'none' });
      void client.refetchQueries({ type: 'active', predicate: query => {
        const key = query.queryKey;
        if (key[0] !== 'admin') return false;
        if (key[1] === 'simulado-results-roster') {
          const params = key[2];
          return !!params && typeof params === 'object' && 'simuladoId' in params && params.simuladoId === simuladoId;
        }
        return ['simulado-detail-stats', 'simulado-question-stats', 'score-distribution', 'performance-by-area', 'simulado-results-aggregate'].includes(String(key[1])) && key[2] === simuladoId;
      } });
      toast({ title: 'Reprocessamento concluído', description: 'O relatório contém apenas totais agregados.' });
    } catch (failure) {
      setError(reprocessErrorMessage(failure));
      const code = failure && typeof failure === 'object' && 'code' in failure ? String(failure.code) : '';
      setUncertain(!['55P03', '22023', '42501', 'P0003'].includes(code));
      requestAnimationFrame(() => reasonInput.current?.focus());
    } finally { lock.current = false; setPending(false); }
  };

  return <div className="space-y-3">
    <Dialog open={open} onOpenChange={value => { if (!lock.current) setOpen(value); }}>
      <DialogTrigger asChild><Button variant="outline" className="min-h-11">Reprocessar resultados</Button></DialogTrigger>
      <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto border-admin-line bg-admin-surface text-admin-text motion-reduce:animate-none" onOpenAutoFocus={event => { event.preventDefault(); reasonInput.current?.focus(); }} onCloseAutoFocus={event => { if (report) { event.preventDefault(); reportElement.current?.focus(); } }}>
        <DialogTitle className="pr-6">Reprocessar resultados</DialogTitle>
        <DialogDescription className="text-admin-muted">Recalcula resultados finalizados com o gabarito atual e reconcilia o histórico de desempenho e o caderno de erros. Preserva respostas e a trajetória acadêmica. Não altera gabarito, não reabre ou finaliza tentativas e não calcula TRI.</DialogDescription>
        {context.isFetching ? <p role="status">Conferindo prova...</p> : context.isError ? <div role="alert"><p>Não foi possível conferir a prova.</p><Button variant="outline" onClick={() => context.refetch()}>Tentar conferir novamente</Button></div> : <>
          <p className="break-words text-sm font-semibold">{context.data?.title} · {context.data?.edition?.label || 'Edição indisponível'}</p>
          {blocked && <p role="alert" className="text-sm">{blocked}</p>}
        </>}
        <div><label htmlFor="reprocess-reason" className="mb-2 block text-sm font-medium">Motivo</label><Textarea id="reprocess-reason" ref={reasonInput} value={reason} disabled={pending} aria-invalid={!!error} aria-describedby="reprocess-help reprocess-error" onChange={e => setReason(e.target.value)} className="min-h-28" /><p id="reprocess-help" className="mt-2 text-sm text-admin-muted">Obrigatório, até 2000 caracteres. Não inclua dados pessoais de alunos. A correção do gabarito deve ter sido feita antes desta operação.</p></div>
        <p id="reprocess-error" role={error ? 'alert' : undefined} className="text-sm">{error}</p>
        {uncertain && <p className="text-sm">Novo envio bloqueado nesta sessão. Confira os resultados e a auditoria e recarregue a página somente após esclarecer o resultado da operação.</p>}
        <DialogFooter className="gap-2"><Button variant="outline" disabled={pending} className="min-h-11" onClick={() => setOpen(false)}>Cancelar</Button><Button className="min-h-11" disabled={pending || !!blocked || context.isFetching || context.isError || uncertain} onClick={submit}>{pending ? 'Reprocessando...' : 'Confirmar reprocessamento'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
    {report && <div ref={reportElement} tabIndex={-1} role="status" className="rounded-lg border border-admin-line bg-admin-raised p-4 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-admin-accent"><h2 className="font-semibold">Reprocessamento concluído</h2><p className="mt-2">{report.attempts_processed} tentativas processadas · {report.scores_changed} notas alteradas · {report.entries_reconciled} entradas reconciliadas.</p><p className="mt-2">{report.idempotent ? 'Nenhuma alteração adicional foi necessária para este gabarito.' : 'Resultados reconciliados pelo servidor.'}</p></div>}
  </div>;
}

export function ReprocessSimuladoDialog({ simuladoId }: { simuladoId: string }) {
  const enabled = useAppConfig('editions_ui');
  const { capabilities } = useAdminAccess();
  if (!enabled || !capabilities.has('content.manage') || !capabilities.has('attempts.manage')) return null;
  return <Content key={simuladoId} simuladoId={simuladoId} />;
}
