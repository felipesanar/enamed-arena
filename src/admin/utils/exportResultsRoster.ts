import ExcelJS from 'exceljs'
import type { SimuladoResultRow } from '@/admin/services/adminApi'

/**
 * XLSX export for the simulado results roster.
 * Mirrors exportQuestionRankingXlsx (same ExcelJS approach + browser download).
 */
export async function exportResultsRosterXlsx(
  rows: SimuladoResultRow[],
  simuladoTitle: string,
): Promise<void> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'PRO: ENAMED'
  workbook.created = new Date()

  const sheet = workbook.addWorksheet('Resultados')

  sheet.columns = [
    { header: 'Rank',          key: 'rank',         width: 7 },
    { header: 'Nome',          key: 'name',         width: 30 },
    { header: 'E-mail',        key: 'email',        width: 35 },
    { header: 'Segmento',      key: 'segment',      width: 12 },
    { header: 'Instituição',   key: 'institution',  width: 30 },
    { header: 'Especialidade', key: 'specialty',    width: 25 },
    { header: 'Nota %',        key: 'score',        width: 10 },
    { header: 'Acertos',       key: 'correct',      width: 10 },
    { header: 'Total Questões',key: 'total',        width: 14 },
    { header: 'Tempo (min)',   key: 'duration_min', width: 12 },
    { header: 'Concluído',     key: 'submitted_at', width: 22 },
    { header: 'Tipo',          key: 'tipo',         width: 10 },
  ]

  rows.forEach(r => {
    sheet.addRow({
      rank:         r.rank,
      name:         r.name ?? '—',
      email:        r.email ?? '—',
      segment:      r.segment,
      institution:  r.institution,
      specialty:    r.specialty,
      score:        r.score != null ? r.score : '',
      correct:      r.correct_count,
      total:        r.total_count,
      duration_min: Math.round(r.duration_seconds / 60),
      submitted_at: new Date(r.submitted_at).toLocaleString('pt-BR'),
      tipo:         r.is_within_window ? 'Válido' : 'Treino',
    })
  })

  // Bold header row.
  sheet.getRow(1).font = { bold: true }

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const safeName = simuladoTitle.replace(/[^a-zA-Z0-9À-ú ]/g, '').trim().replace(/\s+/g, '_')

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `resultados_${safeName}.xlsx`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
