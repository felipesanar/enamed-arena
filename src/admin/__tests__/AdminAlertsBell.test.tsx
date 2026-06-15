import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AdminAccessProvider } from '@/admin/contexts/AdminAccessContext'
import { AdminAlertsBell } from '@/admin/components/AdminAlertsBell'
import type { IntelInsight } from '@/admin/types'

vi.mock('@/admin/hooks/useAdminInteligencia')

import { useAdminIntelInsights } from '@/admin/hooks/useAdminInteligencia'

const mockCritical: IntelInsight = {
  id: 'i1',
  severity: 'critical',
  category: 'desempenho',
  title: 'Área crítica: Cardiologia',
  detail: 'Taxa de acerto abaixo de 50%.',
  metric_value: 48,
  metric_unit: 'percent',
  route: '/admin/inteligencia#areas',
}

const mockInfo: IntelInsight = {
  id: 'i2',
  severity: 'info',
  category: 'engajamento',
  title: 'Engajamento estável',
  detail: 'Nada a reportar.',
  metric_value: 72,
  metric_unit: 'percent',
  route: '/admin/inteligencia',
}

function renderBell(capabilities: string[]) {
  return render(
    <AdminAccessProvider roles={['admin']} capabilities={capabilities}>
      <MemoryRouter>
        <AdminAlertsBell />
      </MemoryRouter>
    </AdminAccessProvider>,
  )
}

describe('AdminAlertsBell', () => {
  beforeEach(() => {
    vi.mocked(useAdminIntelInsights).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    } as any)
  })

  it('caso 1: sem capability intel.view — não renderiza nada (sem botão de alertas)', () => {
    renderBell([])
    expect(screen.queryByRole('button', { name: /alerta/i })).toBeNull()
  })

  it('caso 2: com intel.view e 1 critical + 1 info — renderiza botão e badge "1" (só critical+warning contam)', () => {
    vi.mocked(useAdminIntelInsights).mockReturnValue({
      data: [mockCritical, mockInfo],
      isLoading: false,
      isError: false,
    } as any)
    renderBell(['intel.view'])
    const btn = screen.getByRole('button', { name: /alerta/i })
    expect(btn).toBeInTheDocument()
    // Badge mostra 1 (só critical conta; info não conta)
    expect(screen.getByText('1')).toBeInTheDocument()
  })

  it('caso 3: abrir popover mostra os títulos dos 2 insights', async () => {
    vi.mocked(useAdminIntelInsights).mockReturnValue({
      data: [mockCritical, mockInfo],
      isLoading: false,
      isError: false,
    } as any)
    renderBell(['intel.view'])
    const btn = screen.getByRole('button', { name: /alerta/i })
    fireEvent.click(btn)
    await waitFor(() => {
      expect(screen.getByText('Área crítica: Cardiologia')).toBeInTheDocument()
      expect(screen.getByText('Engajamento estável')).toBeInTheDocument()
    })
  })

  it('caso 4: com intel.view e insights=[] — sem badge; popover mostra "Nenhum alerta no momento."', async () => {
    renderBell(['intel.view'])
    const btn = screen.getByRole('button', { name: /alerta/i })
    expect(btn).toBeInTheDocument()
    // Sem badge (alertCount = 0)
    expect(screen.queryByText('0')).toBeNull()
    // Abrir popover
    fireEvent.click(btn)
    await waitFor(() => {
      expect(screen.getByText('Nenhum alerta no momento.')).toBeInTheDocument()
    })
  })
})
