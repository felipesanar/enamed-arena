// src/admin/lib/suspectKey.ts
//
// Sinal de distribuição de respostas: acha questões cuja curva de erro tem a
// cara de gabarito errado (concentração alta de uma letra específica com
// taxa de acerto baixa), a partir do RPC `admin_simulado_question_stats` que
// já alimenta a seção "Qualidade por questão" do Analytics.
//
// Módulo puro — não sabe de onde vieram os stats. Calibrado contra os
// incidentes reais (S5 Q46, S6 Q49): o discriminante é a CONCENTRAÇÃO do
// erro numa única alternativa, não a dificuldade da questão. Uma questão
// difícil de verdade espalha os erros entre as alternativas erradas.
import type { SimuladoQuestionStat } from '@/admin/types'

export interface SuspectKey {
  questionNumber: number
  correctRate: number
  topWrongLabel: string
  topWrongPct: number
  totalResponses: number
  discriminationIndex: number
  severity: 'high' | 'medium'
  /** Texto pt-BR pronto para exibição. */
  reason: string
}

export interface FindSuspectKeysOptions {
  /** Respostas válidas mínimas para o sinal ser confiável. */
  minResponses?: number
  /** Taxa de acerto máxima (%) para entrar como suspeita. */
  maxCorrectRate?: number
  /** Concentração mínima (%) na alternativa errada mais marcada. */
  minTopWrongPct?: number
}

const DEFAULTS: Required<FindSuspectKeysOptions> = {
  minResponses: 30,
  maxCorrectRate: 20,
  minTopWrongPct: 45,
}

/**
 * pt-BR: inteiro sem casas decimais, fracionário com 1 casa e vírgula
 * (6,8%). Exportado para as superfícies (Analytics, banner, badge)
 * formatarem os mesmos números do jeito que o `reason` já formata.
 */
export function formatSuspectPct(n: number): string {
  return Number.isInteger(n) ? `${n}%` : `${n.toFixed(1).replace('.', ',')}%`
}

function buildReason(
  correctRate: number,
  topWrongLabel: string,
  topWrongPct: number,
  discriminationIndex: number,
): string {
  let reason =
    `Só ${formatSuspectPct(correctRate)} acertaram, e ${formatSuspectPct(topWrongPct)} marcaram ${topWrongLabel}` +
    ` — distribuição típica de gabarito errado.`
  // Ruidoso com poucas tentativas, por isso não é gate — mas quando aparece,
  // é a assinatura clássica de chave errada (quem estudou "erra" mais).
  if (discriminationIndex < 0) {
    reason += ` Índice de discriminação negativo (${Math.round(discriminationIndex)}) reforça.`
  }
  return reason
}

/**
 * Acha questões suspeitas de gabarito errado a partir da distribuição de
 * respostas. Regra (defaults): `total_responses >= 30 && correct_rate <= 20
 * && most_common_wrong_pct >= 45`. `severity: 'high'` quando a concentração
 * na letra errada é pelo menos 3x a taxa de acerto — cobre `correct_rate ===
 * 0` sem dividir por zero, porque a comparação é uma multiplicação, não uma
 * razão. Resultado ordenado por gravidade (menor `correct_rate` primeiro).
 */
export function findSuspectKeys(
  stats: SimuladoQuestionStat[],
  opts?: FindSuspectKeysOptions,
): SuspectKey[] {
  const { minResponses, maxCorrectRate, minTopWrongPct } = { ...DEFAULTS, ...opts }

  const suspects: SuspectKey[] = []

  for (const stat of stats ?? []) {
    const topWrongLabel = stat.most_common_wrong_label
    const topWrongPct = stat.most_common_wrong_pct
    if (topWrongLabel == null || topWrongPct == null) continue
    if (stat.total_responses < minResponses) continue
    if (stat.correct_rate > maxCorrectRate) continue
    if (topWrongPct < minTopWrongPct) continue

    const severity: 'high' | 'medium' = topWrongPct >= 3 * stat.correct_rate ? 'high' : 'medium'

    suspects.push({
      questionNumber: stat.question_number,
      correctRate: stat.correct_rate,
      topWrongLabel,
      topWrongPct,
      totalResponses: stat.total_responses,
      discriminationIndex: stat.discrimination_index,
      severity,
      reason: buildReason(stat.correct_rate, topWrongLabel, topWrongPct, stat.discrimination_index),
    })
  }

  return suspects.sort((a, b) => a.correctRate - b.correctRate)
}
