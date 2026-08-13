import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AttemptModalityBadge } from './AttemptModalityBadge'

describe('AttemptModalityBadge', () => {
  it('mostra o selo para tentativa presencial', () => {
    render(<AttemptModalityBadge attemptType="presencial" />)
    expect(screen.getByText(/aplicação presencial/i)).toBeInTheDocument()
  })

  it('não renderiza nada para online, offline, nulo ou indefinido', () => {
    const { container } = render(
      <>
        <AttemptModalityBadge attemptType="online" />
        <AttemptModalityBadge attemptType="offline" />
        <AttemptModalityBadge attemptType={null} />
        <AttemptModalityBadge attemptType={undefined} />
      </>,
    )
    expect(container).toBeEmptyDOMElement()
  })
})
