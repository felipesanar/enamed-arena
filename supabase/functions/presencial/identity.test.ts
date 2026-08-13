// supabase/functions/presencial/identity.test.ts
import { describe, it, expect } from 'vitest'
import { normalizeName, firstLastKey, pickCandidates } from './identity'

describe('normalizeName', () => {
  it('remove acento, baixa a caixa e colapsa espaços', () => {
    expect(normalizeName('  José   Antônio  DA Silva ')).toBe('jose antonio da silva')
  })
  it('devolve string vazia para entrada vazia', () => {
    expect(normalizeName('   ')).toBe('')
  })
})

describe('firstLastKey', () => {
  it('junta primeiro e último token', () => {
    expect(firstLastKey('Ana Paula Souza Lima')).toBe('ana lima')
  })
  it('com um único token, repete ele', () => {
    expect(firstLastKey('Ana')).toBe('ana ana')
  })
})

describe('pickCandidates', () => {
  it('devolve a lista quando tem até 3', () => {
    expect(pickCandidates([1, 2, 3])).toEqual([1, 2, 3])
  })
  it('devolve vazio com 4 ou mais — nome comum não sugere', () => {
    expect(pickCandidates([1, 2, 3, 4])).toEqual([])
  })
  it('devolve vazio quando não há candidato', () => {
    expect(pickCandidates([])).toEqual([])
  })
})
