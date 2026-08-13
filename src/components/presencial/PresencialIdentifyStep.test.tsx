import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('framer-motion', () => ({
  motion: new Proxy({}, {
    get: () => ({ children, ...rest }: any) => <div {...rest}>{children}</div>,
  }),
  AnimatePresence: ({ children }: any) => <>{children}</>,
  useReducedMotion: () => false,
}))
vi.mock('@/lib/analytics', () => ({ trackEvent: vi.fn() }))
vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }))
vi.mock('@/services/presencialApi', () => ({
  presencialApi: { checkin: vi.fn(), claim: vi.fn(), startUnlinked: vi.fn() },
}))

import { presencialApi } from '@/services/presencialApi'
import { PresencialIdentifyStep } from './PresencialIdentifyStep'

const READY = { status: 'ready' as const, token: 'tok', questions: [] }

function renderStep(onReady = vi.fn()) {
  render(<PresencialIdentifyStep code="s7-rec" onReady={onReady} />)
  return onReady
}

function fill(name: string, email: string) {
  fireEvent.change(screen.getByLabelText(/nome completo/i), { target: { value: name } })
  fireEvent.change(screen.getByLabelText(/e-mail/i), { target: { value: email } })
}

describe('PresencialIdentifyStep', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('deixa claro em qual plataforma o aluno está', () => {
    renderStep()
    expect(screen.getByText(/plataforma de simulados/i)).toBeInTheDocument()
  })

  it('não envia com campos vazios', () => {
    renderStep()
    fireEvent.click(screen.getByRole('button', { name: /continuar/i }))
    expect(presencialApi.checkin).not.toHaveBeenCalled()
  })

  it('chama onReady quando o e-mail é encontrado', async () => {
    vi.mocked(presencialApi.checkin).mockResolvedValue(READY)
    const onReady = renderStep()
    fill('Fulano de Teste', 'fulano@gmail.com')
    fireEvent.click(screen.getByRole('button', { name: /continuar/i }))
    await waitFor(() => {
      expect(onReady).toHaveBeenCalledWith(READY, {
        name: 'Fulano de Teste', email: 'fulano@gmail.com',
      })
    })
  })

  it('mostra candidatos mascarados quando o e-mail não é encontrado', async () => {
    vi.mocked(presencialApi.checkin).mockResolvedValue({
      status: 'suggestions',
      candidates: [{ ref: 'r1', masked_email: 'fu••••no@g••••.com', hint: 'fez os Simulados 5 e 6' }],
    })
    renderStep()
    fill('Fulano de Teste', 'errado@gmail.com')
    fireEvent.click(screen.getByRole('button', { name: /continuar/i }))
    await waitFor(() => {
      expect(screen.getByText('fu••••no@g••••.com')).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: /é minha conta/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /nenhuma é minha/i })).toBeInTheDocument()
  })

  it('reivindica o candidato escolhido', async () => {
    vi.mocked(presencialApi.checkin).mockResolvedValue({
      status: 'suggestions',
      candidates: [{ ref: 'r1', masked_email: 'fu••••no@g••••.com', hint: null }],
    })
    vi.mocked(presencialApi.claim).mockResolvedValue(READY)
    const onReady = renderStep()
    fill('Fulano de Teste', 'errado@gmail.com')
    fireEvent.click(screen.getByRole('button', { name: /continuar/i }))
    await waitFor(() => screen.getByRole('button', { name: /é minha conta/i }))
    fireEvent.click(screen.getByRole('button', { name: /é minha conta/i }))
    await waitFor(() => {
      expect(presencialApi.claim).toHaveBeenCalledWith(
        expect.objectContaining({ code: 's7-rec', candidateRef: 'r1' }),
      )
      expect(onReady).toHaveBeenCalled()
    })
  })

  it('oferece "seguir sem vincular" e usa startUnlinked', async () => {
    vi.mocked(presencialApi.checkin).mockResolvedValue({ status: 'no_account' })
    vi.mocked(presencialApi.startUnlinked).mockResolvedValue(READY)
    const onReady = renderStep()
    fill('Fulano de Teste', 'novo@gmail.com')
    fireEvent.click(screen.getByRole('button', { name: /continuar/i }))
    await waitFor(() => screen.getByRole('button', { name: /seguir sem vincular/i }))
    fireEvent.click(screen.getByRole('button', { name: /seguir sem vincular/i }))
    await waitFor(() => { expect(presencialApi.startUnlinked).toHaveBeenCalled() })
    expect(onReady).toHaveBeenCalled()
  })
})
