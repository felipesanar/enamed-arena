import type { ReactElement } from 'react'
import { render } from '@testing-library/react'
import { AdminAccessProvider } from '@/admin/contexts/AdminAccessContext'

export const ALL_CAPABILITIES = [
  'dashboard.view',
  'content.manage',
  'users.view',
  'users.manage',
  'attempts.view',
  'attempts.manage',
  'intel.view',
  'previews.view',
  'roles.manage',
  'audit.view',
]

/** Renderiza com AdminAccessProvider (admin + todas as capabilities) para páginas gated. */
export function renderWithAccess(ui: ReactElement) {
  return render(
    <AdminAccessProvider roles={['admin']} capabilities={ALL_CAPABILITIES}>
      {ui}
    </AdminAccessProvider>,
  )
}
