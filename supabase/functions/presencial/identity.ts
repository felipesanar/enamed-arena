/**
 * Normalização de nome e regra de corte de candidatos.
 *
 * O corte em 3 é deliberado: na base há 40 nomes com 4+ contas (colisão máxima
 * de 19). Listar candidatos nesses casos só aumenta a chance de o aluno
 * reivindicar a conta de um homônimo. Módulo puro — testado por Vitest.
 */
export const MAX_CANDIDATES = 3

export function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // combining diacritical marks
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
}

export function firstLastKey(name: string): string {
  const parts = normalizeName(name).split(' ').filter(Boolean)
  if (parts.length === 0) return ''
  const first = parts[0]
  const last = parts[parts.length - 1]
  return `${first} ${last}`
}

export function pickCandidates<T>(rows: T[], max: number = MAX_CANDIDATES): T[] {
  if (rows.length === 0 || rows.length > max) return []
  return rows
}
