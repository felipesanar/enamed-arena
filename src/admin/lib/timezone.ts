const TZ = 'America/Sao_Paulo';

/** Offset (min) do tz para um instante UTC. -180 = UTC-3. */
function tzOffsetMinutes(date: Date, tz: string = TZ): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const p: Record<string, string> = {};
  for (const part of dtf.formatToParts(date)) p[part.type] = part.value;
  // Intl pode devolver hour '24' à meia-noite em alguns ambientes; normaliza.
  const hour = p.hour === '24' ? '00' : p.hour;
  const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +hour, +p.minute, +p.second);
  return (asUTC - date.getTime()) / 60000;
}

/** 'YYYY-MM-DDTHH:mm' (hora de Brasília) -> ISO UTC. */
export function localInputToUtcISO(local: string, tz: string = TZ): string {
  if (!local) return '';
  const [d, t] = local.split('T');
  const [y, mo, da] = d.split('-').map(Number);
  const [h, mi] = (t ?? '00:00').split(':').map(Number);
  const guess = Date.UTC(y, mo - 1, da, h, mi);
  const offset = tzOffsetMinutes(new Date(guess), tz);
  return new Date(guess - offset * 60000).toISOString();
}

/** ISO UTC -> 'YYYY-MM-DDTHH:mm' (hora de Brasília) p/ <input datetime-local>. */
export function utcISOToLocalInput(iso: string, tz: string = TZ): string {
  if (!iso) return '';
  const date = new Date(iso);
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  });
  const p: Record<string, string> = {};
  for (const part of dtf.formatToParts(date)) p[part.type] = part.value;
  const hour = p.hour === '24' ? '00' : p.hour;
  return `${p.year}-${p.month}-${p.day}T${hour}:${p.minute}`;
}

function fmt(iso: string, tz: string = TZ): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: tz, weekday: 'short', day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso));
}

/** Resumo legível das três datas (gravadas em UTC). */
export function formatWindowSummary(startISO: string, endISO: string, releaseISO: string, tz: string = TZ): string {
  return `Abre ${fmt(startISO, tz)} · Fecha ${fmt(endISO, tz)} · Resultado ${fmt(releaseISO, tz)} — horário de Brasília`;
}
