/**
 * "Caderno" da aplicação presencial (Vermelho / Azul).
 *
 * A prova presencial é impressa em dois cadernos com os mesmos 100 itens em
 * apresentação diferente (ordem das questões e/ou ordem das alternativas).
 * O caderno é uma LENTE na montagem do esqueleto de questões — e só isso:
 * `buildSkeleton` passa a devolver, para um caderno, as questões na ordem
 * IMPRESSA e as alternativas com o rótulo IMPRESSO, sempre apontando para os
 * ids REAIS (question_id, option_id). `submit` continua recebendo
 * `[{question_id, selected_option_id}]` reais — não muda em nada.
 *
 * Ver contrato: docs/superpowers/specs/2026-09-06-presencial-cadernos.md.
 *
 * Módulo puro (sem chamadas ao Supabase), no mesmo padrão de identity.ts e
 * mask.ts — testável sem rede. `index.ts` faz as queries e chama as funções
 * daqui para decidir e para validar/montar.
 */

export const OPTION_LETTERS = ['A', 'B', 'C', 'D'] as const
export type OptionLetter = typeof OPTION_LETTERS[number]

// Mensagens pt-BR — únicas em todo o módulo, para não divergir entre pontos
// de falha diferentes (uma única string por classe de erro do aluno).
export const CADERNO_UNAVAILABLE_ERROR = 'Caderno indisponível. Chame o fiscal.'
export const CADERNO_SELECTION_REQUIRED_ERROR = 'Escolha o caderno que você recebeu.'

export interface CadernoRow {
  id: string
  simulado_id: string
  code: string
  label: string
  color: string
  is_active: boolean
}

export interface CadernoItemRow {
  position: number
  question_id: string
  // jsonb vindo do banco — shape nunca confiável a priori, validado abaixo.
  option_map: unknown
}

export interface SkeletonQuestion {
  question_id: string
  number: number
  options: { id: string; label: OptionLetter }[]
}

// ─── Resolução do caderno (a ordem do contrato) ──────────────────────────
//
// Nas actions `checkin`, `claim` e `start-unlinked`:
//   1. `session.caderno_id` não nulo → é esse, ponto. Um `caderno` vindo do
//      cliente é IGNORADO (a sala manda; o cliente não escolhe numa sala
//      travada).
//   2. Senão, se o corpo trouxe `caderno` (o `code`) → resolve por
//      `(simulado_id, code, is_active)` — a busca em si é feita por quem
//      chama (precisa de query ao banco), esta função só decide QUE caminho
//      seguir.
//   3. Senão → erro "Escolha o caderno que você recebeu.", A MENOS que o
//      simulado não tenha nenhum caderno cadastrado (retrocompatibilidade
//      com o fluxo de hoje, sem caderno nenhum) — aí o fallback é `null`.
export interface ResolveCadernoInput {
  sessionCadernoId: string | null
  bodyCadernoCode: string | null
  simuladoHasActiveCadernos: boolean
}

export type CadernoResolution =
  | { kind: 'locked'; cadernoId: string }
  | { kind: 'by-code'; code: string }
  | { kind: 'none' } // sem caderno cadastrado no simulado — cadernoId final = null
  | { kind: 'error'; message: string }

export function resolveCadernoSelection(input: ResolveCadernoInput): CadernoResolution {
  const { sessionCadernoId, bodyCadernoCode, simuladoHasActiveCadernos } = input

  if (sessionCadernoId) {
    return { kind: 'locked', cadernoId: sessionCadernoId }
  }

  if (bodyCadernoCode) {
    return { kind: 'by-code', code: bodyCadernoCode }
  }

  if (!simuladoHasActiveCadernos) {
    return { kind: 'none' }
  }

  return { kind: 'error', message: CADERNO_SELECTION_REQUIRED_ERROR }
}

// ─── Agrupamento de option_id reais por questão ──────────────────────────

export function groupOptionIdsByQuestion(
  rows: { id: string; question_id: string }[],
): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>()
  for (const row of rows) {
    const set = map.get(row.question_id) ?? new Set<string>()
    set.add(row.id)
    map.set(row.question_id, set)
  }
  return map
}

// ─── Integridade do mapa — as 4 invariantes do contrato ──────────────────
//
// Um caderno só é utilizável se TODAS valerem. Elas existem porque um mapa
// errado corrompe a nota de 100 alunos em silêncio — a mesma classe de erro
// que já mordeu o S5 e o S6. Nunca serve um esqueleto parcial: um esqueleto
// com 99 questões faria o aluno enviar um gabarito que a validação de
// `submit` recusa no fim, depois de 15 minutos de trabalho.
function isValidOptionMap(
  optionMap: unknown,
  questionId: string,
  optionsByQuestion: Map<string, Set<string>>,
): optionMap is Record<OptionLetter, string> {
  if (!optionMap || typeof optionMap !== 'object' || Array.isArray(optionMap)) return false

  const map = optionMap as Record<string, unknown>
  const keys = Object.keys(map)

  // Invariante 4a: option_map tem EXATAMENTE as chaves A,B,C,D.
  if (keys.length !== OPTION_LETTERS.length) return false
  if (!OPTION_LETTERS.every((letter) => keys.includes(letter))) return false

  const values = OPTION_LETTERS.map((letter) => map[letter])
  if (!values.every((v): v is string => typeof v === 'string' && v.length > 0)) return false

  // Invariante 4b: os 4 valores são distintos.
  if (new Set(values).size !== values.length) return false

  // Invariante 4c: todos pertencem à question_id daquele item.
  const realOptionIds = optionsByQuestion.get(questionId)
  if (!realOptionIds) return false
  return values.every((v) => realOptionIds.has(v))
}

export function validateCadernoCompleteness(
  items: CadernoItemRow[],
  simuladoQuestionIds: string[],
  optionsByQuestion: Map<string, Set<string>>,
): { ok: true } | { ok: false; error: string } {
  const fail = { ok: false as const, error: CADERNO_UNAVAILABLE_ERROR }

  if (items.length === 0) return fail

  // Invariante 1: count(items) = count(questions do simulado).
  if (items.length !== simuladoQuestionIds.length) return fail

  // Invariante 2: position cobre 1..N sem buraco e sem repetição.
  const sortedPositions = items.map((item) => item.position).sort((a, b) => a - b)
  for (let i = 0; i < sortedPositions.length; i++) {
    if (sortedPositions[i] !== i + 1) return fail
  }

  // Invariante 3: o conjunto de question_id dos itens é EXATAMENTE o
  // conjunto de questões do simulado (bijeção com as posições — reforço:
  // sem duas posições apontando para a mesma questão).
  const itemQuestionIds = new Set(items.map((item) => item.question_id))
  if (itemQuestionIds.size !== items.length) return fail
  const simuladoQuestionIdSet = new Set(simuladoQuestionIds)
  if (itemQuestionIds.size !== simuladoQuestionIdSet.size) return fail
  for (const questionId of itemQuestionIds) {
    if (!simuladoQuestionIdSet.has(questionId)) return fail
  }

  // Invariante 4: option_map válido para cada item.
  for (const item of items) {
    if (!isValidOptionMap(item.option_map, item.question_id, optionsByQuestion)) return fail
  }

  return { ok: true }
}

// ─── Montagem do esqueleto a partir do caderno ───────────────────────────
//
// NUNCA vaza enunciado, texto de alternativa, explanation ou image_url* — só
// question_id, number (posição impressa) e options:[{id,label}], sempre nos
// 4 rótulos A,B,C,D em ordem, apontando para os option_id reais.
export interface CadernoWithItemsInput {
  caderno: CadernoRow | null
  expectedSimuladoId: string
  items: CadernoItemRow[]
  simuladoQuestionIds: string[]
  optionsByQuestion: Map<string, Set<string>>
}

export function buildSkeletonFromCaderno(
  input: CadernoWithItemsInput,
): { ok: true; questions: SkeletonQuestion[] } | { ok: false; error: string } {
  const { caderno, expectedSimuladoId, items, simuladoQuestionIds, optionsByQuestion } = input

  // Caderno inexistente, inativo ou de outro simulado: falha antes de olhar
  // para os itens — nunca serve esqueleto parcial de um caderno que nem
  // deveria estar em uso aqui.
  if (!caderno || !caderno.is_active || caderno.simulado_id !== expectedSimuladoId) {
    return { ok: false, error: CADERNO_UNAVAILABLE_ERROR }
  }

  const completeness = validateCadernoCompleteness(items, simuladoQuestionIds, optionsByQuestion)
  if (!completeness.ok) return completeness

  const questions: SkeletonQuestion[] = [...items]
    .sort((a, b) => a.position - b.position)
    .map((item) => {
      const map = item.option_map as Record<OptionLetter, string>
      return {
        question_id: item.question_id,
        number: item.position,
        options: OPTION_LETTERS.map((label) => ({ id: map[label], label })),
      }
    })

  return { ok: true, questions }
}
