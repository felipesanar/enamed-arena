import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { TrendingUp, Trophy } from "lucide-react";

const RANKING_STEPS = [
  { rank: 23 },
  { rank: 57 },
  { rank: 96 },
  { rank: 148 },
];

const CLIMB_PATH = [3, 2, 1, 0];
const STEP_DURATION_MS = 1650;

interface RankingClimbWidgetProps {
  compact?: boolean;
}

export function RankingClimbWidget({ compact = false }: RankingClimbWidgetProps) {
  const reducedMotion = useReducedMotion();
  const [pathStep, setPathStep] = useState(0);
  const activeRowIndex = CLIMB_PATH[pathStep];
  const activeStep = RANKING_STEPS[activeRowIndex];
  const reachedApproval = activeRowIndex === 0;

  useEffect(() => {
    if (reducedMotion) return;
    const id = window.setInterval(() => {
      setPathStep((current) => (current + 1) % CLIMB_PATH.length);
    }, STEP_DURATION_MS);
    return () => window.clearInterval(id);
  }, [reducedMotion]);

  if (compact) {
    return (
      <div className="rounded-lg border border-auth-border-subtle bg-auth-surface-soft p-2">
        <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-auth-text-muted">Evolucao no ranking ENAMED</p>
        <div className="mt-1 flex items-center justify-between">
          <span className="text-body-sm text-auth-text-muted">Posicao atual</span>
          <motion.span
            key={pathStep}
            initial={{ opacity: 0.5, y: 6 }}
            animate={
              reachedApproval && !reducedMotion
                ? { opacity: 1, y: 0, boxShadow: ["0 0 0 0 hsl(var(--primary)/0)", "0 0 0 6px hsl(var(--primary)/0.12)", "0 0 0 0 hsl(var(--primary)/0)"] }
                : { opacity: 1, y: 0 }
            }
            transition={{ duration: 0.45, ease: "easeOut" }}
            className="rounded-full border border-primary/35 bg-primary/20 px-1.5 py-0.5 text-[9px] font-semibold text-primary-foreground"
          >
            Você #{activeStep.rank}
          </motion.span>
        </div>
      </div>
    );
  }

  const progress = ((CLIMB_PATH.length - activeRowIndex) / CLIMB_PATH.length) * 100;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[hsl(var(--auth-border-strong))] bg-[linear-gradient(160deg,hsl(var(--auth-surface-soft)/0.95)_0%,hsl(var(--auth-surface)/0.92)_64%,hsl(var(--auth-bg-soft)/0.88)_100%)] px-3.5 py-3 shadow-auth-card">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_110%_at_100%_0%,hsl(var(--auth-accent-glow)/0.28),transparent_52%)]" />
      <div className="pointer-events-none absolute inset-[1px] rounded-[15px] border border-[hsl(var(--primary)/0.18)]" />
      <motion.div
        className="pointer-events-none absolute inset-0"
        animate={
          reachedApproval && !reducedMotion
            ? { opacity: [0.12, 0.34, 0.12] }
            : { opacity: 0.1 }
        }
        transition={{ duration: 1.1, ease: "easeInOut" }}
        style={{
          background:
            "radial-gradient(72% 88% at 24% 46%, hsl(var(--primary) / 0.24), transparent 62%)",
        }}
      />
      {reachedApproval && (
        <motion.div
          className="pointer-events-none absolute inset-x-4 top-2.5 z-10 flex items-center justify-center"
          initial={false}
          animate={reducedMotion ? { opacity: 0.85, y: 0 } : { opacity: [0.6, 1, 0.6], y: [2, 0, 2] }}
          transition={{ duration: 1.05, ease: "easeInOut", repeat: reducedMotion ? 0 : Infinity }}
        >
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[hsl(var(--primary)/0.42)] bg-[hsl(var(--primary)/0.24)] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-primary-foreground">
            <Trophy className="h-3 w-3" />
            Sua aprovação
          </span>
        </motion.div>
      )}
      <div className="relative space-y-2.5">
        <div className="flex items-center justify-between">
          <p className="text-[9px] font-semibold uppercase tracking-[0.13em] text-auth-text-muted">Ranking ENAMED</p>
          <span className="inline-flex items-center gap-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-[hsl(var(--primary-foreground)/0.9)]">
            {reachedApproval ? "Você no topo" : "Você subindo"}
            <TrendingUp className="h-3 w-3" />
          </span>
        </div>

        <div className="relative grid grid-cols-[22px_1fr] gap-2.5">
          <div className="relative">
            <div className="absolute left-[10px] top-1.5 bottom-1.5 w-px bg-[hsl(var(--auth-border-subtle)/0.9)]" />
            {RANKING_STEPS.map((item, index) => (
              <motion.span
                key={item.rank}
                className="absolute left-[6px] h-2.5 w-2.5 rounded-full border border-[hsl(var(--auth-border-strong))] bg-[hsl(var(--auth-bg-base)/0.85)]"
                style={{ top: `${index * 34 + 4}px` }}
                animate={
                  index === activeRowIndex
                    ? {
                        scale: [1, 1.16, 1],
                        opacity: [0.9, 1, 0.9],
                        boxShadow: [
                          "0 0 0 0 hsl(var(--primary)/0)",
                          "0 0 0 2px hsl(var(--primary)/0.24), 0 0 12px hsl(var(--primary)/0.45)",
                          "0 0 0 0 hsl(var(--primary)/0)",
                        ],
                      }
                    : { scale: 1, opacity: 0.5 }
                }
                transition={{ duration: 0.6, ease: "easeInOut" }}
                initial={false}
              />
            ))}
          </div>

          <div className="relative space-y-2">
            {RANKING_STEPS.map((item, index) => (
              <div key={item.rank} className="relative h-[26px]">
                {index === activeRowIndex ? (
                  <motion.div
                    layoutId="ranking-you-card"
                    className="flex h-[26px] items-center justify-between rounded-md border border-[hsl(var(--primary)/0.4)] bg-[linear-gradient(96deg,hsl(var(--primary)/0.32),hsl(var(--primary)/0.12))] px-2.5 shadow-[0_0_22px_hsl(var(--primary)/0.2)]"
                    transition={{ type: "spring", stiffness: 320, damping: 32, mass: 0.8 }}
                    animate={
                      reachedApproval && !reducedMotion
                        ? {
                            scale: [1, 1.02, 1],
                            boxShadow: [
                              "0 0 0 0 hsl(var(--primary)/0)",
                              "0 0 0 1px hsl(var(--primary)/0.35), 0 0 26px hsl(var(--primary)/0.28)",
                              "0 0 0 0 hsl(var(--primary)/0)",
                            ],
                          }
                        : undefined
                    }
                    onAnimationComplete={() => { /* boxShadow resets naturally */ }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[8px] font-semibold uppercase tracking-[0.08em] text-primary-foreground">Você</span>
                      <span className="text-[11px] font-semibold text-auth-text-primary">#{item.rank}</span>
                    </div>
                    <TrendingUp className="h-3 w-3 text-primary-foreground/95" />
                  </motion.div>
                ) : (
                  <div className="flex h-[26px] items-center gap-2 px-1">
                    <span className="text-[10px] font-medium tracking-[0.02em] text-[hsl(var(--auth-text-primary)/0.9)]">
                      Candidato
                    </span>
                    <span className="text-[11px] font-semibold text-auth-text-primary">#{item.rank}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="relative h-[4px] overflow-hidden rounded-full bg-[hsl(var(--auth-bg-base)/0.58)]">
          <motion.div
            className="absolute inset-y-0 left-0 rounded-full bg-[linear-gradient(90deg,hsl(var(--primary)/0.78),hsl(var(--primary-foreground)/0.88))]"
            initial={false}
            animate={{ width: `${reducedMotion ? 84 : progress}%` }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
          />
          {reachedApproval && (
            <motion.div
              className="absolute inset-y-0 right-0 w-[28%] bg-[linear-gradient(90deg,transparent,hsl(var(--primary)/0.3))]"
              animate={reducedMotion ? { opacity: 0.35 } : { opacity: [0.15, 0.45, 0.15] }}
              transition={{ duration: 1, repeat: reducedMotion ? 0 : Infinity, ease: "easeInOut" }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
