import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import PresencialPage from './PresencialPage'

// v2: /presencial/:codigo é só a landing do QR impresso (rota CONGELADA — ver
// src/__tests__/presencialQrUrlContract.test.ts). Ela redireciona para
// /ranking, que fica atrás do login: "QR → ranking → login → fiz o simulado
// presencialmente". O fluxo público antigo (identificação, cadernos, gabarito
// de bolhas) saiu desta página.
function renderPage(codigo = 's7-presencial') {
  return render(
    <MemoryRouter initialEntries={[`/presencial/${codigo}`]}>
      <Routes>
        <Route path="/presencial/:codigo" element={<PresencialPage />} />
        <Route path="/ranking" element={<div>Página do ranking</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('PresencialPage', () => {
  it('redireciona /presencial/:codigo para /ranking', async () => {
    renderPage()
    expect(await screen.findByText('Página do ranking')).toBeInTheDocument()
  })

  it('redireciona independentemente do código na URL', async () => {
    renderPage('qualquer-outro-codigo')
    expect(await screen.findByText('Página do ranking')).toBeInTheDocument()
  })
})
