import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('@/admin/hooks/useAdminMarketing')

import {
  useAdminMarketingKpis,
  useAdminMarketingSources,
  useAdminMarketingMediums,
  useAdminMarketingCampaigns,
} from '@/admin/hooks/useAdminMarketing'

const mockKpis = {
  new_users: 2860, new_users_prev: 2420, landing_to_signup_pct: 34,
  active_campaigns: 5, organic_pct: 68,
}

const mockSources = [
  { source: 'organic',   user_count: 1945, conv_rate: 68 },
  { source: 'instagram', user_count: 315,  conv_rate: 11 },
]

const mockMediums = [
  { medium: '(nenhum)', user_count: 1945, conv_rate: 68 },
  { medium: 'social',   user_count: 400,  conv_rate: 14 },
]

const mockCampaigns = [
  { campaign: 'enamed_abril_2026', source: 'instagram', visits: 890, signups: 312, conv_rate: 35, first_exams: 201 },
  { campaign: '(sem campanha)',    source: 'organic',   visits: 6312, signups: 2166, conv_rate: 34, first_exams: 1390 },
]

function renderPage() {
  return render(<MemoryRouter><AdminMarketing /></MemoryRouter>)
}

import AdminMarketing from '@/admin/pages/AdminMarketing'

describe('AdminMarketing', () => {
  beforeEach(() => {
    vi.mocked(useAdminMarketingKpis).mockReturnValue({ data: mockKpis, isLoading: false } as any)
    vi.mocked(useAdminMarketingSources).mockReturnValue({ data: mockSources, isLoading: false } as any)
    vi.mocked(useAdminMarketingMediums).mockReturnValue({ data: mockMediums, isLoading: false } as any)
    vi.mocked(useAdminMarketingCampaigns).mockReturnValue({ data: mockCampaigns, isLoading: false } as any)
  })

  it('renders KPI values', () => {
    renderPage()
    expect(screen.getByText('2.860')).toBeInTheDocument()
    expect(screen.getAllByText(/34/).length).toBeGreaterThan(0)
  })

  it('renders source rows', () => {
    renderPage()
    expect(screen.getAllByText('organic').length).toBeGreaterThan(0)
    expect(screen.getAllByText('instagram').length).toBeGreaterThan(0)
  })

  it('renders campaign table with correct columns', () => {
    renderPage()
    expect(screen.getByText('enamed_abril_2026')).toBeInTheDocument()
    expect(screen.getByText('312')).toBeInTheDocument()
  })

  it('export button is present', () => {
    renderPage()
    expect(screen.getByRole('button', { name: /exportar/i })).toBeInTheDocument()
  })
})
