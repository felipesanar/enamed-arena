import type { ErrorType } from "../../errorTypes";

const ICON_PATHS: Record<string, React.ReactNode> = {
  lacuna: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
    </svg>
  ),
  memoria: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
      <path d="M3 3v5h5"/>
      <path d="M12 7v5l4 2"/>
    </svg>
  ),
  atencao: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  ),
  diferencial: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="16 3 21 3 21 8"/>
      <line x1="4" y1="20" x2="21" y2="3"/>
      <polyline points="21 16 21 21 16 21"/>
      <line x1="15" y1="15" x2="21" y2="21"/>
      <line x1="4" y1="4" x2="9" y2="9"/>
    </svg>
  ),
  guessed_correctly: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10"/>
      <circle cx="12" cy="12" r="6"/>
      <circle cx="12" cy="12" r="2"/>
    </svg>
  ),
};

const TYPE_BADGE_LABELS: Record<string, string> = {
  lacuna: "Lacuna",
  memoria: "Memória",
  atencao: "Atenção",
  diferencial: "Diferencial",
  guessed_correctly: "Chute",
};

interface ReasonCardProps {
  type: ErrorType;
  selected: boolean;
  onSelect: () => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
}

export function ReasonCard({ type, selected, onSelect, onKeyDown }: ReasonCardProps) {
  return (
    <button
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      onKeyDown={onKeyDown}
      style={{
        width: "100%",
        textAlign: "left",
        padding: "12px 14px",
        borderRadius: "var(--radius-md)",
        border: selected ? `2px solid ${type.colorBase}` : "2px solid var(--border)",
        background: selected ? type.colorBg : "var(--surface)",
        cursor: "pointer",
        transition: "all .15s ease",
        outline: "none",
        fontFamily: "'Inter', sans-serif",
      }}
      onFocus={(e) => { e.currentTarget.style.boxShadow = `0 0 0 2px ${type.colorBase}44`; }}
      onBlur={(e) => { e.currentTarget.style.boxShadow = "none"; }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <span style={{ color: selected ? type.colorBase : "var(--t3)", flexShrink: 0, marginTop: 1 }}>
          {ICON_PATHS[type.key]}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: selected ? type.colorText : "var(--t1)" }}>
              {type.label}
            </span>
            <span
              style={{
                fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em",
                padding: "1px 7px", borderRadius: "var(--radius-pill)",
                background: type.colorBg, border: `1px solid ${type.colorBorder}`, color: type.colorText,
              }}
            >
              {TYPE_BADGE_LABELS[type.key]}
            </span>
          </div>
          <p style={{ fontSize: 11, color: "var(--t3)", margin: 0, lineHeight: 1.5 }}>
            {type.hint}
          </p>
          {selected && (
            <p style={{ fontSize: 11, fontWeight: 600, color: type.colorText, margin: "6px 0 0", lineHeight: 1.5 }}>
              ↳ {type.strategy}
            </p>
          )}
        </div>
      </div>
    </button>
  );
}
