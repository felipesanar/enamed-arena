import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { PresencialEntryCard } from './PresencialEntryCard'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

const mockUseSimulados = vi.fn()
vi.mock('@/hooks/useSimulados', () => ({
  useSimulados: () => mockUseSimulados(),
}))

vi.mock('@/services/offlineApi', () => ({
  offlineApi: { createPresencialAttempt: vi.fn() },
}))
vi.mock('@/hooks/useOfflineAttempt', () => ({
  persistOfflineAttempt: vi.fn(),
}))
vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }))

import { offlineApi } from '@/services/offlineApi'
import { persistOfflineAttempt } from '@/hooks/useOfflineAttempt'
import { toast } from '@/hooks/use-toast'

const SIMULADO_ABERTO = {
  id: 'sim-7',
  slug: 'simulado-7',
  title: 'Simulado 7',
  status: 'available' as const,
}

describe('PresencialEntryCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('não renderiza nada enquanto carrega', () => {
    mockUseSimulados.mockReturnValue({ simulados: [], loading: true })
    const { container } = render(<PresencialEntryCard />)
    expect(container).toBeEmptyDOMElement()
  })

  it('não renderiza nada quando não há simulado com janela aberta e sem envio', () => {
    mockUseSimulados.mockReturnValue({
      simulados: [{ ...SIMULADO_ABERTO, status: 'completed' as const }],
      loading: false,
    })
    const { container } = render(<PresencialEntryCard />)
    expect(container).toBeEmptyDOMElement()
  })

  it('aparece com o simulado disponível (janela aberta, sem tentativa enviada)', () => {
    mockUseSimulados.mockReturnValue({ simulados: [SIMULADO_ABERTO], loading: false })
    render(<PresencialEntryCard />)
    expect(screen.getByText('Fiz o simulado presencialmente')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /subir o gabarito/i })).toBeInTheDocument()
  })

  it('também aparece quando o status é in_progress (iniciado, não enviado)', () => {
    mockUseSimulados.mockReturnValue({
      simulados: [{ ...SIMULADO_ABERTO, status: 'in_progress' as const }],
      loading: false,
    })
    render(<PresencialEntryCard />)
    expect(screen.getByRole('button', { name: /subir o gabarito/i })).toBeInTheDocument()
  })

  it('ao clicar, cria o attempt offline e navega para o gabarito do slug', async () => {
    mockUseSimulados.mockReturnValue({ simulados: [SIMULADO_ABERTO], loading: false })
    vi.mocked(offlineApi.createPresencialAttempt).mockResolvedValue({
      attempt_id: 'attempt-1',
      started_at: '2026-09-06T14:00:00Z',
      exam_duration_seconds: 18000,
      simulado_slug: 'simulado-7',
    })

    render(<PresencialEntryCard />)
    fireEvent.click(screen.getByRole('button', { name: /subir o gabarito/i }))

    await waitFor(() => {
      expect(offlineApi.createPresencialAttempt).toHaveBeenCalledWith('sim-7')
    })
    expect(persistOfflineAttempt).toHaveBeenCalledWith({
      id: 'attempt-1',
      simulado_id: 'sim-7',
      simulado_slug: 'simulado-7',
      started_at: '2026-09-06T14:00:00Z',
      exam_duration_seconds: 18000,
    })
    expect(mockNavigate).toHaveBeenCalledWith('/simulados/simulado-7/gabarito')
  })

  // "Presencial ganha": quem tinha tentativa online em andamento tem ela
  // convertida. Substituir a tentativa de alguém não pode acontecer calado.
  it('avisa quando a tentativa online do aluno foi substituída', async () => {
    mockUseSimulados.mockReturnValue({ simulados: [SIMULADO_ABERTO], loading: false })
    vi.mocked(offlineApi.createPresencialAttempt).mockResolvedValue({
      attempt_id: 'attempt-1',
      started_at: '2026-09-06T14:00:00Z',
      exam_duration_seconds: 18000,
      simulado_slug: 'simulado-7',
      converted_from_online: true,
    })

    render(<PresencialEntryCard />)
    fireEvent.click(screen.getByRole('button', { name: /subir o gabarito/i }))

    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: expect.stringMatching(/substituída/i) }),
      )
    })
    expect(mockNavigate).toHaveBeenCalledWith('/simulados/simulado-7/gabarito')
  })

  it('não avisa de substituição quando não houve conversão', async () => {
    mockUseSimulados.mockReturnValue({ simulados: [SIMULADO_ABERTO], loading: false })
    vi.mocked(offlineApi.createPresencialAttempt).mockResolvedValue({
      attempt_id: 'attempt-1',
      started_at: '2026-09-06T14:00:00Z',
      exam_duration_seconds: 18000,
      simulado_slug: 'simulado-7',
      converted_from_online: false,
    })

    render(<PresencialEntryCard />)
    fireEvent.click(screen.getByRole('button', { name: /subir o gabarito/i }))

    await waitFor(() => expect(mockNavigate).toHaveBeenCalled())
    expect(toast).not.toHaveBeenCalled()
  })

  it('mostra um toast de erro e não navega quando a criação do attempt falha', async () => {
    mockUseSimulados.mockReturnValue({ simulados: [SIMULADO_ABERTO], loading: false })
    vi.mocked(offlineApi.createPresencialAttempt).mockRejectedValue(new Error('falhou'))

    render(<PresencialEntryCard />)
    fireEvent.click(screen.getByRole('button', { name: /subir o gabarito/i }))

    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'destructive' }),
      )
    })
    expect(mockNavigate).not.toHaveBeenCalled()
  })
})
