import { describe, it, expect } from 'vitest'
import { findSuspectKeys } from './suspectKey'
import type { SimuladoQuestionStat } from '@/admin/types'

function stat(overrides: Partial<SimuladoQuestionStat>): SimuladoQuestionStat {
  return {
    question_number: 1,
    text: 'Enunciado da questão',
    correct_rate: 50,
    discrimination_index: 20,
    most_common_wrong_label: null,
    most_common_wrong_pct: null,
    area: 'Clínica Médica',
    theme: 'Cardiologia',
    total_responses: 100,
    total_responses_all: 110,
    ...overrides,
  }
}

describe('findSuspectKeys', () => {
  it('S6 Q49: 6,8% de acerto, 86% em C, 265 respostas → high', () => {
    const [suspect] = findSuspectKeys([
      stat({
        question_number: 49,
        correct_rate: 6.8,
        most_common_wrong_label: 'C',
        most_common_wrong_pct: 86,
        total_responses: 265,
        discrimination_index: -12,
      }),
    ])

    expect(suspect).toBeDefined()
    expect(suspect.severity).toBe('high')
    expect(suspect.questionNumber).toBe(49)
    expect(suspect.reason).toContain('6,8%')
    expect(suspect.reason).toContain('86%')
    expect(suspect.reason).toContain('C')
    expect(suspect.reason).toContain('-12')
  })

  it('S5 Q46: 6,8% de acerto, 93% em D, 220 respostas → high', () => {
    const [suspect] = findSuspectKeys([
      stat({
        question_number: 46,
        correct_rate: 6.8,
        most_common_wrong_label: 'D',
        most_common_wrong_pct: 93,
        total_responses: 220,
      }),
    ])

    expect(suspect).toBeDefined()
    expect(suspect.severity).toBe('high')
  })

  it('questão difícil legítima (erro espalhado) não entra', () => {
    const suspects = findSuspectKeys([
      stat({
        correct_rate: 20,
        most_common_wrong_label: 'B',
        most_common_wrong_pct: 30,
        total_responses: 200,
      }),
    ])

    expect(suspects).toEqual([])
  })

  it('poucas respostas não entra mesmo com números extremos', () => {
    const suspects = findSuspectKeys([
      stat({
        correct_rate: 5,
        most_common_wrong_label: 'A',
        most_common_wrong_pct: 90,
        total_responses: 12,
      }),
    ])

    expect(suspects).toEqual([])
  })

  it('most_common_wrong_pct null não entra', () => {
    const suspects = findSuspectKeys([
      stat({
        correct_rate: 5,
        most_common_wrong_label: 'A',
        most_common_wrong_pct: null,
        total_responses: 200,
      }),
    ])

    expect(suspects).toEqual([])
  })

  it('most_common_wrong_label null não entra (mesmo com pct alto)', () => {
    const suspects = findSuspectKeys([
      stat({
        correct_rate: 5,
        most_common_wrong_label: null,
        most_common_wrong_pct: 90,
        total_responses: 200,
      }),
    ])

    expect(suspects).toEqual([])
  })

  it('correct_rate 0 com concentração alta → high, sem divisão por zero', () => {
    const [suspect] = findSuspectKeys([
      stat({
        correct_rate: 0,
        most_common_wrong_label: 'B',
        most_common_wrong_pct: 95,
        total_responses: 150,
      }),
    ])

    expect(suspect).toBeDefined()
    expect(suspect.severity).toBe('high')
    expect(Number.isFinite(suspect.correctRate)).toBe(true)
  })

  it('severidade medium quando a concentração não chega a 3x a taxa de acerto', () => {
    const [suspect] = findSuspectKeys([
      stat({
        correct_rate: 18,
        most_common_wrong_label: 'A',
        most_common_wrong_pct: 45, // 45 < 3*18 (54), mas ainda passa o gate de 45
        total_responses: 100,
      }),
    ])

    expect(suspect).toBeDefined()
    expect(suspect.severity).toBe('medium')
  })

  it('ordena por gravidade: menor correct_rate primeiro', () => {
    const suspects = findSuspectKeys([
      stat({
        question_number: 10,
        correct_rate: 15,
        most_common_wrong_label: 'A',
        most_common_wrong_pct: 50,
        total_responses: 100,
      }),
      stat({
        question_number: 20,
        correct_rate: 5,
        most_common_wrong_label: 'B',
        most_common_wrong_pct: 90,
        total_responses: 100,
      }),
      stat({
        question_number: 30,
        correct_rate: 10,
        most_common_wrong_label: 'C',
        most_common_wrong_pct: 60,
        total_responses: 100,
      }),
    ])

    expect(suspects.map(s => s.questionNumber)).toEqual([20, 30, 10])
  })

  it('respeita opts customizados (minResponses, maxCorrectRate, minTopWrongPct)', () => {
    const stats = [
      stat({
        question_number: 1,
        correct_rate: 25, // acima do default (20), mas dentro do opt customizado
        most_common_wrong_label: 'A',
        most_common_wrong_pct: 50,
        total_responses: 15, // abaixo do default (30), mas dentro do opt customizado
      }),
    ]

    expect(findSuspectKeys(stats)).toEqual([])
    expect(
      findSuspectKeys(stats, { minResponses: 10, maxCorrectRate: 30, minTopWrongPct: 50 }),
    ).toHaveLength(1)
    expect(
      findSuspectKeys(stats, { minResponses: 10, maxCorrectRate: 30, minTopWrongPct: 60 }),
    ).toEqual([])
  })
})
