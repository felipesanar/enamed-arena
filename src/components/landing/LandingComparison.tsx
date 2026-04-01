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
          className="mb-12 text-center"
        >
          <motion.p
            variants={headerItemReveal}
            className="text-overline uppercase tracking-[0.12em] text-muted-foreground mb-3"
          >
            Performance
          </motion.p>
          <motion.h2
            variants={headerItemReveal}
            id="comparison-heading"
            className="w-full max-w-none text-heading-1 md:text-[2.5rem] lg:text-[3rem] font-bold text-foreground leading-tight tracking-tight"
          >
            Rankings que mostram onde você está.
          </motion.h2>
          <motion.p
            variants={headerItemReveal}
            className="mx-auto mt-4 w-full max-w-5xl text-body-lg text-muted-foreground leading-relaxed"
          >
            Compare-se com alunos da sua especialidade ou do geral. Posição, percentil e evolução ao longo do tempo.
          </motion.p>
          <motion.div
            variants={headerItemReveal}
            className="mt-8 flex items-center justify-center gap-3"
            aria-hidden
          >
            <span className="h-px w-16 bg-gradient-to-r from-transparent to-primary/40" />
            <span className="w-1.5 h-1.5 rounded-full bg-primary/60" />
            <span className="h-px w-16 bg-gradient-to-l from-transparent to-primary/40" />
          </motion.div>
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
                <item.icon className="h-6 w-6 text-landing-accent" aria-hidden />
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
              <Trophy className="h-5 w-5 text-landing-accent" aria-hidden />
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
                {RANKING_PREVIEW_ROWS.map((row) => {
                  const isYou = row.isYou === true;
                  return (
                    <tr
                      key={row.position}
                      aria-label={isYou ? "Sua posição no ranking" : undefined}
                      className={
                        isYou
                          ? "relative border-b border-primary/30 border-l-[3px] border-l-primary bg-gradient-to-r from-primary/[0.22] via-primary/[0.14] to-transparent shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_24px_-8px_hsl(var(--primary)/0.2)] last:border-b-0"
                          : "border-b border-border/60 last:border-0"
                      }
                    >
                      <td
                        className={`py-3 px-5 tabular-nums ${
                          isYou
                            ? "font-bold text-landing-accent"
                            : "font-semibold text-foreground"
                        }`}
                      >
                        {row.position}
                      </td>
                      <td className="py-3 px-5">
                        <span
                          className={
                            isYou
                              ? "font-bold tracking-tight text-landing-accent drop-shadow-[0_0_12px_hsl(var(--primary)/0.35)]"
                              : "font-medium text-foreground"
                          }
                        >
                          {row.name}
                        </span>
                      </td>
                      <td
                        className={`py-3 px-5 hidden sm:table-cell ${
                          isYou ? "font-medium text-foreground/90" : "text-muted-foreground"
                        }`}
                      >
                        {row.specialty}
                      </td>
                      <td
                        className={`py-3 px-5 text-right tabular-nums ${
                          isYou ? "font-bold text-foreground" : "font-semibold text-foreground"
                        }`}
                      >
                        {row.score}%
                      </td>
                      <td className="py-3 px-5 text-right">
                        <span
                          className={
                            row.variation === "—"
                              ? "text-muted-foreground"
                              : row.variation.startsWith("+")
                                ? isYou
                                  ? "font-bold text-success"
                                  : "font-medium text-success"
                                : "text-muted-foreground"
                          }
                        >
                          {row.variation}
                        </span>
                      </td>
                    </tr>
                  );
                })}
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
          className="relative mt-8 overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-b from-card/80 to-card/45 px-6 py-8 text-center shadow-[0_24px_56px_-28px_rgba(0,0,0,0.42)] md:mt-10 md:px-10 md:py-9"
        >
          <div className="pointer-events-none absolute inset-0" aria-hidden>
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
            <div
              className="absolute left-1/2 top-0 h-36 w-[min(100%,24rem)] -translate-x-1/2 -translate-y-[45%] rounded-full opacity-90 blur-3xl"
              style={{ background: "hsl(var(--primary) / 0.14)" }}
            />
          </div>
          <div className="relative mx-auto flex max-w-[52rem] flex-col items-center gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-primary/30 bg-primary/[0.12] text-landing-accent shadow-[inset_0_1px_0_rgba(255,255,255,0.07)]">
              <Target className="h-5 w-5" strokeWidth={2.25} aria-hidden />
            </div>
            <p className="text-pretty text-[1.0625rem] font-semibold leading-snug tracking-tight text-foreground md:text-xl md:leading-snug">
              Tudo pensado para quem quer{" "}
              <span className="text-landing-accent">competir em outro nível</span>
              .
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
