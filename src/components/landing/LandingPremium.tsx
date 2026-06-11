import { useEffect, useRef, useState } from "react";
import { animate, motion, useInView, useReducedMotion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  CalendarClock,
  Crosshair,
  Heart,
  NotebookPen,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { trackEvent } from "@/lib/analytics";
import {
  EASE,
  VIEWPORT_HEADER,
  VIEWPORT_REVEAL,
  headerReveal,
  headerItemReveal,
  containerReveal,
  itemRevealLeft,
  DURATION_NORMAL,
  DURATION_FAST,
} from "@/lib/landingMotion";

// ─── Conteúdo ────────────────────────────────────────────────────────────────

type ProPillar = {
  id: string;
  icon: LucideIcon;
  title: string;
  description: string;
};

const PRO_PILLARS: ProPillar[] = [
  {
    id: "revisao",
    icon: RotateCcw,
    title: "Revisão espaçada",
    description:
      "Cada questão errada volta na hora certa de lembrar. Você fixa o conteúdo sem precisar reestudar tudo.",
  },
  {
    id: "treino",
    icon: Crosshair,
    title: "Treino direcionado",
    description:
      "Sessões cronometradas montadas a partir dos seus erros, focadas nas suas áreas mais fracas.",
  },
  {
    id: "reta-final",
    icon: CalendarClock,
    title: "Reta Final ENAMED",
    description:
      "Um plano para cada dia, priorizando as áreas que mais caem conforme a prova se aproxima.",
  },
  {
    id: "diagnostico",
    icon: Sparkles,
    title: "Diagnóstico do Prof. San",
    description:
      "Análise inteligente dos seus padrões de erro, com orientação clara do que atacar primeiro.",
  },
];

const MOCK_TABS = ["Revisar", "Favoritos", "Anotações", "Diagnóstico"] as const;

const MOCK_QUEUE = [
  { area: "Clínica Médica", theme: "Pneumologia", due: "Hoje" },
  { area: "Pediatria", theme: "Infectologia", due: "Hoje" },
  { area: "Cirurgia", theme: "Emergência", due: "Amanhã" },
] as const;

const DOMAIN_PCT = 68;

// ─── Contador animado ────────────────────────────────────────────────────────

function CountUpPercent({ to }: { to: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const reduced = useReducedMotion();
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!inView) return;
    if (reduced) {
      setValue(to);
      return;
    }
    const controls = animate(0, to, {
      duration: 1.5,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setValue(Math.round(v)),
    });
    return () => controls.stop();
  }, [inView, reduced, to]);

  return (
    <span ref={ref} className="tabular-nums">
      {value}%
    </span>
  );
}

// ─── Mockup do Caderno ───────────────────────────────────────────────────────

function CadernoMockup({ reduced }: { reduced: boolean }) {
  // A trilha (com área visível) dispara o observer; o preenchimento nasce com
  // largura 0% e elementos de área zero não disparam IntersectionObserver.
  const trackRef = useRef<HTMLDivElement>(null);
  const trackInView = useInView(trackRef, { once: true, margin: "-60px" });
  const fillWidth = reduced || trackInView ? `${DOMAIN_PCT}%` : "0%";

  return (
    <div
      className="relative w-full rounded-[22px] border border-primary/[0.28] bg-[linear-gradient(165deg,rgba(18,14,30,0.97)_0%,rgba(11,8,20,0.99)_100%)] p-5 shadow-[0_44px_100px_-24px_rgba(0,0,0,0.78),0_16px_44px_-24px_hsl(var(--primary)/0.4),inset_0_1px_0_rgba(255,255,255,0.08)] sm:p-6"
      aria-label="Demonstração do Caderno de Erros: domínio em 68%, fila de revisão do dia e modos de estudo"
    >
      {/* Glow interno */}
      <div
        className="pointer-events-none absolute inset-0 rounded-[22px]"
        style={{
          background:
            "radial-gradient(ellipse 80% 52% at 50% -6%, hsl(var(--primary)/0.14) 0%, transparent 58%)",
        }}
        aria-hidden
      />

      <div className="relative z-[1]">
        {/* Cabeçalho do mockup */}
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-[0.7rem] font-bold uppercase tracking-[0.14em] text-landing-accent">
            <NotebookPen className="h-3.5 w-3.5" aria-hidden />
            Caderno de Erros
          </p>
          <span className="inline-flex items-center gap-1 rounded-md border border-landing-accent/40 bg-landing-accent/[0.08] px-2 py-1 text-[0.6rem] font-black tracking-[0.18em] text-landing-accent">
            PRO
          </span>
        </div>

        {/* Abas — espelho da TabBar do produto */}
        <div className="mb-5 flex flex-wrap gap-1.5" role="presentation">
          {MOCK_TABS.map((tab, i) => (
            <span
              key={tab}
              className={cn(
                "rounded-full px-3 py-1.5 text-[0.7rem] font-semibold leading-none transition-colors",
                i === 0
                  ? "bg-primary text-primary-foreground shadow-[0_4px_14px_-4px_hsl(var(--primary)/0.6)]"
                  : "border border-white/[0.08] bg-white/[0.03] text-muted-foreground",
              )}
            >
              {tab}
            </span>
          ))}
        </div>

        {/* Domínio — contador animado + barra */}
        <div className="mb-4 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[2rem] font-black leading-none text-foreground">
                <CountUpPercent to={DOMAIN_PCT} />
              </p>
              <p className="mt-1.5 text-[0.7rem] uppercase tracking-[0.12em] text-muted-foreground/65">
                de domínio do caderno
              </p>
            </div>
            <p className="text-right text-[0.7rem] leading-snug text-muted-foreground/72">
              34 de 50 questões
              <br />
              dominadas
            </p>
          </div>
          <div ref={trackRef} className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
            <motion.div
              className="h-full rounded-full bg-gradient-brand-progress"
              initial={false}
              animate={{ width: fillWidth }}
              transition={
                reduced
                  ? { duration: 0 }
                  : { duration: 1.5, ease: [0.22, 1, 0.36, 1] }
              }
              style={{ width: "0%" }}
            />
          </div>
        </div>

        {/* Fila de revisão do dia */}
        <div className="mb-4">
          <p className="mb-2 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground/55">
            Sua fila de revisão
          </p>
          <ul className="space-y-1.5">
            {MOCK_QUEUE.map((q) => (
              <li
                key={`${q.area}-${q.theme}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-2.5"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span
                    className={cn(
                      "h-1.5 w-1.5 shrink-0 rounded-full",
                      q.due === "Hoje" ? "bg-landing-accent" : "bg-muted-foreground/40",
                    )}
                    aria-hidden
                  />
                  <p className="truncate text-[0.78rem] font-semibold text-foreground">
                    {q.area}
                    <span className="ml-1.5 font-normal text-muted-foreground/65">
                      {q.theme}
                    </span>
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-md px-2 py-0.5 text-[0.62rem] font-semibold",
                    q.due === "Hoje"
                      ? "bg-primary/[0.18] text-landing-accent"
                      : "bg-white/[0.05] text-muted-foreground/65",
                  )}
                >
                  {q.due}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Rodapé do mockup — favoritos + diagnóstico */}
        <div className="flex items-center justify-between gap-3 border-t border-white/[0.07] pt-3.5">
          <p className="flex items-center gap-1.5 text-[0.7rem] text-muted-foreground/72">
            <Heart className="h-3 w-3 text-landing-accent/80" aria-hidden />
            12 questões favoritas
          </p>
          <p className="flex items-center gap-1.5 text-[0.7rem] font-medium text-landing-accent">
            <Sparkles className="h-3 w-3" aria-hidden />
            Diagnóstico pronto
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Seção ───────────────────────────────────────────────────────────────────

export function LandingPremium() {
  const reduced = !!useReducedMotion();

  return (
    <section
      id="pro"
      className="relative overflow-hidden py-16 md:py-20 px-4 md:px-6"
      aria-labelledby="premium-heading"
    >
      {/* Atmosfera própria da seção PRO */}
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/25 to-transparent" />
        <div
          className="absolute left-[8%] top-[12%] h-72 w-72 rounded-full blur-3xl"
          style={{ background: "hsl(var(--primary) / 0.07)" }}
        />
        <div
          className="absolute bottom-[6%] right-[4%] h-80 w-80 rounded-full blur-3xl"
          style={{ background: "hsl(var(--landing-accent-mid) / 0.06)" }}
        />
      </div>

      <div className="mx-auto max-w-[1280px]">
        <motion.header
          variants={headerReveal}
          initial="hidden"
          whileInView="show"
          viewport={VIEWPORT_HEADER}
          className="mb-12 md:mb-14"
        >
          <motion.div variants={headerItemReveal} className="mb-4">
            <span className="inline-flex items-center gap-2 rounded-full border border-landing-accent/35 bg-landing-accent/[0.08] px-4 py-1.5 text-overline font-semibold uppercase tracking-[0.14em] text-landing-accent">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              Exclusivo SanarFlix PRO
            </span>
          </motion.div>
          <motion.h2
            variants={headerItemReveal}
            id="premium-heading"
            className="w-full max-w-[18ch] text-heading-1 font-bold leading-tight tracking-tight text-foreground md:text-[2.5rem] lg:text-[3rem]"
          >
            Seus erros viram o seu{" "}
            <span className="text-gradient-wine-impact inline-block pb-1 font-extrabold tracking-tight">
              maior atalho
            </span>
            .
          </motion.h2>
          <motion.p
            variants={headerItemReveal}
            className="mt-4 w-full max-w-[58ch] text-body-lg leading-relaxed text-muted-foreground"
          >
            O Caderno de Erros guarda cada questão que você errou e devolve no
            momento certo: revisão espaçada, treino cronometrado e um plano de
            reta final montado para a sua prova.
          </motion.p>
        </motion.header>

        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-12 xl:gap-16">
          {/* Pilares PRO */}
          <motion.ul
            variants={containerReveal}
            initial="hidden"
            whileInView="show"
            viewport={VIEWPORT_REVEAL}
            className="space-y-3"
          >
            {PRO_PILLARS.map((pillar) => {
              const Icon = pillar.icon;
              return (
                <motion.li
                  key={pillar.id}
                  variants={itemRevealLeft}
                  whileHover={
                    reduced
                      ? undefined
                      : { x: 4, transition: { duration: DURATION_FAST, ease: EASE } }
                  }
                  className="group flex items-start gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4 transition-colors duration-300 hover:border-primary/[0.32] hover:bg-white/[0.045] sm:p-5"
                >
                  <div
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-primary/[0.25] bg-primary/[0.12] text-landing-accent transition-colors duration-300 group-hover:border-primary/[0.45] group-hover:bg-primary/[0.2]"
                    style={{ boxShadow: "0 0 18px rgba(142,31,61,0.16)" }}
                    aria-hidden
                  >
                    <Icon className="h-5 w-5" strokeWidth={2.1} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="mb-1 text-[1rem] font-semibold leading-snug text-foreground">
                      {pillar.title}
                    </h3>
                    <p className="text-body-sm leading-relaxed text-muted-foreground">
                      {pillar.description}
                    </p>
                  </div>
                </motion.li>
              );
            })}
          </motion.ul>

          {/* Mockup do produto */}
          <motion.div
            initial={reduced ? false : { opacity: 0, y: 28, scale: 0.98 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={VIEWPORT_REVEAL}
            transition={{ duration: 0.6, ease: EASE }}
            className="relative mx-auto w-full max-w-[480px] lg:max-w-none"
          >
            <CadernoMockup reduced={reduced} />
          </motion.div>
        </div>

        <motion.div
          initial={reduced ? false : { opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={VIEWPORT_REVEAL}
          transition={{ duration: DURATION_NORMAL, ease: EASE }}
          className="mt-12 flex flex-col items-center gap-3 text-center"
        >
          <Button
            size="lg"
            className="min-h-[52px] rounded-full bg-primary px-8 font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-all duration-300 hover:-translate-y-0.5 hover:bg-wine-hover hover:shadow-xl hover:shadow-primary/30"
            asChild
          >
            <Link
              to="/login"
              onClick={() => trackEvent("lead_captured", { source: "landing_pro_cta" })}
            >
              Conhecer o SanarFlix PRO
            </Link>
          </Button>
          <p className="text-caption text-muted-foreground/72">
            Incluído na assinatura SanarFlix PRO, junto com todo o ecossistema Sanar.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
