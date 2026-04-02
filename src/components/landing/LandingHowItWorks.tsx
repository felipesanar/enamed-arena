import { useId, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import {
  UserPlus,
  BookOpen,
  PenLine,
  BarChart3,
  Users,
  BookMarked,
  CalendarDays,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  EASE,
  VIEWPORT_HEADER,
  VIEWPORT_REVEAL,
  headerReveal,
  headerItemReveal,
  DURATION_NORMAL,
  DURATION_FAST,
} from "@/lib/landingMotion";

type JourneyStep = {
  step: number;
  icon: LucideIcon;
  title: string;
  description: string;
};

const STEPS: JourneyStep[] = [
  {
    step: 1,
    icon: UserPlus,
    title: "Cadastro e perfil",
    description: "Crie sua conta e informe especialidade e instituições. Seu perfil personaliza rankings e recomendações.",
  },
  {
    step: 2,
    icon: BookOpen,
    title: "Fique atento às janelas de execução",
    description:
      "Veja o calendário, data e número de questões. Realize o simulado entre as datas indicadas para que sua nota entre no ranking nacional.",
  },
  {
    step: 3,
    icon: PenLine,
    title: "Realize a prova",
    description:
      "Escolha o modo online ou offline, conforme o seu conforto. Ambiente de prova realista e adaptado para o que faz sentido para você.",
  },
  {
    step: 4,
    icon: BarChart3,
    title: "Acompanhe o desempenho",
    description: "Resultado com nota, acertos por área e análise questão a questão. Entenda exatamente onde você está.",
  },
  {
    step: 5,
    icon: Users,
    title: "Compare com outros alunos",
    description: "Veja sua posição no ranking, percentil e evolução. Compare com sua especialidade ou com o ranking geral.",
  },
  {
    step: 6,
    icon: BookMarked,
    title: "Revise erros e evolua",
    description: "Use o caderno de erros e os recursos de revisão. No próximo simulado, você parte de um patamar mais alto.",
  },
];

type JourneyScheduleItem = {
  id: string;
  simulado: string;
  startDate: string;
  endDate: string;
};

const JOURNEY_SCHEDULE: JourneyScheduleItem[] = [
  {
    id: "simulado-2",
    simulado: "Simulado #2 — Cirurgia e Emergência",
    startDate: "28/03/2026",
    endDate: "30/03/2026",
  },
  {
    id: "simulado-1",
    simulado: "Simulado #1 — Fundamentos Clínicos",
    startDate: "24/03/2026",
    endDate: "26/03/2026",
  },
  {
    id: "simulado-4",
    simulado: "Simulado #4 — Medicina Preventiva e Saúde Coletiva",
    startDate: "14/04/2026",
    endDate: "16/04/2026",
  },
  {
    id: "simulado-5",
    simulado: "Simulado #5 — Clínica Médica Avançada",
    startDate: "21/04/2026",
    endDate: "23/04/2026",
  },
  {
    id: "simulado-6",
    simulado: "Simulado #6 — Revisão Geral ENAMED",
    startDate: "28/04/2026",
    endDate: "30/04/2026",
  },
];

function LandingJourneyTimelineIllustration({
  items,
  reduced,
}: {
  items: JourneyScheduleItem[];
  reduced: boolean;
}) {
  const headingId = useId();

  return (
    <div role="region" aria-labelledby={headingId} className="mb-0">
      <div className="mb-1 flex items-center gap-3">
        <h3 id={headingId} className="whitespace-nowrap text-sm font-semibold tracking-tight text-white">
          Histórico e próximos
        </h3>
        <div className="h-px flex-1 rounded-full bg-white/30" />
      </div>
      <p className="mb-4 text-xs text-white">Ordenado do mais recente para o mais antigo.</p>

      <div className="relative pl-2">
        <div
          className="pointer-events-none absolute bottom-4 left-[16px] top-3 w-px -translate-x-1/2 rounded-full bg-gradient-to-b from-white/35 via-white/20 to-white/20"
          aria-hidden
        />

        <div className="space-y-2.5 pl-8">
          {items.map((item, index) => {
            return (
              <motion.div
                key={item.id}
                initial={reduced ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: reduced ? 0 : 0.35,
                  delay: reduced ? 0 : index * 0.05,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="relative min-h-[88px]"
              >
                <div
                  className="pointer-events-none absolute left-[-16px] top-[24px] z-0 h-px w-[18px] bg-white/30"
                  aria-hidden
                />
                <div
                  className="absolute left-[-24px] top-[20px] z-[1] -translate-x-1/2"
                  aria-hidden
                >
                  <div className="h-3 w-3 rounded-full border-2 border-background bg-white shadow-sm ring-1 ring-white/70" />
                </div>

                <div
                  className={cn(
                    "flex min-w-0 items-start gap-3 rounded-xl border border-white/20 bg-white/[0.03] px-3 py-3 shadow-[0_10px_28px_-18px_rgba(0,0,0,0.6)] transition-shadow sm:px-4",
                    !reduced && "hover:border-white/35 hover:shadow-[0_14px_30px_-16px_rgba(0,0,0,0.65)]",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold leading-snug text-white">{item.simulado}</p>
                    <div className="mt-2 inline-flex items-center rounded-lg border border-white/30 bg-white/10 px-2.5 py-1.5 text-[0.76rem] font-semibold leading-relaxed text-white">
                      Janela de execução: {item.startDate} até {item.endDate}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function LandingHowItWorks() {
  const reducedMotion = !!useReducedMotion();
  const [showExecutionCalendar, setShowExecutionCalendar] = useState(false);

  return (
    <section
      id="como-funciona"
      className="relative py-14 md:py-[4.5rem] px-4 md:px-6"
      aria-labelledby="how-it-works-heading"
    >
      <div className="max-w-[1280px] mx-auto">
        <div className="relative mb-14">
          <span
            className="absolute -top-4 -left-2 text-[8rem] sm:text-[10rem] font-black text-foreground/[0.04] leading-none select-none pointer-events-none tabular-nums"
            aria-hidden
          >
            6
          </span>
          <motion.header
            variants={headerReveal}
            initial="hidden"
            whileInView="show"
            viewport={VIEWPORT_HEADER}
            className="relative z-10"
          >
            <motion.p
              variants={headerItemReveal}
              className="text-overline uppercase tracking-[0.12em] text-muted-foreground mb-3 flex items-center gap-2"
            >
              <span className="w-6 h-px bg-gradient-to-r from-transparent via-primary to-wine-glow" />
              Jornada
            </motion.p>
            <motion.h2
              variants={headerItemReveal}
              id="how-it-works-heading"
              className="text-heading-1 md:text-[2.5rem] lg:text-[3rem] font-bold text-foreground w-full max-w-none leading-tight tracking-tight"
            >
              Do cadastro à sua evolução.
            </motion.h2>
            <motion.p
              variants={headerItemReveal}
              className="mt-4 w-full max-w-none text-body-lg text-muted-foreground leading-relaxed"
            >
              Um caminho pensado para acompanhar seu desempenho, comparar resultados e te fazer evoluir a cada simulado.
            </motion.p>
          </motion.header>
        </div>

        <div className="mx-auto w-full max-w-4xl">
          <div className="relative">
            <div
              className="pointer-events-none absolute bottom-4 left-[1.85rem] top-4 hidden w-px rounded-full bg-gradient-to-b from-primary/40 via-primary/20 to-border sm:block"
              aria-hidden
            />
            <div className="space-y-4">
              {STEPS.map((s, i) => (
                <motion.article
                  key={s.step}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={VIEWPORT_REVEAL}
                  transition={{ duration: DURATION_NORMAL, delay: i * 0.06, ease: EASE }}
                  whileHover={{ x: 2, transition: { duration: DURATION_FAST, ease: EASE } }}
                  className="relative rounded-2xl border border-border bg-card/60 px-5 py-5 transition-colors duration-300 hover:border-primary/20 hover:bg-card/75 sm:pl-16"
                >
                  <div
                    className="mb-3 inline-flex items-center rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-white/80 sm:mb-2"
                    aria-label={`Etapa ${s.step}`}
                  >
                    Etapa {s.step}
                  </div>
                  <div
                    className="absolute left-4 top-6 hidden h-7 w-7 items-center justify-center rounded-full border border-primary/40 bg-primary text-[0.72rem] font-bold text-primary-foreground shadow-lg shadow-primary/20 sm:flex"
                    aria-hidden
                  >
                    {s.step}
                  </div>
                  <div className="mb-2 flex items-center gap-2.5">
                    <s.icon className="h-4.5 w-4.5 text-landing-accent" aria-hidden />
                    <h3 className="font-semibold text-foreground text-heading-3">{s.title}</h3>
                  </div>
                  <p className="text-body-sm leading-relaxed text-muted-foreground">{s.description}</p>
                  {s.step === 2 && (
                    <div className="mt-4">
                      <button
                        type="button"
                        onClick={() => setShowExecutionCalendar(true)}
                        className="inline-flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-primary/15"
                      >
                        <CalendarDays className="h-3.5 w-3.5" aria-hidden />
                        Ver calendário de execução
                      </button>
                    </div>
                  )}
                </motion.article>
              ))}
            </div>
          </div>
        </div>

        <Dialog open={showExecutionCalendar} onOpenChange={setShowExecutionCalendar}>
          <DialogContent className="max-w-[95vw] sm:max-w-3xl md:max-w-4xl border-white/10 bg-[linear-gradient(165deg,rgba(11,8,20,0.99)_0%,rgba(7,5,14,1)_100%)] p-0 shadow-[0_30px_80px_-24px_rgba(0,0,0,0.8)] [&>button]:text-white [&>button]:opacity-100 [&>button]:hover:text-white [&>button]:data-[state=open]:bg-white/10">
            <DialogHeader className="border-b border-white/10 bg-[linear-gradient(90deg,rgba(232,56,98,0.12)_0%,rgba(232,56,98,0.03)_40%,rgba(255,255,255,0)_100%)] px-5 pt-5 pb-3 text-left">
              <DialogTitle className="text-base text-white sm:text-lg">
                Janelas de execução dos simulados
              </DialogTitle>
              <DialogDescription className="text-xs text-white sm:text-sm">
                Acompanhe as datas para organizar seu preparo.
              </DialogDescription>
            </DialogHeader>
            <div className="relative max-h-[74vh] overflow-y-auto overflow-x-hidden px-5 pb-5 pt-4">
              <div className="pointer-events-none absolute inset-0 opacity-100" aria-hidden>
                <div className="absolute right-[-8%] top-[-15%] h-64 w-64 rounded-full bg-primary/12 blur-3xl" />
                <div className="absolute bottom-[-20%] left-[-10%] h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
              </div>
              <div className="relative z-10 rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-5">
                <LandingJourneyTimelineIllustration
                  items={JOURNEY_SCHEDULE}
                  reduced={reducedMotion}
                />
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </section>
  );
}
