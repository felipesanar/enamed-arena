import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PresencialCadernoBanner } from './PresencialCadernoBanner'

const VERMELHO = { code: 'v', label: 'Caderno 1', color: 'vermelho' as const }
const AZUL = { code: 'a', label: 'Caderno 2', color: 'azul' as const }

describe('PresencialCadernoBanner', () => {
  it('mostra label e cor por extenso', () => {
    render(<PresencialCadernoBanner caderno={VERMELHO} />)
    expect(screen.getByText('Caderno 1 · Vermelho')).toBeInTheDocument()
  })

  it('mostra o outro caderno corretamente', () => {
    render(<PresencialCadernoBanner caderno={AZUL} />)
    expect(screen.getByText('Caderno 2 · Azul')).toBeInTheDocument()
  })

  it('fica sticky no topo quando sticky=true (tela do gabarito)', () => {
    render(<PresencialCadernoBanner caderno={VERMELHO} sticky />)
    expect(screen.getByRole('status')).toHaveClass('sticky', 'top-0')
  })

  it('não é sticky por padrão', () => {
    render(<PresencialCadernoBanner caderno={VERMELHO} />)
    expect(screen.getByRole('status')).not.toHaveClass('sticky')
  })
})
