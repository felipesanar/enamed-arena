import { useId } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { UserPlus, BookOpen, PenLine, BarChart3, Users, BookMarked } from "lucide-react";
import { cn } from "@/lib/utils";
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
  windowLabel: string;
};

const JOURNEY_SCHEDULE: JourneyScheduleItem[] = [
  {
    id: "simulado-2",
    simulado: "Simulado #2 — Cirurgia e Emergência",
    windowLabel: "Janela de execução: 28/03/2026 até 30/03/2026",
  },
  {
    id: "simulado-1",
    simulado: "Simulado #1 — Fundamentos Clínicos",
    windowLabel: "Janela de execução: 24/03/2026 até 26/03/2026",
  },
  {
    id: "simulado-4",
    simulado: "Simulado #4 — Medicina Preventiva e Saúde Coletiva",
    windowLabel: "Janela de execução: 14/04/2026 até 16/04/2026",
  },
  {
    id: "simulado-5",
    simulado: "Simulado #5 — Clínica Médica Avançada",
    windowLabel: "Janela de execução: 21/04/2026 até 23/04/2026",
  },
  {
    id: "simulado-6",
    simulado: "Simulado #6 — Revisão Geral ENAMED",
    windowLabel: "Janela de execução: 28/04/2026 até 30/04/2026",
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
        <h3 id={headingId} className="whitespace-nowrap text-sm font-semibold tracking-tight text-foreground">
          Histórico e próximos
        </h3>
        <div className="h-px flex-1 rounded-full bg-border" />
      </div>
      <p className="mb-4 text-xs text-muted-foreground">Ordenado do mais recente para o mais antigo.</p>

      <div className="relative pl-2">
        <div
          className="pointer-events-none absolute bottom-4 left-[16px] top-3 w-px -translate-x-1/2 rounded-full bg-gradient-to-b from-border via-primary/15 to-border"
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
                  className="pointer-events-none absolute left-[-16px] top-[24px] z-0 h-px w-[18px] bg-border"
                  aria-hidden
                />
                <div
                  className="absolute left-[-24px] top-[20px] z-[1] -translate-x-1/2"
                  aria-hidden
                >
                  <div className="h-3 w-3 rounded-full border-2 border-background bg-primary/40 shadow-sm ring-1 ring-primary/45" />
                </div>

                <div
                  className={cn(
                    "flex min-w-0 items-start gap-3 rounded-xl border border-border/90 bg-card/95 px-3 py-3 shadow-sm transition-shadow sm:px-4",
                    !reduced && "hover:border-border hover:shadow-md",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold leading-snug text-foreground">{item.simulado}</p>
                    <p className="mt-2 rounded-lg border border-primary/25 bg-primary/10 px-2.5 py-1.5 text-[0.76rem] font-semibold leading-relaxed text-landing-accent">
                      {item.windowLabel}
                    </p>
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-10 items-start">
          <div className="space-y-4">
            {STEPS.map((s, i) => (
              <motion.div
                key={s.step}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={VIEWPORT_REVEAL}
                transition={{ duration: DURATION_NORMAL, delay: i * 0.06, ease: EASE }}
                whileHover={{ x: 4, transition: { duration: DURATION_FAST, ease: EASE } }}
                className="relative pl-20 pr-6 py-6 rounded-2xl border border-border bg-card/50 hover:border-primary/20 hover:bg-card/70 transition-colors duration-300"
              >
                <div
                  className="absolute top-6 left-6 flex h-9 w-9 items-center justify-center rounded-full text-caption font-bold tabular-nums text-primary-foreground bg-primary shadow-lg shadow-primary/25"
                  aria-hidden
                >
                  {s.step}
                </div>
                <div className="flex items-center gap-3 mb-2">
                  <s.icon className="h-5 w-5 text-landing-accent" aria-hidden />
                  <h3 className="font-semibold text-foreground text-heading-3">{s.title}</h3>
                </div>
                <p className="text-body-sm text-muted-foreground leading-relaxed">{s.description}</p>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={VIEWPORT_REVEAL}
            transition={{ duration: DURATION_NORMAL, ease: EASE }}
            className="relative min-h-[420px] overflow-y-auto overflow-x-hidden rounded-3xl border border-border bg-card/60 p-4 shadow-xl sm:p-5"
          >
            <div className="pointer-events-none absolute inset-0 opacity-90" aria-hidden>
              <div className="absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-3xl" />
            </div>
            <div className="relative z-10">
              <LandingJourneyTimelineIllustration items={JOURNEY_SCHEDULE} reduced={reducedMotion} />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
