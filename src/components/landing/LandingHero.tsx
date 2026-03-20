import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion, useScroll, useTransform } from "framer-motion";
import { Button } from "@/components/ui/button";
import { TrendingUp, Trophy, BarChart3, ChevronRight, Zap, Sparkles } from "lucide-react";

const NAV_HEIGHT = 80;
const EASE = [0.32, 0.72, 0.2, 1] as const;

const STAGGER = {
  eyebrow: 0.08,
  headline: 0.18,
  subhead: 0.32,
  ctas: 0.44,
  cards: 0.56,
  visual: 0.2,
  panel: 0.35,
  float1: 0.5,
  float2: 0.6,
};

/** Imagem da aluna no hero. Coloque hero-student.png em public/. */
const HERO_HUMAN_IMAGE_SRC = "/hero-student.png";

/** Mensagem fictícia da análise SanarFlix — aprovação 1ª opção + outras instituições */
const AI_INSIGHT_MESSAGE = "Você seria aprovado na sua 1ª opção (Unifesp) e em mais 3 instituições.";

const TYPEWRITER_SPEED_MS = 42;

function HeroAiInsight() {
  const [phase, setPhase] = useState<"analyzing" | "typing">("analyzing");
  const [visibleLength, setVisibleLength] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("typing"), 1600);
    return () => clearTimeout(t1);
  }, []);

  useEffect(() => {
    if (phase !== "typing") return;
    if (visibleLength >= AI_INSIGHT_MESSAGE.length) return;
    const t = setTimeout(() => setVisibleLength((n) => n + 1), TYPEWRITER_SPEED_MS);
    return () => clearTimeout(t);
  }, [phase, visibleLength]);

  const displayText = AI_INSIGHT_MESSAGE.slice(0, visibleLength);
  const showCursor = phase === "typing" && visibleLength < AI_INSIGHT_MESSAGE.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.8, ease: EASE }}
      className="relative w-full rounded-2xl border-2 border-primary/40 bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5 shadow-[0_0_24px_-4px_hsl(var(--primary)_/_0.2)] overflow-hidden"
    >
      {/* Barra sutil de “processamento” durante análise */}
      {phase === "analyzing" && (
        <motion.div
          className="absolute bottom-0 left-0 h-0.5 bg-primary/60"
          initial={{ width: "0%" }}
          animate={{ width: "100%" }}
          transition={{ duration: 1.5, ease: "easeInOut" }}
        />
      )}
      <div className="relative p-4 sm:p-5">
        <div className="flex items-center gap-2.5 mb-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/30 shadow-[0_0_12px_hsl(var(--primary)_/_0.25)]">
            <Sparkles className="h-4 w-4 text-primary" aria-hidden />
          </span>
          <span className="text-caption font-bold uppercase tracking-widest text-primary">
            Análise SanarFlix
          </span>
        </div>
        {phase === "analyzing" ? (
          <p className="text-body-sm text-muted-foreground flex items-center gap-1.5">
            Analisando desempenho
            <span className="inline-flex gap-0.5">
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-primary"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.2 }}
                />
              ))}
            </span>
          </p>
        ) : (
          <p className="text-body md:text-body-lg font-semibold text-foreground leading-snug min-h-[2.5rem]">
            {displayText}
            {showCursor && (
              <motion.span
                className="inline-block w-0.5 h-[1em] align-middle bg-primary ml-0.5"
                animate={{ opacity: [1, 0] }}
                transition={{ duration: 0.6, repeat: Infinity }}
                aria-hidden
              />
            )}
          </p>
        )}
      </div>
    </motion.div>
  );
}

export function LandingHero() {
  const { scrollY } = useScroll();
  const heroY = useTransform(scrollY, [0, 400], [0, 60]);
  const heroOpacity = useTransform(scrollY, [0, 200], [1, 0.7]);

  return (
    <section
      id="hero"
      className="relative min-h-[100svh] flex flex-col justify-center overflow-hidden"
      style={{ paddingTop: NAV_HEIGHT + 48, paddingBottom: 48 }}
    >
      {/* Background — camadas de profundidade, tokens da marca */}
      <div className="absolute inset-0 pointer-events-none -z-10" aria-hidden>
        <div className="absolute top-0 left-0 w-full h-[75%] bg-gradient-to-b from-primary/10 via-primary/4 to-transparent" />
        <div className="absolute top-[8%] left-[-6%] w-[480px] h-[480px] rounded-full bg-primary/14 blur-[90px]" />
        <div className="absolute bottom-[12%] right-[-4%] w-[360px] h-[360px] rounded-full bg-wine-glow/10 blur-[80px]" />
        <div className="absolute top-[40%] right-[8%] w-[220px] h-[220px] rounded-full bg-primary/8 blur-[60px]" />
        {/* Leve movimento atmosférico */}
        <motion.div
          className="absolute top-[20%] right-[15%] w-[180px] h-[180px] rounded-full bg-wine-glow/6 blur-[70px]"
          animate={{ opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      <div className="w-full max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-12 lg:gap-14 xl:gap-16 items-center">
          {/* Coluna de copy */}
          <div className="space-y-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: STAGGER.eyebrow, ease: EASE }}
              className="inline-flex items-center gap-2.5 px-3.5 py-2 rounded-full border border-primary/35 bg-card/60 backdrop-blur-sm shadow-[0_1px_2px_hsl(var(--foreground)_/_0.06)]"
            >
              <span className="text-overline uppercase tracking-[0.12em] font-semibold text-foreground">
                Ecossistema
              </span>
              <span
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary border border-primary/40 shadow-[0_2px_8px_hsl(var(--primary)_/_0.3)]"
                aria-hidden
              >
                <span className="text-primary-foreground font-bold text-xs">S</span>
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 32 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, delay: STAGGER.headline, ease: EASE }}
              className="text-[2.75rem] sm:text-[3.5rem] md:text-[4rem] lg:text-[4.25rem] xl:text-[4.5rem] font-bold text-foreground leading-[0.97] tracking-tight max-w-[12ch]"
            >
              Sua performance{" "}
              <span className="text-gradient-wine block mt-1 leading-[1.12] pb-0.5">vira estratégia.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: STAGGER.subhead, ease: EASE }}
              className="text-body-lg md:text-xl text-muted-foreground max-w-[26rem] leading-relaxed"
            >
              Correção por área, ranking em tempo real e análise que mostra exatamente onde você está — e o que revisar antes da próxima prova.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: STAGGER.ctas, ease: EASE }}
              className="flex flex-wrap gap-4"
            >
              <Button
                size="lg"
                className="min-h-[56px] px-8 rounded-xl font-semibold text-base bg-primary text-primary-foreground hover:bg-wine-hover shadow-[0_4px_24px_hsl(var(--primary)_/_0.4)] hover:shadow-[0_8px_36px_hsl(var(--primary)_/_0.5)] transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0"
                asChild
              >
                <Link to="/login">Quero participar do próximo simulado</Link>
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="min-h-[56px] px-6 rounded-xl font-semibold border-border bg-transparent hover:bg-muted/50 hover:border-primary/30 transition-all duration-300"
                asChild
              >
                <a href="#como-funciona">Ver como funciona</a>
              </Button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: STAGGER.cards, ease: EASE }}
              className="grid grid-cols-1 sm:grid-cols-3 gap-4"
            >
              {[
                {
                  icon: BarChart3,
                  value: "Correção por área",
                  label: "Análise questão a questão e por disciplina",
                },
                {
                  icon: Trophy,
                  value: "Ranking em tempo real",
                  label: "Compare-se com milhares de alunos",
                },
                {
                  icon: TrendingUp,
                  value: "Evolução entre provas",
                  label: "Curva de desempenho e próximos passos",
                },
              ].map((item) => (
                <motion.div
                  key={item.value}
                  whileHover={{ y: -3, transition: { duration: 0.2, ease: EASE } }}
                  className="group p-4 rounded-2xl border border-border bg-card/60 hover:bg-card/90 hover:border-primary/25 transition-all duration-300 cursor-default"
                >
                  <item.icon className="h-5 w-5 text-primary mb-2.5 opacity-90 group-hover:opacity-100" aria-hidden />
                  <p className="font-semibold text-foreground text-heading-3">{item.value}</p>
                  <p className="text-body-sm text-muted-foreground mt-0.5">{item.label}</p>
                </motion.div>
              ))}
            </motion.div>
          </div>

          {/* Lado direito — composição de produto com camada humana + painel + profundidade */}
          <motion.div
            style={{ y: heroY, opacity: heroOpacity }}
            initial={{ opacity: 0, scale: 0.97, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.8, delay: STAGGER.visual, ease: EASE }}
            className="relative hidden lg:block"
          >
            <div className="relative w-full max-w-[520px] ml-auto">
              {/* Camada 1: atmosfera + humano (fallback ou mídia) */}
              <div className="absolute inset-0 rounded-[28px] overflow-hidden">
                {HERO_HUMAN_IMAGE_SRC ? (
                  <>
                    <img
                      src={HERO_HUMAN_IMAGE_SRC}
                      alt="Estudante de medicina no ecossistema SanarFlix Simulados"
                      className="absolute inset-0 w-full h-full object-cover object-right-bottom scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-landing-bg via-landing-bg/85 to-transparent" />
                    <div className="absolute inset-0 bg-gradient-to-t from-landing-bg/95 via-transparent to-transparent" />
                  </>
                ) : (
                  /* Fallback editorial: silhueta suave sugerindo presença de estudo */
                  <div
                    className="absolute inset-0 bg-gradient-to-br from-primary/6 via-transparent to-wine-glow/5"
                    aria-hidden
                  />
                )}
                {/* Núcleo de luz sutil (atmosfera) */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[70%] h-[70%] rounded-full bg-primary/8 blur-[80px] pointer-events-none" />
              </div>

              {/* Camada 2: painel principal de produto */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: STAGGER.panel, ease: EASE }}
                className="relative rounded-[24px] border border-border overflow-hidden bg-card/90 backdrop-blur-xl shadow-[0_24px_80px_-12px_rgba(0,0,0,0.5),0_0_0_1px_hsl(var(--border))]"
              >
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[85%] h-[40%] bg-gradient-to-b from-primary/10 to-transparent rounded-full blur-2xl" />
                  <div className="absolute bottom-0 right-0 w-1/2 h-1/2 bg-wine-glow/6 rounded-full blur-3xl" />
                </div>

                <div className="relative p-6 space-y-5 min-h-[400px] flex flex-col justify-between">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-overline uppercase tracking-wider text-muted-foreground">
                        Resultado do simulado
                      </p>
                      <p className="text-heading-2 font-semibold text-foreground mt-0.5 truncate">
                        Clínica Médica · 120 questões
                      </p>
                    </div>
                    <span className="shrink-0 px-3 py-1.5 rounded-full text-caption font-semibold bg-success/20 text-success border border-success/30">
                      Concluído
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: "Score", value: "87%", sub: "acima da média" },
                      { label: "Posição", value: "#42", sub: "entre 2.4k" },
                      { label: "Acertos", value: "104/120", sub: "por área" },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className="p-4 rounded-xl border border-border bg-background/60 backdrop-blur-sm"
                      >
                        <p className="text-overline uppercase tracking-wider text-muted-foreground">
                          {item.label}
                        </p>
                        <p className="font-bold text-foreground text-heading-1 mt-1 tabular-nums">
                          {item.value}
                        </p>
                        <p className="text-caption text-muted-foreground mt-0.5">{item.sub}</p>
                      </div>
                    ))}
                  </div>

                  <HeroAiInsight />

                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3.5 rounded-xl bg-primary/12 border border-primary/25">
                      <p className="text-caption font-semibold text-primary flex items-center gap-1.5">
                        <BarChart3 className="h-3.5 w-3.5" />
                        Desempenho por área
                      </p>
                      <p className="text-body-sm text-muted-foreground mt-0.5">
                        Clínica, Cirurgia, Pediatria...
                      </p>
                    </div>
                    <div className="p-3.5 rounded-xl bg-muted/40 border border-border">
                      <p className="text-caption font-semibold text-foreground flex items-center gap-1.5">
                        <Zap className="h-3.5 w-3.5 text-primary" />
                        Próximo simulado
                      </p>
                      <p className="text-body-sm text-muted-foreground mt-0.5">Em breve</p>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Cards orbitais fora da área do painel (sem sobrepor métricas) */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: STAGGER.float1, ease: EASE }}
                className="absolute -left-[8.5rem] top-[14%] w-[140px] rounded-2xl border border-border bg-card/95 backdrop-blur-md shadow-lg p-3"
              >
                <p className="text-caption font-semibold text-primary flex items-center gap-1">
                  <TrendingUp className="h-3.5 w-3.5" />
                  Evolução
                </p>
                <p className="text-heading-2 font-bold text-foreground mt-1 tabular-nums">+12%</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">vs. último simulado</p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: STAGGER.float2, ease: EASE }}
                className="absolute -right-2 bottom-[8%] w-[130px] rounded-2xl border border-border bg-card/95 backdrop-blur-md shadow-lg p-3"
              >
                <p className="text-caption font-semibold text-muted-foreground">Ranking</p>
                <p className="text-heading-2 font-bold text-foreground mt-1 flex items-center gap-1">
                  #42
                  <ChevronRight className="h-4 w-4 text-primary" />
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Clínica Médica</p>
              </motion.div>
            </div>
          </motion.div>
        </div>

        {/* Versão mobile do painel — compacta, foco em métricas */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: STAGGER.visual + 0.2, ease: EASE }}
          className="lg:hidden mt-10 rounded-2xl border border-border overflow-hidden bg-card/80 backdrop-blur-sm shadow-xl"
        >
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-overline text-muted-foreground">Resultado do simulado</p>
              <span className="px-2.5 py-1 rounded-full text-caption font-semibold bg-success/20 text-success">
                Concluído
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Score", value: "87%" },
                { label: "Posição", value: "#42" },
                { label: "Acertos", value: "104/120" },
              ].map((item) => (
                <div
                  key={item.label}
                  className="p-3 rounded-xl border border-border bg-background/50 text-center"
                >
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {item.label}
                  </p>
                  <p className="font-bold text-foreground text-heading-2 tabular-nums">{item.value}</p>
                </div>
              ))}
            </div>
            <div className="rounded-xl border border-primary/30 bg-primary/10 p-3 flex items-start gap-2">
              <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" aria-hidden />
              <div>
                <p className="text-caption font-semibold text-primary uppercase tracking-wider">Análise SanarFlix</p>
                <p className="text-body-sm text-foreground mt-0.5">{AI_INSIGHT_MESSAGE}</p>
              </div>
            </div>
            <p className="text-body-sm text-muted-foreground text-center">
              Desempenho por área e evolução entre provas na plataforma.
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
