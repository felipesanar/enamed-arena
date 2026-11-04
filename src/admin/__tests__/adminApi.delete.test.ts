import { beforeEach, describe, expect, it, vi } from 'vitest'

const { from, rpc } = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }))
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from, rpc } }))
import { adminApi } from '@/admin/services/adminApi'

describe('preservacao na exclusao admin', () => {
  const eq = vi.fn()
  const del = vi.fn(() => ({ eq }))
  beforeEach(() => {
    vi.clearAllMocks()
    rpc.mockResolvedValue({ data: [{ simulado_id: 's1', attempts_count: 0 }], error: null })
    from.mockReturnValue({ delete: del })
    eq.mockResolvedValue({ error: null })
  })

  it.each(['deleteSimulado', 'deleteQuestionsForSimulado'] as const)('%s bloqueia antes de apagar quando ha tentativas', async method => {
    rpc.mockResolvedValue({ data: [{ simulado_id: 's1', attempts_count: 1 }], error: null })
    await expect(adminApi[method]('s1')).rejects.toThrow(/tentativas/)
    expect(from).not.toHaveBeenCalled()
  })

  it.each([null, [], [{ simulado_id: 's1', attempts_count: null }]])('contagem desconhecida bloqueia: %j', async data => {
    rpc.mockResolvedValue({ data, error: null })
    await expect(adminApi.deleteSimulado('s1')).rejects.toThrow(/confirmar/)
    expect(from).not.toHaveBeenCalled()
  })

  it('propaga falha da contagem sem apagar', async () => {
    rpc.mockResolvedValue({ data: null, error: new Error('RPC indisponivel') })
    await expect(adminApi.deleteQuestionsForSimulado('s1')).rejects.toThrow('RPC indisponivel')
    expect(from).not.toHaveBeenCalled()
  })

  it('apaga questoes numa unica operacao, sem apagar alternativas antes', async () => {
    await adminApi.deleteQuestionsForSimulado('s1')
    expect(from.mock.calls).toEqual([['questions']])
    expect(eq).toHaveBeenCalledWith('simulado_id', 's1')
  })

  it.each(['deleteSimulado', 'deleteQuestionsForSimulado'] as const)('%s traduz erro FK sem ignora-lo', async method => {
    eq.mockResolvedValue({ error: { code: '23503', message: 'foreign key violation' } })
    await expect(adminApi[method]('s1')).rejects.toThrow(/histórico/)
  })

  it('propaga outros erros de exclusao', async () => {
    eq.mockResolvedValue({ error: new Error('delete negado') })
    await expect(adminApi.deleteQuestionsForSimulado('s1')).rejects.toThrow('delete negado')
  })

  it('listagem inclui contagem autoritativa sem filtrar tentativas por RLS', async () => {
    const order = vi.fn(async () => ({ data: [{ id: 's1' }], error: null }))
    from.mockReturnValue({ select: vi.fn(() => ({ order })) })
    expect(await adminApi.listSimulados()).toEqual([{ id: 's1', attempts_count: 0 }])
    expect(rpc).toHaveBeenCalledWith('admin_simulado_attempt_counts', {})
  })

  it('listagem nao transforma falta de contagem em zero', async () => {
    const order = vi.fn(async () => ({ data: [{ id: 's1' }], error: null }))
    from.mockReturnValue({ select: vi.fn(() => ({ order })) })
    rpc.mockResolvedValue({ data: [], error: null })
    expect(await adminApi.listSimulados()).toEqual([{ id: 's1', attempts_count: null }])
    rpc.mockResolvedValue({ data: null, error: new Error('RPC negada') })
    await expect(adminApi.listSimulados()).rejects.toThrow('RPC negada')
  })
})
