import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
vi.mock('@/admin/components/AdminAlertsBell', () => ({ AdminAlertsBell: () => <button aria-label="Alertas">Alertas</button> }))
vi.mock('@/hooks/useAppConfig', () => ({ useAppConfig: () => false }))
vi.mock('next-themes', () => ({ useTheme: () => ({ resolvedTheme: 'light', setTheme: vi.fn() }) }))
import { AdminTopbar } from './AdminTopbar'
describe('topbar keeps navigation and actions', () => {
  it('preserves breadcrumb/theme/alerts and hides new filters with flag false', () => {
    render(<MemoryRouter initialEntries={['/admin/inteligencia']}><AdminTopbar /></MemoryRouter>)
    expect(screen.getByRole('navigation', { name: 'Trilha de navegação' })).toHaveTextContent('Análise')
    expect(screen.getByText('Visão geral')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Alertas' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ativar tema escuro' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Filtros dos relatórios' })).not.toBeInTheDocument()
  })
})
