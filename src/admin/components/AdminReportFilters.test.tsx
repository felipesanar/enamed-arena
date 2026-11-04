import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { AdminPeriodProvider, useAdminPeriod } from '@/admin/contexts/AdminPeriodContext'
import { AdminAccessProvider } from '@/admin/contexts/AdminAccessContext'
const identity = vi.hoisted(() => ({ user: 'a', flag: true, capabilities: ['intel.view'] }))
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: identity.user }, loading: false }) }))
vi.mock('@/hooks/useAppConfig', () => ({ useAppConfig: () => identity.flag }))
vi.mock('@/admin/services/adminEditionsApi', () => ({ adminEditionsApi: { list: vi.fn() } }))
import { adminEditionsApi } from '@/admin/services/adminEditionsApi'
import { AdminReportFilters } from './AdminReportFilters'
function Probe() {
  const c = useAdminPeriod()
  return <output data-testid="scope">{JSON.stringify(c.reportScope) ?? 'blocked'}</output>
}
function mount(route = '/admin/inteligencia') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[route]}>
    <AdminAccessProvider roles={['analyst']} capabilities={identity.capabilities}><AdminPeriodProvider><AdminReportFilters /><Probe /></AdminPeriodProvider></AdminAccessProvider>
  </MemoryRouter></QueryClientProvider>)
}
describe('report filters', () => {
  beforeEach(() => {
    sessionStorage.clear(); vi.clearAllMocks(); identity.user = 'a'; identity.flag = true; identity.capabilities = ['intel.view']
    vi.mocked(adminEditionsApi.list).mockResolvedValue([{ id: 'a', code: 'A', label: 'Edição A' }, { id: 'b', code: 'B', label: 'Edição B' }] as never)
  })
  it.each(['/admin', '/admin/analytics', '/admin/simulados/abc/resultados'])('does not mount catalog on unsupported %s', route => {
    mount(route); expect(adminEditionsApi.list).not.toHaveBeenCalled(); expect(screen.queryByLabelText('Edição')).not.toBeInTheDocument()
  })
  it('flag off and capability denied produce zero catalog queries', () => {
    identity.flag = false; const view = mount(); expect(adminEditionsApi.list).not.toHaveBeenCalled(); view.unmount()
    identity.flag = true; identity.capabilities = []; mount(); expect(adminEditionsApi.list).not.toHaveBeenCalled()
  })
  it('applies only valid custom BRT dates, preserves draft/edition, cancels and reopens', async () => {
    mount(); await screen.findByRole('option', { name: 'Edição A' })
    fireEvent.change(screen.getByLabelText('Período'), { target: { value: 'custom' } })
    fireEvent.change(screen.getByLabelText('De'), { target: { value: '31/02/2026' } })
    fireEvent.change(screen.getByLabelText('Até'), { target: { value: '01/03/2026' } })
    const before = screen.getByTestId('scope').textContent
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar intervalo' }))
    expect(screen.getByLabelText('De')).toHaveFocus(); expect(screen.getByTestId('scope')).toHaveTextContent(before!)
    fireEvent.change(screen.getByLabelText('Edição'), { target: { value: 'a' } })
    expect(screen.getByLabelText('De')).toHaveValue('31/02/2026')
    fireEvent.change(screen.getByLabelText('De'), { target: { value: '02/03/2026' } })
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar intervalo' }))
    expect(screen.getByLabelText('Até')).toHaveFocus()
    fireEvent.change(screen.getByLabelText('Até'), { target: { value: '02/03/2026' } })
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar intervalo' }))
    expect(screen.getByTestId('scope')).toHaveTextContent('2026-03-03T03:00:00.000Z')
    expect(screen.getByLabelText('Período')).toHaveFocus()
    fireEvent.click(screen.getByRole('button', { name: 'Editar intervalo' }))
    expect(screen.getByLabelText('De')).toHaveValue('02/03/2026')
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByLabelText('De')).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Período'), { target: { value: 'all' } })
    expect(screen.getByTestId('scope')).toHaveTextContent('"editionId":"a","startAt":null,"endAt":null')
  })
  it('handles loading, failure/retry and empty catalog', async () => {
    vi.mocked(adminEditionsApi.list).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([])
    mount(); expect(screen.getByText('Carregando edições…')).toBeInTheDocument()
    await screen.findByText('Não foi possível carregar as edições.')
    expect(screen.getByTestId('scope')).toHaveTextContent('blocked')
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    await screen.findByText('Nenhuma edição disponível no catálogo.')
    expect(screen.getByRole('button', { name: 'Atualizar catálogo' })).toBeInTheDocument()
  })
  it('does not silently replace an unknown stored edition with all', async () => {
    sessionStorage.setItem('admin-report:a:v1', JSON.stringify({ editionId: 'removed', range: { kind: 'all' } }))
    mount(); await screen.findByText(/A edição selecionada não está disponível/)
    expect(screen.getByTestId('scope')).toHaveTextContent('blocked')
    fireEvent.change(screen.getByLabelText('Edição'), { target: { value: '' } })
    await waitFor(() => expect(screen.getByTestId('scope')).toHaveTextContent('"editionId":null'))
  })
})
