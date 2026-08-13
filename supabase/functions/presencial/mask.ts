/**
 * Mascaramento de e-mail para a sugestão de conta por nome.
 *
 * Objetivo: o dono reconhece o próprio endereço; um terceiro não consegue
 * reconstruí-lo. Preserva 2 primeiros e 2 últimos caracteres do local-part,
 * a primeira letra do domínio e o TLD inteiro (inclusive composto, .com.br).
 *
 * Módulo puro, sem API de Deno — testado por Vitest.
 */
const DOT = '•'

function maskMiddle(value: string, keepStart: number, keepEnd: number): string {
  if (value.length <= keepStart + keepEnd) {
    return value.slice(0, 1) + DOT.repeat(Math.max(value.length - 1, 1))
  }
  const start = value.slice(0, keepStart)
  const end = value.slice(value.length - keepEnd)
  return start + DOT.repeat(value.length - keepStart - keepEnd) + end
}

export function maskEmail(email: string): string {
  const at = email.lastIndexOf('@')
  if (at <= 0 || at === email.length - 1) return DOT.repeat(3)

  const local = email.slice(0, at)
  const domain = email.slice(at + 1)

  const firstDot = domain.indexOf('.')
  if (firstDot <= 0) return DOT.repeat(3)

  const host = domain.slice(0, firstDot)
  const tld = domain.slice(firstDot) // ".com" ou ".com.br"

  const maskedLocal = local.length <= 4
    ? local.slice(0, 1) + DOT.repeat(Math.max(local.length - 1, 1))
    : maskMiddle(local, 2, 2)

  const maskedHost = host.slice(0, 1) + DOT.repeat(Math.max(host.length - 1, 1))

  return `${maskedLocal}@${maskedHost}${tld}`
}
