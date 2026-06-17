/** Valida coerência das janelas de um simulado. Retorna mensagem de erro pt-BR ou null se OK.
 *  Campos vazios não são validados (retorna null) — validação de obrigatoriedade é do form. */
export function validateWindows(start: string, end: string, release: string): string | null {
  if (!start || !end) return null
  if (new Date(end) <= new Date(start)) return 'A janela deve terminar depois de começar.'
  if (release && new Date(release) < new Date(end)) return 'A liberação de resultados deve ser após o fim da janela.'
  return null
}

/** Avisos não-bloqueantes (string[]). nowISO injetável p/ teste. */
export function windowWarnings(
  start: string, end: string, _release: string, durationMinutes: number, nowISO?: string,
): string[] {
  const out: string[] = [];
  if (!start || !end) return out;
  const now = nowISO ? new Date(nowISO) : new Date();
  if (new Date(start) < now) out.push('Atenção: a janela começa no passado.');
  const windowMin = (new Date(end).getTime() - new Date(start).getTime()) / 60000;
  if (durationMinutes && windowMin < durationMinutes) {
    out.push(`Atenção: a duração da prova (${durationMinutes} min) é maior que a janela (${Math.round(windowMin)} min).`);
  }
  return out;
}
