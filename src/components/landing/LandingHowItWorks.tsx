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
    title: "Escolha o simulado",
    description: "Veja o calendário, datas e número de questões. Escolha o simulado que faz sentido para sua etapa de preparação.",
  },
  {
    step: 3,
    icon: PenLine,
    title: "Realize a prova",
    description: "Ambiente de prova realista: tempo cronometrado, marcação de questões e navegação clara.",
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

function LandingJourneyTimelineIllustration({
  steps,
  reduced,
}: {
  steps: JourneyStep[];
  reduced: boolean;
}) {
  const headingId = useId();

  return (
    <div role="region" aria-labelledby={headingId} className="mb-0">
      <div className="mb-1 flex items-center gap-3">
        <h3 id={headingId} className="whitespace-nowrap text-sm font-semibold tracking-tight text-foreground">
          Linha do tempo da jornada
        </h3>
        <div className="h-px flex-1 rounded-full bg-border" />
      </div>
      <p className="mb-3 text-xs text-muted-foreground">Etapas 1 a 6, na ordem — do cadastro à revisão.</p>

      <div className="relative pl-1">
        <div
          className="pointer-events-none absolute bottom-4 left-[17px] top-4 w-px -translate-x-1/2 rounded-full bg-gradient-to-b from-primary/35 via-primary/15 to-border"
          aria-hidden
        />

        <div className="space-y-2 pl-[2.75rem] sm:pl-12">
          {steps.map((s, index) => {
            const Icon = s.icon;
            return (
              <motion.div
                key={s.step}
                initial={reduced ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: reduced ? 0 : 0.35,
                  delay: reduced ? 0 : index * 0.05,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="relative"
              >
                <div
                  className="pointer-events-none absolute left-[calc(27px-2.75rem)] top-[21px] z-0 h-px w-[calc(2.75rem-27px)] bg-border sm:left-[calc(27px-3rem)] sm:top-[22px] sm:w-[calc(3rem-27px)]"
                  aria-hidden
                />
                <div
                  className="absolute left-[calc(17px-2.75rem)] top-[17px] z-[1] -translate-x-1/2 sm:left-[calc(17px-3rem)]"
                  aria-hidden
                >
                  <div className="h-2.5 w-2.5 rounded-full border-2 border-background bg-primary/25 shadow-sm ring-1 ring-primary/35 sm:h-3 sm:w-3" />
                </div>

                <div
                  className={cn(
                    "flex gap-3 rounded-xl border border-border/90 bg-card/95 px-3 py-2.5 shadow-sm transition-shadow sm:gap-4 sm:px-4 sm:py-3",
                    !reduced && "hover:border-border hover:shadow-md",
                  )}
                >
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold tabular-nums text-primary"
                    aria-hidden
                  >
                    {s.step}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-0.5 flex items-center gap-2">
                      <Icon className="h-3.5 w-3.5 shrink-0 text-landing-accent sm:h-4 sm:w-4" aria-hidden />
                      <span className="text-xs font-medium text-muted-foreground">Passo {s.step}</span>
                    </div>
                    <p className="text-sm font-semibold leading-snug text-foreground">{s.title}</p>
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{s.description}</p>
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
              <LandingJourneyTimelineIllustration steps={STEPS} reduced={reducedMotion} />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
