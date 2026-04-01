import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { Button } from "@/components/ui/button";
import { TrendingUp, Trophy, BarChart3, ChevronRight, Zap, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { trackEvent } from "@/lib/analytics";
import { SPRING_GENTLE } from "@/lib/landingMotion";

const EASE = [0.32, 0.72, 0.2, 1] as const;

const STAGGER = {
  eyebrow: 0.05,
  headline: 0.12,
  subhead: 0.24,
  ctas: 0.35,
  cards: 0.48,
  visual: 0.15,
  panel: 0.28,
  float1: 0.5,
  float2: 0.6,
};

/** Imagem da aluna no hero. Coloque hero-student.png em public/. */
const HERO_HUMAN_IMAGE_SRC = "/hero-student.png";

/** Mensagem fictícia da análise SanarFlix — aprovação 1ª opção + outras instituições */
const AI_INSIGHT_MESSAGE = "Você seria aprovado na sua 1ª opção (Unifesp) e em mais 3 instituições.";

const TYPEWRITER_SPEED_MS = 42;

function HeroAiInsight({ compact = false, cinematic = false }: { compact?: boolean; cinematic?: boolean }) {
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
      whileHover={cinematic && compact ? { rotateX: -3, rotateY: 4, z: 20, transition: SPRING_GENTLE } : undefined}
      style={{ transformStyle: "preserve-3d" }}
      className={cn(
        "relative w-full overflow-hidden",
        cinematic &&
          compact &&
          cn(
            "rounded-[14px] border border-primary/30",
            "bg-[linear-gradient(168deg,hsl(220_18%_14%/0.97)_0%,hsl(220_20%_10%/0.95)_45%,hsl(220_22%_8%/0.98)_100%)]",
            "shadow-[0_12px_40px_-12px_rgba(0,0,0,0.55),inset_0_1px_0_0_rgba(255,255,255,0.07),inset_0_0_48px_-18px_hsl(var(--primary)/0.12)]",
          ),
        !cinematic &&
          "border-primary/40 bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5 shadow-[0_0_24px_-4px_hsl(var(--primary)_/_0.2)]",
        compact && !cinematic ? "rounded-xl border" : !cinematic && "rounded-2xl border-2",
      )}
    >
      {cinematic && compact && (
        <>
          <div
            className="pointer-events-none absolute inset-0 rounded-[14px] bg-[radial-gradient(ellipse_90%_70%_at_50%_-10%,hsl(var(--primary)/0.14),transparent_55%)] opacity-90 xl:opacity-100"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0 rounded-[14px] bg-gradient-to-b from-white/[0.03] via-transparent to-black/20 xl:from-white/[0.04] xl:to-black/25"
            aria-hidden
          />
        </>
      )}
      {/* Barra sutil de “processamento” durante análise */}
      {phase === "analyzing" && (
        <motion.div
          className="absolute bottom-0 left-0 h-0.5 bg-primary/60"
          initial={{ width: "0%" }}
          animate={{ width: "100%" }}
          transition={{ duration: 1.5, ease: "easeInOut" }}
        />
      )}
      <div className={cn("relative z-[1]", compact ? "p-3 sm:p-3.5" : "p-4 sm:p-5")}>
        <div className={cn("flex items-center", compact ? "mb-2 gap-2" : "mb-3 gap-2.5")}>
          <span
            className={cn(
              "flex shrink-0 items-center justify-center rounded-xl",
              cinematic && compact
                ? "bg-primary/35 shadow-[0_0_16px_hsl(var(--primary)/0.35),inset_0_1px_0_0_rgba(255,255,255,0.12)]"
                : "bg-primary/30 shadow-[0_0_12px_hsl(var(--primary)_/_0.25)]",
              compact ? "h-6 w-6" : "h-8 w-8",
            )}
          >
            <Sparkles className={cn("text-primary", compact ? "h-3 w-3" : "h-4 w-4")} aria-hidden />
          </span>
          <span
            className={cn(
              "font-bold uppercase tracking-widest text-primary",
              compact ? "text-[10px] leading-tight" : "text-caption",
            )}
          >
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
          <p
            className={cn(
              "font-semibold text-foreground leading-snug",
              compact ? "text-body-sm min-h-[2rem]" : "text-body md:text-body-lg min-h-[2.5rem]",
            )}
          >
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
  const prefersReducedMotion = useReducedMotion();
  /** Tilt 3D só onde faz sentido: viewport grande + hover real (evita touch/tablet “estranho”). */
  const [finePointerHoverDesktop, setFinePointerHoverDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px) and (hover: hover)");
    const sync = () => setFinePointerHoverDesktop(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  const { scrollY } = useScroll();
  const heroY = useTransform(scrollY, [0, 400], [0, 60]);
  const heroOpacity = useTransform(scrollY, [0, 200], [1, 0.7]);

  return (
    <section
      id="hero"
      className={cn(
        "relative min-h-[100svh] flex flex-col justify-start overflow-x-hidden overflow-y-visible pb-12",
        /* Telas estreitas: menos padding-top; amplas: mais — limitado por clamp (evita colisão com header fixo no mínimo). */
        "pt-[max(env(safe-area-inset-top,0px),clamp(4rem,2.25vw+3rem,5.25rem))]",
      )}
    >
      {/* Background — camadas de profundidade, tokens da marca */}
      <div className="absolute inset-0 pointer-events-none -z-10" aria-hidden>
        <div className="absolute top-0 left-0 w-full h-[75%] bg-gradient-to-b from-primary/10 via-primary/4 to-transparent" />
        {/* Orb principal — top-left, primary */}
        <motion.div
          className="absolute top-[8%] left-[-6%] w-[480px] h-[480px] rounded-full bg-primary/14 blur-[90px]"
          animate={{ x: [0, 40, 0], y: [0, -30, 0] }}
          transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
        />
        {/* Orb secundário — bottom-right, wine-glow */}
        <motion.div
          className="absolute bottom-[12%] right-[-4%] w-[360px] h-[360px] rounded-full bg-wine-glow/10 blur-[80px]"
          animate={{ x: [0, -25, 0], y: [0, 35, 0] }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
        />
        {/* Orb sutil — top-right, primary */}
        <motion.div
          className="absolute top-[40%] right-[8%] w-[220px] h-[220px] rounded-full bg-primary/8 blur-[60px]"
          animate={{ opacity: [0.4, 0.9, 0.4] }}
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
                <Link to="/login" onClick={() => trackEvent("lead_captured", { source: "landing_hero_primary" })}>
                  Quero participar do próximo simulado
                </Link>
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
              ].map((item, index) => (
                <motion.div
                  key={item.value}
                  animate={{ y: [0, -6, 0] }}
                  transition={{
                    duration: 3.5,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: index * 0.4,
                  }}
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
            className="relative hidden min-w-0 overflow-visible lg:block lg:-mr-2 xl:-mr-4"
          >
            {/*
              Coluna usa largura total da célula (sem max-w que prendia o card). Card sem w-full para self-end + translate-x funcionarem.
            */}
            <div className="relative ml-auto w-full min-w-0 max-w-none overflow-visible pb-12 pt-5 sm:pt-6 lg:pt-7" style={{ perspective: "1200px" }}>
              <div className="flex flex-col items-end gap-0">
                {/* lg estreito: foto mais larga + mais altura; xl+ equilibra com o card */}
                <div className="relative z-0 w-[min(118%,26rem)] shrink-0 bg-transparent shadow-none ring-0 sm:w-[min(118%,28rem)] lg:w-full lg:max-w-[min(100%,38rem)] xl:max-w-[min(118%,34rem)] 2xl:max-w-[min(118%,31rem)]">
                  {HERO_HUMAN_IMAGE_SRC ? (
                    <img
                      src={HERO_HUMAN_IMAGE_SRC}
                      alt="Estudante de medicina no ecossistema SanarFlix Simulados"
                      className="block h-[min(36rem,62vh)] w-full translate-y-12 rounded-xl border-0 object-cover object-[48%_18%] shadow-none outline-none [filter:brightness(1.08)_contrast(1.03)_drop-shadow(0_22px_48px_rgb(0_0_0/0.28))] sm:h-[min(38rem,64vh)] sm:translate-y-14 sm:object-[46%_16%] sm:rounded-2xl lg:h-[min(44rem,74vh)] lg:translate-y-10 lg:object-[46%_14%] xl:h-[min(40rem,68vh)] xl:translate-y-14 2xl:h-[min(42rem,66vh)] 2xl:translate-y-[4.75rem]"
                      decoding="async"
                    />
                  ) : (
                    <div
                      className="flex aspect-[3/4] min-h-[24rem] w-full items-center justify-center rounded-[28px] bg-gradient-to-br from-primary/6 via-transparent to-wine-glow/5"
                      aria-hidden
                    />
                  )}
                </div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: STAGGER.panel, ease: EASE }}
                  className="relative isolate z-20 -mt-16 w-full max-w-[min(100%,400px)] shrink-0 self-center sm:-mt-[4.5rem] sm:max-w-[min(100%,420px)] lg:-mt-20 lg:max-w-[min(100%,440px)] xl:-mt-24 xl:max-w-[min(100%,500px)] 2xl:-mt-28 2xl:max-w-[min(100%,520px)] lg:translate-x-2 xl:translate-x-3 2xl:translate-x-4"
                >
                  {/* Evolução + Ranking: ao lado do card Resultado, eixo vertical central; z alto para não ficar sob a foto/card */}
                  <motion.div
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5, delay: STAGGER.float1, ease: EASE }}
                    className="pointer-events-none absolute top-1/2 right-full z-[50] mr-2 w-[118px] -translate-y-1/2 rounded-xl border border-border bg-card/95 p-2.5 shadow-[0_12px_40px_-8px_rgba(0,0,0,0.55)] backdrop-blur-md sm:w-[124px] sm:p-3"
                  >
                    <p className="flex items-center gap-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary sm:text-caption sm:normal-case sm:tracking-normal">
                      <TrendingUp className="h-3 w-3 shrink-0 sm:h-3.5 sm:w-3.5" />
                      Evolução
                    </p>
                    <p className="mt-0.5 text-lg font-bold tabular-nums text-foreground sm:text-heading-2 sm:mt-1">+12%</p>
                    <p className="mt-0.5 text-[9px] text-muted-foreground sm:text-[10px]">vs. último simulado</p>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5, delay: STAGGER.float2, ease: EASE }}
                    className="pointer-events-none absolute top-1/2 left-full z-[50] ml-2 w-[124px] -translate-y-1/2 rounded-xl border border-border bg-card/95 p-2.5 shadow-[0_12px_40px_-8px_rgba(0,0,0,0.55)] backdrop-blur-md sm:w-[130px] sm:p-3"
                  >
                    <p className="text-[11px] font-semibold text-muted-foreground sm:text-caption">Ranking</p>
                    <p className="mt-0.5 flex items-center gap-1 text-lg font-bold tabular-nums text-foreground sm:text-heading-2 sm:mt-1">
                      #42
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-primary sm:h-4 sm:w-4" />
                    </p>
                    <p className="mt-0.5 text-[9px] text-muted-foreground sm:text-[10px]">Clínica Médica</p>
                  </motion.div>

                {/* Perspectiva: mais aberta em telas grandes; desligada em viewports menores que lg */}
                <div className="max-lg:[perspective:none] [perspective:1040px] lg:[perspective:1280px] xl:[perspective:1520px]">
                  <motion.div
                    initial={false}
                    whileHover={
                      prefersReducedMotion || !finePointerHoverDesktop
                        ? undefined
                        : {
                            rotateX: -1.2,
                            rotateY: 1,
                            transition: { type: "spring", stiffness: 340, damping: 38, mass: 0.75 },
                          }
                    }
                    style={{ transformStyle: "preserve-3d" }}
                    className={cn(
                      "relative z-10 origin-center transform-gpu rounded-[20px] sm:rounded-[22px] xl:rounded-[24px]",
                      finePointerHoverDesktop && !prefersReducedMotion && "lg:will-change-transform",
                      /* lg estreito: card menor para não “engolir” a foto; xl+ recupera presença */
                      "scale-[0.80] sm:scale-[0.82] lg:scale-[0.82] xl:scale-[0.86] 2xl:scale-[0.89]",
                      /* Sombras: lg = mais contidas; xl+ = profundidade cinematográfica; 2xl = presença máxima */
                      "shadow-[0_26px_52px_-18px_rgba(0,0,0,0.5),0_10px_24px_-12px_rgba(0,0,0,0.32),0_0_0_1px_rgba(255,255,255,0.055),inset_0_1px_0_0_rgba(255,255,255,0.085)]",
                      "xl:shadow-[0_40px_80px_-22px_rgba(0,0,0,0.65),0_18px_36px_-14px_rgba(0,0,0,0.4),0_0_0_1px_rgba(255,255,255,0.065),inset_0_1px_0_0_rgba(255,255,255,0.1)]",
                      "2xl:shadow-[0_52px_110px_-26px_rgba(0,0,0,0.74),0_22px_44px_-16px_rgba(0,0,0,0.46),0_0_0_1px_rgba(255,255,255,0.075),inset_0_1px_0_0_rgba(255,255,255,0.11)]",
                    )}
                  >
                    {/* Plano base */}
                    <div
                      className="absolute inset-0 rounded-[20px] bg-gradient-to-br from-[hsl(220_18%_12%)] via-[hsl(220_20%_8.5%)] to-[hsl(220_24%_5.5%)] sm:rounded-[22px] xl:rounded-[24px]"
                      aria-hidden
                    />
                    {/* Halos: intensidade sobe com breakpoint (evita “lama” em lg estreito) */}
                    <div
                      className="pointer-events-none absolute inset-0 rounded-[20px] bg-[radial-gradient(ellipse_85%_55%_at_50%_-5%,hsl(var(--primary)/0.11),transparent_52%)] opacity-85 sm:rounded-[22px] sm:opacity-90 xl:rounded-[24px] xl:opacity-100"
                      aria-hidden
                    />
                    <div
                      className="pointer-events-none absolute inset-0 rounded-[20px] bg-[radial-gradient(ellipse_70%_50%_at_85%_95%,hsl(var(--wine-glow)/0.07),transparent_55%)] opacity-75 sm:rounded-[22px] sm:opacity-85 xl:rounded-[24px] xl:opacity-100"
                      aria-hidden
                    />
                    {/* Reflexo lateral: só xl+ (reduz ruído em laptop 13") */}
                    <div
                      className="pointer-events-none absolute inset-0 hidden rounded-[22px] bg-[linear-gradient(115deg,transparent_40%,rgba(255,255,255,0.028)_48%,transparent_56%)] xl:block xl:rounded-[24px]"
                      aria-hidden
                    />
                    <div
                      className="pointer-events-none absolute inset-x-0 top-0 h-px rounded-t-[20px] bg-gradient-to-r from-transparent via-white/[0.16] to-transparent sm:rounded-t-[22px] xl:via-white/20 xl:rounded-t-[24px]"
                      aria-hidden
                    />
                    {/* Inset + vinheta: mais leve em lg, mais profundo em xl+ */}
                    <div
                      className="pointer-events-none absolute inset-0 rounded-[20px] shadow-[inset_0_14px_32px_-10px_rgba(0,0,0,0.34),inset_0_-1px_0_0_rgba(255,255,255,0.035)] sm:rounded-[22px] xl:rounded-[24px] xl:shadow-[inset_0_22px_48px_-12px_rgba(0,0,0,0.42),inset_0_-1px_0_0_rgba(255,255,255,0.04)]"
                      aria-hidden
                    />
                    <div
                      className="pointer-events-none absolute inset-0 rounded-[20px] bg-gradient-to-b from-transparent via-transparent to-black/[0.28] sm:rounded-[22px] xl:to-black/35 xl:rounded-[24px]"
                      aria-hidden
                    />

                    <div className="relative flex min-h-[250px] flex-col justify-between gap-2.5 space-y-0 p-3 sm:min-h-[270px] sm:gap-3 sm:p-3.5 md:min-h-[280px] lg:min-h-[260px] lg:gap-3 lg:p-3.5 xl:min-h-[300px] xl:gap-4 xl:p-4 2xl:min-h-[320px] 2xl:p-5">
                      <div className="flex items-start justify-between gap-2 sm:gap-3">
                        <div className="min-w-0">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/95 sm:text-overline">
                            Resultado do simulado
                          </p>
                          <p className="mt-0.5 truncate text-heading-3 font-semibold tracking-tight text-foreground sm:text-heading-2">
                            Clínica Médica · 120 questões
                          </p>
                        </div>
                        <span
                          className={cn(
                            "shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold sm:px-3 sm:py-1.5 sm:text-caption",
                            "border border-emerald-500/35 bg-[linear-gradient(180deg,hsl(152_45%_22%/0.55),hsl(152_40%_14%/0.45))]",
                            "text-emerald-200/95 shadow-[0_4px_12px_rgba(0,0,0,0.35),inset_0_1px_0_0_rgba(255,255,255,0.12)]",
                          )}
                        >
                          Concluído
                        </span>
                      </div>

                      {/* Métricas: relevo mais suave em lg; xl+ ganha contraste de plano */}
                      <div className="grid grid-cols-3 gap-1.5 sm:gap-2 lg:gap-2.5">
                        {[
                          { label: "Score", value: "87%", sub: "acima da média" },
                          { label: "Posição", value: "#42", sub: "entre 2.4k" },
                          { label: "Acertos", value: "104/120", sub: "por área" },
                        ].map((item) => (
                          <div
                            key={item.label}
                            className={cn(
                              "rounded-[10px] border p-2 sm:rounded-[11px] sm:p-2.5 lg:rounded-xl lg:p-3.5",
                              "border-white/[0.07] bg-[linear-gradient(155deg,hsl(220_16%_15%)_0%,hsl(220_20%_9%)_100%)]",
                              "shadow-[0_4px_12px_-4px_rgba(0,0,0,0.45),inset_0_1px_0_0_rgba(255,255,255,0.05)]",
                              "xl:shadow-[0_6px_16px_-4px_rgba(0,0,0,0.55),inset_0_1px_0_0_rgba(255,255,255,0.06),inset_0_-8px_16px_-8px_rgba(0,0,0,0.25)]",
                            )}
                          >
                            <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground sm:text-overline">
                              {item.label}
                            </p>
                            <p className="mt-0.5 text-base font-bold tabular-nums text-foreground sm:mt-1 sm:text-heading-2">
                              {item.value}
                            </p>
                            <p className="mt-0.5 text-[9px] text-muted-foreground sm:text-caption">{item.sub}</p>
                          </div>
                        ))}
                      </div>

                      <HeroAiInsight compact cinematic />

                      <div className="grid grid-cols-2 gap-1.5 sm:gap-2 lg:gap-2.5">
                        <div
                          className={cn(
                            "rounded-[10px] border border-primary/35 p-2.5 sm:rounded-[11px] sm:p-3 lg:rounded-xl lg:p-3.5",
                            "bg-[linear-gradient(168deg,hsl(var(--primary)/0.14)_0%,hsl(220_22%_9%)_100%)] lg:bg-[linear-gradient(168deg,hsl(var(--primary)/0.16)_0%,hsl(220_22%_9%)_100%)]",
                            "shadow-[0_5px_14px_-5px_rgba(0,0,0,0.45),inset_0_1px_0_0_rgba(255,255,255,0.05)]",
                            "xl:shadow-[0_8px_20px_-6px_rgba(0,0,0,0.5),inset_0_1px_0_0_rgba(255,255,255,0.06)]",
                          )}
                        >
                          <p className="flex items-center gap-1 text-[10px] font-semibold text-primary sm:gap-1.5 sm:text-caption">
                            <BarChart3 className="h-3 w-3 shrink-0 sm:h-3.5 sm:w-3.5" />
                            Desempenho por área
                          </p>
                          <p className="mt-0.5 text-[10px] text-muted-foreground sm:text-body-sm">
                            Clínica, Cirurgia, Pediatria...
                          </p>
                        </div>
                        <div
                          className={cn(
                            "rounded-[10px] border border-white/[0.06] p-2.5 sm:rounded-[11px] sm:p-3 lg:rounded-xl lg:p-3.5",
                            "bg-[linear-gradient(168deg,hsl(220_16%_12%)_0%,hsl(220_22%_7%)_100%)]",
                            "shadow-[inset_0_2px_6px_rgba(0,0,0,0.28),0_3px_10px_-4px_rgba(0,0,0,0.35)]",
                            "xl:shadow-[inset_0_2px_8px_rgba(0,0,0,0.35),0_4px_12px_-4px_rgba(0,0,0,0.4)]",
                          )}
                        >
                          <p className="flex items-center gap-1 text-[10px] font-semibold text-foreground sm:gap-1.5 sm:text-caption">
                            <Zap className="h-3 w-3 shrink-0 text-primary sm:h-3.5 sm:w-3.5" />
                            Próximo simulado
                          </p>
                          <p className="mt-0.5 text-[10px] text-muted-foreground sm:text-body-sm">Em breve</p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </div>
              </motion.div>
              </div>

            </div>
          </motion.div>
        </div>

        {/* Mobile / tablet: painel próprio — mesma linguagem premium, menos camadas (performance + legibilidade) */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: STAGGER.visual + 0.2, ease: EASE }}
          className={cn(
            "relative isolate lg:hidden mt-10 overflow-hidden rounded-2xl border border-white/[0.08]",
            "bg-gradient-to-br from-[hsl(220_18%_11%)] via-[hsl(220_20%_8%)] to-[hsl(220_24%_5.5%)]",
            "shadow-[0_22px_48px_-16px_rgba(0,0,0,0.55),0_0_0_1px_rgba(255,255,255,0.05),inset_0_1px_0_0_rgba(255,255,255,0.06)]",
          )}
        >
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_100%_60%_at_50%_-15%,hsl(var(--primary)/0.12),transparent_50%)]"
            aria-hidden
          />
          <div className="pointer-events-none absolute inset-0 shadow-[inset_0_12px_28px_-8px_rgba(0,0,0,0.35)]" aria-hidden />
          <div className="relative space-y-4 p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-overline text-muted-foreground">Resultado do simulado</p>
                <p className="text-heading-3 font-semibold text-foreground mt-0.5 truncate">Clínica Médica · 120 questões</p>
              </div>
              <span className="shrink-0 rounded-full border border-emerald-500/35 bg-[linear-gradient(180deg,hsl(152_45%_22%/0.5),hsl(152_40%_14%/0.4))] px-2.5 py-1 text-caption font-semibold text-emerald-200/95 shadow-[0_2px_8px_rgba(0,0,0,0.3)]">
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
                  className={cn(
                    "rounded-xl border border-white/[0.07] p-2.5 text-center sm:p-3",
                    "bg-[linear-gradient(155deg,hsl(220_16%_14%)_0%,hsl(220_20%_9%)_100%)]",
                    "shadow-[0_4px_12px_-4px_rgba(0,0,0,0.4),inset_0_1px_0_0_rgba(255,255,255,0.05)]",
                  )}
                >
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{item.label}</p>
                  <p className="font-bold text-foreground text-heading-2 tabular-nums mt-0.5">{item.value}</p>
                </div>
              ))}
            </div>
            <div
              className={cn(
                "rounded-xl border border-primary/35 p-3 flex items-start gap-2.5",
                "bg-[linear-gradient(168deg,hsl(var(--primary)/0.14)_0%,hsl(220_22%_9%)_100%)]",
                "shadow-[0_6px_16px_-6px_rgba(0,0,0,0.45),inset_0_1px_0_0_rgba(255,255,255,0.05)]",
              )}
            >
              <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" aria-hidden />
              <div>
                <p className="text-caption font-semibold text-primary uppercase tracking-wider">Análise SanarFlix</p>
                <p className="text-body-sm text-foreground mt-0.5 leading-snug">{AI_INSIGHT_MESSAGE}</p>
              </div>
            </div>
            <p className="text-body-sm text-muted-foreground text-center leading-relaxed">
              Desempenho por área e evolução entre provas na plataforma.
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
