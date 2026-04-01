import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Clock,
  Sparkles,
  Trophy,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const STEPS = [
  {
    id: "janela",
    mission: "Fase 01",
    title: "Janela oficial",
    subtitle: "Modo ranking",
    body:
      "Enquanto a janela de execução estiver aberta, sua prova vale para o ranking nacional ENAMED. É o modo competitivo oficial — mesmo formato, mesma pressão do dia da seleção.",
    Icon: Trophy,
    accent: "#e83862",
  },
  {
    id: "treino",
    mission: "Fase 02",
    title: "Depois da janela",
    subtitle: "Treino inteligente",
    body:
      "O mesmo simulado continua disponível: mesma interface, mesma correção e análise. Fora da janela você treina com referência total — a realização não entra no ranking.",
    Icon: Sparkles,
    accent: "#c084fc",
  },
  {
    id: "resultados",
    mission: "Fase 03",
    title: "Resultados & ranking",
    subtitle: "Tudo liberado junto",
    body:
      "Após o encerramento da janela, liberamos resultado detalhado, gabarito e o ranking da prova para você comparar desempenho e evoluir no próximo ciclo.",
    Icon: BarChart3,
    accent: "#38bdf8",
  },
  {
    id: "regras",
    mission: "Bonus",
    title: "Regras rápidas",
    subtitle: "Checklist",
    body: "",
    Icon: Clock,
    accent: "#fbbf24",
    pills: [
      "Não é possível pausar o cronômetro",
      "Resultado liberado após a janela",
      "Ranking disponível após encerramento",
    ],
  },
] as const;

const EASE = [0.22, 1, 0.36, 1] as const;

/** Dispara `window.dispatchEvent(new CustomEvent(…))` para abrir o tutorial a partir de outros CTAs. */
export const COMO_FUNCIONA_MODAL_OPEN_EVENT = "enamed:open-como-funciona-tutorial";

export function ComoFuncionaSimuladosTrigger({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(COMO_FUNCIONA_MODAL_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(COMO_FUNCIONA_MODAL_OPEN_EVENT, onOpen);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <div id="how-it-works" className={cn("scroll-mt-28", className)}>
        <DialogTrigger asChild>
          <button
            type="button"
            className={cn(
              "group inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold shadow-md transition-all duration-200",
              "border border-[rgba(142,31,61,0.35)] bg-white text-[#8e1f3d]",
              "hover:border-[rgba(142,31,61,0.55)] hover:shadow-[0_4px_20px_rgba(142,31,61,0.18)] hover:-translate-y-0.5 active:translate-y-0",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8e1f3d]/35 focus-visible:ring-offset-2",
            )}
            style={{
              boxShadow: "0 2px 10px rgba(142,31,61,.1), inset 0 1px 0 rgba(255,255,255,.9)",
            }}
          >
            <span
              className="flex h-8 w-8 items-center justify-center rounded-full transition-transform duration-200 group-hover:scale-105"
              style={{
                background: "linear-gradient(145deg, rgba(232,56,98,.2) 0%, rgba(142,31,61,.15) 100%)",
                border: "1px solid rgba(142,31,61,.22)",
              }}
            >
              <CircleHelp className="h-4 w-4" aria-hidden />
            </span>
            Como funciona
          </button>
        </DialogTrigger>
      </div>

      <DialogContent
        className={cn(
          "max-h-[min(92dvh,680px)] w-[min(96vw,520px)] max-w-none overflow-hidden border-0 bg-transparent p-0 shadow-none",
          "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          "text-white [&>button]:right-3 [&>button]:top-3 [&>button]:text-white/70 [&>button]:hover:text-white [&>button]:ring-offset-[#0a0508]",
        )}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogTitle className="sr-only">Tutorial — Como funcionam os simulados</DialogTitle>
        <TutorialPanel
          open={open}
          prefersReducedMotion={!!prefersReducedMotion}
          onClose={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function TutorialPanel({
  open,
  prefersReducedMotion,
  onClose,
}: {
  open: boolean;
  prefersReducedMotion: boolean;
  onClose: () => void;
}) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!open) setStep(0);
  }, [open]);
  const total = STEPS.length;
  const current = STEPS[step];
  const Icon = current.Icon;

  const go = (dir: -1 | 1) => {
    setStep((s) => Math.min(total - 1, Math.max(0, s + dir)));
  };

  const slideVariants = prefersReducedMotion
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
      }
    : {
        initial: { opacity: 0, x: 56, rotateY: -22, filter: "blur(4px)" },
        animate: { opacity: 1, x: 0, rotateY: 0, filter: "blur(0px)" },
        exit: { opacity: 0, x: -40, rotateY: 16, filter: "blur(3px)" },
      };

  return (
    <div
      className="relative mx-auto w-full perspective-[1100px]"
      style={{ perspective: "1100px" }}
    >
      {/* Outer chassis — gradient rim + glow */}
      <div
        className="relative rounded-[28px] p-[1px] shadow-[0_0_80px_-12px_rgba(232,56,98,0.45),0_24px_64px_-24px_rgba(0,0,0,0.85)]"
        style={{
          background:
            "linear-gradient(135deg, rgba(255,255,255,.22) 0%, rgba(232,56,98,.45) 28%, rgba(90,21,48,.9) 55%, rgba(10,5,8,1) 100%)",
        }}
      >
        <div
          className="relative overflow-hidden rounded-[27px] px-5 pb-6 pt-8 sm:px-7 sm:pb-7 sm:pt-9"
          style={{
            background:
              "linear-gradient(168deg, rgba(35,18,32,.98) 0%, rgba(14,8,12,.99) 42%, rgba(6,3,6,1) 100%)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,.07)",
          }}
        >
          {/* Scanline / grid ambience */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.04) 1px, transparent 1px)",
              backgroundSize: "20px 20px",
              maskImage: "radial-gradient(ellipse 80% 70% at 50% 40%, black 20%, transparent 75%)",
            }}
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -top-24 left-1/2 h-48 w-[120%] -translate-x-1/2 rounded-full blur-3xl"
            style={{ background: "radial-gradient(circle, rgba(232,56,98,.25) 0%, transparent 65%)" }}
            aria-hidden
          />

          {/* HUD header */}
          <div className="relative z-[1] mb-5 flex items-center justify-between gap-3">
            <div>
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.35em] text-white/35">
                Simulados ENAMED
              </p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-[#e83862]/90">
                {current.mission}
              </p>
            </div>
            <div
              className="flex items-center gap-1 rounded-full px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider"
              style={{
                background: "rgba(255,255,255,.06)",
                border: "1px solid rgba(255,255,255,.1)",
                color: "rgba(255,255,255,.5)",
              }}
            >
              {String(step + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
            </div>
          </div>

          <DialogDescription asChild>
            <div className="relative z-[1]" aria-live="polite">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={current.id}
                  variants={slideVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={
                    prefersReducedMotion
                      ? { duration: 0.15 }
                      : { duration: 0.45, ease: EASE }
                  }
                  style={{ transformStyle: "preserve-3d", backfaceVisibility: "hidden" }}
                  className="relative rounded-2xl border border-white/[0.09] bg-gradient-to-b from-white/[0.07] to-white/[0.02] px-5 py-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_12px_40px_-20px_rgba(0,0,0,0.6)] sm:px-6 sm:py-7"
                >
                  <div
                    className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full blur-2xl opacity-60"
                    style={{ background: `radial-gradient(circle, ${current.accent}55 0%, transparent 70%)` }}
                    aria-hidden
                  />
                  <div className="relative flex items-start gap-4">
                    <div
                      className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl shadow-lg"
                      style={{
                        background: `linear-gradient(145deg, ${current.accent}33 0%, rgba(0,0,0,.35) 100%)`,
                        border: `1px solid ${current.accent}44`,
                        boxShadow: `0 8px 28px -8px ${current.accent}66`,
                      }}
                    >
                      <Icon className="h-7 w-7" style={{ color: current.accent }} strokeWidth={1.75} />
                    </div>
                    <div className="min-w-0 flex-1 pt-0.5">
                      <h2 className="text-lg font-extrabold leading-tight tracking-tight text-white sm:text-xl">
                        {current.title}
                      </h2>
                      <p className="mt-0.5 text-xs font-semibold uppercase tracking-[0.12em] text-white/40">
                        {current.subtitle}
                      </p>
                      {current.body ? (
                        <p className="mt-3 text-sm leading-relaxed text-white/72">{current.body}</p>
                      ) : null}
                      {"pills" in current && current.pills ? (
                        <ul className="mt-4 space-y-2">
                          {current.pills.map((pill) => (
                            <li
                              key={pill}
                              className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-black/25 px-3 py-2 text-xs font-medium text-white/75"
                            >
                              <span
                                className="h-1.5 w-1.5 shrink-0 rounded-full"
                                style={{ background: current.accent, boxShadow: `0 0 8px ${current.accent}` }}
                              />
                              {pill}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </DialogDescription>

          {/* Progress rail */}
          <div className="relative z-[1] mt-6 flex gap-1.5">
            {STEPS.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setStep(i)}
                className={cn(
                  "h-1 flex-1 rounded-full transition-all duration-300",
                  i === step ? "bg-[#e83862] shadow-[0_0_12px_rgba(232,56,98,0.5)]" : "bg-white/10 hover:bg-white/20",
                )}
                aria-label={`Ir para etapa ${i + 1}`}
              />
            ))}
          </div>

          {/* Controls */}
          <div className="relative z-[1] mt-5 flex flex-wrap items-center justify-between gap-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={step === 0}
              onClick={() => go(-1)}
              className="gap-1 text-white/80 hover:bg-white/10 hover:text-white disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" />
              Voltar
            </Button>
            {step < total - 1 ? (
              <Button
                type="button"
                size="sm"
                onClick={() => go(1)}
                className="gap-1 bg-[#e83862] font-semibold text-white shadow-[0_4px_20px_rgba(232,56,98,0.35)] hover:bg-[#f04d72]"
              >
                Próxima fase
                <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                onClick={onClose}
                className="gap-1 bg-[#e83862] font-semibold text-white shadow-[0_4px_20px_rgba(232,56,98,0.35)] hover:bg-[#f04d72]"
              >
                Entendi — jogar!
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
