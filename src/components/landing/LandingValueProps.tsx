import { motion } from "framer-motion";
import {
  BarChart3,
  Trophy,
  FileCheck,
  TrendingUp,
  BookOpen,
  Sparkles,
  Users,
} from "lucide-react";
import {
  EASE,
  VIEWPORT_HEADER,
  VIEWPORT_REVEAL,
  containerReveal,
  itemReveal,
  headerReveal,
  headerItemReveal,
  DURATION_NORMAL,
} from "@/lib/landingMotion";
import { LIVE_FEEDBACK_LINES } from "@/lib/landingMockData";

const ITEMS = [
  {
    id: "exp",
    icon: BarChart3,
    title: "Experiência premium de prova",
    description:
      "Interface pensada para concentração e performance. Tempo real, marcação de questões e ambiente que simula a prova de verdade.",
  },
  {
    id: "metricas",
    icon: TrendingUp,
    title: "Métricas e desempenho detalhado",
    description:
      "Veja seu rendimento por disciplina, tema e tipo de questão. Entenda onde você brilha e onde precisa evoluir.",
  },
  {
    id: "ranking",
    icon: Trophy,
    title: "Ranking e comparativos",
    description:
      "Compare-se com outros alunos, por especialidade ou geral. Posição, percentil e evolução ao longo do tempo.",
  },
  {
    id: "analise",
    icon: FileCheck,
    title: "Análise pós-prova",
    description:
      "Correção comentada, justificativas e estatísticas por questão. Não é só certo ou errado — é aprendizado.",
  },
  {
    id: "evolucao",
    icon: Sparkles,
    title: "Evolução entre simulados",
    description:
      "Acompanhe sua curva de desempenho entre uma prova e outra. Objetivos claros e próximos passos sugeridos.",
  },
  {
    id: "sanar",
    icon: Users,
    title: "Integração SanarFlix e PRO",
    description:
      "Conteúdo e trilhas do ecossistema Sanar alinhados ao seu desempenho. Preparação que conversa com a prova.",
  },
  {
    id: "caderno",
    icon: BookOpen,
    title: "Caderno de erros e continuidade",
    description:
      "Recursos premium para revisar o que errou e consolidar. Estudo inteligente baseado na sua performance.",
  },
];

export function LandingValueProps() {
  return (
    <section
      id="diferenciais"
      className="relative py-16 md:py-20 px-4 md:px-6"
      aria-labelledby="value-props-heading"
    >
      <div className="max-w-[1280px] mx-auto">
        <motion.header
          variants={headerReveal}
          initial="hidden"
          whileInView="show"
          viewport={VIEWPORT_HEADER}
          className="mb-12"
        >
          <motion.p
            variants={headerItemReveal}
            className="text-overline uppercase tracking-[0.12em] text-muted-foreground mb-3 flex items-center gap-2"
          >
            <span className="w-6 h-px bg-gradient-to-r from-transparent via-primary to-wine-glow" />
            Diferenciais
          </motion.p>
          <motion.h2
            variants={headerItemReveal}
            id="value-props-heading"
            className="text-heading-1 md:text-[2.5rem] lg:text-[3rem] font-bold text-foreground max-w-[14ch] leading-tight tracking-tight"
          >
            Muito além de um simulado comum.
          </motion.h2>
          <motion.p
            variants={headerItemReveal}
            className="mt-4 text-body-lg text-muted-foreground max-w-[32rem] leading-relaxed"
          >
            Cada recurso foi desenhado para quem leva preparação a sério e quer performance de alto nível.
          </motion.p>
        </motion.header>

        <motion.p
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={VIEWPORT_REVEAL}
          transition={{ duration: DURATION_NORMAL, ease: EASE }}
          className="mb-8 px-4 py-3 rounded-xl border border-primary/20 bg-primary/5 text-body-sm text-muted-foreground text-center"
        >
          {LIVE_FEEDBACK_LINES[0]}
        </motion.p>

        <motion.div
          variants={containerReveal}
          initial="hidden"
          whileInView="show"
          viewport={VIEWPORT_REVEAL}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
        >
          {ITEMS.map((props) => (
            <motion.article
              key={props.id}
              variants={itemReveal}
              whileHover={{ y: -4, transition: { duration: 0.2, ease: EASE } }}
              className="group relative p-6 rounded-3xl border border-border bg-card/70 shadow-lg hover:border-primary/25 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 min-h-[200px] flex flex-col"
            >
              <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none">
                <div className="absolute -top-[35%] -left-[15%] w-52 h-52 rounded-full bg-primary/10 blur-2xl opacity-80 group-hover:opacity-100 transition-opacity duration-300" aria-hidden />
              </div>
              <div className="relative z-10">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 border border-primary/20 mb-4 group-hover:bg-primary/25 group-hover:border-primary/30 transition-colors duration-300">
                  <props.icon className="h-5 w-5 text-primary" aria-hidden />
                </div>
                <h3 className="font-semibold text-foreground text-heading-3 mb-2">{props.title}</h3>
                <p className="text-body text-muted-foreground leading-relaxed">{props.description}</p>
              </div>
            </motion.article>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
