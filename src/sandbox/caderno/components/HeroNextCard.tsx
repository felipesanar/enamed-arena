import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import type { NotebookEntry } from "../mockEntries";
import { ERROR_TYPES } from "../errorTypes";

interface HeroNextCardProps {
  entry: NotebookEntry;
  onMarkResolved: (id: string) => void;
  simuladoBaseUrl?: string;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export function HeroNextCard({ entry, onMarkResolved, simuladoBaseUrl = "/simulados" }: HeroNextCardProps) {
  const reduced = useReducedMotion();
  const type = ERROR_TYPES[entry.errorType];

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={entry.id}
        initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.98, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.98, y: -8 }}
        transition={reduced ? { duration: 0.15 } : { type: "spring", damping: 25, stiffness: 300 }}
        className="caderno-sandbox"
        style={{ background: "var(--ink)", borderRadius: "var(--radius-xl)", overflow: "hidden", position: "relative", marginBottom: 16 }}
      >
        {/* Wine accent bar */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute", left: 0, top: 0, bottom: 0, width: 3,
            background: "linear-gradient(180deg, var(--wine), var(--wine-mid))",
          }}
        />

        <div style={{ padding: "20px 20px 20px 22px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "rgba(255,255,255,.35)", marginBottom: 8 }}>
            Próxima para revisar
          </div>

          <div style={{ marginBottom: 4 }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: "rgba(255,255,255,.9)" }}>
              Q{entry.questionNumber} · {entry.area}
            </span>
            <span style={{ fontSize: 12.5, color: "rgba(255,255,255,.5)" }}> — {entry.theme}</span>
          </div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,.35)", marginBottom: 14 }}>
            {entry.simuladoTitle} · {formatDate(entry.createdAt)}
          </div>

          <span style={{
            fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em",
            padding: "2px 10px", borderRadius: "var(--radius-pill)",
            background: type.colorBase + "25", border: `1px solid ${type.colorBase}50`,
            color: type.colorBase, display: "inline-block",
            marginBottom: entry.note ? 12 : 16,
          }}>
            {type.label}
          </span>

          {entry.note && (
            <div style={{
              fontSize: 12, color: "rgba(255,255,255,.55)", fontStyle: "italic",
              background: "rgba(255,255,255,.04)", borderRadius: "var(--radius-sm)",
              padding: "8px 12px", borderLeft: "2px solid rgba(255,255,255,.1)",
              marginBottom: 16, lineHeight: 1.5,
            }}>
              "{entry.note}"
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              onClick={() => onMarkResolved(entry.id)}
              aria-label={`Marcar questão ${entry.questionNumber} como resolvida`}
              style={{
                flex: 1, padding: "10px 16px", borderRadius: "var(--radius-md)", border: "none",
                background: "var(--success)", color: "#fff",
                fontSize: 13, fontWeight: 700, cursor: "pointer",
                fontFamily: "'Inter', sans-serif",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              Marcar como resolvida
            </button>
            <a
              href={`${simuladoBaseUrl}/${entry.simuladoId}/correcao?q=${entry.questionNumber}`}
              style={{ fontSize: 12, color: "rgba(255,255,255,.45)", textDecoration: "none", whiteSpace: "nowrap" }}
            >
              Ver questão →
            </a>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
