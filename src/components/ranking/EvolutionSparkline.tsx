import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

interface Props {
  series: number[];
}

const W = 150;
const H = 38;
const P = 4;

/** Micro-gráfico da evolução de nota entre simulados. Renderiza só com ≥ 2 pontos. */
export function EvolutionSparkline({ series }: Props) {
  const reduced = useReducedMotion();
  if (series.length < 2) return null;

  const min = Math.min(...series);
  const max = Math.max(...series);
  const span = max - min || 1;
  const pts = series.map((v, i) => {
    const x = P + (i / (series.length - 1)) * (W - 2 * P);
    const y = P + (1 - (v - min) / span) * (H - 2 * P);
    return [x, y] as const;
  });
  const d = pts.map((p) => p.join(',')).join(' ');
  const last = pts[pts.length - 1];
  const trend = series[series.length - 1] >= series[0] ? 'subindo' : 'caindo';

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="block w-full"
      height={H}
      preserveAspectRatio="none"
      role="img"
      aria-label={`Sua nota está ${trend}: de ${series[0]}% para ${series[series.length - 1]}%`}
    >
      <motion.polyline
        points={d}
        fill="none"
        stroke="#ffbf6b"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: reduced ? 1 : 0 }}
        animate={{ pathLength: 1 }}
        transition={reduced ? { duration: 0 } : { duration: 0.8, ease: 'easeOut' }}
      />
      <circle cx={last[0]} cy={last[1]} r="3.5" fill="#fff" />
    </svg>
  );
}
