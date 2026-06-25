// src/admin/components/ui/AdminSectionHeader.tsx
import type { ReactNode } from 'react'

interface AdminSectionHeaderProps {
  title: string
  /** chip à direita: nome do hook/origem dos dados (debug/handoff) */
  hook?: string
  /** ações alinhadas à direita (botões, links) */
  actions?: ReactNode
}

export function AdminSectionHeader({ title, hook, actions }: AdminSectionHeaderProps) {
  return (
    <div className="mb-3 flex items-center gap-3">
      <span className="whitespace-nowrap text-[11px] font-bold uppercase tracking-[0.08em] text-admin-faint">
        {title}
      </span>
      <div className="h-px flex-1 bg-gradient-to-r from-admin-line to-transparent" />
      {hook && (
        <span className="whitespace-nowrap rounded-full border border-admin-line/80 bg-admin-raised/40 px-2 py-0.5 font-mono text-[9px] text-admin-faint/70">
          {hook}
        </span>
      )}
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}
