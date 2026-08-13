/**
 * Token do fluxo presencial: HMAC-SHA256 sobre o payload em base64url.
 *
 * NÃO é sessão Supabase. Escopo é um único gabarito: com ele não se lê caderno
 * de erros, desempenho, ranking nem qualquer dado da conta. TTL de 2h.
 *
 * Usa Web Crypto, disponível tanto no Deno quanto no Node do Vitest.
 *
 * O payload é ASSINADO (HMAC), não CIFRADO: qualquer um com o token consegue
 * decodificar o base64url e ler o JSON — a assinatura só garante que não foi
 * adulterado, não que é secreto. Por isso nenhum identificador de usuário
 * (user_id, e-mail, etc.) entra aqui: violaria a invariante "o user_id nunca
 * sai numa resposta HTTP". Quando o servidor precisar do user_id depois,
 * derive por join a partir de `attempt_id` (public.attempts) ou
 * `submission_id` (public.presencial_submissions.linked_user_id) — nunca
 * confie num user_id vindo do cliente.
 */
export interface PresencialTokenPayload {
  submission_id: string
  simulado_id: string
  session_id: string
  attempt_id: string | null
  exp: number
}

const enc = new TextEncoder()

function b64url(input: string): string {
  return btoa(input).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromB64url(input: string): string {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/')
  return atob(padded + '='.repeat((4 - (padded.length % 4)) % 4))
}

async function hmac(body: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(body))
  return b64url(String.fromCharCode(...new Uint8Array(sig)))
}

export async function signToken(
  payload: PresencialTokenPayload,
  secret: string,
): Promise<string> {
  const body = b64url(JSON.stringify(payload))
  return `${body}.${await hmac(body, secret)}`
}

export async function verifyToken(
  token: string,
  secret: string,
  nowMs: number,
): Promise<PresencialTokenPayload | null> {
  const parts = token.split('.')
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null

  const [body, sig] = parts
  const expected = await hmac(body, secret)

  // Comparação de tempo constante.
  if (sig.length !== expected.length) return null
  let diff = 0
  for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i)
  if (diff !== 0) return null

  try {
    const payload = JSON.parse(fromB64url(body)) as PresencialTokenPayload
    if (typeof payload.exp !== 'number' || payload.exp <= nowMs) return null
    return payload
  } catch {
    return null
  }
}
