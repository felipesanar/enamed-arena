// src/sandbox/caderno/ui/ProgressBar.tsx
import { motion, useReducedMotion } from "framer-motion";

interface ProgressBarProps {
  resolved: number;
  total: number;
}

export function ProgressBar({ resolved, total }: ProgressBarProps) {
  const reduced = useReducedMotion();
  const pct = total === 0 ? 0 : Math.round((resolved / total) * 100);

  return (
    <div
      role="progressbar"
      aria-valuenow={resolved}
      aria-valuemax={total}
      aria-label={`${resolved} de ${total} questões resolvidas`}
      style={{
        height: 6,
        borderRadius: "var(--radius-pill)",
        background: "rgba(255,255,255,.08)",
        overflow: "hidden",
        position: "relative",
      }}
    >
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={
          reduced
            ? { duration: 0 }
            : { duration: 0.8, delay: 0.2, ease: "easeOut" }
        }
        style={{
          height: "100%",
          background: "linear-gradient(90deg, var(--wine-mid), var(--wine))",
          borderRadius: "var(--radius-pill)",
        }}
      />
    </div>
  );
}
