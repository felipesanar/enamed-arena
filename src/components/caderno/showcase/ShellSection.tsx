/**
 * ShellSection — showcase da casca premium do Caderno v2.
 *
 * Renderiza com mock data toda a estrutura visual da CadernoPage redesenhada:
 * PageHeaderPremium, TabBar (via SegmentedTabs), FilterBar, QueueSections
 * com NotebookEntryCards, BulkActionBar e estados vazios.
 *
 * Uso: importar em CadernoV3ShowcasePage ou qualquer rota /sandbox/caderno-v3.
 * NÃO usa auth — dados 100% mock.
 *
 * Toggle no parent: dark/light + desktop/mobile (container 390px).
 */

import "@/components/caderno/ui/caderno-theme.css";

import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Play,
  Target,
  Swords,
  CheckSquare,
  Clock,
  BookOpen,
  Zap,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";

import {
  PageHeaderPremium,
  SectionHeader,
  CadernoEmptyState,
  CadernoSkeleton,
  FilterChip,
} from "@/components/caderno/ui";

import { NotebookEntryCard, type NotebookEntry } from "@/components/caderno/NotebookEntryCard";
import { ZeroPendingState } from "@/components/caderno/ZeroPendingState";

/* ── Mock data ────────────────────────────────────────────────────────────── */

const NOW = new Date().toISOString();
const DUE_TODAY = new Date(Date.now() - 1000).toISOString(); // past = due
const DUE_FUTURE_5 = new Date(Date.now() + 5 * 86_400_000).toISOString();
const DUE_FUTURE_20 = new Date(Date.now() + 20 * 86_400_000).toISOString();

const MOCK_ENTRIES: NotebookEntry[] = [
  {
    id: "1",
    questionId: "q1",
    simuladoId: "s1",
    simuladoTitle: "ENAMED 2024 — Clínica Médica",
    area: "Cardiologia",
    theme: "Síndrome Coronariana Aguda",
    questionNumber: 14,
    reason: "did_not_know",
    learningNote: "STEMI: supra de ST ≥1mm em ≥2 derivações contíguas ou BREB novo.",
    wasCorrect: false,
    addedAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
    resolvedAt: null,
    nextReviewAt: DUE_TODAY,
    srsDueAt: DUE_TODAY,
    srsReps: 0,
    srsInterval: 0,
    masteredAt: null,
    questionText:
      "Paciente de 62 anos, diabético, chega ao PS com dor torácica há 2h irradiando para MSE. ECG mostra supra de ST em V1-V4. Qual a conduta imediata?",
  },
  {
    id: "2",
    questionId: "q2",
    simuladoId: "s1",
    simuladoTitle: "ENAMED 2024 — Clínica Médica",
    area: "Neurologia",
    theme: "AVC Isquêmico",
    questionNumber: 27,
    reason: "did_not_remember",
    learningNote: null,
    wasCorrect: false,
    addedAt: new Date(Date.now() - 5 * 86_400_000).toISOString(),
    resolvedAt: null,
    nextReviewAt: DUE_TODAY,
    srsDueAt: DUE_TODAY,
    srsReps: 1,
    srsInterval: 1,
    masteredAt: null,
    questionText:
      "Janela terapêutica para trombólise com rt-PA no AVC isquêmico é de até quantas horas após o início dos sintomas?",
  },
  {
    id: "3",
    questionId: "q3",
    simuladoId: "s2",
    simuladoTitle: "ENAMED 2023 — Cirurgia",
    area: "Cirurgia Geral",
    theme: "Apendicite Aguda",
    questionNumber: 8,
    reason: "reading_error",
    learningNote: "Atenção ao termo EXCETO nas questões de diagnóstico diferencial.",
    wasCorrect: false,
    addedAt: new Date(Date.now() - 7 * 86_400_000).toISOString(),
    resolvedAt: null,
    nextReviewAt: DUE_FUTURE_5,
    srsDueAt: DUE_FUTURE_5,
    srsReps: 2,
    srsInterval: 5,
    masteredAt: null,
    questionText: null,
  },
  {
    id: "4",
    questionId: "q4",
    simuladoId: "s2",
    simuladoTitle: "ENAMED 2023 — Cirurgia",
    area: "Ortopedia",
    theme: "Fraturas do Quadril",
    questionNumber: 33,
    reason: "confused_alternatives",
    learningNote: null,
    wasCorrect: false,
    addedAt: new Date(Date.now() - 10 * 86_400_000).toISOString(),
    resolvedAt: null,
    nextReviewAt: DUE_FUTURE_20,
    srsDueAt: DUE_FUTURE_20,
    srsReps: 1,
    srsInterval: 20,
    masteredAt: null,
    questionText: null,
  },
  {
    id: "5",
    questionId: "q5",
    simuladoId: "s3",
    simuladoTitle: "ENAMED 2022 — Pediatria",
    area: "Pediatria",
    theme: "Pneumonia Bacteriana",
    questionNumber: 5,
    reason: "guessed_correctly",
    learningNote: "Streptococcus pneumoniae é o principal agente em > 5 anos.",
    wasCorrect: true,
    addedAt: new Date(Date.now() - 14 * 86_400_000).toISOString(),
    resolvedAt: NOW,
    nextReviewAt: null,
    srsDueAt: null,
    srsReps: 3,
    srsInterval: 30,
    masteredAt: NOW,
    questionText: null,
  },
];

const BUCKETS = {
  devidas: MOCK_ENTRIES.filter((e) => e.id === "1" || e.id === "2"),
  emAprendizado: MOCK_ENTRIES.filter((e) => e.id === "3"),
  agendadas: MOCK_ENTRIES.filter((e) => e.id === "4"),
  dominadas: MOCK_ENTRIES.filter((e) => e.id === "5"),
};

const HEADER_STATS = [
  { label: "Pendentes", value: 3, color: "#f59e0b" },
  { label: "Dominadas", value: 1, color: "#16a34a" },
  { label: "Total", value: 5 },
  { label: "Especialidades", value: 4 },
  { label: "3 dias seguidos", value: 3, color: "#f97316" },
];

const CAUSE_FILTERS = [
  { label: "Todos", count: 5, active: true },
  { label: "Lacuna", count: 1, active: false },
  { label: "Memória", count: 1, active: false },
  { label: "Atenção", count: 1, active: false },
  { label: "Diferencial", count: 1, active: false },
  { label: "Chute", count: 1, active: false },
];

/* ── ShellSection ─────────────────────────────────────────────────────────── */

export interface ShellSectionProps {
  /** Viewport simulado: true = 390px (mobile), false = 1120px (desktop) */
  isMobileView?: boolean;
  /** Toggle dark mode */
  isDark?: boolean;
  /** Qual estado mostrar: 'default' | 'loading' | 'empty' | 'zero-pending' | 'no-filter-result' */
  scenario?: "default" | "loading" | "empty" | "zero-pending" | "no-filter-result";
}

export function ShellSection({
  isMobileView = false,
  isDark = false,
  scenario = "default",
}: ShellSectionProps) {
  const [activeFilter, setActiveFilter] = useState("Todos");
  const [showDominadas, setShowDominadas] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const isSelectMode = selectedIds.size > 0;

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const noop = () => {};

  return (
    <div className={cn("caderno-root", isDark ? "dark" : "")}>
      <div
        className={cn(
          "mx-auto space-y-5 pb-10",
          isMobileView ? "max-w-[390px]" : "max-w-[1120px]",
        )}
        style={{ fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}
      >
        {/* ── SCENARIO: Loading ── */}
        {scenario === "loading" && <CadernoSkeleton count={4} />}

        {/* ── SCENARIO: Empty (zero entries ever) ── */}
        {scenario === "empty" && (
          <CadernoEmptyState
            className="mx-auto max-w-xl"
            icon={<BookOpen className="h-8 w-8 text-[var(--c-muted)]" />}
            title="Seu Caderno está vazio"
            description={'Na correção do simulado, toque em "Salvar no Caderno" para adicionar questões que quer dominar.'}
            action={
              <span
                className={cn(
                  "inline-flex items-center gap-2 rounded-[var(--c-radius-control)] px-5 py-2.5 text-[13px] font-bold text-white cursor-pointer",
                  "bg-gradient-to-br from-[var(--c-wine-500)] to-[var(--c-wine-700)]",
                  "shadow-[var(--c-shadow-glow)]",
                )}
              >
                <Zap className="h-4 w-4" aria-hidden />
                Ver simulados disponíveis
              </span>
            }
          />
        )}

        {/* ── SCENARIO: Zero pending ── */}
        {scenario === "zero-pending" && (
          <>
            <PageHeaderPremium
              title="Caderno de Erros"
              subtitle="Revise suas questões organizadas por causa e especialidade."
              stats={[
                { label: "Pendentes", value: 0, color: "#f59e0b" },
                { label: "Dominadas", value: 5, color: "#16a34a" },
                { label: "Total", value: 5 },
              ]}
            />
            <ZeroPendingState
              resolvedCount={5}
              streak={7}
              nextDueAt={DUE_FUTURE_5}
              onShowResolved={() => setShowDominadas(true)}
            />
          </>
        )}

        {/* ── SCENARIO: No filter result ── */}
        {scenario === "no-filter-result" && (
          <>
            <PageHeaderPremium
              title="Caderno de Erros"
              stats={HEADER_STATS}
            />
            <div className="flex gap-1.5 flex-wrap">
              {CAUSE_FILTERS.map((f) => (
                <FilterChip
                  key={f.label}
                  label={f.label}
                  count={f.count}
                  active={activeFilter === f.label}
                  onClick={() => setActiveFilter(f.label)}
                />
              ))}
            </div>
            <CadernoEmptyState
              title="Nenhuma questão encontrada"
              description="Nenhuma questão corresponde aos filtros selecionados."
              action={
                <button
                  type="button"
                  onClick={() => setActiveFilter("Todos")}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-[var(--c-radius-control)] border border-[var(--c-border)] bg-[var(--c-surface)] px-4 py-2 text-[12px] font-semibold text-[var(--c-muted)]",
                    "transition-colors hover:border-[var(--c-wine-300)] hover:text-[var(--c-ink)]",
                  )}
                >
                  Limpar filtros
                </button>
              }
            />
          </>
        )}

        {/* ── SCENARIO: Default (full shell) ── */}
        {scenario === "default" && (
          <>
            {/* PageHeaderPremium */}
            <PageHeaderPremium
              title="Caderno de Erros"
              subtitle="Revise suas questões organizadas por causa e especialidade."
              stats={HEADER_STATS}
              primaryAction={
                <span
                  className={cn(
                    "inline-flex items-center gap-2 rounded-[var(--c-radius-control)] px-5 py-2.5 text-[13px] font-bold text-white cursor-pointer",
                    "bg-gradient-to-br from-[var(--c-wine-500)] to-[var(--c-wine-700)]",
                    "shadow-[var(--c-shadow-glow)] transition-all hover:-translate-y-0.5",
                  )}
                >
                  <Play className="h-3.5 w-3.5 fill-current" aria-hidden />
                  Iniciar revisão
                </span>
              }
            />

            {/* CTAs secundários */}
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn(
                "inline-flex items-center gap-1.5 rounded-[var(--c-radius-control)] border border-[var(--c-border)] bg-[var(--c-surface)] px-3 py-1.5",
                "text-[12px] font-semibold text-[var(--c-muted)] cursor-pointer",
                "hover:border-[var(--c-wine-300)] hover:text-[var(--c-ink)]",
              )}>
                <Target className="h-3.5 w-3.5 shrink-0" aria-hidden />
                Treinar pontos fracos
              </span>
              <span className={cn(
                "inline-flex items-center gap-1.5 rounded-[var(--c-radius-control)] border border-[var(--c-wine-300)] bg-[var(--c-wine-50)] text-[var(--c-wine-700)] px-3 py-1.5",
                "text-[12px] font-semibold cursor-pointer dark:bg-[var(--c-wine-900)]/30 dark:text-[var(--c-wine-300)]",
              )}>
                <Swords className="h-3.5 w-3.5 shrink-0" aria-hidden />
                Reta Final ENAMED
                <span className="ml-0.5 inline-flex items-center gap-0.5 rounded-full bg-[var(--c-wine-500)] px-1.5 py-0.5 text-[10px] font-bold text-white">
                  <Clock className="h-2.5 w-2.5" aria-hidden />
                  175d
                </span>
              </span>
            </div>

            {/* Filtros */}
            <div className="flex items-center gap-3">
              <div className="flex gap-1.5 flex-wrap flex-1">
                {CAUSE_FILTERS.map((f) => (
                  <FilterChip
                    key={f.label}
                    label={f.label}
                    count={f.count}
                    active={activeFilter === f.label}
                    onClick={() => setActiveFilter(f.label)}
                  />
                ))}
              </div>
              {/* Selecionar */}
              <button
                type="button"
                aria-pressed={isSelectMode}
                onClick={() => { if (isSelectMode) setSelectedIds(new Set()); }}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-[var(--c-radius-control)] border px-3 py-2 text-[12px] font-semibold",
                  isSelectMode
                    ? "border-[var(--c-wine-400)] bg-[var(--c-wine-50)] text-[var(--c-wine-700)] dark:bg-[var(--c-wine-900)]/30"
                    : "border-[var(--c-border)] bg-[var(--c-surface)] text-[var(--c-muted)] hover:border-[var(--c-wine-300)] hover:text-[var(--c-ink)]",
                )}
              >
                <CheckSquare className="h-3.5 w-3.5" aria-hidden />
                <span className="hidden sm:inline">{isSelectMode ? "Selecionando" : "Selecionar"}</span>
                {isSelectMode && (
                  <span className="ml-0.5 rounded-full bg-[var(--c-wine-500)] px-1.5 py-0.5 text-[10px] font-bold text-white tabular-nums">
                    {selectedIds.size}
                  </span>
                )}
              </button>
            </div>

            {/* CTA sessão de revisão */}
            <div className={cn(
              "relative flex items-center justify-between gap-4 overflow-hidden rounded-[var(--c-radius-card)]",
              "border border-[var(--c-wine-300)]/30 bg-gradient-to-r from-[var(--c-wine-50)] via-[var(--c-surface)] to-[var(--c-surface)]",
              "dark:from-[var(--c-wine-900)]/20 dark:via-[var(--c-surface)] dark:border-[var(--c-wine-700)]/30",
              "px-5 py-4 shadow-[var(--c-shadow-sm)]",
            )}>
              <div className="flex min-w-0 items-center gap-3">
                <div className="h-11 w-11 shrink-0 rounded-full bg-[var(--c-surface-2)] border-2 border-[var(--c-surface)] flex items-center justify-center text-lg">
                  👨‍⚕️
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] font-bold text-[var(--c-ink)]">Modo revisão com Prof. San</p>
                  <p className="text-[12px] text-[var(--c-muted)]">Revise 3 questões pendentes com análise de IA.</p>
                </div>
              </div>
              <span className={cn(
                "hidden shrink-0 items-center gap-1.5 rounded-[var(--c-radius-control)] px-4 py-2 text-[13px] font-bold text-white sm:flex",
                "bg-gradient-to-br from-[var(--c-wine-500)] to-[var(--c-wine-700)]",
                "shadow-[var(--c-shadow-glow)]",
              )}>
                <Play className="h-3.5 w-3.5 fill-current" aria-hidden />
                Iniciar sessão
              </span>
            </div>

            {/* ── Devidas hoje ── */}
            <div className="space-y-3">
              <SectionHeader title="Devidas hoje" count={BUCKETS.devidas.length} />
              <motion.div
                className="flex flex-col gap-2"
                initial="hidden"
                animate="visible"
                variants={{
                  visible: { transition: { staggerChildren: 0.04 } },
                  hidden: {},
                }}
              >
                {BUCKETS.devidas.map((entry) => (
                  <motion.div
                    key={entry.id}
                    variants={{
                      hidden: { opacity: 0, y: 8 },
                      visible: { opacity: 1, y: 0, transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] } },
                    }}
                  >
                    <NotebookEntryCard
                      entry={entry}
                      onRemove={noop}
                      onToggleMastered={noop}
                      onSnooze={noop}
                      selectable={isSelectMode}
                      selected={selectedIds.has(entry.id)}
                      onToggleSelect={handleToggleSelect}
                    />
                  </motion.div>
                ))}
              </motion.div>
            </div>

            {/* ── Em aprendizado ── */}
            <div className="space-y-3">
              <SectionHeader title="Em aprendizado" count={BUCKETS.emAprendizado.length} />
              <div className="flex flex-col gap-2">
                {BUCKETS.emAprendizado.map((entry) => (
                  <NotebookEntryCard
                    key={entry.id}
                    entry={entry}
                    onRemove={noop}
                    onToggleMastered={noop}
                    onSnooze={noop}
                    selectable={isSelectMode}
                    selected={selectedIds.has(entry.id)}
                    onToggleSelect={handleToggleSelect}
                  />
                ))}
              </div>
            </div>

            {/* ── Agendadas ── */}
            <div className="space-y-3">
              <SectionHeader title="Agendadas" count={BUCKETS.agendadas.length} />
              <div className="flex flex-col gap-2">
                {BUCKETS.agendadas.map((entry) => (
                  <NotebookEntryCard
                    key={entry.id}
                    entry={entry}
                    onRemove={noop}
                    onToggleMastered={noop}
                    onSnooze={noop}
                    selectable={isSelectMode}
                    selected={selectedIds.has(entry.id)}
                    onToggleSelect={handleToggleSelect}
                  />
                ))}
              </div>
            </div>

            {/* ── Dominadas ── */}
            <div>
              {!showDominadas ? (
                <button
                  type="button"
                  onClick={() => setShowDominadas(true)}
                  className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[var(--c-muted)] hover:text-[var(--c-ink)]"
                >
                  Ver {BUCKETS.dominadas.length} dominada
                </button>
              ) : (
                <div className="space-y-3">
                  <SectionHeader
                    title="Dominadas"
                    count={BUCKETS.dominadas.length}
                    action={
                      <button
                        type="button"
                        onClick={() => setShowDominadas(false)}
                        className="text-[12px] font-semibold text-[var(--c-muted)] hover:text-[var(--c-ink)]"
                      >
                        Ocultar
                      </button>
                    }
                  />
                  <div className="flex flex-col gap-2">
                    {BUCKETS.dominadas.map((entry) => (
                      <NotebookEntryCard
                        key={entry.id}
                        entry={entry}
                        variant="compact"
                        onRemove={noop}
                        onToggleMastered={noop}
                        onSnooze={noop}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default ShellSection;
