export function EmptyState() {
  return (
    <div
      className="caderno-sandbox"
      style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        textAlign: "center", padding: "64px 24px", gap: 16,
      }}
    >
      <div style={{
        width: 56, height: 56, borderRadius: "var(--radius-lg)",
        background: "var(--s3)", border: "1px solid var(--border)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--t3)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
        </svg>
      </div>
      <div>
        <div style={{ fontSize: 15, fontWeight: 700, color: "var(--t1)", marginBottom: 6 }}>
          Seu Caderno está vazio
        </div>
        <div style={{ fontSize: 13, color: "var(--t3)", maxWidth: 280, lineHeight: 1.6 }}>
          Na correção do simulado, toque em "Salvar no Caderno" para adicionar questões que quer dominar.
        </div>
      </div>
      <a
        href="/simulados"
        style={{
          padding: "10px 20px", borderRadius: "var(--radius-md)",
          background: "var(--wine)", color: "#fff",
          fontSize: 13, fontWeight: 700, textDecoration: "none",
          fontFamily: "'Inter', sans-serif",
        }}
      >
        Ver simulados disponíveis
      </a>
    </div>
  );
}
