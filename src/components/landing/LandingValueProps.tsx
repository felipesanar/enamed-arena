import { motion } from "framer-motion";
import {
  Timer,
  Activity,
  Trophy,
  ClipboardCheck,
  TrendingUp,
  Layers,
  BookMarked,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
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
import { cn } from "@/lib/utils";

// ─── Data ────────────────────────────────────────────────────────────────────

type Item = {
  id: string;
  icon: LucideIcon;
  tag: string;
  title: string;
  description: string;
  featured: boolean;
};

const ITEMS: Item[] = [
  {
    id: "exp",
    icon: Timer,
    tag: "PROVA REAL",
    title: "Experiência premium de prova",
    description:
      "Interface pensada para concentração e performance. Tempo real, marcação de questões e ambiente que simula a prova de verdade.",
    featured: true,
  },
  {
    id: "metricas",
    icon: Activity,
    tag: "ANALYTICS",
    title: "Métricas e desempenho detalhado",
    description:
      "Veja seu rendimento por disciplina, tema e tipo de questão. Entenda onde você brilha e onde precisa evoluir.",
    featured: false,
  },
  {
    id: "ranking",
    icon: Trophy,
    tag: "RANKING",
    title: "Ranking e comparativos",
    description:
      "Acompanhe sua posição entre os alunos, por especialidade ou no geral, com visão de percentil e evolução ao longo do tempo.",
    featured: false,
  },
  {
    id: "analise",
    icon: ClipboardCheck,
    tag: "PÓS-PROVA",
    title: "Análise pós-prova",
    description:
      "Correção comentada, justificativas e estatísticas por questão para transformar a revisão em parte real do seu preparo.",
    featured: true,
  },
  {
    id: "evolucao",
    icon: TrendingUp,
    tag: "EVOLUÇÃO",
    title: "Evolução entre simulados",
    description:
      "Acompanhe sua curva de desempenho entre uma prova e outra. Objetivos claros e próximos passos sugeridos.",
    featured: false,
  },
  {
    id: "sanar",
    icon: Layers,
    tag: "INTEGRAÇÃO PRO",
    title: "Integração SanarFlix e PRO",
    description:
      "Conteúdo e trilhas do ecossistema Sanar alinhados ao seu desempenho. Preparação que conversa com a prova.",
    featured: false,
  },
  {
    id: "caderno",
    icon: BookMarked,
    tag: "CADERNO PRO",
    title: "Caderno de erros e continuidade",
    description:
      "Recursos premium para revisar o que errou e consolidar. Estudo inteligente baseado na sua performance.",
    featured: false,
  },
];

// ─── Inline platform UI mockups ───────────────────────────────────────────────

/** Mini exam interface — card 01 */
function ExamPreview() {
  const options = [
    { w: "90%", selected: false },
    { w: "100%", selected: true },
    { w: "78%", selected: false },
    { w: "84%", selected: false },
  ];
  return (
    <div
      className="absolute bottom-0 right-0 w-[150px] pointer-events-none select-none opacity-[0.22] group-hover:opacity-[0.42] transition-opacity duration-500"
      aria-hidden
    >
      <div className="rounded-t-xl border-t border-x border-white/[0.09] bg-[#120508] p-3 shadow-xl">
        {/* Top bar */}
        <div className="flex justify-between items-center mb-2 pb-1.5 border-b border-white/[0.06]">
          <div className="flex items-center gap-1">
            <span className="text-[6px] text-white/40">Questão</span>
            <span className="text-[6px] font-bold text-white/75">23</span>
            <span className="text-[6px] text-white/30">/ 60</span>
          </div>
          <span className="text-[6px] font-mono font-bold text-landing-accent">◷ 01:24:03</span>
        </div>
        {/* Progress bar */}
        <div className="h-[2px] bg-white/[0.07] rounded-full mb-2.5 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[hsl(345,65%,38%)] to-[hsl(351,55%,55%)]"
            style={{ width: "38%" }}
          />
        </div>
        {/* Options */}
        <div className="flex flex-col gap-1.5">
          {options.map((opt, i) => (
            <div
              key={i}
              className="h-[7px] rounded-[3px]"
              style={{
                width: opt.w,
                background: opt.selected
                  ? "rgba(142,31,61,0.40)"
                  : "rgba(255,255,255,0.05)",
                outline: opt.selected ? "1px solid rgba(181,67,97,0.50)" : "none",
              }}
            />
          ))}
        </div>
        {/* Bottom action strip */}
        <div className="mt-2.5 flex gap-1.5">
          <div className="h-[5px] flex-1 rounded-full bg-white/[0.04]" />
          <div className="h-[5px] w-10 rounded-full bg-[rgba(142,31,61,0.25)]" />
        </div>
      </div>
    </div>
  );
}

/** Mini correction view — card 04 */
function AnalysisPreview() {
  return (
    <div
      className="absolute bottom-0 right-0 w-[138px] pointer-events-none select-none opacity-[0.22] group-hover:opacity-[0.42] transition-opacity duration-500"
      aria-hidden
    >
      <div className="rounded-t-xl border-t border-x border-white/[0.09] bg-[#120508] p-3 shadow-xl">
        {/* Correct answer row */}
        <div className="rounded-lg bg-green-500/[0.10] border border-green-500/[0.22] px-2 py-1.5 mb-1.5">
          <div className="flex items-center gap-1 mb-1">
            <div className="w-2 h-2 rounded-full bg-green-400" />
            <span className="text-[6px] text-green-400 font-semibold">Resposta correta</span>
          </div>
          <div className="h-[3px] bg-white/10 rounded-full mb-1" />
          <div className="h-[3px] bg-white/10 rounded-full w-3/4" />
        </div>
        {/* Justification snippet */}
        <div className="rounded-lg bg-white/[0.04] border border-white/[0.07] px-2 py-1.5 mb-1.5">
          <span className="text-[5px] font-semibold text-landing-accent/80 tracking-widest uppercase block mb-1">
            Justificativa
          </span>
          <div className="h-[3px] bg-white/[0.10] rounded-full mb-1" />
          <div className="h-[3px] bg-white/[0.10] rounded-full mb-1 w-[85%]" />
          <div className="h-[3px] bg-white/[0.10] rounded-full w-[70%]" />
        </div>
        {/* Stats row */}
        <div className="flex gap-1">
          <div className="flex-1 bg-green-500/[0.08] border border-green-500/[0.14] rounded-md px-1 py-0.5 text-center">
            <span className="text-[7px] font-bold text-green-400">68%</span>
          </div>
          <div className="flex-1 bg-red-500/[0.08] border border-red-500/[0.14] rounded-md px-1 py-0.5 text-center">
            <span className="text-[7px] font-bold text-red-400">32%</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Mini bar chart — card 02 */
function MetricsDecor() {
  const bars = [52, 78, 43, 91, 67, 84];
  const maxH = 32;
  return (
    <div
      className="absolute bottom-4 right-4 flex items-end gap-1 pointer-events-none select-none opacity-[0.18] group-hover:opacity-[0.32] transition-opacity duration-500"
      aria-hidden
    >
      {bars.map((v, i) => (
        <div
          key={i}
          className="w-3.5 rounded-t-sm"
          style={{
            height: `${(v / 100) * maxH}px`,
            background:
              i === 3
                ? "hsl(351,55%,58%)"
                : "rgba(255,255,255,0.12)",
          }}
        />
      ))}
    </div>
  );
}

/** Mini ranking list — card 03 */
function RankingDecor() {
  const rows = [
    { pos: "#1", w: "80%", accent: true },
    { pos: "#2", w: "64%", accent: false },
    { pos: "#3", w: "50%", accent: false },
    { pos: "#4", w: "42%", accent: false },
  ];
  return (
    <div
      className="absolute bottom-4 right-4 w-[88px] pointer-events-none select-none opacity-[0.18] group-hover:opacity-[0.32] transition-opacity duration-500"
      aria-hidden
    >
      {rows.map((r) => (
        <div key={r.pos} className="flex items-center gap-1.5 mb-1.5 last:mb-0">
          <span className="text-[6px] font-bold text-white/40 w-4 shrink-0 text-right">{r.pos}</span>
          <div
            className="h-[5px] rounded-full shrink-0"
            style={{
              width: r.w,
              background: r.accent ? "hsl(351,55%,58%)" : "rgba(255,255,255,0.10)",
            }}
          />
        </div>
      ))}
    </div>
  );
}

/** Ascending sparkline — card 05 */
function SparklineDecor() {
  return (
    <div
      className="absolute bottom-4 right-4 pointer-events-none select-none opacity-[0.20] group-hover:opacity-[0.36] transition-opacity duration-500"
      aria-hidden
    >
      <svg width="72" height="36" viewBox="0 0 72 36" fill="none">
        <defs>
          <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(351,55%,58%)" stopOpacity="0.25" />
            <stop offset="100%" stopColor="hsl(351,55%,58%)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d="M0 30 L12 24 L24 26 L36 16 L48 10 L60 6 L72 2"
          stroke="hsl(351,55%,62%)"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M0 30 L12 24 L24 26 L36 16 L48 10 L60 6 L72 2 L72 36 L0 36 Z"
          fill="url(#spark-fill)"
        />
        <circle cx="72" cy="2" r="2.5" fill="hsl(351,55%,62%)" />
      </svg>
    </div>
  );
}

/** PRO badge — card 06 */
function ProDecor() {
  return (
    <div
      className="absolute bottom-4 right-4 pointer-events-none select-none opacity-[0.22] group-hover:opacity-[0.40] transition-opacity duration-500"
      aria-hidden
    >
      <span className="inline-flex items-center gap-1 border border-landing-accent/40 bg-landing-accent/[0.08] text-landing-accent rounded-md px-2 py-1">
        <span className="text-[7px] font-black tracking-[0.18em]">PRO</span>
      </span>
    </div>
  );
}

/** Bookmarked notes — card 07 */
function CadernoDecor() {
  const lines = [
    { w: "85%", marked: false },
    { w: "70%", marked: true },
    { w: "90%", marked: false },
    { w: "60%", marked: true },
    { w: "75%", marked: false },
  ];
  return (
    <div
      className="absolute bottom-4 right-4 w-[68px] pointer-events-none select-none opacity-[0.18] group-hover:opacity-[0.32] transition-opacity duration-500"
      aria-hidden
    >
      {lines.map((l, i) => (
        <div key={i} className="flex items-center gap-1 mb-1.5 last:mb-0">
          <div
            className="h-[4px] rounded-full shrink-0"
            style={{
              width: l.w,
              background: l.marked ? "rgba(248,113,113,0.50)" : "rgba(255,255,255,0.12)",
            }}
          />
        </div>
      ))}
    </div>
  );
}

// ─── Card ────────────────────────────────────────────────────────────────────

const DECOR_MAP: Record<string, JSX.Element> = {
  exp: <ExamPreview />,
  metricas: <MetricsDecor />,
  ranking: <RankingDecor />,
  analise: <AnalysisPreview />,
  evolucao: <SparklineDecor />,
  sanar: <ProDecor />,
  caderno: <CadernoDecor />,
};

function FeatureCard({
  item,
  ordinal,
  className,
}: {
  item: Item;
  ordinal: string;
  className?: string;
}) {
  const Icon = item.icon;
  return (
    <motion.article
      variants={itemReveal}
      whileHover={{ y: -3, transition: { duration: 0.2, ease: EASE } }}
      className={cn(
        "group relative overflow-hidden rounded-2xl border flex flex-col",
        "transition-colors duration-300",
        item.featured
          ? "p-7 lg:p-8 min-h-[230px] border-white/[0.10] hover:border-primary/[0.35] bg-white/[0.05]"
          : "p-5 lg:p-6 min-h-[190px] border-white/[0.07] hover:border-white/[0.16] bg-white/[0.025]",
        className,
      )}
    >
      {/* Featured: deep wine gradient in top-left */}
      {item.featured && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 100% 80% at 0% 0%, rgba(90,20,35,0.55) 0%, transparent 55%)",
          }}
          aria-hidden
        />
      )}

      {/* Top accent line */}
      <div
        className={cn(
          "absolute top-0 inset-x-0 h-px pointer-events-none bg-gradient-to-r transition-opacity duration-300",
          item.featured
            ? "from-[hsl(351,55%,55%)] via-[hsl(345,55%,40%)] to-transparent opacity-70 group-hover:opacity-100"
            : "from-transparent via-white/[0.12] to-transparent opacity-100 group-hover:from-[hsl(351,55%,50%)/0.5] group-hover:via-[hsl(345,55%,38%)/0.25] group-hover:to-transparent",
        )}
        aria-hidden
      />

      {/* Hover glow */}
      <div
        className="absolute -top-14 -left-14 w-44 h-44 rounded-full bg-primary/[0.12] blur-[60px] opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        aria-hidden
      />

      {/* Ordinal — decorative large number behind content */}
      <span
        className="absolute bottom-1 right-3 font-black leading-none text-white/[0.035] select-none pointer-events-none tabular-nums"
        style={{ fontSize: "clamp(52px, 5.5vw, 80px)" }}
        aria-hidden
      >
        {ordinal}
      </span>

      {/* Platform UI decoration */}
      {DECOR_MAP[item.id]}

      {/* Icon */}
      <div
        className={cn(
          "relative z-10 flex items-center justify-center rounded-xl border shrink-0 mb-4",
          "bg-primary/[0.12] border-primary/[0.25]",
          "group-hover:bg-primary/[0.22] group-hover:border-primary/[0.45]",
          "transition-all duration-300",
          item.featured ? "h-11 w-11" : "h-10 w-10",
        )}
        style={{ boxShadow: "0 0 18px rgba(142,31,61,0.18)" }}
      >
        <Icon
          className={cn("text-landing-accent", item.featured ? "h-5 w-5" : "h-4 w-4")}
          aria-hidden
        />
      </div>

      {/* Text content */}
      <div className="relative z-10 flex flex-col flex-1">
        {/* Tag */}
        <p className="text-[8.5px] font-bold tracking-[0.20em] text-landing-accent mb-2 uppercase">
          {item.tag}
        </p>

        {/* Title */}
        <h3
          className={cn(
            "font-semibold text-white leading-snug mb-2.5",
            item.featured ? "text-[1.1rem] md:text-[1.15rem]" : "text-[0.95rem]",
          )}
        >
          {item.title}
        </h3>

        {/* Description */}
        <p className="text-[0.825rem] text-white/68 leading-relaxed">
          {item.description}
        </p>
      </div>
    </motion.article>
  );
}

// ─── Section ─────────────────────────────────────────────────────────────────

export function LandingValueProps() {
  return (
    <section
      id="diferenciais"
      className="relative py-14 md:py-[4.5rem] px-4 md:px-6"
      aria-labelledby="value-props-heading"
    >
      <div className="max-w-[1280px] mx-auto">
        {/* Header */}
        <motion.header
          variants={headerReveal}
          initial="hidden"
          whileInView="show"
          viewport={VIEWPORT_HEADER}
          className="mb-12 flex flex-col lg:flex-row lg:items-end lg:gap-12"
        >
          <div className="flex-1">
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
              className="w-full max-w-none text-heading-1 md:text-[2.5rem] lg:text-[3rem] font-bold text-foreground leading-tight tracking-tight"
            >
              Muito além de um simulado comum.
            </motion.h2>
          </div>
          <div className="lg:w-[320px] lg:shrink-0 lg:border-l lg:border-border/50 lg:pl-8 mt-4 lg:mt-0 lg:pb-1">
            <motion.p
              variants={headerItemReveal}
              className="w-full max-w-none text-body-lg text-muted-foreground leading-relaxed"
            >
              Cada recurso foi planejado para quem busca uma preparação completa, estratégica e com foco em alta performance.
            </motion.p>
          </div>
        </motion.header>

        {/* Availability strip */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={VIEWPORT_REVEAL}
          transition={{ duration: DURATION_NORMAL, ease: EASE }}
          className="mb-8 flex items-center gap-3 flex-wrap"
        >
          <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/25">
            Disponível em
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-primary/[0.30] bg-primary/[0.09] text-[9px] font-semibold text-landing-accent tracking-wide">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" aria-hidden />
            Plataforma online
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-white/[0.10] bg-white/[0.04] text-[9px] font-semibold text-white/45 tracking-wide">
            PDF / Offline
          </span>
          <span className="flex-1 hidden sm:block h-px bg-gradient-to-r from-white/[0.07] to-transparent" aria-hidden />
          <span className="hidden sm:block text-[9px] text-white/25 font-medium tracking-widest uppercase">
            7 recursos exclusivos
          </span>
        </motion.div>

        {/* Bento grid */}
        <motion.div
          variants={containerReveal}
          initial="hidden"
          whileInView="show"
          viewport={VIEWPORT_REVEAL}
          className="grid grid-cols-12 gap-3 md:gap-4"
        >
          {/* Row 1: featured wide (7) + normal (5) */}
          <FeatureCard item={ITEMS[0]} ordinal="01" className="col-span-12 md:col-span-7" />
          <FeatureCard item={ITEMS[1]} ordinal="02" className="col-span-12 md:col-span-5" />

          {/* Row 2: normal (5) + featured wide (7) — reversed */}
          <FeatureCard item={ITEMS[2]} ordinal="03" className="col-span-12 md:col-span-5" />
          <FeatureCard item={ITEMS[3]} ordinal="04" className="col-span-12 md:col-span-7" />

          {/* Row 3: three equal */}
          <FeatureCard item={ITEMS[4]} ordinal="05" className="col-span-12 md:col-span-4" />
          <FeatureCard item={ITEMS[5]} ordinal="06" className="col-span-12 md:col-span-4" />
          <FeatureCard item={ITEMS[6]} ordinal="07" className="col-span-12 md:col-span-4" />
        </motion.div>
      </div>
    </section>
  );
}
