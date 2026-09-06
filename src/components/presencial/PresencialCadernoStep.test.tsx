import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('framer-motion', () => ({
  motion: new Proxy({}, {
    get: () => ({ children, ...rest }: any) => <div {...rest}>{children}</div>,
  }),
  AnimatePresence: ({ children }: any) => <>{children}</>,
  useReducedMotion: () => false,
}))

import { PresencialCadernoStep } from './PresencialCadernoStep'

const CADERNOS = [
  { code: 'v', label: 'Caderno 1', color: 'vermelho' as const },
  { code: 'a', label: 'Caderno 2', color: 'azul' as const },
]

describe('PresencialCadernoStep', () => {
  it('avisa que escolher o caderno errado invalida a nota', () => {
    render(<PresencialCadernoStep cadernos={CADERNOS} onSelect={vi.fn()} />)
    expect(screen.getByText(/qual caderno você recebeu/i)).toBeInTheDocument()
    expect(screen.getByText(/invalida sua nota/i)).toBeInTheDocument()
  })

  it('mostra um cartão navegável por teclado para cada caderno, com aria-label de caderno e cor', () => {
    render(<PresencialCadernoStep cadernos={CADERNOS} onSelect={vi.fn()} />)
    const vermelho = screen.getByRole('button', { name: /caderno 1, cor vermelho/i })
    const azul = screen.getByRole('button', { name: /caderno 2, cor azul/i })
    expect(vermelho.tagName).toBe('BUTTON')
    expect(azul.tagName).toBe('BUTTON')
  })

  it('chama onSelect com o caderno escolhido', () => {
    const onSelect = vi.fn()
    render(<PresencialCadernoStep cadernos={CADERNOS} onSelect={onSelect} />)
    fireEvent.click(screen.getByRole('button', { name: /caderno 2, cor azul/i }))
    expect(onSelect).toHaveBeenCalledWith(CADERNOS[1])
  })
})
