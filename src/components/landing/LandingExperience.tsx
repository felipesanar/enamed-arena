import { motion } from "framer-motion";
import { LayoutGrid, BarChart3, Trophy, BookOpen } from "lucide-react";
import { LandingExamDemo } from "./LandingExamDemo";
import {
  EASE,
  VIEWPORT_HEADER,
  VIEWPORT_REVEAL,
  headerReveal,
  headerItemReveal,
  DURATION_NORMAL,
  DURATION_FAST,
} from "@/lib/landingMotion";

export function LandingExperience() {
  return (
    <section
      id="experiencia"
      className="relative py-14 md:py-[4.5rem] px-4 md:px-6"
      aria-labelledby="experience-heading"
    >
      <div className="max-w-[1280px] mx-auto">
        <motion.header
          variants={headerReveal}
          initial="hidden"
          whileInView="show"
          viewport={VIEWPORT_HEADER}
          className="mb-14"
        >
          <motion.div variants={headerItemReveal} className="mb-4">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/25 bg-primary/10 text-overline uppercase tracking-[0.12em] font-semibold text-landing-accent">
              <span className="w-1.5 h-1.5 rounded-full bg-landing-accent/55" aria-hidden />
              Experiência de Prova
            </span>
          </motion.div>
          <motion.h2
            variants={headerItemReveal}
            id="experience-heading"
            className="text-heading-1 md:text-[2.5rem] lg:text-[3rem] font-bold text-foreground w-full max-w-none leading-tight tracking-tight"
          >
            Ambiente de prova no nível da sua preparação.
          </motion.h2>
          <motion.p
            variants={headerItemReveal}
            className="mt-4 w-full max-w-none text-body-lg text-muted-foreground leading-relaxed"
          >
            Ambiente de prova, resultado, ranking e insights — tudo com a mesma qualidade e clareza.
          </motion.p>
          <motion.div variants={headerItemReveal} className="mt-5 flex flex-wrap items-center gap-2.5">
            <span className="inline-flex items-center rounded-full border border-primary/70 bg-primary/35 px-3 py-1.5 text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-white shadow-[0_10px_24px_-12px_hsl(var(--primary)/0.65)]">
              Ambiente real de simulado • teste abaixo
            </span>
          </motion.div>
        </motion.header>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,14rem)] lg:items-start lg:gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,16rem)] xl:gap-10">
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={VIEWPORT_REVEAL}
            transition={{ duration: DURATION_NORMAL, ease: EASE }}
            className="relative min-w-0 lg:max-w-none"
          >
            <LandingExamDemo />
          </motion.div>

          <div
            className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-1 lg:gap-2 w-full max-w-lg mx-auto lg:mx-0 lg:max-w-none lg:shrink-0"
            aria-label="Recursos da plataforma"
          >
            {[
              { icon: BarChart3, title: "Desempenho por área", desc: "Gráficos e percentuais detalhados por disciplina e tema." },
              { icon: Trophy, title: "Ranking nacional", desc: "Sua posição e evolução comparada aos demais candidatos." },
              { icon: BookOpen, title: "Correção comentada", desc: "Justificativas detalhadas e estatísticas por questão." },
              { icon: LayoutGrid, title: "Comparativo entre provas", desc: "Curva de evolução e progresso entre os simulados." },
            ].map((card, i) => (
              <motion.div
                key={card.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={VIEWPORT_REVEAL}
                transition={{ delay: i * 0.06, duration: DURATION_NORMAL, ease: EASE }}
                whileHover={{ y: -2, transition: { duration: DURATION_FAST, ease: EASE } }}
                className="rounded-xl border border-border/80 bg-card/40 p-4 shadow-sm hover:border-primary/25 hover:bg-card/60 transition-all duration-300 sm:p-4.5 lg:rounded-lg lg:p-3.5"
              >
                <card.icon
                  className="mb-2.5 h-5 w-5 text-landing-accent lg:mb-2 lg:h-[18px] lg:w-[18px]"
                  aria-hidden
                />
                <h3 className="mb-1 text-sm font-semibold leading-snug text-foreground sm:text-[0.9rem] lg:text-[0.8125rem] lg:leading-tight">
                  {card.title}
                </h3>
                <p className="text-xs leading-relaxed text-muted-foreground sm:text-[0.8125rem] lg:text-[0.6875rem] lg:leading-relaxed">
                  {card.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
