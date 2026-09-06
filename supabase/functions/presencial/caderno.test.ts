// supabase/functions/presencial/caderno.test.ts
import { describe, it, expect } from 'vitest'
import {
  resolveCadernoSelection,
  groupOptionIdsByQuestion,
  validateCadernoCompleteness,
  buildSkeletonFromCaderno,
  CADERNO_UNAVAILABLE_ERROR,
  CADERNO_SELECTION_REQUIRED_ERROR,
  type CadernoItemRow,
  type CadernoRow,
} from './caderno'

// ─── Fixture: caderno completo, 3 questões, ordem impressa embaralhada ────

const Q1 = 'q-1'
const Q2 = 'q-2'
const Q3 = 'q-3'

const OPTIONS = [
  { id: 'q1-A', question_id: Q1 },
  { id: 'q1-B', question_id: Q1 },
  { id: 'q1-C', question_id: Q1 },
  { id: 'q1-D', question_id: Q1 },
  { id: 'q2-A', question_id: Q2 },
  { id: 'q2-B', question_id: Q2 },
  { id: 'q2-C', question_id: Q2 },
  { id: 'q2-D', question_id: Q2 },
  { id: 'q3-A', question_id: Q3 },
  { id: 'q3-B', question_id: Q3 },
  { id: 'q3-C', question_id: Q3 },
  { id: 'q3-D', question_id: Q3 },
]

const SIMULADO_ID = 'sim-1'
const QUESTION_IDS = [Q1, Q2, Q3]

const CADERNO: CadernoRow = {
  id: 'cad-1',
  simulado_id: SIMULADO_ID,
  code: 'v',
  label: 'Caderno 1',
  color: 'vermelho',
  is_active: true,
}

// Ordem impressa: posição 1 = Q2, posição 2 = Q3, posição 3 = Q1 — e a
// posição 2 (Q3) tem as alternativas embaralhadas (letra impressa != letra
// original).
const COMPLETE_ITEMS: CadernoItemRow[] = [
  { position: 3, question_id: Q1, option_map: { A: 'q1-A', B: 'q1-B', C: 'q1-C', D: 'q1-D' } },
  { position: 1, question_id: Q2, option_map: { A: 'q2-A', B: 'q2-B', C: 'q2-C', D: 'q2-D' } },
  { position: 2, question_id: Q3, option_map: { A: 'q3-C', B: 'q3-A', C: 'q3-D', D: 'q3-B' } },
]

function optionsByQuestion() {
  return groupOptionIdsByQuestion(OPTIONS)
}

describe('resolveCadernoSelection', () => {
  it('sessão travada vence, mesmo com caderno no corpo', () => {
    const resolution = resolveCadernoSelection({
      sessionCadernoId: 'cad-locked',
      bodyCadernoCode: 'a',
      simuladoHasActiveCadernos: true,
    })
    expect(resolution).toEqual({ kind: 'locked', cadernoId: 'cad-locked' })
  })

  it('sem sessão travada, usa o code do corpo', () => {
    const resolution = resolveCadernoSelection({
      sessionCadernoId: null,
      bodyCadernoCode: 'v',
      simuladoHasActiveCadernos: true,
    })
    expect(resolution).toEqual({ kind: 'by-code', code: 'v' })
  })

  it('sem sessão travada e sem code, mas simulado tem cadernos ativos: exige escolha', () => {
    const resolution = resolveCadernoSelection({
      sessionCadernoId: null,
      bodyCadernoCode: null,
      simuladoHasActiveCadernos: true,
    })
    expect(resolution).toEqual({ kind: 'error', message: CADERNO_SELECTION_REQUIRED_ERROR })
  })

  it('sem sessão travada, sem code e sem cadernos cadastrados: retrocompat (null)', () => {
    const resolution = resolveCadernoSelection({
      sessionCadernoId: null,
      bodyCadernoCode: null,
      simuladoHasActiveCadernos: false,
    })
    expect(resolution).toEqual({ kind: 'none' })
  })
})

describe('validateCadernoCompleteness', () => {
  it('mapa completo passa', () => {
    const result = validateCadernoCompleteness(COMPLETE_ITEMS, QUESTION_IDS, optionsByQuestion())
    expect(result).toEqual({ ok: true })
  })

  it('mapa incompleto (falta 1 de N itens) é recusado', () => {
    const incomplete = COMPLETE_ITEMS.slice(0, 2) // só 2 de 3
    const result = validateCadernoCompleteness(incomplete, QUESTION_IDS, optionsByQuestion())
    expect(result).toEqual({ ok: false, error: CADERNO_UNAVAILABLE_ERROR })
  })

  it('option_map com letra faltando é recusado', () => {
    const broken: CadernoItemRow[] = [
      COMPLETE_ITEMS[0],
      COMPLETE_ITEMS[1],
      { position: 2, question_id: Q3, option_map: { A: 'q3-C', B: 'q3-A', C: 'q3-D' } }, // falta D
    ]
    const result = validateCadernoCompleteness(broken, QUESTION_IDS, optionsByQuestion())
    expect(result).toEqual({ ok: false, error: CADERNO_UNAVAILABLE_ERROR })
  })

  it('option_map com valor repetido é recusado', () => {
    const broken: CadernoItemRow[] = [
      COMPLETE_ITEMS[0],
      COMPLETE_ITEMS[1],
      { position: 2, question_id: Q3, option_map: { A: 'q3-C', B: 'q3-C', C: 'q3-D', D: 'q3-B' } },
    ]
    const result = validateCadernoCompleteness(broken, QUESTION_IDS, optionsByQuestion())
    expect(result).toEqual({ ok: false, error: CADERNO_UNAVAILABLE_ERROR })
  })

  it('option_map apontando para alternativa de OUTRA questão é recusado', () => {
    const broken: CadernoItemRow[] = [
      COMPLETE_ITEMS[0],
      COMPLETE_ITEMS[1],
      // Q3 usando o id de uma alternativa da Q1 — vazamento cruzado.
      { position: 2, question_id: Q3, option_map: { A: 'q1-A', B: 'q3-A', C: 'q3-D', D: 'q3-B' } },
    ]
    const result = validateCadernoCompleteness(broken, QUESTION_IDS, optionsByQuestion())
    expect(result).toEqual({ ok: false, error: CADERNO_UNAVAILABLE_ERROR })
  })

  it('posições com buraco (1..N com repetição em vez de sequência) são recusadas', () => {
    const broken: CadernoItemRow[] = [
      { ...COMPLETE_ITEMS[0], position: 1 },
      { ...COMPLETE_ITEMS[1], position: 1 }, // repete a posição 1, pula a 2
      COMPLETE_ITEMS[2],
    ]
    const result = validateCadernoCompleteness(broken, QUESTION_IDS, optionsByQuestion())
    expect(result).toEqual({ ok: false, error: CADERNO_UNAVAILABLE_ERROR })
  })

  it('duas posições apontando para a mesma questão são recusadas', () => {
    const broken: CadernoItemRow[] = [
      { position: 1, question_id: Q1, option_map: COMPLETE_ITEMS[0].option_map },
      { position: 2, question_id: Q1, option_map: COMPLETE_ITEMS[0].option_map },
      COMPLETE_ITEMS[2],
    ]
    const result = validateCadernoCompleteness(broken, QUESTION_IDS, optionsByQuestion())
    expect(result).toEqual({ ok: false, error: CADERNO_UNAVAILABLE_ERROR })
  })
})

describe('buildSkeletonFromCaderno', () => {
  it('mapa completo vira esqueleto na ordem de position, alternativas sempre A,B,C,D nos ids certos', () => {
    const result = buildSkeletonFromCaderno({
      caderno: CADERNO,
      expectedSimuladoId: SIMULADO_ID,
      items: COMPLETE_ITEMS,
      simuladoQuestionIds: QUESTION_IDS,
      optionsByQuestion: optionsByQuestion(),
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return

    // Ordem de `number` = ordem impressa (position), não a ordem de inserção.
    expect(result.questions.map((q) => q.number)).toEqual([1, 2, 3])
    expect(result.questions.map((q) => q.question_id)).toEqual([Q2, Q3, Q1])

    // Toda questão sai com exatamente A,B,C,D nessa ordem.
    for (const q of result.questions) {
      expect(q.options.map((o) => o.label)).toEqual(['A', 'B', 'C', 'D'])
    }

    // A questão com alternativas embaralhadas (Q3, position 2) aponta para os
    // ids reais certos apesar do rótulo impresso não bater com o original.
    const q3 = result.questions.find((q) => q.question_id === Q3)!
    expect(q3.options).toEqual([
      { id: 'q3-C', label: 'A' },
      { id: 'q3-A', label: 'B' },
      { id: 'q3-D', label: 'C' },
      { id: 'q3-B', label: 'D' },
    ])

    // Nunca vaza nada além de question_id/number/options[{id,label}].
    for (const q of result.questions) {
      expect(Object.keys(q).sort()).toEqual(['number', 'options', 'question_id'])
    }
  })

  it('caderno de outro simulado é recusado', () => {
    const result = buildSkeletonFromCaderno({
      caderno: CADERNO,
      expectedSimuladoId: 'sim-outro',
      items: COMPLETE_ITEMS,
      simuladoQuestionIds: QUESTION_IDS,
      optionsByQuestion: optionsByQuestion(),
    })
    expect(result).toEqual({ ok: false, error: CADERNO_UNAVAILABLE_ERROR })
  })

  it('caderno inativo é recusado', () => {
    const result = buildSkeletonFromCaderno({
      caderno: { ...CADERNO, is_active: false },
      expectedSimuladoId: SIMULADO_ID,
      items: COMPLETE_ITEMS,
      simuladoQuestionIds: QUESTION_IDS,
      optionsByQuestion: optionsByQuestion(),
    })
    expect(result).toEqual({ ok: false, error: CADERNO_UNAVAILABLE_ERROR })
  })

  it('caderno inexistente (null) é recusado', () => {
    const result = buildSkeletonFromCaderno({
      caderno: null,
      expectedSimuladoId: SIMULADO_ID,
      items: COMPLETE_ITEMS,
      simuladoQuestionIds: QUESTION_IDS,
      optionsByQuestion: optionsByQuestion(),
    })
    expect(result).toEqual({ ok: false, error: CADERNO_UNAVAILABLE_ERROR })
  })

  it('mapa incompleto (99 de 100 itens) é recusado — nunca serve esqueleto parcial', () => {
    const hundredQuestionIds = Array.from({ length: 100 }, (_, i) => `q-${i + 1}`)
    const ninetyNineItems: CadernoItemRow[] = hundredQuestionIds.slice(0, 99).map((qid, i) => ({
      position: i + 1,
      question_id: qid,
      option_map: { A: `${qid}-A`, B: `${qid}-B`, C: `${qid}-C`, D: `${qid}-D` },
    }))
    const options = hundredQuestionIds.flatMap((qid) => [
      { id: `${qid}-A`, question_id: qid },
      { id: `${qid}-B`, question_id: qid },
      { id: `${qid}-C`, question_id: qid },
      { id: `${qid}-D`, question_id: qid },
    ])

    const result = buildSkeletonFromCaderno({
      caderno: CADERNO,
      expectedSimuladoId: SIMULADO_ID,
      items: ninetyNineItems,
      simuladoQuestionIds: hundredQuestionIds,
      optionsByQuestion: groupOptionIdsByQuestion(options),
    })
    expect(result).toEqual({ ok: false, error: CADERNO_UNAVAILABLE_ERROR })
  })
})
