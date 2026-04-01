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
      className="relative py-14 md:py-18 px-4 md:px-6"
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
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/25 bg-primary/8 text-overline uppercase tracking-[0.12em] font-semibold text-primary">
              <span className="w-1.5 h-1.5 rounded-full bg-primary/70" aria-hidden />
              Experiência de Prova
            </span>
          </motion.div>
          <motion.h2
            variants={headerItemReveal}
            id="experience-heading"
            className="text-heading-1 md:text-[2.5rem] lg:text-[3rem] font-bold text-foreground max-w-[16ch] leading-tight tracking-tight"
          >
            Ambiente de prova no nível da sua preparação.
          </motion.h2>
          <motion.p
            variants={headerItemReveal}
            className="mt-4 text-body-lg text-muted-foreground max-w-[32rem] leading-relaxed"
          >
            Ambiente de prova, resultado, ranking e insights — tudo com a mesma qualidade e clareza.
          </motion.p>
        </motion.header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={VIEWPORT_REVEAL}
            transition={{ duration: DURATION_NORMAL, ease: EASE }}
            className="relative"
          >
            <LandingExamDemo />
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { icon: BarChart3, title: "Desempenho por área", desc: "Gráficos e percentuais por disciplina e tema." },
              { icon: Trophy, title: "Ranking", desc: "Sua posição e evolução em relação aos outros." },
              { icon: BookOpen, title: "Correção comentada", desc: "Justificativas e estatísticas por questão." },
              { icon: LayoutGrid, title: "Comparativo entre provas", desc: "Curva de evolução entre simulados." },
            ].map((card, i) => (
              <motion.div
                key={card.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={VIEWPORT_REVEAL}
                transition={{ delay: i * 0.06, duration: DURATION_NORMAL, ease: EASE }}
                whileHover={{ y: -3, transition: { duration: DURATION_FAST, ease: EASE } }}
                className="p-5 rounded-2xl border border-border bg-card/50 hover:border-primary/20 hover:bg-card/70 transition-all duration-300"
              >
                <card.icon className="h-6 w-6 text-primary mb-3" aria-hidden />
                <h3 className="font-semibold text-foreground text-heading-3 mb-1">{card.title}</h3>
                <p className="text-body-sm text-muted-foreground">{card.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
