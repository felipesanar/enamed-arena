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
  it('analyst vê Visão, Inteligência e Ferramentas; não vê Gestão', () => {
    const nav = visibleNav(new Set(['dashboard.view', 'intel.view', 'previews.view']))
    expect(nav.map(g => g.title)).toEqual(['Visão', 'Inteligência', 'Ferramentas'])
  })

  it('support vê Usuários e Tentativas mas não Simulados', () => {
    const nav = visibleNav(new Set(['dashboard.view', 'users.view', 'users.manage', 'attempts.view', 'attempts.manage']))
    const gestao = nav.find(g => g.title === 'Gestão')
    expect(gestao?.items.map(i => i.label)).toEqual(['Usuários', 'Tentativas'])
  })
})

describe('AdminSidebar', () => {
  it('renderiza só grupos permitidos', () => {
    render(
      <MemoryRouter>
        <AdminAccessProvider roles={['analyst']} capabilities={['dashboard.view', 'intel.view', 'previews.view']}>
          <AdminSidebar collapsed={false} onToggle={() => {}} onOpenPalette={() => {}} />
        </AdminAccessProvider>
      </MemoryRouter>,
    )
    expect(screen.getByText('Jornada')).toBeInTheDocument()
    expect(screen.queryByText('Simulados')).not.toBeInTheDocument()
  })
})
