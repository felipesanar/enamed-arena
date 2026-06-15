// src/admin/components/ui/AdminSectionHeader.tsx
interface AdminSectionHeaderProps {
  title: string
  hook?: string
}

export function AdminSectionHeader({ title, hook }: AdminSectionHeaderProps) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <span className="text-micro-label text-admin-muted uppercase whitespace-nowrap">
        {title}
      </span>
      <div className="flex-1 h-px bg-gradient-to-r from-admin-line to-transparent" />
      {hook && (
        <span className="text-[9px] text-admin-muted/50 bg-admin-raised/40 border border-admin-line/80 px-2 py-0.5 rounded-full whitespace-nowrap font-mono">
          {hook}
        </span>
      )}
    </div>
  )
}
