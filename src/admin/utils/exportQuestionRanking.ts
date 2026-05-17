import ExcelJS from 'exceljs'
import type { SimuladoQuestionStat } from '@/admin/types'

/**
 * XLSX export migrated from `xlsx` (SheetJS Community v0.18.5, which carries
 * CVE-2023-30533 — Prototype Pollution) to `exceljs`. Same shape, no behavior
 * change for callers.
 */
export async function exportQuestionRankingXlsx(
  stats: SimuladoQuestionStat[],
  simuladoTitle: string,
): Promise<void> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'PRO: ENAMED'
  workbook.created = new Date()

  const sheet = workbook.addWorksheet('Ranking Questões')

  sheet.columns = [
    { header: 'Ranking',                  key: 'rank',           width: 8 },
    { header: 'Questão',                  key: 'q',              width: 9 },
    { header: 'Área',                     key: 'area',           width: 20 },
    { header: 'Tema',                     key: 'theme',          width: 30 },
    { header: '% Acerto',                 key: 'correct_rate',   width: 10 },
    { header: 'Total Respostas',          key: 'total',          width: 15 },
    { header: 'Alt. Errada Mais Comum',   key: 'wrong_label',    width: 22 },
    { header: '% Alt. Errada',            key: 'wrong_pct',      width: 12 },
  ]

  stats.forEach((s, i) => {
    sheet.addRow({
      rank: i + 1,
      q: s.question_number,
      area: s.area,
      theme: s.theme,
      correct_rate: s.correct_rate,
      total: s.total_responses,
      wrong_label: s.most_common_wrong_label ?? '—',
      wrong_pct: s.most_common_wrong_pct ?? '',
    })
  })

  // Bold header row.
  sheet.getRow(1).font = { bold: true }

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const safeName = simuladoTitle.replace(/[^a-zA-Z0-9À-ú ]/g, '').trim().replace(/\s+/g, '_')

  // Browser-side download trigger. Kept inline (no extra util) since this is
  // the only place we generate xlsx files for download in the app.
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `ranking_questoes_${safeName}.xlsx`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
