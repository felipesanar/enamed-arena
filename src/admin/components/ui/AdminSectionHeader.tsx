// src/admin/components/ui/AdminSectionHeader.tsx
interface AdminSectionHeaderProps {
  title: string
  hook?: string
}

export function AdminSectionHeader({ title, hook }: AdminSectionHeaderProps) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap">
        {title}
      </span>
      <div className="flex-1 h-px bg-border" />
      {hook && (
        <span className="text-[9px] text-muted-foreground/40 bg-card border border-border px-2 py-0.5 rounded-full whitespace-nowrap">
          {hook}
        </span>
      )}
    </div>
  )
}
