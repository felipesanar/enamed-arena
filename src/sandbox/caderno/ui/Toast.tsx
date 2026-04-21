// src/sandbox/caderno/ui/Toast.tsx
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

export interface ToastData {
  id: string;
  questionNumber: number;
  area: string;
  typeLabel: string;
  typeColor: string;
}

interface ToastProps {
  toast: ToastData;
  onDismiss: (id: string) => void;
}

export function Toast({ toast, onDismiss }: ToastProps) {
  const reduced = useReducedMotion();

  return (
    <motion.div
      role="status"
      aria-live="polite"
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduced ? { opacity: 0 } : { opacity: 0, y: 10 }}
      transition={
        reduced
          ? { duration: 0.15 }
          : { type: "spring", damping: 20, stiffness: 260 }
      }
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        background: "#ffffff",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        boxShadow: "0 8px 24px rgba(0,0,0,.12)",
        padding: "12px 16px",
        minWidth: 280,
        maxWidth: 360,
        fontFamily: "'Inter', sans-serif",
        cursor: "pointer",
      }}
      onClick={() => onDismiss(toast.id)}
    >
      {/* Check icon */}
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          background: "rgba(16,185,129,.12)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path d="M2 7l3.5 3.5L12 3.5" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--t1)", marginBottom: 2 }}>
          Salvo no Caderno de Erros
        </div>
        <div style={{ fontSize: 11, color: "var(--t3)" }}>
          Q{toast.questionNumber} · {toast.area} adicionada à fila.
        </div>
      </div>
      {/* Type tag */}
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: ".05em",
          textTransform: "uppercase",
          padding: "2px 8px",
          borderRadius: "var(--radius-pill)",
          background: toast.typeColor + "20",
          color: toast.typeColor,
          flexShrink: 0,
        }}
      >
        {toast.typeLabel}
      </span>
    </motion.div>
  );
}
