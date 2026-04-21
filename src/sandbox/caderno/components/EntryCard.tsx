import type { NotebookEntry } from "../mockEntries";
import { ERROR_TYPES } from "../errorTypes";

interface EntryCardProps {
  entry: NotebookEntry;
  onMarkResolved?: (id: string) => void;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export function EntryCard({ entry, onMarkResolved }: EntryCardProps) {
  const type = ERROR_TYPES[entry.errorType];
  const resolved = !!entry.resolvedAt;

  return (
    <div
      className="caderno-sandbox"
      style={{
        display: "flex", alignItems: "center", gap: 0,
        background: "var(--surface)", borderRadius: "var(--radius-md)",
        border: "1px solid var(--border)", overflow: "hidden",
        minHeight: 56, opacity: resolved ? 0.45 : 1, transition: "opacity .25s ease",
      }}
    >
      {/* Color bar */}
      <div aria-hidden="true" style={{ width: 3, alignSelf: "stretch", background: type.colorBase, flexShrink: 0 }} />

      {/* Content */}
      <div style={{ flex: 1, padding: "10px 14px", minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
          <span style={{
            fontSize: 12.5, fontWeight: 700, color: "var(--t1)",
            textDecoration: resolved ? "line-through" : "none",
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            maxWidth: "calc(100% - 80px)",
          }}>
            Q{entry.questionNumber} · {entry.area}
          </span>
          <span style={{
            fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em",
            padding: "1px 7px", borderRadius: "var(--radius-pill)",
            background: type.colorBg, border: `1px solid ${type.colorBorder}`, color: type.colorText,
            flexShrink: 0,
          }}>
            {type.label.split(" ")[0]}
          </span>
        </div>
        <div style={{ fontSize: 11, color: "var(--t3)" }}>
          {entry.simuladoTitle} · {formatDate(entry.createdAt)}
        </div>
      </div>

      {/* Check button */}
      {!resolved && onMarkResolved ? (
        <button
          onClick={() => onMarkResolved(entry.id)}
          aria-label={`Marcar questão ${entry.questionNumber} como resolvida`}
          style={{
            width: 44, height: "100%", minHeight: 56,
            display: "flex", alignItems: "center", justifyContent: "center",
            border: "none", borderLeft: "1px solid var(--border)", background: "none",
            cursor: "pointer", flexShrink: 0, color: "var(--t4)", transition: "all .15s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "#dcfce7";
            e.currentTarget.style.borderColor = "#a7f3d0";
            e.currentTarget.style.color = "#10b981";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "none";
            e.currentTarget.style.borderColor = "var(--border)";
            e.currentTarget.style.color = "var(--t4)";
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </button>
      ) : (
        <div
          aria-label="Resolvida"
          style={{
            width: 44, minHeight: 56, display: "flex", alignItems: "center", justifyContent: "center",
            borderLeft: "1px solid var(--border)", flexShrink: 0, color: "#10b981",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
      )}
    </div>
  );
}
