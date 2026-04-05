import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('@/admin/hooks/useAdminUsuarios')
import { useAdminUserList } from '@/admin/hooks/useAdminUsuarios'

const mockUsers = [
  {
    user_id: 'u1', full_name: 'Felipe Matos', email: 'felipe@sanar.com',
    avatar_url: null, segment: 'pro' as const, specialty: 'Clínica Médica',
    created_at: '2026-03-12T10:00:00Z', avg_score: 74.2, total_attempts: 8, total_count: 2,
  },
  {
    user_id: 'u2', full_name: 'Ana Silva', email: 'ana@gmail.com',
    avatar_url: null, segment: 'standard' as const, specialty: 'Pediatria',
    created_at: '2026-03-28T10:00:00Z', avg_score: 61.8, total_attempts: 3, total_count: 2,
  },
]

function renderList() {
  return render(
    <MemoryRouter>
      <AdminUsuarios />
    </MemoryRouter>
  )
}

import AdminUsuarios from '@/admin/pages/AdminUsuarios'

describe('AdminUsuarios', () => {
  beforeEach(() => {
    vi.mocked(useAdminUserList).mockReturnValue({
      data: mockUsers, isLoading: false, isError: false,
    } as any)
  })

  it('renders user names and emails', () => {
    renderList()
    expect(screen.getByText('Felipe Matos')).toBeInTheDocument()
    expect(screen.getByText('felipe@sanar.com')).toBeInTheDocument()
    expect(screen.getByText('Ana Silva')).toBeInTheDocument()
  })

  it('shows segment badges', () => {
    renderList()
    expect(screen.getByText('PRO')).toBeInTheDocument()
    expect(screen.getByText('Standard')).toBeInTheDocument()
  })

  it('shows loading skeleton when isLoading', () => {
    vi.mocked(useAdminUserList).mockReturnValue({
      data: undefined, isLoading: true, isError: false,
    } as any)
    const { container } = renderList()
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument()
  })

  it('filter pills call hook with correct segment', () => {
    renderList()
    fireEvent.click(screen.getByRole('button', { name: 'PRO' }))
    expect(vi.mocked(useAdminUserList)).toHaveBeenCalledWith(
      expect.anything(), 'pro', expect.anything()
    )
  })
})
