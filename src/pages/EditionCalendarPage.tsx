import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAppConfig } from '@/hooks/useAppConfig';
import { useUserEdition } from '@/hooks/useUserEdition';
import { useSimulados } from '@/hooks/useSimulados';
import { Button } from '@/components/ui/button';
import { buildEditionCalendar, calendarFilename, exportCalendarIcs, googleCalendarUrl } from '@/lib/edition-calendar';
import type { EditionCalendarEvent } from '@/types/edition-calendar';

const brazilTime = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' });
function eventDate(event: EditionCalendarEvent) {
  if (event.allDay) return `${event.start.split('-').reverse().join('/')} · Dia inteiro`;
  return `${brazilTime.format(new Date(event.start))}${event.end ? ` até ${brazilTime.format(new Date(event.end))}` : ''}`;
}

function CalendarContent() {
  const editions = useUserEdition(true);
  const simulados = useSimulados();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [exportStatus, setExportStatus] = useState('');
  const catalog = editions.isSuccess ? editions.data ?? [] : [];
  const selected = catalog.find(e => e.id === selectedId) ?? catalog.find(e => e.id === editions.userEdition?.id) ?? catalog[0] ?? null;
  const loading = editions.isPending || simulados.loading;
  const error = editions.isError || !!simulados.error;
  const calendar = buildEditionCalendar(selected, loading || error ? [] : simulados.simulados);
  const events = loading || error ? [] : calendar.events;

  function download(items: readonly EditionCalendarEvent[]) {
    let url: string | undefined;
    try {
      url = URL.createObjectURL(new Blob([exportCalendarIcs(items, new Date())], { type: 'text/calendar;charset=utf-8' }));
      const anchor = document.createElement('a');
      anchor.href = url; anchor.download = calendarFilename(selected?.code ?? 'edicao');
      document.body.append(anchor); anchor.click(); anchor.remove();
      setExportStatus('Calendário exportado. O arquivo não inclui dados pessoais.');
    } catch {
      setExportStatus('Não foi possível exportar. Tente novamente.');
    } finally {
      if (url) URL.revokeObjectURL(url);
    }
  }

  return <section className="mx-auto w-full max-w-6xl min-w-0 space-y-6 p-4 text-foreground md:p-8" aria-labelledby="calendar-title">
    <header className="flex flex-col items-start justify-between gap-5 md:flex-row">
      <div className="min-w-0 space-y-2">
        <p className="text-overline text-primary">Sua preparação, edição por edição</p>
        <h1 id="calendar-title" className="text-heading-1 font-bold tracking-tight">Calendário de simulados</h1>
        <p className="max-w-2xl text-body">Acompanhe as janelas de realização e a liberação de resultados. Consultar outra edição não altera seu alvo de estudo.</p>
      </div>
      <Button className="min-h-11 w-full shrink-0 md:w-auto" disabled={!events.length} onClick={() => download(events)}>Exportar calendário</Button>
    </header>
    <div className="flex min-w-0 flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <label className="grid min-w-0 gap-2 text-sm font-semibold md:max-w-lg">Edição consultada
        <select className="min-h-11 w-full min-w-0 max-w-full rounded-md border border-input bg-background px-3 py-2 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          disabled={loading || !catalog.length} value={selected?.id ?? ''} onChange={event => { setSelectedId(event.target.value); setExportStatus(''); }}>
          {!catalog.length && <option value="">Nenhuma edição disponível</option>}
          {catalog.map(e => <option key={e.id} value={e.id}>{e.label}{e.id === editions.userEdition?.id ? ' · edição-alvo' : ''}{e.status === 'archived' ? ' · histórico' : ''}</option>)}
        </select>
      </label>
      <p className="text-sm">Horários de Brasília · America/Sao_Paulo</p>
    </div>
    {loading ? <p role="status" className="rounded-lg border bg-card p-6">Carregando calendário…</p>
      : error ? <div role="alert" className="space-y-3 rounded-lg border bg-card p-6"><p>Não foi possível carregar o calendário. Sua seleção será preservada.</p><Button variant="outline" onClick={() => { void editions.refetch(); void simulados.refetch(); }}>Tentar novamente</Button></div>
      : <>
        {selected && <div className="space-y-1 rounded-lg border bg-card p-4 [overflow-wrap:anywhere]">
          <h2 className="font-semibold">{selected.label}</h2>
          <p className="text-sm">{selected.id === editions.userEdition?.id ? 'Esta é sua edição-alvo.' : 'Você está consultando outra edição. Seu alvo não foi alterado.'}</p>
          {!events.some(event => event.type === 'official-exam') && <p className="text-sm">Data oficial a confirmar. Quando disponíveis, as janelas de simulados abaixo não representam confirmação da prova pelo Inep.</p>}
        </div>}
        {selected?.exam_date_confirmed && !events.some(event => event.type === 'official-exam') && <p role="alert" className="rounded-lg border border-warning bg-card p-4 text-sm">Há um erro de configuração na data oficial desta edição. A prova oficial foi omitida do calendário e da exportação.</p>}
        {calendar.errors.length > 0 && <p role="alert" className="rounded-lg border border-warning bg-card p-4 text-sm">Há datas com erro de configuração em {new Set(calendar.errors.map(e => e.simuladoId)).size} simulado(s). Eventos inválidos foram omitidos; nenhuma liberação de resultados foi presumida.</p>}
        {events.length ? <ol aria-label="Eventos em ordem cronológica" className="divide-y divide-border rounded-lg border bg-card">
          {events.map(event => <li key={`${event.simuladoId ?? 'official'}-${event.type}`} className="grid min-w-0 gap-3 p-5 md:grid-cols-[minmax(0,1fr)_auto] md:gap-5">
            <div className="min-w-0 space-y-1 [overflow-wrap:anywhere]">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">{event.type === 'window' ? 'Janela de realização' : event.type === 'results' ? 'Liberação de resultados' : 'Prova oficial'}</p>
              <h3 className="font-semibold">{event.title}</h3>
              <p className="text-sm"><time dateTime={event.start}>{eventDate(event)}</time></p>
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
              <button className="min-h-11 underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => download([event])} aria-label={`Exportar ICS: ${event.title}`}>ICS</button>
              <a className="inline-flex min-h-11 items-center underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href={googleCalendarUrl(event)} target="_blank" rel="noopener noreferrer" aria-label={`Google Agenda: ${event.title}`}>Google Agenda</a>
            </div>
          </li>)}
        </ol> : <p role="status" className="rounded-lg border bg-card p-6">Nenhum evento disponível para esta edição.</p>}
      </>}
    <p className="text-sm">A janela indica quando realizar o simulado, não a duração da prova. Resultados são marcos sem duração. Exportações não incluem notas, respostas ou dados pessoais.</p>
    {exportStatus && <p role="status" className="text-sm">{exportStatus}</p>}
  </section>;
}

export default function EditionCalendarPage() {
  const enabled = useAppConfig('editions_ui');
  return enabled ? <CalendarContent /> : <Navigate to="/simulados" replace />;
}
