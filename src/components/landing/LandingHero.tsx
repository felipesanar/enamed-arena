import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  AnimatePresence,
  animate,
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { BarChart3, FileQuestion, Link2, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { trackEvent } from "@/lib/analytics";
import { SANARFLIX_MARK_SRC } from "@/components/brand/BrandMark";
import { EASE } from "@/lib/landingMotion";

/** Animation delays for staggered entrance */
const DELAY = {
  eyebrow: 0.05,
  headline: 0.15,
  subhead: 0.26,
  ctas: 0.36,
  visual: 0.18,
  chipLeft: 0.5,
  chipRight: 0.6,
  stats: 0.65,
} as const;

const HERO_VALUE_PROPS: readonly {
  id: string;
  title: string;
  description: string;
  Icon: LucideIcon;
}[] = [
  {
    id: "novel-questions",
    title: "100 questões inéditas",
    description: "Banco exclusivo para treino fora das rotações óbvias.",
    Icon: FileQuestion,
  },
  {
    id: "enamed-model",
    title: "Formato fiel ao ENAMED",
    description: "Prova construída para espelhar o que importa no dia da seleção.",
    Icon: Link2,
  },
  {
    id: "inep-dcn",
    title: "INEP e DCN na curadoria",
    description: "Prevalência de provas e diretrizes nacionais guiando cada eixo.",
    Icon: BarChart3,
  },
  {
    id: "offline-upload",
    title: "Offline e gabarito",
    description: "Estude sem conexão e envie o gabarito quando estiver online.",
    Icon: WifiOff,
  },
];

const HERO_VALUE_PROPS_ARIA_LABEL = HERO_VALUE_PROPS.map(
  (p) => `${p.title}. ${p.description}`,
).join(" ");

type HeroValuePropsVariant = "compactUnderCard" | "mobileStrip";

const RANK_DEMO_START = 42;
const RANK_DEMO_END = 1;
const RANK_DEMO_RANGE = RANK_DEMO_START - RANK_DEMO_END;

/** Chip lateral do hero: demonstração de ranking melhorando (42 → 1) com ênfase crescente. */
function HeroRankingChip({ prefersReducedMotion }: { prefersReducedMotion: boolean | null }) {
  const reduced = prefersReducedMotion === true;
  const [rank, setRank] = useState(RANK_DEMO_START);
  const [demoDone, setDemoDone] = useState(false);

  useEffect(() => {
    if (reduced) {
      setRank(RANK_DEMO_END);
      setDemoDone(true);
      return;
    }

    let controls: { stop: () => void } | undefined;
    const timer = window.setTimeout(() => {
      controls = animate(RANK_DEMO_START, RANK_DEMO_END, {
        duration: 4.75,
        ease: [0.22, 1, 0.36, 1],
        onUpdate: (v) => setRank(Math.round(v)),
        onComplete: () => {
          setRank(RANK_DEMO_END);
          setDemoDone(true);
        },
      });
    }, 900);

    return () => {
      window.clearTimeout(timer);
      controls?.stop();
    };
  }, [reduced]);

  const progress = (RANK_DEMO_START - rank) / RANK_DEMO_RANGE;
  const emphasis = progress * progress;

  const chipShadow = demoDone
    ? "0 10px 32px -4px rgba(0,0,0,0.62), 0 0 36px -8px hsl(var(--primary) / 0.45)"
    : `0 10px 32px -4px rgba(0,0,0,${0.62 - emphasis * 0.06})`;

  return (
    <motion.div
      initial={reduced ? {} : { opacity: 0, x: 16 }}
      animate={reduced ? {} : { opacity: 1, x: 0 }}
      transition={{ duration: 0.5, delay: DELAY.chipRight, ease: EASE }}
      className="absolute right-0 top-1/2 z-10 -translate-y-1/2 rounded-xl border border-white/10 bg-card/[0.92] p-3 backdrop-blur-xl"
      style={{
        boxShadow: chipShadow,
        borderColor:
          progress > 0.88 ? "hsl(var(--primary) / 0.38)" : "rgba(255, 255, 255, 0.1)",
      }}
      aria-label="Demonstração: posição no ranking melhora do 42º para o 1º lugar"
    >
      <p className="flex items-baseline gap-0.5 text-xl font-extrabold leading-none">
        <span className="text-lg text-landing-accent" aria-hidden>
          #
        </span>
        <motion.span
          className="inline-flex h-[1.15em] min-w-[2.25ch] items-center justify-end overflow-hidden tabular-nums tracking-tight"
          animate={reduced ? {} : { scale: 1 + emphasis * 0.11 }}
          transition={{ type: "spring", stiffness: 320, damping: 30 }}
        >
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={rank}
              initial={reduced ? false : { y: 11, opacity: 0.25 }}
              animate={{ y: 0, opacity: 1 }}
              exit={reduced ? undefined : { y: -9, opacity: 0 }}
              transition={{ duration: 0.22, ease: EASE }}
              className={cn(
                "inline-block will-change-transform",
                progress >= 0.78 &&
                  "text-landing-accent [text-shadow:0_0_18px_hsl(var(--primary)/0.55),0_0_42px_hsl(var(--primary)/0.22)]",
                progress >= 0.42 && progress < 0.78 && "text-foreground",
                progress < 0.42 && "text-muted-foreground",
              )}
            >
              {rank}
            </motion.span>
          </AnimatePresence>
        </motion.span>
      </p>
      <p className="mt-1 text-[0.55rem] uppercase tracking-[0.1em] text-muted-foreground/50">
        Ranking
      </p>
    </motion.div>
  );
}

function HeroValuePropsList({ variant }: { variant: HeroValuePropsVariant }) {
  const compact = variant === "compactUnderCard";
  return (
    <ul
      className={cn(
        "grid w-full grid-cols-2 border border-white/[0.08] bg-white/[0.025] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
        compact
          ? "gap-2 p-2 rounded-[14px] xl:gap-2.5 xl:p-2.5 xl:rounded-2xl"
          : "gap-2 p-2 sm:p-2.5 rounded-xl",
      )}
      aria-label={HERO_VALUE_PROPS_ARIA_LABEL}
    >
      {HERO_VALUE_PROPS.map((item) => {
        const { Icon } = item;
        return (
          <li
            key={item.id}
            className={cn(
              "flex min-w-0 items-start border border-white/[0.06] bg-white/[0.03]",
              compact
                ? "gap-2 rounded-[10px] p-2 xl:gap-2.5 xl:rounded-xl xl:p-2.5"
                : "gap-2 rounded-lg p-2 sm:p-2.5",
            )}
          >
            <div
              className={cn(
                "flex shrink-0 items-center justify-center bg-gradient-to-br from-primary/18 to-primary/5 text-landing-accent ring-1 ring-inset ring-primary/15",
                compact
                  ? "h-7 w-7 rounded-lg xl:h-8 xl:w-8 xl:rounded-[10px] xl:ring-primary/18"
                  : "h-8 w-8 rounded-lg sm:h-9 sm:w-9 ring-primary/18",
              )}
              aria-hidden
            >
              <Icon
                className={cn(
                  compact ? "h-3.5 w-3.5 xl:h-4 xl:w-4" : "h-3.5 w-3.5 sm:h-4 sm:w-4",
                )}
                strokeWidth={2.2}
              />
            </div>
            <div className="min-w-0 flex-1 pt-px">
              <p
                className={cn(
                  "font-bold leading-snug tracking-tight text-foreground",
                  compact ? "text-[0.6875rem] xl:text-xs" : "text-[0.7rem] sm:text-xs",
                )}
              >
                {item.title}
              </p>
              <p
                className={cn(
                  "line-clamp-2 text-muted-foreground/72",
                  compact
                    ? "mt-1 text-[0.625rem] leading-relaxed xl:text-[0.6875rem] xl:leading-relaxed"
                    : "mt-0.5 text-[0.625rem] leading-snug sm:text-[0.6875rem]",
                )}
              >
                {item.description}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function LandingHero() {
  const prefersReducedMotion = useReducedMotion();

  /** Enable 3D hover only on real pointer devices ≥ lg. Used in Task 3/4 for the AI insight card tilt. */
  const [finePointerHoverDesktop, setFinePointerHoverDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px) and (hover: hover)");
    const sync = () => setFinePointerHoverDesktop(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const { scrollY } = useScroll();
  const visualY = useTransform(scrollY, [0, 400], [0, 60]);
  const visualOpacity = useTransform(scrollY, [0, 200], [1, 0.7]);

  /** Helper: entrance animation props, no-op when reduced motion is preferred */
  const entrance = (delay: number, yAmount = 20) =>
    prefersReducedMotion
      ? {}
      : {
          initial: { opacity: 0, y: yAmount },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.55, delay, ease: EASE },
        };

  return (
    <section
      id="hero"
      aria-labelledby="hero-heading"
      className="relative min-h-[100svh] flex flex-col justify-center overflow-x-hidden overflow-y-visible pb-16 pt-[max(env(safe-area-inset-top,0px),clamp(4rem,2.25vw+3rem,5.25rem))]"
    >
      {/* ── Background ── */}
      <div className="absolute inset-0 pointer-events-none -z-10 overflow-hidden" aria-hidden>
        {/* Base gradient */}
        <div className="absolute inset-0 bg-[linear-gradient(145deg,#07060d_0%,#0e0b1a_50%,#080511_100%)]" />

        {/* Grid texture — masked radially so it fades at edges */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: [
              "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px)",
              "linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
            ].join(", "),
            backgroundSize: "36px 36px",
            maskImage:
              "radial-gradient(ellipse 85% 85% at 50% 50%, black 15%, transparent 75%)",
          }}
        />

        {/* Glow 1 — vinho: âncora dark + main (profundidade) */}
        <motion.div
          className="absolute -top-20 -left-16 w-[420px] h-[420px] rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(61,0,17,0.32) 0%, rgba(100,3,30,0.2) 42%, transparent 62%)",
          }}
          animate={prefersReducedMotion ? {} : { x: [0, 30, 0], y: [0, -20, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Glow 2 — purple, bottom-right */}
        <motion.div
          className="absolute -bottom-28 right-[15%] w-[320px] h-[320px] rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(90,60,180,0.14) 0%, transparent 62%)",
          }}
          animate={prefersReducedMotion ? {} : { x: [0, -20, 0], y: [0, 25, 0] }}
          transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Glow 3 — sanar-light family, discretíssimo */}
        <div
          className="absolute top-[35%] right-[8%] w-[200px] h-[200px] rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(163,69,93,0.14) 0%, rgba(100,3,30,0.08) 45%, transparent 68%)",
          }}
        />
      </div>

      {/* ── Content grid (filled in next tasks) ── */}
      <div className="w-full max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.18fr)] lg:gap-8 xl:gap-10 2xl:gap-12">
          {/* Left column — Task 4 (with motion entrances) */}
          <div className="space-y-6 lg:space-y-7">
            {/* Eyebrow badge */}
            <motion.div {...entrance(DELAY.eyebrow)}>
              <div className="inline-flex items-center gap-2.5 rounded-full border border-[hsl(var(--landing-accent-mid)/0.55)] bg-gradient-to-r from-[hsl(var(--brand-sanar-light)/0.14)] via-[hsl(var(--primary)/0.14)] to-[hsl(220_18%_9%/0.88)] px-3 py-1.5 pl-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_2px_12px_-4px_rgba(0,0,0,0.35)] backdrop-blur-md ring-1 ring-inset ring-white/[0.08] transition-[border-color,box-shadow] duration-300 hover:border-[hsl(var(--landing-accent-mid)/0.7)] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_4px_20px_-6px_hsl(var(--primary)/0.28)]">
                <span className="relative h-7 w-7 shrink-0 overflow-hidden rounded-lg">
                  <img
                    src={SANARFLIX_MARK_SRC}
                    alt=""
                    draggable={false}
                    decoding="async"
                    className="h-full w-full object-cover object-center"
                  />
                </span>
                <span className="text-[0.8125rem] font-semibold leading-none tracking-wide text-[hsl(var(--brand-sanar-lighter))] drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)] sm:text-sm">
                  Ecossistema SanarFlix
                </span>
              </div>
            </motion.div>

            {/* Headline */}
            <motion.h1
              {...entrance(DELAY.headline, 32)}
              id="hero-heading"
              className="w-full max-w-none text-[3.2rem] sm:text-[3.5rem] lg:text-[3.2rem] xl:text-[3.6rem] font-extrabold leading-[1.05] tracking-[-0.04em] text-foreground"
            >
              Performance com{" "}
              <em className="not-italic text-gradient-hero-em bg-clip-text text-transparent block mt-1 leading-[1.1] pb-2">
                precisão cirúrgica.
              </em>
            </motion.h1>

            {/* Subhead */}
            <motion.p
              {...entrance(DELAY.subhead)}
              className="w-full max-w-none text-body-lg text-muted-foreground leading-relaxed"
            >
              Realize simulados com correção por área, ranking em tempo real e
              análise que mostra exatamente onde você está — e o que revisar antes
              da próxima prova.
            </motion.p>

            {/* CTA row */}
            <motion.div {...entrance(DELAY.ctas)} className="flex items-center gap-4 flex-wrap">
              <Button
                size="lg"
                className="min-h-[52px] px-7 rounded-xl font-bold text-base bg-primary text-primary-foreground shadow-[0_8px_36px_hsl(var(--primary)/0.5),0_3px_12px_hsl(var(--primary)/0.3)] hover:bg-wine-hover hover:shadow-[0_12px_44px_hsl(var(--primary)/0.58),0_4px_14px_hsl(var(--primary)/0.28)] hover:-translate-y-0.5 transition-all duration-300 active:translate-y-0"
                asChild
              >
                <Link
                  to="/login"
                  onClick={() => trackEvent("lead_captured", { source: "landing_hero_primary" })}
                >
                  Entrar no próximo simulado <span aria-hidden="true">→</span>
                </Link>
              </Button>
              <a
                href="#como-funciona"
                className="text-body font-medium text-[rgb(194,134,140)] border-b border-[rgb(194,134,140)]/50 transition-colors duration-200 pb-px hover:text-landing-accent hover:border-landing-accent/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                Ver como funciona
              </a>
            </motion.div>

            {/* Value props — alinhado ao fluxo do hero no mobile (coluna esquerda) */}
            <motion.div
              initial={prefersReducedMotion ? {} : { opacity: 0, y: 12 }}
              animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: DELAY.stats, ease: EASE }}
              className="lg:hidden mt-8 w-full max-w-md"
            >
              <HeroValuePropsList variant="mobileStrip" />
            </motion.div>
          </div>

          {/* Right column — Task 3 + 4 */}
          <motion.div
            style={prefersReducedMotion ? {} : { y: visualY, opacity: visualOpacity }}
            initial={prefersReducedMotion ? {} : { opacity: 0, scale: 0.97, y: 30 }}
            animate={prefersReducedMotion ? {} : { opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.8, delay: DELAY.visual, ease: EASE }}
            className="relative hidden min-w-0 w-full lg:-ml-3 lg:flex lg:flex-col lg:items-stretch xl:-ml-6 2xl:-ml-8"
          >
            <div className="relative w-full min-w-0 pl-0 pr-1 xl:pr-4 2xl:pr-6">

              {/* Chip left — Evolução */}
              <motion.div
                initial={prefersReducedMotion ? {} : { opacity: 0, x: -16 }}
                animate={prefersReducedMotion ? {} : { opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: DELAY.chipLeft, ease: EASE }}
                className="absolute left-[-10px] top-1/2 z-10 -translate-y-1/2 bg-card/[0.92] backdrop-blur-xl border border-white/10 rounded-xl p-3 shadow-[0_10px_32px_-4px_rgba(0,0,0,0.6)] xl:left-[-18px] 2xl:left-[-22px]"
              >
                <p className="text-xl font-extrabold text-foreground leading-none">
                  <span className="text-landing-accent text-lg" aria-hidden>▲</span> +12%
                </p>
                <p className="text-[0.55rem] text-muted-foreground/50 uppercase tracking-[0.1em] mt-1">
                  Evolução
                </p>
              </motion.div>

              {/* Chip right — Ranking (demo animada) */}
              <HeroRankingChip prefersReducedMotion={prefersReducedMotion} />

              {/* Main AI insight card */}
              <div style={{ perspective: "1000px" }}>
                <motion.div
                  initial={{ rotateX: 0, rotateY: 0 }}
                  animate={{ rotateX: 2.5, rotateY: -2 }}
                  transition={{ duration: 0.8, delay: DELAY.visual, ease: EASE }}
                  whileHover={
                    prefersReducedMotion || !finePointerHoverDesktop
                      ? undefined
                      : {
                          rotateX: -1,
                          rotateY: 1.5,
                          transition: { type: "spring", stiffness: 300, damping: 35 },
                        }
                  }
                  style={{ transformStyle: "preserve-3d" }}
                  className="relative w-full rounded-[22px] border border-primary/[0.32] bg-[linear-gradient(165deg,rgba(18,14,30,0.97)_0%,rgba(11,8,20,0.99)_100%)] p-7 shadow-[0_36px_88px_-18px_rgba(0,0,0,0.72),inset_0_1px_0_rgba(255,255,255,0.08),0_0_0_1px_hsl(var(--primary)/0.08)] xl:rounded-3xl xl:p-8 2xl:p-9"
                >
                  {/* Inner radial glow */}
                  <div
                    className="pointer-events-none absolute inset-0 rounded-[22px] xl:rounded-3xl"
                    style={{
                      background:
                        "radial-gradient(ellipse 82% 56% at 50% -6%, hsl(var(--primary)/0.15) 0%, transparent 58%)",
                    }}
                    aria-hidden
                  />

                  <div className="relative z-[1]">
                    {/* Card eyebrow */}
                    <p className="text-overline uppercase tracking-[0.14em] text-landing-accent flex items-center gap-2 mb-2.5">
                      <span aria-hidden>✦</span> Análise SanarFlix
                    </p>

                    {/* Card headline + desc */}
                    <p className="text-[1.45rem] font-extrabold leading-[1.12] tracking-tight text-foreground xl:text-[1.58rem] 2xl:text-[1.68rem] mb-1.5">
                      Unifesp + 3 instituições
                    </p>
                    <p className="mb-4 w-full max-w-none text-[0.875rem] leading-relaxed text-muted-foreground/58 xl:text-body-sm">
                      você seria aprovado nestas instituições com o desempenho atual
                    </p>

                    <div className="h-px bg-white/[0.07] mb-3.5" />

                    {/* Area breakdown grid */}
                    <div className="grid grid-cols-3 gap-2 mb-3.5">
                      {[
                        { name: "Clínica Méd.", score: "82%", colorClass: "text-success" },
                        { name: "Cirurgia",     score: "68%", colorClass: "text-warning" },
                        { name: "Pediatria",    score: "54%", colorClass: "text-landing-accent" },
                      ].map((area) => (
                        <div
                          key={area.name}
                          className="bg-white/[0.035] border border-white/[0.06] rounded-[11px] p-2.5 xl:p-3"
                        >
                          <p className="text-[0.55rem] xl:text-[0.5625rem] text-muted-foreground/52 uppercase tracking-[0.08em] mb-1">
                            {area.name}
                          </p>
                          <p className={cn("text-[1rem] xl:text-[1.05rem] font-extrabold leading-none tabular-nums", area.colorClass)}>
                            {area.score}
                          </p>
                        </div>
                      ))}
                    </div>

                    {/* Progress bar */}
                    <div className="flex items-center gap-2.5">
                      <span className="text-[0.5625rem] xl:text-[0.6rem] text-muted-foreground/52 whitespace-nowrap shrink-0 uppercase tracking-[0.06em]">
                        Progresso geral
                      </span>
                      <div className="flex-1 h-1.5 bg-white/[0.07] rounded-full overflow-hidden">
                        <div className="h-full w-[74%] bg-gradient-brand-progress rounded-full" />
                      </div>
                      <span className="text-[0.5625rem] xl:text-[0.6rem] font-bold text-muted-foreground/72 shrink-0 tabular-nums">74%</span>
                    </div>
                  </div>
                </motion.div>
              </div>

              {/* Value props — logo abaixo do card, mesma coluna e ritmo visual */}
              <motion.div
                initial={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
                animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: DELAY.stats, ease: EASE }}
                className="relative z-0 mt-3.5 w-full"
              >
                <HeroValuePropsList variant="compactUnderCard" />
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
