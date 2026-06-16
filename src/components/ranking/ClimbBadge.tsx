import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowUpRight, ArrowDownRight, Minus, Sparkles } from 'lucide-react';
import type { Climb } from '@/lib/ranking-percentile';

/** Badge de evolução da colocação (subiu / caiu / manteve / estreia) sobre o hero wine. */
export function ClimbBadge({ climb }: { climb: Climb }) {
  const reduced = useReducedMotion();

  if (climb.kind === 'debut') {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-white/16 bg-white/10 px-3 py-1.5 text-[13px] font-medium text-white/85">
        <Sparkles className="h-4 w-4 text-amber-200" aria-hidden /> Sua estreia no ranking
      </span>
    );
  }

  const up = climb.delta > 0;
  const down = climb.delta < 0;
  const cls = up
    ? 'border-[rgba(74,222,128,0.3)] bg-[rgba(74,222,128,0.16)] text-[#bbf7d0]'
    : down
      ? 'border-[rgba(248,113,113,0.3)] bg-[rgba(248,113,113,0.14)] text-[#fecaca]'
      : 'border-white/16 bg-white/10 text-white/85';
  const Icon = up ? ArrowUpRight : down ? ArrowDownRight : Minus;
  const text = up
    ? `Subiu do top ${climb.prevPercentil}% para o top ${climb.currPercentil}%`
    : down
      ? `Caiu do top ${climb.prevPercentil}% para o top ${climb.currPercentil}%`
      : `Você manteve o top ${climb.currPercentil}%`;

  return (
    <motion.span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[13px] font-medium ${cls}`}
      animate={up && !reduced ? { scale: [1, 1.04, 1] } : undefined}
      transition={{ duration: 1.2, repeat: up && !reduced ? Infinity : 0, repeatDelay: 1.5 }}
    >
      <Icon className="h-4 w-4" aria-hidden /> {text}
    </motion.span>
  );
}
