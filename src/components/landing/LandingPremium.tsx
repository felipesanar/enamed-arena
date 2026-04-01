import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Sparkles, BookMarked, BarChart3, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  EASE,
  VIEWPORT_HEADER,
  VIEWPORT_REVEAL,
  headerReveal,
  headerItemReveal,
  containerReveal,
  itemReveal,
  DURATION_NORMAL,
  DURATION_FAST,
} from "@/lib/landingMotion";

const PRO_FEATURES = [
  { icon: BookMarked, title: "Caderno de erros", desc: "Revisão focada no que você errou, com contexto e material relacionado." },
  { icon: BarChart3, title: "Análise aprofundada", desc: "Métricas avançadas e comparação entre múltiplos simulados." },
  { icon: Zap, title: "Recursos exclusivos", desc: "Conteúdo e trilhas SanarFlix alinhados ao seu desempenho." },
  { icon: Sparkles, title: "Continuidade de preparação", desc: "Estudo inteligente que evolui com você entre uma prova e outra." },
];

export function LandingPremium() {
  return (
    <section
      id="pro"
      className="relative py-16 md:py-20 px-4 md:px-6"
      aria-labelledby="premium-heading"
    >
      <div className="max-w-[1280px] mx-auto">
        <motion.header
          variants={headerReveal}
          initial="hidden"
          whileInView="show"
          viewport={VIEWPORT_HEADER}
          className="mb-12 text-center"
        >
          <motion.h2
            variants={headerItemReveal}
            id="premium-heading"
            className="w-full max-w-none text-heading-1 md:text-[2.5rem] lg:text-[3rem] font-bold text-foreground leading-tight tracking-tight"
          >
            A preparação mais{" "}
            <span className="text-gradient-wine-impact inline-block pb-1 font-extrabold tracking-tight">
              completa
            </span>{" "}
            do mercado.
          </motion.h2>
          <motion.p
            variants={headerItemReveal}
            className="mx-auto mt-4 w-full max-w-5xl text-body-lg text-muted-foreground leading-relaxed"
          >
            Recursos exclusivos para quem quer extrair o máximo de cada simulado.
          </motion.p>
        </motion.header>

        <motion.div
          variants={containerReveal}
          initial="hidden"
          whileInView="show"
          viewport={VIEWPORT_REVEAL}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5"
        >
          {PRO_FEATURES.map((f) => (
            <motion.div
              key={f.title}
              variants={itemReveal}
              whileHover={{ y: -3, transition: { duration: DURATION_FAST, ease: EASE } }}
              className="p-5 rounded-2xl border border-border bg-card/50 hover:border-primary/20 hover:bg-card/70 transition-all duration-300"
            >
              <f.icon className="h-6 w-6 text-landing-accent mb-3" aria-hidden />
              <h3 className="font-semibold text-foreground text-heading-3 mb-1">{f.title}</h3>
              <p className="text-body-sm text-muted-foreground">{f.desc}</p>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={VIEWPORT_REVEAL}
          transition={{ duration: DURATION_NORMAL, ease: EASE }}
          className="mt-10 text-center"
        >
          <Button
            size="lg"
            className="min-h-[52px] px-8 rounded-full font-semibold bg-primary text-primary-foreground hover:bg-wine-hover shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5 transition-all duration-300"
            asChild
          >
            <Link to="/login">Conhecer SanarFlix PRO</Link>
          </Button>
        </motion.div>
      </div>
    </section>
  );
}
