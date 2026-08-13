// supabase/functions/presencial/token.test.ts
import { describe, it, expect } from 'vitest'
import { signToken, verifyToken, type PresencialTokenPayload } from './token'

const SECRET = 'segredo-de-teste-nao-usar-em-producao'
const NOW = 1_760_000_000_000

const payload: PresencialTokenPayload = {
  submission_id: 'sub-1',
  simulado_id: 'sim-1',
  session_id: 'sess-1',
  attempt_id: 'att-1',
  user_id: 'user-1',
  exp: NOW + 2 * 60 * 60 * 1000,
}

describe('token', () => {
  it('assina e verifica o mesmo payload', async () => {
    const t = await signToken(payload, SECRET)
    expect(await verifyToken(t, SECRET, NOW)).toEqual(payload)
  })

  it('rejeita assinatura de outro segredo', async () => {
    const t = await signToken(payload, SECRET)
    expect(await verifyToken(t, 'outro-segredo', NOW)).toBeNull()
  })

  it('rejeita payload adulterado', async () => {
    const t = await signToken(payload, SECRET)
    const [body, sig] = t.split('.')
    const tampered = btoa(JSON.stringify({ ...payload, user_id: 'invasor' }))
      .replace(/=+$/, '')
    expect(await verifyToken(`${tampered}.${sig}`, SECRET, NOW)).toBeNull()
    expect(body).not.toBe(tampered)
  })

  it('rejeita token expirado', async () => {
    const t = await signToken({ ...payload, exp: NOW - 1 }, SECRET)
    expect(await verifyToken(t, SECRET, NOW)).toBeNull()
  })

  it('rejeita formato inválido', async () => {
    expect(await verifyToken('sem-ponto', SECRET, NOW)).toBeNull()
    expect(await verifyToken('', SECRET, NOW)).toBeNull()
  })
})
