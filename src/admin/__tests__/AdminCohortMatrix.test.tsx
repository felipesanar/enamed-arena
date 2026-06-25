import { render, screen } from '@testing-library/react'
import { AdminCohortMatrix } from '@/admin/components/ui/AdminCohortMatrix'
import type { CohortRetentionRow } from '@/admin/types'

const rows: CohortRetentionRow[] = [
  {
    cohort_month: '2026-05-01',
    cohort_size: 1000,
    did_onboarding: 400,
    did_1_plus: 200,
    did_2_plus: 80,
    did_3_plus: 20,
    avg_score: 60,
    did_offline_pending: 12,
    started_any: 240,
  },
]

describe('AdminCohortMatrix', () => {
  it('renders a table with cohort month, size and milestone percentages', () => {
    const { container } = render(<AdminCohortMatrix rows={rows} />)
    expect(container.querySelector('table')).toBeInTheDocument()
    // month formatted via toLocaleDateString pt-BR (ex. "mai. de 2026" / "mai 2026")
    expect(screen.getByText(/2026/)).toBeInTheDocument()
    expect(screen.getByText('1.000')).toBeInTheDocument()
    // ≥1 simulado: 200/1000 = 20%
    expect(screen.getByText('20%')).toBeInTheDocument()
    // onboarding: 400/1000 = 40%
    expect(screen.getByText('40%')).toBeInTheDocument()
  })

  it('renders a skeleton when isLoading', () => {
    const { container } = render(<AdminCohortMatrix rows={[]} isLoading />)
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument()
  })

  it('does not crash and shows a dash when avg_score is null', () => {
    const nullScore: CohortRetentionRow[] = [{
      cohort_month: '2026-06-01', cohort_size: 500,
      did_onboarding: 100, did_1_plus: 0, did_2_plus: 0, did_3_plus: 0,
      avg_score: null, did_offline_pending: 0, started_any: 0,
    }]
    render(<AdminCohortMatrix rows={nullScore} />)
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })
})
