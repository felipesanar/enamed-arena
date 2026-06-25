import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { visibleNav } from '@/admin/lib/navigation'
import { AdminSidebar } from '@/admin/components/AdminSidebar'
import { AdminAccessProvider } from '@/admin/contexts/AdminAccessContext'

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { email: 'ana@sanar.com', user_metadata: { full_name: 'Ana Beta' } },
    loading: false,
  }),
}))
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { auth: { signOut: vi.fn() } },
}))

describe('visibleNav', () => {
  it('analista vê Início, Análise e Sistema; não vê Conteúdo', () => {
    const nav = visibleNav(new Set(['dashboard.view', 'intel.view', 'previews.view']))
    expect(nav.map(g => g.title)).toEqual(['Início', 'Análise', 'Sistema'])
    expect(nav.find(g => g.title === 'Conteúdo')).toBeUndefined()
  })

  it('suporte vê Usuários e Tentativas no grupo Pessoas, mas não Conteúdo', () => {
    const nav = visibleNav(new Set(['dashboard.view', 'users.view', 'attempts.view']))
    const pessoas = nav.find(g => g.title === 'Pessoas')
    expect(pessoas?.items.map(i => i.label)).toEqual(['Usuários', 'Tentativas'])
    expect(nav.find(g => g.title === 'Conteúdo')).toBeUndefined()
  })

  it('grupo Sistema aparece com audit.view e some sem nenhuma capability dele', () => {
    const withAudit = visibleNav(new Set(['dashboard.view', 'audit.view']))
    const sistema = withAudit.find(g => g.title === 'Sistema')
    expect(sistema?.items.map(i => i.label)).toEqual(['Auditoria'])

    const withoutAudit = visibleNav(new Set(['dashboard.view']))
    expect(withoutAudit.find(g => g.title === 'Sistema')).toBeUndefined()
  })
})

describe('AdminSidebar', () => {
  function renderSidebar(roles: string[], capabilities: string[], collapsed = false) {
    return render(
      <MemoryRouter>
        <AdminAccessProvider roles={roles} capabilities={capabilities}>
          <AdminSidebar collapsed={collapsed} onToggle={() => {}} onOpenPalette={() => {}} />
        </AdminAccessProvider>
      </MemoryRouter>,
    )
  }

  it('renderiza só os grupos permitidos pelas capabilities', () => {
    renderSidebar(['analyst'], ['dashboard.view', 'intel.view', 'previews.view'])
    expect(screen.getByText('Jornada')).toBeInTheDocument()
    expect(screen.queryByText('Simulados')).not.toBeInTheDocument()
  })

  it('mostra a marca, o perfil e o atalho de busca quando expandida', () => {
    renderSidebar(['admin'], ['dashboard.view'])
    expect(screen.getByText('Arena Admin')).toBeInTheDocument()
    expect(screen.getByText('ENAMED')).toBeInTheDocument()
    expect(screen.getByText('Ana Beta')).toBeInTheDocument()
    expect(screen.getByLabelText('Buscar (Ctrl K)')).toBeInTheDocument()
  })

  it('oferece sair do painel e recolher o menu', () => {
    renderSidebar(['admin'], ['dashboard.view'])
    expect(screen.getByLabelText('Sair do painel')).toBeInTheDocument()
    expect(screen.getByLabelText('Recolher menu (Ctrl B)')).toBeInTheDocument()
  })

  it('quando recolhida, esconde os rótulos mas mantém acesso a expandir', () => {
    renderSidebar(['admin'], ['dashboard.view'], true)
    expect(screen.queryByText('Arena Admin')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Expandir menu (Ctrl B)')).toBeInTheDocument()
  })
})
