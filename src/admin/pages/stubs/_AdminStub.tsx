// src/admin/pages/stubs/_AdminStub.tsx
import { AdminPanel } from '@/admin/components/ui/AdminPanel'

export function AdminStub({ icon, title, phase }: { icon: React.ReactNode; title: string; phase: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-6 px-4">
      <AdminPanel className="max-w-md w-full flex flex-col items-center text-center gap-4 py-10 px-6">
        <div className="rounded-2xl bg-primary/10 p-4 text-primary [&_svg]:h-10 [&_svg]:w-10">{icon}</div>
        <h2 className="text-heading-2 text-foreground">{title}</h2>
        <p className="text-body text-muted-foreground">
          Em construção — Fase <span className="font-semibold text-foreground">{phase}</span>
        </p>
      </AdminPanel>
    </div>
  )
}
