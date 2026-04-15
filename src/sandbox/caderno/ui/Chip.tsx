// src/sandbox/caderno/ui/Chip.tsx
interface ChipProps {
  label: string;
  count?: number;
  active: boolean;
  dotColor?: string; // hex — shows colored dot when provided
  onClick: () => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
}

export function Chip({ label, count, active, dotColor, onClick, onKeyDown }: ChipProps) {
  return (
    <button
      role="radio"
      aria-checked={active}
      onClick={onClick}
      onKeyDown={onKeyDown}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 12px",
        borderRadius: "var(--radius-pill)",
        border: active
          ? `1.5px solid ${dotColor ?? "var(--wine)"}`
          : "1.5px solid var(--border)",
        background: active
          ? dotColor
            ? dotColor + "18"
            : "rgba(160,48,80,.08)"
          : "var(--surface)",
        color: active
          ? dotColor ?? "var(--wine)"
          : "var(--t2)",
        fontSize: 12.5,
        fontWeight: active ? 700 : 500,
        fontFamily: "'Inter', sans-serif",
        cursor: "pointer",
        whiteSpace: "nowrap",
        transition: "all .15s ease",
        outline: "none",
      }}
      onFocus={(e) => { e.currentTarget.style.boxShadow = "0 0 0 2px rgba(160,48,80,.3)"; }}
      onBlur={(e) => { e.currentTarget.style.boxShadow = "none"; }}
    >
      {dotColor && (
        <span
          aria-hidden="true"
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: dotColor,
            flexShrink: 0,
          }}
        />
      )}
      {label}
      {count !== undefined && (
        <span style={{ opacity: 0.65, fontWeight: 500 }}>{count}</span>
      )}
    </button>
  );
}
