import { motion } from "framer-motion";
import { TrendingUp, Target, PieChart, Trophy } from "lucide-react";
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
import { RANKING_PREVIEW_ROWS } from "@/lib/landingMockData";

const ITEMS = [
  { icon: TrendingUp, title: "Ranking e percentil", desc: "Sua posição em relação a milhares de alunos. Por especialidade ou geral." },
  { icon: PieChart, title: "Desempenho por tema", desc: "Onde você acerta mais e onde precisa investir. Leitura clara de forças e fraquezas." },
  { icon: Target, title: "Visão estratégica", desc: "Evolução entre provas e próximos passos sugeridos com base no seu resultado." },
];

export function LandingComparison() {
  return (
    <section
      id="performance"
      className="relative py-16 md:py-20 px-4 md:px-6 overflow-hidden"
      aria-labelledby="comparison-heading"
    >
      <div className="absolute inset-0 pointer-events-none -z-10 bg-gradient-to-b from-transparent via-primary/[0.03] to-transparent" aria-hidden />
      <div className="max-w-[1280px] mx-auto relative">
        <motion.header
          variants={headerReveal}
          initial="hidden"
          whileInView="show"
          viewport={VIEWPORT_HEADER}
          className="mb-14"
        >
          <motion.p
            variants={headerItemReveal}
            className="text-overline uppercase tracking-[0.12em] text-muted-foreground mb-3 flex items-center gap-2"
          >
            <span className="w-6 h-px bg-gradient-to-r from-transparent via-primary to-wine-glow" />
            Performance
          </motion.p>
          <motion.h2
            variants={headerItemReveal}
            id="comparison-heading"
            className="text-heading-1 md:text-[2.5rem] lg:text-[3rem] font-bold text-foreground max-w-[14ch] leading-tight tracking-tight"
          >
            Você não só responde. Você entende sua performance.
          </motion.h2>
          <motion.p
            variants={headerItemReveal}
            className="mt-4 text-body-lg text-muted-foreground max-w-[32rem] leading-relaxed"
          >
            Ranking, comparação entre simulados, desempenho por tema e visão estratégica do estudo em um só lugar.
          </motion.p>
        </motion.header>

        <motion.div
          variants={containerReveal}
          initial="hidden"
          whileInView="show"
          viewport={VIEWPORT_REVEAL}
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          {ITEMS.map((item) => (
            <motion.div
              key={item.title}
              variants={itemReveal}
              whileHover={{ y: -4, transition: { duration: DURATION_FAST, ease: EASE } }}
              className="p-6 rounded-3xl border border-border bg-card/70 shadow-lg hover:border-primary/20 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 border border-primary/20 mb-4">
                <item.icon className="h-6 w-6 text-primary" aria-hidden />
              </div>
              <h3 className="font-semibold text-foreground text-heading-2 mb-2">{item.title}</h3>
              <p className="text-body text-muted-foreground leading-relaxed">{item.desc}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* Mini ranking — aparência de produto real */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={VIEWPORT_REVEAL}
          transition={{ duration: DURATION_NORMAL, ease: EASE }}
          className="mt-10 rounded-2xl border border-border overflow-hidden bg-card/70 shadow-lg"
        >
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" aria-hidden />
              <span className="text-overline uppercase tracking-wider font-semibold text-foreground">
                Ranking · Clínica Médica
              </span>
            </div>
            <span className="text-caption text-muted-foreground">Atualizado há 2h</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-body-sm">
              <thead>
                <tr className="text-overline uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="py-3 px-5 font-semibold w-16">#</th>
                  <th className="py-3 px-5 font-semibold">Aluno</th>
                  <th className="py-3 px-5 font-semibold hidden sm:table-cell">Especialidade</th>
                  <th className="py-3 px-5 font-semibold text-right w-20">Score</th>
                  <th className="py-3 px-5 font-semibold text-right w-16">Var.</th>
                </tr>
              </thead>
              <tbody>
                {RANKING_PREVIEW_ROWS.map((row) => (
                  <tr
                    key={row.position}
                    className={`border-b border-border/60 last:border-0 ${
                      row.highlight ? "bg-primary/10 border-l-2 border-l-primary" : ""
                    }`}
                  >
                    <td className="py-3 px-5 font-semibold text-foreground tabular-nums">{row.position}</td>
                    <td className="py-3 px-5 font-medium text-foreground">{row.name}</td>
                    <td className="py-3 px-5 text-muted-foreground hidden sm:table-cell">{row.specialty}</td>
                    <td className="py-3 px-5 text-right font-semibold text-foreground tabular-nums">{row.score}%</td>
                    <td className="py-3 px-5 text-right">
                      <span
                        className={
                          row.variation === "—"
                            ? "text-muted-foreground"
                            : row.variation.startsWith("+")
                              ? "text-success font-medium"
                              : "text-muted-foreground"
                        }
                      >
                        {row.variation}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="px-5 py-3 text-caption text-muted-foreground border-t border-border">
            Entre 2.4k participantes · Sua posição e evolução em tempo real na plataforma.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={VIEWPORT_REVEAL}
          transition={{ duration: DURATION_NORMAL, ease: EASE }}
          className="mt-6 p-6 rounded-2xl border border-border bg-card/50 text-center"
        >
          <p className="text-body font-medium text-foreground">
            Tudo pensado para quem quer competir em outro nível — com dados claros e ação concreta.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
