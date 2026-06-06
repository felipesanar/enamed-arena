/**
 * RetaFinalSection — showcase da War Room ENAMED (Caderno v2, redesign premium).
 *
 * Rota de sandbox: /sandbox/caderno-v3
 * Renderiza TODOS os estados da Reta Final com mock data para QA no browser
 * sem auth — NÃO usa Supabase.
 *
 * Estados cobertos:
 *   1. Loading (skeleton)
 *   2. Prova já passou (ExamPassed)
 *   3. Caderno vazio (EmptyNotebook)
 *   4. Em dia — sem pendências hoje (UpToDate)
 *   5. Normal — com questões hoje + dias seguintes
 *   6. Plano com entradas descobertas (uncovered > 0)
 *
 * Toggle desktop/mobile e light/dark delegado ao parent (ShellSection ou CadernoV3ShowcasePage).
 */

import "@/components/caderno/ui/caderno-theme.css";

import { useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen,
  Target,
  Zap,
  CalendarCheck2,
  Trophy,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

import {
  SectionHeader,
  CadernoEmptyState,
  CadernoSkeleton,
  BottomActionBar,
} from "@/components/caderno/ui";

import { RetaFinalHero } from "@/components/caderno/retafinal/RetaFinalHero";
import { DayPlanCard } from "@/components/caderno/retafinal/DayPlanCard";
import type { RetaFinalStats, DayPlan, RetaFinalEntry } from "@/lib/retaFinalPlan";

// ─── Mock data ────────────────────────────────────────────────────────────────

const TODAY = new Date();
function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  r.setHours(0, 0, 0, 0);
  return r;
}

const MOCK_ENTRIES_TODAY: RetaFinalEntry[] = [
  {
    id: "e1",
    area: "Cardiologia",
    theme: "Síndrome Coronariana Aguda — IAMCSST",
    reason: "did_not_know",
    srs_due_at: new Date(Date.now() - 86400000).toISOString(),
    srs_reps: 0,
    srs_lapses: 2,
    mastered_at: null,
  },
  {
    id: "e2",
    area: "Neurologia",
    theme: "AVC Isquêmico — janela terapêutica",
    reason: "did_not_remember",
    srs_due_at: new Date(Date.now() - 3600000).toISOString(),
    srs_reps: 1,
    srs_lapses: 1,
    mastered_at: null,
  },
  {
    id: "e3",
    area: "Pediatria",
    theme: "Desidratação — classificação OMS",
    reason: "reading_error",
    srs_due_at: new Date(Date.now() - 7200000).toISOString(),
    srs_reps: 0,
    srs_lapses: 0,
    mastered_at: null,
  },
  {
    id: "e4",
    area: "Clínica Médica",
    theme: "Pneumonia — agentes etiológicos",
    reason: "confused_alternatives",
    srs_due_at: new Date(Date.now() - 10800000).toISOString(),
    srs_reps: 2,
    srs_lapses: 3,
    mastered_at: null,
  },
  {
    id: "e5",
    area: "Cirurgia Geral",
    theme: "Abdome agudo — apendicite",
    reason: "guessed_correctly",
    srs_due_at: new Date(Date.now() - 5400000).toISOString(),
    srs_reps: 0,
    srs_lapses: 1,
    mastered_at: null,
  },
  {
    id: "e6",
    area: "Ginecologia",
    theme: "Pré-eclâmpsia — critérios de gravidade",
    reason: "did_not_know",
    srs_due_at: new Date(Date.now() - 2700000).toISOString(),
    srs_reps: 0,
    srs_lapses: 0,
    mastered_at: null,
  },
];

const MOCK_ENTRIES_FUTURE: RetaFinalEntry[] = [
  {
    id: "f1",
    area: "Psiquiatria",
    theme: "Transtorno bipolar — diagnóstico diferencial",
    reason: "did_not_remember",
    srs_due_at: addDays(TODAY, 1).toISOString(),
    srs_reps: 1,
    srs_lapses: 0,
    mastered_at: null,
  },
  {
    id: "f2",
    area: "Endocrinologia",
    theme: "Diabetes tipo 2 — metas glicêmicas",
    reason: "did_not_know",
    srs_due_at: addDays(TODAY, 1).toISOString(),
    srs_reps: 0,
    srs_lapses: 1,
    mastered_at: null,
  },
  {
    id: "f3",
    area: "Ortopedia",
    theme: "Fraturas do quadril — classificação",
    reason: "confused_alternatives",
    srs_due_at: addDays(TODAY, 2).toISOString(),
    srs_reps: 2,
    srs_lapses: 0,
    mastered_at: null,
  },
  {
    id: "f4",
    area: "Dermatologia",
    theme: "Melanoma — estadiamento",
    reason: "reading_error",
    srs_due_at: addDays(TODAY, 3).toISOString(),
    srs_reps: 0,
    srs_lapses: 0,
    mastered_at: null,
  },
];

function makeDayPlan(date: Date, entries: RetaFinalEntry[]): DayPlan {
  return { date, entries };
}

const MOCK_STATS_NORMAL: RetaFinalStats = {
  totalActive: 22,
  overdue: 6,
  mastered: 8,
  covered: 18,
  uncovered: 4,
  daysUntil: 175,
};

const MOCK_STATS_GOOD: RetaFinalStats = {
  totalActive: 12,
  overdue: 0,
  mastered: 18,
  covered: 12,
  uncovered: 0,
  daysUntil: 89,
};

const MOCK_STATS_EXAM_CLOSE: RetaFinalStats = {
  totalActive: 35,
  overdue: 18,
  mastered: 5,
  covered: 25,
  uncovered: 10,
  daysUntil: 7,
};

const MOCK_PLANS_NORMAL: DayPlan[] = [
  makeDayPlan(addDays(TODAY, 0), MOCK_ENTRIES_TODAY),
  makeDayPlan(addDays(TODAY, 1), MOCK_ENTRIES_FUTURE.slice(0, 2)),
  makeDayPlan(addDays(TODAY, 2), MOCK_ENTRIES_FUTURE.slice(2, 3)),
  makeDayPlan(addDays(TODAY, 3), MOCK_ENTRIES_FUTURE.slice(3, 4)),
  makeDayPlan(addDays(TODAY, 4), []),
  makeDayPlan(addDays(TODAY, 5), MOCK_ENTRIES_TODAY.slice(0, 2)),
];

// ─── Sub-seção helper ─────────────────────────────────────────────────────────

function SectionLabel({ label }: { label: string }) {
  return (
    <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--c-muted)]">
      {label}
    </p>
  );
}

function Divider() {
  return <div className="h-px bg-[var(--c-border)]" aria-hidden />;
}

// ─── CTA reutilizável ────────────────────────────────────────────────────────

function PrimaryCta({
  to,
  icon: Icon,
  children,
}: {
  to: string;
  icon: React.FC<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "inline-flex items-center gap-2 rounded-[var(--c-radius-control)] px-5 py-2.5",
        "text-[13px] font-bold text-white no-underline",
        "[background:var(--c-gradient-brand)]",
        "shadow-[var(--c-shadow-glow)]",
        "hover:brightness-110 transition-all active:scale-[0.99]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-wine-400)]/50",
      )}
    >
      <Icon className="h-4 w-4" aria-hidden />
      {children}
    </Link>
  );
}

// ─── Upcoming days helper (mesmo da página real) ─────────────────────────────

function UpcomingDays({ plans }: { plans: DayPlan[] }) {
  const [showAll, setShowAll] = useState(false);
  const PREVIEW = 3;
  const displayed = showAll ? plans : plans.slice(0, PREVIEW);
  const hasMore = plans.length > PREVIEW;

  return (
    <div className="space-y-2.5">
      <AnimatePresence initial={false}>
        {displayed.map((dayPlan, idx) => (
          <motion.div
            key={dayPlan.date.getTime()}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.22, delay: idx * 0.03, ease: [0.22, 1, 0.36, 1] }}
          >
            <DayPlanCard date={dayPlan.date} entries={dayPlan.entries} isToday={false} previewLimit={3} />
          </motion.div>
        ))}
      </AnimatePresence>
      {hasMore && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="flex w-full items-center justify-center gap-1.5 py-2 text-[12px] font-semibold text-[var(--c-muted)] hover:text-[var(--c-ink)] transition-colors"
        >
          {showAll ? (
            <><ChevronUp className="h-4 w-4" aria-hidden />Ver menos dias</>
          ) : (
            <><ChevronDown className="h-4 w-4" aria-hidden />Ver mais {plans.length - PREVIEW} dias</>
          )}
        </button>
      )}
    </div>
  );
}

// ─── Estado 1: Loading ────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="caderno-root space-y-4">
      <SectionLabel label="Estado 1 — carregando (skeleton)" />
      <CadernoSkeleton count={3} />
    </div>
  );
}

// ─── Estado 2: Prova passou ───────────────────────────────────────────────────

function ExamPassedScenario() {
  return (
    <div className="caderno-root space-y-4">
      <SectionLabel label="Estado 2 — prova já aconteceu" />
      <CadernoEmptyState
        className="mx-auto max-w-xl"
        icon={<CalendarCheck2 className="h-8 w-8 text-[var(--c-wine-500)]" aria-hidden />}
        title="O ENAMED já aconteceu!"
        description="O War Room estará disponível no próximo ciclo. Continue revisando seu caderno de erros para manter o ritmo."
        action={<PrimaryCta to="/caderno" icon={BookOpen}>Ir para o Caderno</PrimaryCta>}
      />
    </div>
  );
}

// ─── Estado 3: Caderno vazio ──────────────────────────────────────────────────

function EmptyNotebookScenario() {
  return (
    <div className="caderno-root space-y-4">
      <SectionLabel label="Estado 3 — caderno vazio" />
      <CadernoEmptyState
        className="mx-auto max-w-xl"
        icon={<Target className="h-8 w-8 text-[var(--c-wine-500)]" aria-hidden />}
        title="Caderno vazio"
        description="O War Room monta seu plano com base nas questões do seu Caderno de Erros. Adicione questões na correção do simulado para ativar o plano."
        action={<PrimaryCta to="/simulados" icon={Zap}>Ver simulados disponíveis</PrimaryCta>}
      />
    </div>
  );
}

// ─── Estado 4: Em dia (sem pendências hoje) ────────────────────────────────

function UpToDateScenario() {
  return (
    <div className="caderno-root space-y-6">
      <SectionLabel label="Estado 4 — em dia (sem pendências hoje)" />
      <RetaFinalHero daysUntil={MOCK_STATS_GOOD.daysUntil} stats={MOCK_STATS_GOOD} />
      <div className="space-y-3">
        <SectionHeader title="Hoje" />
        <CadernoEmptyState
          variant="celebratory"
          icon={<Trophy className="h-8 w-8 text-[var(--c-wine-500)]" aria-hidden />}
          title="Você está em dia!"
          description={`Nenhuma revisão pendente para hoje. Continue assim — faltam ${MOCK_STATS_GOOD.daysUntil} dias para o ENAMED.`}
        />
      </div>
    </div>
  );
}

// ─── Estado 5: Normal (hero + hoje + timeline) ────────────────────────────────

function NormalScenario() {
  const todayPlan = MOCK_PLANS_NORMAL[0];
  const upcoming = MOCK_PLANS_NORMAL.slice(1);

  return (
    <div className="caderno-root space-y-6">
      <SectionLabel label="Estado 5 — normal (175 dias, 6 questões hoje, 4 dias seguintes)" />

      <RetaFinalHero daysUntil={MOCK_STATS_NORMAL.daysUntil} stats={MOCK_STATS_NORMAL} />

      {MOCK_STATS_NORMAL.uncovered > 0 && (
        <motion.p
          className="rounded-[var(--c-radius-control)] border border-orange-200 bg-orange-50 dark:border-orange-900/40 dark:bg-orange-950/20 px-4 py-2.5 text-[12px] text-[var(--c-ink)]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <span className="font-bold text-orange-600 tabular-nums">
            {MOCK_STATS_NORMAL.uncovered}
          </span>{" "}
          questões não caberão no plano antes do ENAMED. Considere aumentar o ritmo diário.
        </motion.p>
      )}

      <div className="space-y-3">
        <SectionHeader
          title={`Hoje, domine estas ${todayPlan.entries.length} questões`}
          description="Questões priorizadas por lapso, peso ENAMED e vencimento."
        />
        <DayPlanCard
          date={todayPlan.date}
          entries={todayPlan.entries}
          isToday
          previewLimit={5}
        />
      </div>

      <div className="space-y-3">
        <SectionHeader
          title="Próximos dias"
          count={upcoming.length}
          description="Toque em qualquer dia para ver as questões agendadas."
        />
        <UpcomingDays plans={upcoming} />
      </div>
    </div>
  );
}

// ─── Estado 6: Reta final próxima (7 dias, alta pressão) ─────────────────────

function ExamCloseScenario() {
  const highPressurePlan: DayPlan[] = Array.from({ length: 7 }, (_, i) =>
    makeDayPlan(addDays(TODAY, i), i === 0 ? MOCK_ENTRIES_TODAY : MOCK_ENTRIES_TODAY.slice(0, 3 - (i % 3))),
  );
  const todayPlan = highPressurePlan[0];
  const upcoming = highPressurePlan.slice(1);

  return (
    <div className="caderno-root space-y-6">
      <SectionLabel label="Estado 6 — reta final (7 dias, alta pressão, descobertas)" />

      <RetaFinalHero daysUntil={MOCK_STATS_EXAM_CLOSE.daysUntil} stats={MOCK_STATS_EXAM_CLOSE} />

      <motion.p
        className="rounded-[var(--c-radius-control)] border border-orange-200 bg-orange-50 dark:border-orange-900/40 dark:bg-orange-950/20 px-4 py-2.5 text-[12px] text-[var(--c-ink)]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <span className="font-bold text-orange-600 tabular-nums">
          {MOCK_STATS_EXAM_CLOSE.uncovered}
        </span>{" "}
        questões não caberão no plano antes do ENAMED. Foque nas mais vencidas.
      </motion.p>

      <div className="space-y-3">
        <SectionHeader
          title={`Hoje, domine estas ${todayPlan.entries.length} questões`}
          description="Atenção especial ao peso ENAMED e lapsos."
        />
        <DayPlanCard date={todayPlan.date} entries={todayPlan.entries} isToday previewLimit={5} />
      </div>

      <div className="space-y-3">
        <SectionHeader title="Próximos dias" count={upcoming.length} />
        <UpcomingDays plans={upcoming} />
      </div>
    </div>
  );
}

// ─── Export principal ─────────────────────────────────────────────────────────

export interface RetaFinalSectionProps {
  /** Viewport simulado: true = 390px (mobile), false = 1120px (desktop) */
  isMobileView?: boolean;
  /** Toggle dark mode */
  isDark?: boolean;
  /** Qual cenário mostrar. Default: mostra todos sequencialmente */
  scenario?: "all" | "loading" | "exam-passed" | "empty" | "up-to-date" | "normal" | "exam-close";
}

export function RetaFinalSection({
  isMobileView = false,
  isDark = false,
  scenario = "all",
}: RetaFinalSectionProps) {
  return (
    <div className={cn("caderno-root", isDark ? "dark" : "")}>
      <div
        className={cn(
          "mx-auto space-y-12 bg-[var(--c-bg)] pb-16 pt-8",
          isMobileView ? "max-w-[390px] px-4" : "max-w-[860px] px-8",
        )}
        style={{ fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}
      >
        {/* Cabeçalho da seção */}
        <div>
          <h2 className="text-heading-2 font-bold text-[var(--c-ink)] mb-1">
            War Room ENAMED — Reta Final
          </h2>
          <p className="text-body text-[var(--c-muted)]">
            Showcase de todos os estados da Reta Final — Caderno de Erros v2 redesign premium.
          </p>
        </div>

        {(scenario === "all" || scenario === "loading") && (
          <>
            <LoadingState />
            {scenario === "all" && <Divider />}
          </>
        )}

        {(scenario === "all" || scenario === "exam-passed") && (
          <>
            <ExamPassedScenario />
            {scenario === "all" && <Divider />}
          </>
        )}

        {(scenario === "all" || scenario === "empty") && (
          <>
            <EmptyNotebookScenario />
            {scenario === "all" && <Divider />}
          </>
        )}

        {(scenario === "all" || scenario === "up-to-date") && (
          <>
            <UpToDateScenario />
            {scenario === "all" && <Divider />}
          </>
        )}

        {(scenario === "all" || scenario === "normal") && (
          <>
            <NormalScenario />
            {scenario === "all" && <Divider />}
          </>
        )}

        {(scenario === "all" || scenario === "exam-close") && (
          <ExamCloseScenario />
        )}

        {/* BottomActionBar demo (mobile only) */}
        {isMobileView && (scenario === "all" || scenario === "normal" || scenario === "exam-close") && (
          <BottomActionBar>
            <Link
              to="/caderno/revisao?mode=due"
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-[var(--c-radius-control)] px-5 py-3",
                "text-[14px] font-bold text-white no-underline",
                "[background:var(--c-gradient-brand)]",
                "shadow-[var(--c-shadow-glow)]",
                "active:scale-[0.99] transition-all",
              )}
            >
              <Zap className="h-4 w-4" aria-hidden />
              Começar revisão de hoje
            </Link>
          </BottomActionBar>
        )}
      </div>
    </div>
  );
}

export default RetaFinalSection;
