// supabase/functions/presencial/mask.test.ts
import { describe, it, expect } from 'vitest'
import { maskEmail } from './mask'

describe('maskEmail', () => {
  it('preserva 2 primeiros e 2 últimos do local-part e a 1ª letra do domínio', () => {
    expect(maskEmail('joao.silva@gmail.com')).toBe('jo••••••va@g••••.com')
  })

  it('mostra só o primeiro caractere quando o local-part tem 4 ou menos', () => {
    expect(maskEmail('ana@gmail.com')).toBe('a••@g••••.com')
    expect(maskEmail('abcd@uol.com.br')).toBe('a•••@u••.com.br')
  })

  it('mantém o TLD composto intacto', () => {
    expect(maskEmail('maria.souza@hotmail.com.br')).toBe('ma•••••••za@h••••••.com.br')
  })

  it('não vaza nada quando a entrada é inválida', () => {
    expect(maskEmail('semarroba')).toBe('•••')
    expect(maskEmail('')).toBe('•••')
  })
})
