// None of the four Caderno categories has an accepted production emitter yet.
// Do not load/upsert preferences here: hiding unsupported controls must preserve
// stored opt-ins/opt-outs. Restore each category only with its working backend.
export function NotificationsSection() {
  return (
    <p role="status" className="text-body text-muted-foreground">
      Nenhum aviso automático disponível para configurar no momento.
    </p>
  );
}
