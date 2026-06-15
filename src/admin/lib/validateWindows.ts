/** Valida coerência das janelas de um simulado. Retorna mensagem de erro pt-BR ou null se OK.
 *  Campos vazios não são validados (retorna null) — validação de obrigatoriedade é do form. */
export function validateWindows(start: string, end: string, release: string): string | null {
  if (!start || !end) return null
  if (new Date(end) <= new Date(start)) return 'A janela deve terminar depois de começar.'
  if (release && new Date(release) < new Date(end)) return 'A liberação de resultados deve ser após o fim da janela.'
  return null
}
