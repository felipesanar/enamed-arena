import { describe, it, expect } from 'vitest'
import { validateWindows } from '@/admin/lib/validateWindows'

describe('validateWindows', () => {
  it('retorna null quando start < end <= release', () => {
    expect(validateWindows(
      '2026-04-01T08:00',
      '2026-04-01T13:00',
      '2026-04-01T13:00',
    )).toBeNull()
    expect(validateWindows(
      '2026-04-01T08:00',
      '2026-04-01T13:00',
      '2026-04-02T08:00',
    )).toBeNull()
  })

  it('retorna mensagem de fim quando end <= start', () => {
    expect(validateWindows(
      '2026-04-01T13:00',
      '2026-04-01T08:00',
      '2026-04-02T08:00',
    )).toBe('A janela deve terminar depois de começar.')
    expect(validateWindows(
      '2026-04-01T08:00',
      '2026-04-01T08:00',
      '',
    )).toBe('A janela deve terminar depois de começar.')
  })

  it('retorna mensagem de liberação quando release < end', () => {
    expect(validateWindows(
      '2026-04-01T08:00',
      '2026-04-01T13:00',
      '2026-04-01T10:00',
    )).toBe('A liberação de resultados deve ser após o fim da janela.')
  })

  it('retorna null quando campos obrigatórios estão vazios', () => {
    expect(validateWindows('', '2026-04-01T13:00', '2026-04-01T14:00')).toBeNull()
    expect(validateWindows('2026-04-01T08:00', '', '2026-04-01T14:00')).toBeNull()
    expect(validateWindows('', '', '')).toBeNull()
  })
})
