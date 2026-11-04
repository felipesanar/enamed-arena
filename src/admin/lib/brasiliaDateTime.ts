const formatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

export function isoToBrasiliaInput(iso: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) throw new Error('Data inválida');
  const parts = Object.fromEntries(formatter.formatToParts(date).map(p => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

/** Resolve the zone with Intl, including historic DST, never the browser zone. */
export function brasiliaInputToISO(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error('Data inválida');
  const wall = Date.parse(`${value}:00Z`);
  let instant = wall;
  for (let i = 0; i < 3; i++) {
    const rendered = Date.parse(`${isoToBrasiliaInput(new Date(instant).toISOString())}:00Z`);
    instant += wall - rendered;
  }
  const iso = new Date(instant).toISOString();
  if (isoToBrasiliaInput(iso) !== value) throw new Error('Data ou horário inválido em Brasília');
  return iso;
}
