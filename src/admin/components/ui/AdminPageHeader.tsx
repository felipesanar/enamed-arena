import type { ReactNode } from 'react'

interface AdminPageHeaderProps {
  title: string
  /** linha auxiliar: contagem, período, descrição curta */
  subtitle?: ReactNode
  /** slot à direita: botões de ação, seletor de período */
  actions?: ReactNode
}

export function AdminPageHeader({ title, subtitle, actions }: AdminPageHeaderProps) {
  return (
    <div className="flex items-end justify-between gap-4 mb-5">
      <div className="min-w-0">
        <h1 className="text-lg font-semibold text-admin-text tracking-tight">{title}</h1>
        {subtitle && <p className="text-xs text-admin-muted mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  )
}
