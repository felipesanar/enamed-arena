// src/admin/pages/stubs/_AdminStub.tsx
export function AdminStub({ icon, title, phase }: { icon: React.ReactNode; title: string; phase: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-[60vh] gap-4 text-center">
      <div className="text-muted-foreground/20">{icon}</div>
      <h2 className="text-heading-2 text-foreground">{title}</h2>
      <p className="text-body text-muted-foreground">Em construção — Fase {phase}</p>
    </div>
  )
}
