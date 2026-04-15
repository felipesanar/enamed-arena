interface DuplicateBannerProps {
  existingReason: string;
  addedAt: string;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function DuplicateBanner({ existingReason, addedAt }: DuplicateBannerProps) {
  return (
    <div
      style={{
        background: "#fffbeb",
        border: "1px solid #fde68a",
        borderRadius: "var(--radius-md)",
        padding: "10px 14px",
        fontSize: 12,
        color: "#92400e",
        marginBottom: 12,
        lineHeight: 1.5,
      }}
    >
      <strong>Já está no Caderno</strong> — adicionada em {formatDate(addedAt)} como{" "}
      <em>"{existingReason}"</em>. Selecione outro motivo para atualizar.
    </div>
  );
}
