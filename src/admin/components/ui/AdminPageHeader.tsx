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
    <div className="mb-5 flex items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-[1.5rem] font-extrabold leading-tight tracking-[-0.025em] text-admin-text">
          {title}
        </h1>
        {subtitle && <p className="mt-1 text-[13px] text-admin-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}
