import * as XLSX from 'xlsx'
import type { SimuladoQuestionStat } from '@/admin/types'

export function exportQuestionRankingXlsx(
  stats: SimuladoQuestionStat[],
  simuladoTitle: string,
) {
  const rows = stats.map((s, i) => ({
    'Ranking': i + 1,
    'Questão': s.question_number,
    'Área': s.area,
    'Tema': s.theme,
    '% Acerto': s.correct_rate,
    'Total Respostas': s.total_responses,
    'Alt. Errada Mais Comum': s.most_common_wrong_label ?? '—',
    '% Alt. Errada': s.most_common_wrong_pct ?? '',
  }))

  const ws = XLSX.utils.json_to_sheet(rows)

  const colWidths = [
    { wch: 8 },   // Ranking
    { wch: 9 },   // Questão
    { wch: 20 },  // Área
    { wch: 30 },  // Tema
    { wch: 10 },  // % Acerto
    { wch: 15 },  // Total Respostas
    { wch: 22 },  // Alt. Errada
    { wch: 12 },  // % Alt. Errada
  ]
  ws['!cols'] = colWidths

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Ranking Questões')

  const safeName = simuladoTitle.replace(/[^a-zA-Z0-9À-ú ]/g, '').trim().replace(/\s+/g, '_')
  XLSX.writeFile(wb, `ranking_questoes_${safeName}.xlsx`)
}
