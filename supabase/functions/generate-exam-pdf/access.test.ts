import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { authorizeExamPdf } from './access'
import { readFileSync } from 'node:fs'

const edge = vi.hoisted(() => ({
  handler: null as null | ((request: Request) => Promise<Response>),
  createClient: vi.fn(),
}))
vi.mock('https://deno.land/std@0.168.0/http/server.ts', () => ({
  serve: (handler: (request: Request) => Promise<Response>) => { edge.handler = handler },
}))
vi.mock('https://esm.sh/@supabase/supabase-js@2.49.4', () => ({ createClient: edge.createClient }))
vi.mock('https://esm.sh/pdf-lib@1.17.1', () => ({
  rgb: vi.fn(), PDFDocument: {}, PDFFont: {}, PDFImage: {}, StandardFonts: {}, PageSizes: {},
}))

const now = Date.parse('2026-11-04T12:00:00Z')
const simulado = { status: 'published', execution_window_start: '2026-11-04T00:00:00Z', execution_window_end: '2026-11-05T00:00:00Z' }
const attempt = { user_id: 'u1', simulado_id: 's1', attempt_type: 'offline' }
function setup(overrides = {}) {
  return { userId: 'u1', simuladoId: 's1', force: false, now,
    hasCapability: vi.fn(async () => ({ data: false, error: null })),
    getSimulado: vi.fn(async () => ({ data: simulado, error: null })),
    getAttempt: vi.fn(async () => ({ data: attempt, error: null })), ...overrides }
}

describe('gate PDF', () => {
  it('permite tentativa offline propria na janela', async () => {
    expect(await authorizeExamPdf(setup())).toBe(true)
  })
  it.each([null, { ...attempt, user_id: 'other' }, { ...attempt, attempt_type: 'online' }, { ...attempt, simulado_id: 'other' }])('nega tentativa invalida: %j', async data => {
    expect(await authorizeExamPdf(setup({ getAttempt: async () => ({ data, error: null }) }))).toBe(false)
  })
  it('permite tentativa offline propria depois da janela encerrada (modo treino)', async () => {
    const closed = { ...simulado, execution_window_start: '2026-06-28T12:01:00Z', execution_window_end: '2026-07-05T02:59:00Z' }
    expect(await authorizeExamPdf(setup({ getSimulado: async () => ({ data: closed, error: null }) }))).toBe(true)
  })
  it('nega fora da janela sem tentativa offline propria', async () => {
    const closed = { ...simulado, execution_window_end: '2026-11-03T00:00:00Z' }
    expect(await authorizeExamPdf(setup({
      getSimulado: async () => ({ data: closed, error: null }),
      getAttempt: async () => ({ data: null, error: null }),
    }))).toBe(false)
  })
  it.each([
    { ...simulado, execution_window_start: '2026-11-06T00:00:00Z' },
    { ...simulado, execution_window_start: null },
    { ...simulado, status: 'draft' },
  ])('nega janela/status invalido: %j', async data => {
    expect(await authorizeExamPdf(setup({ getSimulado: async () => ({ data, error: null }) }))).toBe(false)
  })
  it('force e exclusivo do admin', async () => {
    expect(await authorizeExamPdf(setup({ force: true }))).toBe(false)
  })
  it('admin pode gerar sem tentativa e fora da janela, inclusive force', async () => {
    const input = setup({ force: true, hasCapability: async () => ({ data: true, error: null }) })
    expect(await authorizeExamPdf(input)).toBe(true)
    expect(input.getAttempt).not.toHaveBeenCalled()
  })
  it('nega sub ausente antes de consultar capacidade', async () => {
    const input = setup({ userId: '' })
    expect(await authorizeExamPdf(input)).toBe(false)
    expect(input.hasCapability).not.toHaveBeenCalled()
  })
  it.each(['hasCapability', 'getSimulado', 'getAttempt'])('falha fechado em erro de %s', async key => {
    expect(await authorizeExamPdf(setup({ [key]: async () => ({ data: true, error: new Error('DB') }) }))).toBe(false)
    expect(await authorizeExamPdf(setup({ [key]: async () => { throw new Error('DB') } }))).toBe(false)
  })
  it('gate integrado precede cache e URL assinada; capacidade usa JWT do usuario', () => {
    const source = readFileSync('supabase/functions/generate-exam-pdf/index.ts', 'utf8')
    const handler = source.slice(source.indexOf('serve(async'))
    expect(handler.indexOf('await authorizeExamPdf(')).toBeGreaterThan(0)
    expect(handler.indexOf('await authorizeExamPdf(')).toBeLessThan(handler.indexOf('supabase.storage'))
    expect(handler).toContain('anonClient.rpc("has_capability", { p_capability: "content.manage" })')
    expect(handler).toMatch(/status: 403/)
  })
})

describe('HTTP PDF com cache (somente mocks, sem rede)', () => {
  const storage = { list: vi.fn(), createSignedUrl: vi.fn() }
  const storageFrom = vi.fn(() => storage)
  const rpc = vi.fn()
  const getClaims = vi.fn()
  let attemptData: unknown
  let simuladoData: unknown
  let claimsError: unknown

  beforeAll(async () => {
    await import('./index')
  })
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('Deno', { env: { get: (key: string) => key } })
    attemptData = attempt
    simuladoData = { ...simulado, execution_window_start: '2020-01-01T00:00:00Z', execution_window_end: '2099-01-01T00:00:00Z', updated_at: '2026-11-04T00:00:00Z' }
    claimsError = null
    getClaims.mockImplementation(async () => ({ data: { claims: { sub: 'u1' } }, error: claimsError }))
    rpc.mockResolvedValue({ data: false, error: null })
    const db = {
      from: (table: string) => {
        const chain = {
          select: vi.fn(() => chain), eq: vi.fn(() => chain),
          maybeSingle: async () => ({ data: table === 'attempts' ? attemptData : simuladoData, error: null }),
          single: async () => ({ data: simuladoData, error: null }),
        }
        return chain
      },
      storage: { from: storageFrom },
    }
    edge.createClient.mockImplementation((_url, key) => key === 'SUPABASE_ANON_KEY'
      ? { auth: { getClaims }, rpc } : db)
    storage.list.mockImplementation(async (_path, options) => ({ data: [{ name: options.search }] }))
    storage.createSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://test.invalid/cached.pdf' }, error: null })
  })
  afterEach(() => vi.unstubAllGlobals())

  function request(force = false) {
    return new Request('https://test.invalid/pdf', { method: 'POST',
      headers: { Authorization: 'Bearer verified-test-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ simulado_id: 's1', force }),
    })
  }

  it('sem tentativa retorna 403 e nao consulta cache nem assina URL', async () => {
    attemptData = null
    expect((await edge.handler!(request())).status).toBe(403)
    expect(storageFrom).not.toHaveBeenCalled()
  })
  it('tentativa propria offline pode receber PDF do cache', async () => {
    const response = await edge.handler!(request())
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: 'ready', url: 'https://test.invalid/cached.pdf' })
    expect(storage.createSignedUrl).toHaveBeenCalledOnce()
    expect(rpc).toHaveBeenCalledWith('has_capability', { p_capability: 'content.manage' })
  })
  it('admin sem tentativa pode acessar cache', async () => {
    attemptData = null
    rpc.mockResolvedValue({ data: true, error: null })
    expect((await edge.handler!(request())).status).toBe(200)
  })
  it('force por nao admin nao acessa storage', async () => {
    expect((await edge.handler!(request(true))).status).toBe(403)
    expect(storageFrom).not.toHaveBeenCalled()
  })
  it('erro RPC nega cache mesmo com tentativa propria', async () => {
    rpc.mockResolvedValue({ data: true, error: new Error('RPC') })
    expect((await edge.handler!(request())).status).toBe(403)
    expect(storageFrom).not.toHaveBeenCalled()
  })
  it.each([{}, { sub: '' }])('exige claims.sub verificado: %j', async claims => {
    getClaims.mockResolvedValue({ data: { claims }, error: null })
    expect((await edge.handler!(request())).status).toBe(401)
    expect(storageFrom).not.toHaveBeenCalled()
  })
  it('falha de verificacao do JWT nao aceita sub', async () => {
    claimsError = new Error('JWT invalido')
    expect((await edge.handler!(request())).status).toBe(401)
    expect(rpc).not.toHaveBeenCalled()
    expect(storageFrom).not.toHaveBeenCalled()
  })
})
