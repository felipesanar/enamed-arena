import { motion } from "framer-motion";
import {
  EASE,
  VIEWPORT_HEADER,
  VIEWPORT_REVEAL,
  headerReveal,
  headerItemReveal,
  DURATION_NORMAL,
  DURATION_FAST,
} from "@/lib/landingMotion";

import { SOCIAL_PROOF_STATS } from "@/lib/landingMockData";

const QUOTES = [
  {
    text: "A plataforma trouxe clareza para minha preparação. Não é só fazer prova — é entender onde estou e para onde ir.",
    author: "Aluna de Medicina",
    context: "Usuária SanarFlix Simulados",
  },
  {
    text: "O ranking por especialidade mudou minha noção de onde eu estava. Hoje sei exatamente em que temas investir.",
    author: "Estudante de Medicina",
    context: "SanarFlix Simulados",
  },
];

const FOOTER_TAGS = ["Ecossistema SanarFlix", "Preparação para residência", "Alta performance"];

export function LandingSocialProof() {
  return (
    <section
      id="prova-social"
      className="relative py-16 md:py-20 px-4 md:px-6"
      aria-labelledby="social-proof-heading"
    >
      <div className="max-w-[1280px] mx-auto">
        <motion.header
          variants={headerReveal}
          initial="hidden"
          whileInView="show"
          viewport={VIEWPORT_HEADER}
          className="mb-12 text-center"
        >
          <div className="flex items-center justify-center gap-1 mb-4" aria-label="5 estrelas">
            {[0, 1, 2, 3, 4].map((i) => (
              <motion.span
                key={i}
                initial={{ opacity: 0, scale: 0.5 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: i * 0.08, ease: EASE }}
                className="text-[1.25rem] text-primary"
                aria-hidden
              >
                ★
              </motion.span>
            ))}
          </div>
          <motion.p
            variants={headerItemReveal}
            className="text-overline uppercase tracking-[0.12em] text-muted-foreground mb-3"
          >
            Prova Social
          </motion.p>
          <motion.h2
            variants={headerItemReveal}
            id="social-proof-heading"
            className="text-heading-1 md:text-[2.5rem] lg:text-[3rem] font-bold text-foreground leading-tight tracking-tight"
          >
            Quem já usou não volta atrás.
          </motion.h2>
          <motion.p
            variants={headerItemReveal}
            className="mt-4 text-body-lg text-muted-foreground max-w-[36rem] mx-auto leading-relaxed"
          >
            Alunos que testaram a plataforma relatam mais confiança e clareza na preparação.
          </motion.p>
        </motion.header>

        <div className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <motion.blockquote
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={VIEWPORT_REVEAL}
              transition={{ duration: DURATION_NORMAL, ease: EASE }}
              className="p-6 md:p-8 rounded-3xl border border-border bg-card/50"
            >
              <p className="text-heading-2 md:text-[1.5rem] font-semibold text-foreground leading-snug max-w-[24ch]">
                "{QUOTES[0].text}"
              </p>
              <p className="mt-4 text-body text-muted-foreground leading-relaxed">{QUOTES[0].context}</p>
              <footer className="mt-6 pt-4 border-t border-border">
                <p className="font-semibold text-foreground">{QUOTES[0].author}</p>
              </footer>
            </motion.blockquote>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {SOCIAL_PROOF_STATS.map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={VIEWPORT_REVEAL}
                transition={{ delay: i * 0.07, duration: DURATION_NORMAL, ease: EASE }}
                whileHover={{ y: -3, transition: { duration: DURATION_FAST, ease: EASE } }}
                className="p-5 rounded-2xl border border-border bg-card/50 text-center hover:border-primary/20 hover:bg-card/70 transition-all duration-300"
              >
                <p className="font-bold text-heading-1 md:text-display text-foreground tabular-nums">{stat.value}</p>
                <p className="text-body-sm text-muted-foreground mt-1">{stat.label}</p>
              </motion.div>
            ))}
            </div>
          </div>

          <motion.blockquote
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={VIEWPORT_REVEAL}
            transition={{ duration: DURATION_NORMAL, ease: EASE }}
            className="p-6 rounded-2xl border border-border bg-card/40 text-center md:text-left"
          >
            <p className="text-body-lg font-medium text-foreground max-w-[36rem] mx-auto md:mx-0">
              "{QUOTES[1].text}"
            </p>
            <footer className="mt-4">
              <p className="text-body-sm font-semibold text-foreground">{QUOTES[1].author}</p>
              <p className="text-caption text-muted-foreground">{QUOTES[1].context}</p>
            </footer>
          </motion.blockquote>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={VIEWPORT_REVEAL}
          transition={{ duration: DURATION_NORMAL, ease: EASE }}
          className="mt-10 flex flex-wrap justify-center items-center gap-x-6 gap-y-2 text-muted-foreground text-body-sm"
        >
          {FOOTER_TAGS.map((tag, i) => (
            <span key={tag} className="flex items-center gap-x-6">
              {i > 0 && <span aria-hidden className="text-muted-foreground/70">·</span>}
              <motion.span
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={VIEWPORT_REVEAL}
                transition={{ delay: 0.1 + i * 0.05, duration: DURATION_NORMAL, ease: EASE }}
              >
                {tag}
              </motion.span>
            </span>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
