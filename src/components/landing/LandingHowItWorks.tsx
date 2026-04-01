import { motion } from "framer-motion";
import { UserPlus, BookOpen, PenLine, BarChart3, Users, BookMarked, ArrowRight } from "lucide-react";
import { NEXT_SIMULADO } from "@/lib/landingMockData";
import {
  EASE,
  VIEWPORT_HEADER,
  VIEWPORT_REVEAL,
  headerReveal,
  headerItemReveal,
  DURATION_NORMAL,
  DURATION_FAST,
} from "@/lib/landingMotion";

const STEPS = [
  { step: "01", icon: UserPlus, title: "Cadastro e perfil", description: "Crie sua conta e informe especialidade e instituições. Seu perfil personaliza rankings e recomendações." },
  { step: "02", icon: BookOpen, title: "Escolha o simulado", description: "Veja o calendário, datas e número de questões. Escolha o simulado que faz sentido para sua etapa de preparação." },
  { step: "03", icon: PenLine, title: "Realize a prova", description: "Ambiente de prova sério: tempo cronometrado, marcação de questões, navegação clara. Foco total." },
  { step: "04", icon: BarChart3, title: "Acompanhe o desempenho", description: "Resultado com nota, acertos por área e análise questão a questão. Entenda exatamente onde você está." },
  { step: "05", icon: Users, title: "Compare com outros alunos", description: "Veja sua posição no ranking, percentil e evolução. Compare com sua especialidade ou com o geral." },
  { step: "06", icon: BookMarked, title: "Revise erros e evolua", description: "Use o caderno de erros e os recursos de revisão. No próximo simulado, você parte de um patamar mais alto." },
];

export function LandingHowItWorks() {
  return (
    <section
      id="como-funciona"
      className="relative py-14 md:py-[4.5rem] px-4 md:px-6"
      aria-labelledby="how-it-works-heading"
    >
      <div className="max-w-[1280px] mx-auto">
        <div className="relative mb-14">
          {/* Número decorativo de fundo */}
          <span
            className="absolute -top-4 -left-2 text-[8rem] sm:text-[10rem] font-black text-foreground/[0.04] leading-none select-none pointer-events-none tabular-nums"
            aria-hidden
          >
            06
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
              className="text-heading-1 md:text-[2.5rem] lg:text-[3rem] font-bold text-foreground max-w-[14ch] leading-tight tracking-tight"
            >
              Do cadastro à evolução contínua.
            </motion.h2>
            <motion.p
              variants={headerItemReveal}
              className="mt-4 text-body-lg text-muted-foreground max-w-[32rem] leading-relaxed"
            >
              Uma jornada pensada para você medir, comparar e subir de nível a cada simulado.
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
                  className="absolute top-6 left-6 w-9 h-9 rounded-full flex items-center justify-center text-caption font-bold text-primary-foreground bg-primary shadow-lg shadow-primary/25"
                  aria-hidden
                >
                  {s.step}
                </div>
                <div className="flex items-center gap-3 mb-2">
                  <s.icon className="h-5 w-5 text-primary" aria-hidden />
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
            className="relative rounded-3xl border border-border overflow-hidden min-h-[420px] p-6 flex flex-col justify-between bg-card/60 shadow-xl"
          >
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-1/2 left-1/2 w-64 h-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-3xl" />
            </div>
            <div className="relative z-10 space-y-6">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
                <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
                <span className="text-body-sm font-medium text-foreground">Próximo simulado</span>
              </div>
              <div className="rounded-2xl border border-border bg-card/80 p-5 text-left">
                <p className="font-semibold text-foreground text-heading-3">{NEXT_SIMULADO.title}</p>
                <p className="text-body-sm text-muted-foreground mt-1">{NEXT_SIMULADO.questions} questões · {NEXT_SIMULADO.date}</p>
                <p className="mt-3 text-body font-medium text-primary">{NEXT_SIMULADO.inscritos} inscritos</p>
              </div>
              <p className="text-body text-muted-foreground">
                Cada etapa prepara a próxima. Inscreva-se, escolha o simulado e acompanhe sua evolução.
              </p>
            </div>
            <div className="relative z-10 flex items-center justify-center gap-2 text-muted-foreground text-body-sm">
              <ArrowRight className="h-5 w-5 rotate-90" aria-hidden />
              <span>Veja os passos ao lado</span>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
