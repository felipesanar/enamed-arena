import React, { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

interface Props {
  position: number;
  total: number;
  percentil: number;
}

const CIRC = 2 * Math.PI * 52;

/** Anel de percentil sobre superfície wine (always-dark): preenche mais quanto melhor o percentil. */
export function PercentileRing({ position, total, percentil }: Props) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(reduced ? position : 1);

  useEffect(() => {
    if (reduced) {
      setShown(position);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const dur = 700;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / dur);
      setShown(Math.round(1 + (position - 1) * k));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [position, reduced]);

  const offset = CIRC * (percentil / 100);

  return (
    <div
      className="relative h-32 w-32 shrink-0"
      role="img"
      aria-label={`${position}ª posição de ${total} — top ${percentil}%`}
    >
      <svg viewBox="0 0 120 120" className="block h-32 w-32">
        <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="9" />
        <motion.circle
          cx="60"
          cy="60"
          r="52"
          fill="none"
          stroke="#ffbf6b"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={CIRC}
          transform="rotate(-90 60 60)"
          initial={{ strokeDashoffset: CIRC }}
          animate={{ strokeDashoffset: offset }}
          transition={reduced ? { duration: 0 } : { duration: 0.9, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[2rem] font-bold leading-none text-white tabular-nums">#{shown}</span>
        <span className="mt-0.5 text-[11px] text-white/60">de {total}</span>
      </div>
    </div>
  );
}
