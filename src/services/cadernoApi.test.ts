import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc: vi.fn() },
}))
vi.mock('@/lib/logger', () => ({
  logger: { log: vi.fn(), error: vi.fn(), warn: vi.fn() },
}))

import { supabase } from '@/integrations/supabase/client'
import { cadernoApi } from './cadernoApi'

describe('cadernoApi.listActiveCadernos', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('chama list_active_cadernos com o simuladoId e devolve as linhas', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: [
        { code: 'caderno-1', label: 'Caderno 1', color: 'vermelho' },
        { code: 'caderno-2', label: 'Caderno 2', color: 'azul' },
      ],
      error: null,
    } as any)

    const result = await cadernoApi.listActiveCadernos('sim-1')

    expect(supabase.rpc).toHaveBeenCalledWith('list_active_cadernos', { p_simulado_id: 'sim-1' })
    expect(result).toEqual([
      { code: 'caderno-1', label: 'Caderno 1', color: 'vermelho' },
      { code: 'caderno-2', label: 'Caderno 2', color: 'azul' },
    ])
  })

  it('devolve [] quando não há cadernos ativos', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: [], error: null } as any)
    const result = await cadernoApi.listActiveCadernos('sim-1')
    expect(result).toEqual([])
  })

  it('propaga o erro do RPC', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: new Error('boom') } as any)
    await expect(cadernoApi.listActiveCadernos('sim-1')).rejects.toThrow('boom')
  })
})

describe('cadernoApi.getCadernoSkeleton', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('mapeia option_a..option_d para options[] e position para number, ordenado como veio', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: [
        {
          position: 1,
          question_id: 'q-natural-42',
          option_a: 'opt-a-1',
          option_b: 'opt-b-1',
          option_c: 'opt-c-1',
          option_d: 'opt-d-1',
        },
        {
          position: 2,
          question_id: 'q-natural-7',
          option_a: 'opt-a-2',
          option_b: 'opt-b-2',
          option_c: 'opt-c-2',
          option_d: 'opt-d-2',
        },
      ],
      error: null,
    } as any)

    const result = await cadernoApi.getCadernoSkeleton('sim-1', 'caderno-1')

    expect(supabase.rpc).toHaveBeenCalledWith('get_caderno_skeleton', {
      p_simulado_id: 'sim-1',
      p_caderno_code: 'caderno-1',
    })
    expect(result).toEqual([
      {
        question_id: 'q-natural-42',
        number: 1,
        options: [
          { id: 'opt-a-1', label: 'A' },
          { id: 'opt-b-1', label: 'B' },
          { id: 'opt-c-1', label: 'C' },
          { id: 'opt-d-1', label: 'D' },
        ],
      },
      {
        question_id: 'q-natural-7',
        number: 2,
        options: [
          { id: 'opt-a-2', label: 'A' },
          { id: 'opt-b-2', label: 'B' },
          { id: 'opt-c-2', label: 'C' },
          { id: 'opt-d-2', label: 'D' },
        ],
      },
    ])
  })

  it('devolve [] quando o caderno está indisponível ou incompleto (0 linhas)', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: [], error: null } as any)
    const result = await cadernoApi.getCadernoSkeleton('sim-1', 'caderno-1')
    expect(result).toEqual([])
  })

  it('propaga o erro do RPC', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: new Error('boom') } as any)
    await expect(cadernoApi.getCadernoSkeleton('sim-1', 'caderno-1')).rejects.toThrow('boom')
  })
})

describe('cadernoApi.setAttemptCaderno', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('chama set_attempt_caderno_guarded com attemptId e cadernoCode', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null } as any)
    await cadernoApi.setAttemptCaderno('att-1', 'caderno-1')
    expect(supabase.rpc).toHaveBeenCalledWith('set_attempt_caderno_guarded', {
      p_attempt_id: 'att-1',
      p_caderno_code: 'caderno-1',
    })
  })

  it('propaga o erro do RPC', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: new Error('boom') } as any)
    await expect(cadernoApi.setAttemptCaderno('att-1', 'caderno-1')).rejects.toThrow('boom')
  })
})
