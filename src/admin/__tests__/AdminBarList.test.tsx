import { render, screen } from '@testing-library/react'
import { AdminBarList } from '@/admin/components/ui/AdminBarList'

describe('AdminBarList', () => {
  it('renders one row per item with labels and formatted values', () => {
    render(
      <AdminBarList
        items={[
          { label: 'Pediatria', value: 56.6 },
          { label: 'GO', value: 83.8 },
        ]}
        goodAt={70}
        warnAt={60}
        valueSuffix="%"
      />,
    )
    expect(screen.getByText('Pediatria')).toBeInTheDocument()
    expect(screen.getByText('GO')).toBeInTheDocument()
    expect(screen.getByText('56.6%')).toBeInTheDocument()
    expect(screen.getByText('83.8%')).toBeInTheDocument()
  })

  it('colors bars by threshold (destructive below warnAt, success at/above goodAt)', () => {
    const { container } = render(
      <AdminBarList
        items={[
          { label: 'Pediatria', value: 56.6 },
          { label: 'GO', value: 83.8 },
        ]}
        goodAt={70}
        warnAt={60}
        valueSuffix="%"
      />,
    )
    expect(container.querySelector('.bg-admin-destructive')).toBeInTheDocument()
    expect(container.querySelector('.bg-admin-success')).toBeInTheDocument()
  })

  it('renders skeleton (animate-pulse) and no items when isLoading', () => {
    const { container } = render(
      <AdminBarList items={[{ label: 'Pediatria', value: 56.6 }]} isLoading />,
    )
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument()
    expect(screen.queryByText('Pediatria')).not.toBeInTheDocument()
  })
})
