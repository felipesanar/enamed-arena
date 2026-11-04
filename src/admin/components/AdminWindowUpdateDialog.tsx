import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { adminApi } from '@/admin/services/adminApi';
import { brasiliaInputToISO, isoToBrasiliaInput } from '@/admin/lib/brasiliaDateTime';
import { invalidateAdminExamQueries } from '@/lib/exam-query-cache';
import type { SimuladoWindow, WindowPreview, WindowUpdateReport } from '@/admin/types/admin-session';

const fields = [
  ['execution_window_start', 'Nova abertura'],
  ['execution_window_end', 'Novo fechamento'],
  ['results_release_at', 'Nova liberação de resultados'],
] as const;
const formatDate = (iso: string) => new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));

export function AdminWindowUpdateDialog({ simuladoId, window, onSuccess }: {
  simuladoId: string; window: SimuladoWindow; onSuccess: (window: SimuladoWindow) => void;
}) {
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [dates, setDates] = useState<SimuladoWindow>(() => ({
    execution_window_start: isoToBrasiliaInput(window.execution_window_start),
    execution_window_end: isoToBrasiliaInput(window.execution_window_end),
    results_release_at: isoToBrasiliaInput(window.results_release_at),
  }));
  const [reason, setReason] = useState('');
  const [preview, setPreview] = useState<WindowPreview | null>(null);
  const [pending, setPending] = useState<'preview' | 'update' | 'read' | null>(null);
  const [error, setError] = useState('');
  const [uncertain, setUncertain] = useState(false);
  const [completed, setCompleted] = useState<WindowUpdateReport | null>(null);
  const lock = useRef(false);
  const firstInput = useRef<HTMLInputElement>(null);
  const summaryElement = useRef<HTMLDivElement>(null);
  const reportElement = useRef<HTMLParagraphElement>(null);
  let proposed: SimuladoWindow | null = null;
  try {
    const value = Object.fromEntries(fields.map(([key]) => [key, brasiliaInputToISO(dates[key])])) as unknown as SimuladoWindow;
    if (Date.parse(value.execution_window_start) < Date.parse(value.execution_window_end) && Date.parse(value.execution_window_end) <= Date.parse(value.results_release_at)) proposed = value;
  } catch { /* Invalid local input is kept editable, never sent. */ }

  const confer = async () => {
    if (lock.current || !proposed) return;
    lock.current = true; setPending('preview'); setError(''); setPreview(null);
    try { setPreview(await adminApi.previewSimuladoWindow(simuladoId, proposed)); requestAnimationFrame(() => summaryElement.current?.focus()); }
    catch { setError('Não foi possível conferir o impacto. Tente conferir novamente.'); }
    finally { lock.current = false; setPending(null); }
  };
  const readCurrent = async () => {
    if (lock.current) return;
    lock.current = true; setPending('read'); setPreview(null); setError('');
    try {
      const current = await adminApi.getSimulado(simuladoId);
      setDates({
        execution_window_start: isoToBrasiliaInput(current.execution_window_start),
        execution_window_end: isoToBrasiliaInput(current.execution_window_end),
        results_release_at: isoToBrasiliaInput(current.results_release_at),
      });
      setError('Janela atual lida. Confira novamente o impacto. O resultado do envio anterior ainda exige revisão da auditoria por uma pessoa autorizada.');
    } catch { setError('Não foi possível ler a janela atual. O novo envio continua bloqueado.'); }
    finally { lock.current = false; setPending(null); }
  };
  const confirm = async () => {
    if (lock.current || !preview || !proposed || uncertain || !reason.trim() || reason.trim().length > 2000) return;
    lock.current = true; setPending('update'); setError('');
    try {
      const report = await adminApi.updateSimuladoWindow(simuladoId, proposed, preview.current_window_hash, reason);
      invalidateAdminExamQueries(client);
      onSuccess(report.new_window);
      setCompleted(report); setPreview(null); setOpen(false);
    } catch (failure) {
      const code = failure && typeof failure === 'object' && 'code' in failure ? String(failure.code) : '';
      const message = failure && typeof failure === 'object' && 'message' in failure ? String(failure.message) : '';
      const status = failure && typeof failure === 'object' && 'status' in failure ? Number(failure.status) : null;
      setPreview(null);
      if (code === '40001' || message.includes('STALE_WINDOW_HASH')) setError('A janela mudou desde a conferência. Confira novamente antes de confirmar.');
      else if (code === '55P03') setError('A prova está ocupada por outra operação. Aguarde e confira novamente.');
      else if (['22023', '42501', 'P0003', 'PGRST202', '42883'].includes(code) || status === 403) setError('Alteração recusada. Confira os dados, as permissões e a disponibilidade desta operação.');
      else { setUncertain(true); setError('Resultado incerto: a alteração pode ter sido concluída. Novo envio bloqueado nesta sessão.'); }
    } finally { lock.current = false; setPending(null); }
  };

  return <div className="space-y-3">
    <Dialog open={open} onOpenChange={value => {
      if (lock.current) return;
      if (value) { setPreview(null); setError(''); }
      setOpen(value);
    }}>
      <DialogTrigger asChild><Button type="button" variant="outline" className="min-h-11">Alterar janela com conferência</Button></DialogTrigger>
      <DialogContent aria-busy={!!pending} className="max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto border-admin-line bg-admin-surface text-admin-text motion-reduce:animate-none sm:max-w-xl" onOpenAutoFocus={event => { event.preventDefault(); firstInput.current?.focus(); }} onCloseAutoFocus={event => { if (completed) { event.preventDefault(); reportElement.current?.focus(); } }} onEscapeKeyDown={event => { if (lock.current) event.preventDefault(); }} onPointerDownOutside={event => { if (lock.current) event.preventDefault(); }}>
        <DialogTitle className="pr-6">Alterar janela da prova</DialogTitle>
        <DialogDescription className="text-admin-muted">Confira o impacto no ranking antes de alterar. As respostas e notas são preservadas. Todos os horários são de Brasília.</DialogDescription>
        <div className="space-y-3">{fields.map(([key, label], index) => <div key={key} className="min-w-0 space-y-1.5">
          <label className="block text-sm font-medium" htmlFor={`new-${key}`}>{label}</label>
          <Input ref={index === 0 ? firstInput : undefined} id={`new-${key}`} type="datetime-local" value={dates[key]} disabled={!!pending} className="min-h-11 min-w-0 max-w-full border-admin-line-strong bg-admin-bg text-admin-text [color-scheme:light] dark:[color-scheme:dark]" onChange={event => { setDates(prev => ({ ...prev, [key]: event.target.value })); setPreview(null); setError(''); setCompleted(null); }} />
          <p className="text-xs text-admin-muted">Atual: {formatDate((preview?.old_window ?? window)[key])}</p>
        </div>)}</div>
        {!proposed && <p role="alert" className="text-sm">Confira as datas: abertura antes do fechamento e resultados no fechamento ou depois.</p>}
        <Button type="button" variant="outline" className="min-h-11" disabled={!!pending || !proposed} onClick={confer}>{pending === 'preview' ? 'Conferindo impacto...' : 'Conferir impacto'}</Button>
        {preview && <div ref={summaryElement} tabIndex={-1} role="status" className="rounded-lg border border-admin-line bg-admin-raised p-4 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-admin-accent"><p className="font-semibold">{preview.attempts_examined} tentativas conferidas</p>{fields.map(([key, label]) => <p key={key} className="mt-2">{label}: {formatDate(preview.old_window[key])} antes; {formatDate(preview.new_window[key])} depois.</p>)}<p className="mt-2">Elegíveis para ranking: {preview.old_eligible} antes; {preview.new_eligible} depois.</p><p>{preview.eligibility_changed} participações mudam de elegibilidade.</p><p className="mt-2 text-admin-muted">A confirmação confere novamente a janela no servidor.</p></div>}
        <div className="space-y-1.5"><label htmlFor="window-reason" className="block text-sm font-medium">Motivo</label><Textarea id="window-reason" value={reason} disabled={!!pending} onChange={event => setReason(event.target.value)} className="border-admin-line-strong bg-admin-bg text-admin-text" aria-describedby="window-reason-help" /><p id="window-reason-help" className="text-xs text-admin-muted">Obrigatório, de 1 a 2000 caracteres. Não inclua dados pessoais de alunos.</p></div>
        {error && <p role="alert" className="text-sm">{error}</p>}
        {uncertain && <><p className="text-sm">Resultado incerto. Confira a auditoria e a janela atual antes de qualquer nova operação. Conferir impacto faz apenas uma leitura e não libera um novo envio.</p><Button type="button" variant="outline" disabled={!!pending} onClick={readCurrent}>Ler janela atual</Button></>}
        <DialogFooter className="gap-2"><Button type="button" variant="outline" disabled={!!pending} className="min-h-11" onClick={() => setOpen(false)}>Voltar ao formulário</Button><Button type="button" className="min-h-11" disabled={!!pending || !preview || !proposed || uncertain || !reason.trim() || reason.trim().length > 2000} onClick={confirm}>{pending === 'update' ? 'Alterando janela...' : 'Confirmar alteração'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
    {completed && <p ref={reportElement} tabIndex={-1} role="status" className="text-sm">Janela alterada. Respostas e notas preservadas. {completed.attempts_examined} tentativas conferidas; {completed.eligibility_changed} participações mudaram de elegibilidade.</p>}
  </div>;
}
