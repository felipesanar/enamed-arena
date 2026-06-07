import { motion } from 'framer-motion';
import { Stethoscope } from 'lucide-react';
import { cn } from '@/lib/utils';
import { scoreTier } from './helpers';
import { SectionHeader } from './primitives';

export function EvoBarsSection({
  byArea,
  prefersReducedMotion,
}: {
  byArea: Array<{ area: string; score: number; correct: number; questions: number }>;
  prefersReducedMotion: boolean;
}) {
  return (
    <section aria-label="Evolução por especialidade">
      <SectionHeader title="Evolução por especialidade" />
      <div className="rounded-2xl border border-border bg-card p-4 md:p-5">
        <ul className="space-y-3.5">
          {byArea.map((area, i) => {
            const tier = scoreTier(area.score);
            const fill =
              tier === 'success'
                ? 'bg-gradient-to-r from-emerald-400 to-emerald-500'
                : tier === 'warning'
                  ? 'bg-gradient-to-r from-amber-400 to-amber-500'
                  : 'bg-gradient-to-r from-[#8e1f3d] to-[#e83862]';
            return (
              <li key={area.area}>
                <div className="mb-1.5 flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <Stethoscope
                      className="h-4 w-4 shrink-0 text-muted-foreground/50"
                      aria-hidden
                    />
                    <span className="truncate text-[13px] font-medium text-foreground">
                      {area.area}
                    </span>
                  </div>
                  <span className="shrink-0 text-[13px] font-bold tabular-nums text-foreground">
                    {area.correct}
                    <span className="text-muted-foreground/40">/</span>
                    {area.questions}
                  </span>
                </div>
                <div
                  className="h-[7px] overflow-hidden rounded-full bg-primary/[0.08]"
                  role="progressbar"
                  aria-valuenow={area.correct}
                  aria-valuemax={area.questions}
                  aria-label={`${area.area}: ${area.score}% de aproveitamento`}
                >
                  <motion.div
                    className={cn('h-full rounded-full', fill)}
                    initial={{ width: prefersReducedMotion ? `${area.score}%` : 0 }}
                    animate={{ width: `${area.score}%` }}
                    transition={{
                      duration: prefersReducedMotion ? 0 : 0.7,
                      delay: prefersReducedMotion ? 0 : i * 0.06,
                      ease: 'easeOut',
                    }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
