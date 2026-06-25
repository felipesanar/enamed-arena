import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { renderWithAccess } from './test-utils'

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
  landing_to_signup_insufficient: false, organic_low_confidence: false,
}

const mockSources = [
  { source: 'organic',   user_count: 1945, conv_rate: 68, signup_conv_pct: 0.6 },
  { source: 'instagram', user_count: 315,  conv_rate: 11, signup_conv_pct: null },
]

const mockMediums = [
  { medium: '(nenhum)', user_count: 1945, conv_rate: 68, signup_conv_pct: 0.6 },
  { medium: 'social',   user_count: 400,  conv_rate: 14, signup_conv_pct: null },
]

const mockCampaigns = [
  { campaign: 'enamed_abril_2026', source: 'instagram', visits: 890, signups: 312, conv_rate: 35, first_exams: 201, started_exams: 240, insufficient_data: false },
  { campaign: '(sem campanha)',    source: 'organic',   visits: 6312, signups: 2166, conv_rate: 34, first_exams: 1390, started_exams: 1500, insufficient_data: false },
]

function renderPage() {
  return renderWithAccess(<MemoryRouter><AdminMarketing /></MemoryRouter>)
}

import AdminMarketing from '@/admin/pages/AdminMarketing'

describe('AdminMarketing', () => {
  beforeEach(() => {
    vi.mocked(useAdminMarketingKpis).mockReturnValue({ data: mockKpis, isLoading: false } as any)
    vi.mocked(useAdminMarketingSources).mockReturnValue({ data: mockSources, isLoading: false } as any)
    vi.mocked(useAdminMarketingMediums).mockReturnValue({ data: mockMediums, isLoading: false } as any)
    vi.mocked(useAdminMarketingCampaigns).mockReturnValue({ data: mockCampaigns, isLoading: false } as any)
  })

  it('opens with the question the panel answers', () => {
    renderPage()
    expect(screen.getByText('De onde vêm os novos alunos?')).toBeInTheDocument()
    expect(screen.getByText('Aquisição')).toBeInTheDocument()
  })

  it('renders the origin breakdown with share percentages', () => {
    renderPage()
    expect(screen.getByText('Origens por participação nos cadastros')).toBeInTheDocument()
    // 1945 de 2260 = 86,1% para organic
    expect(screen.getByText('86.1%')).toBeInTheDocument()
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

  it('uses Portuguese labels without English UTM jargon', () => {
    renderPage()
    expect(screen.getByText('Por canal')).toBeInTheDocument()
    expect(screen.getByText('Por meio')).toBeInTheDocument()
    expect(screen.queryByText(/UTM/i)).not.toBeInTheDocument()
  })

  it('shows "Dados insuficientes" for the conversion KPI when flagged', () => {
    vi.mocked(useAdminMarketingKpis).mockReturnValue({
      data: { ...mockKpis, landing_to_signup_pct: -1, landing_to_signup_insufficient: true },
      isLoading: false,
    } as any)
    renderPage()
    expect(screen.getByText('Dados insuficientes')).toBeInTheDocument()
  })

  it('does not crash and renders a dash when a campaign conv_rate is null', () => {
    vi.mocked(useAdminMarketingCampaigns).mockReturnValue({
      data: [{ campaign: 'no_visits', source: 'organic', visits: 0, signups: 3, conv_rate: null, first_exams: 0, started_exams: 0, insufficient_data: true }],
      isLoading: false,
    } as any)
    renderPage()
    expect(screen.getByText('no_visits')).toBeInTheDocument()
  })
})
