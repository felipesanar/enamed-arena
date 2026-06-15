import { describe, it, expect } from 'vitest'
import { getInitials } from '@/admin/lib/format'

describe('getInitials', () => {
  it('retorna iniciais dos dois primeiros nomes', () => {
    expect(getInitials('Felipe Souza Lima')).toBe('FS')
  })
  it('retorna fallback para vazio/null', () => {
    expect(getInitials(null)).toBe('A')
    expect(getInitials('')).toBe('A')
  })
  it('funciona com nome único', () => {
    expect(getInitials('Felipe')).toBe('F')
  })
})
