/** Iniciais (2 primeiros nomes) para avatares. Fallback 'A'. */
export function getInitials(name: string | null | undefined): string {
  if (!name) return 'A'
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(n => n[0])
    .join('')
    .toUpperCase() || 'A'
}

/** Número compacto pt-BR */
export function formatCompact(n: number): string {
  return new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(n)
}

/** Inteiro com separador pt-BR */
export function formatInt(n: number): string {
  return new Intl.NumberFormat('pt-BR').format(n)
}
