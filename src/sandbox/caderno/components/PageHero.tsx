import { motion, useReducedMotion } from "framer-motion";
import { ProgressBar } from "../ui/ProgressBar";

interface PageHeroProps {
  pendingCount: number;
  resolvedCount: number;
  totalCount: number;
  specialtyCount: number;
  streak: number;
}

export function PageHero({
  pendingCount,
  resolvedCount,
  totalCount,
  specialtyCount,
  streak,
}: PageHeroProps) {
  return (
    <div
      className="caderno-sandbox"
      style={{ background: "var(--ink-2)", position: "relative", overflow: "hidden", padding: "28px 24px 24px" }}
    >
      {/* Decorative radial glow */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute", top: -80, left: -60,
          width: 320, height: 320,
          background: "radial-gradient(circle, var(--wine-glow) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      {/* PRO badge + title */}
      <div style={{ marginBottom: 20, position: "relative" }}>
        <span style={{
          fontSize: 9, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase",
          padding: "2px 8px", borderRadius: "var(--radius-pill)",
          background: "var(--wine-glow)", border: "1px solid rgba(160,48,80,.3)",
          color: "var(--wine)", display: "inline-block", marginBottom: 8,
        }}>
          PRO
        </span>
        <h1 style={{ fontSize: 26, fontWeight: 900, letterSpacing: "-.03em", color: "#ffffff", margin: 0, lineHeight: 1.15 }}>
          Caderno de Erros
        </h1>
        <p style={{ fontSize: 12.5, color: "rgba(255,255,255,.5)", margin: "6px 0 0" }}>
          Suas questões para dominar antes da prova.
        </p>
      </div>

      {/* Stats grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16, position: "relative" }}>
        {[
          { label: "Pendentes", value: pendingCount, color: "#fb923c" },
          { label: "Resolvidas", value: resolvedCount, color: "var(--success)" },
          { label: "Total", value: totalCount, color: "#ffffff" },
          { label: "Especialidades", value: specialtyCount, color: "#ffffff" },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ textAlign: "center" }}>
            <div style={{
              fontSize: 30, fontWeight: 900, letterSpacing: "-.04em",
              fontVariantNumeric: "tabular-nums", color, lineHeight: 1,
            }}>
              {value}
            </div>
            <div style={{
              fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,.45)",
              marginTop: 4, textTransform: "uppercase", letterSpacing: ".06em",
            }}>
              {label}
            </div>
          </div>
        ))}
      </div>

      {/* Progress band */}
      <div style={{ marginBottom: streak > 0 ? 16 : 0, position: "relative" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,.5)" }}>Progresso</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,.8)" }}>
            {resolvedCount} / {totalCount}
          </span>
        </div>
        <ProgressBar resolved={resolvedCount} total={totalCount} />
      </div>

      {/* Streak */}
      {streak > 0 && (
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          padding: "8px 14px", borderRadius: "var(--radius-md)",
          background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)",
        }}>
          <span style={{ fontSize: 16 }} aria-hidden="true">🔥</span>
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: "rgba(255,255,255,.9)" }}>
              {streak} dia{streak !== 1 ? "s" : ""} seguidos revisando
            </div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,.4)" }}>
              Consistência é o diferencial
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
