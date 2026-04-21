interface ZeroPendingStateProps {
  resolvedCount: number;
  streak: number;
  onShowResolved: () => void;
}

export function ZeroPendingState({ resolvedCount, streak, onShowResolved }: ZeroPendingStateProps) {
  return (
    <div
      className="caderno-sandbox"
      style={{
        background: "var(--ink)", borderRadius: "var(--radius-xl)",
        padding: "48px 24px",
        display: "flex", flexDirection: "column", alignItems: "center",
        textAlign: "center", gap: 20,
      }}
    >
      <div style={{
        width: 72, height: 72, borderRadius: "50%",
        background: "rgba(16,185,129,.08)", border: "2px solid rgba(16,185,129,.3)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }} aria-hidden="true">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      </div>

      <div>
        <div style={{ fontSize: 20, fontWeight: 900, color: "#ffffff", marginBottom: 8 }}>
          Caderno zerado 🎯
        </div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,.5)", lineHeight: 1.6, maxWidth: 280 }}>
          {resolvedCount} questões dominadas.{streak > 1 ? ` ${streak} dias seguidos revisando.` : ""}
        </div>
      </div>

      <button
        onClick={onShowResolved}
        style={{
          padding: "10px 20px", borderRadius: "var(--radius-md)",
          border: "1.5px solid rgba(255,255,255,.15)", background: "none",
          color: "rgba(255,255,255,.6)", fontSize: 13, fontWeight: 600,
          cursor: "pointer", fontFamily: "'Inter', sans-serif",
        }}
      >
        Ver questões resolvidas
      </button>
    </div>
  );
}
