import { useState, useMemo } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

import type { PerformanceBreakdown } from '@/lib/resultHelpers';
import type { Question } from '@/types';
import type { ExamState } from '@/types/exam';
import { StaggerContainer, StaggerItem } from '@/components/premium/PageTransition';
import { usePdfDownload } from '@/hooks/usePdfDownload';

import { SimuladoTabs } from './panel/SimuladoTabs';
import { PerformanceHeroCard } from './panel/PerformanceHeroCard';
import { Breadcrumb } from './panel/Breadcrumb';
import { SectionHeader, AreaGridSection, EmptyDrill } from './panel/primitives';
import { AreaCard } from './panel/AreaCard';
import { ThemeAccordionRow } from './panel/ThemeAccordionRow';
import { SummarySection } from './panel/SummarySection';
import { EvoBarsSection } from './panel/EvoBarsSection';

/* ──────────────────────────────────────────────────────────────────────────
 * Types
 * ────────────────────────────────────────────────────────────────────────── */

export type DesempenhoSimuladoPanelProps = {
  simuladosWithResults: Array<{ id: string; title: string }>;
  selectedSimuladoId: string | null;
  onSelectSimulado: (id: string) => void;
  breakdown: PerformanceBreakdown;
  questions: Question[];
  examState?: ExamState | null;
  studentName?: string;
  resultNavVariant?: 'public' | 'admin';
};

/* ──────────────────────────────────────────────────────────────────────────
 * Panel
 * ────────────────────────────────────────────────────────────────────────── */

export function DesempenhoSimuladoPanel({
  simuladosWithResults,
  selectedSimuladoId,
  onSelectSimulado,
  breakdown,
  questions,
  examState,
  studentName,
  resultNavVariant = 'public',
}: DesempenhoSimuladoPanelProps) {
  const prefersReducedMotion = useReducedMotion();
  const [selectedSpecialty, setSelectedSpecialty] = useState<string | null>(null);
  const [selectedSubspecialty, setSelectedSubspecialty] = useState<string | null>(null);
  const [selectedTheme, setSelectedTheme] = useState<string | null>(null);

  const { overall, byArea, bySubspecialty, byTheme } = breakdown;
  const bestArea = byArea[0] ?? null;
  const worstArea = byArea.length > 1 ? byArea[byArea.length - 1] : null;

  const simuladoTitle = useMemo(
    () => simuladosWithResults.find((s) => s.id === selectedSimuladoId)?.title ?? '',
    [simuladosWithResults, selectedSimuladoId],
  );

  const pdf = usePdfDownload({
    simuladoId: selectedSimuladoId ?? '',
    simuladoTitle,
    studentName: studentName ?? 'Aluno',
    questions,
    examState: examState ?? null,
    breakdown,
  });

  const subspecialtiesForSpecialty = useMemo(
    () =>
      selectedSpecialty
        ? bySubspecialty.filter((s) => s.specialty === selectedSpecialty)
        : [],
    [selectedSpecialty, bySubspecialty],
  );

  const themesForSubspecialty = useMemo(
    () =>
      selectedSpecialty && selectedSubspecialty
        ? byTheme.filter(
            (t) => t.specialty === selectedSpecialty && t.area === selectedSubspecialty,
          )
        : [],
    [selectedSpecialty, selectedSubspecialty, byTheme],
  );

  const questionResultsForTheme = useMemo(() => {
    if (!selectedTheme || !selectedSpecialty || !selectedSubspecialty) return [];
    return breakdown.overall.questionResults
      .filter((q) => {
        if (q.area !== selectedSpecialty) return false;
        const parts = q.theme.split('>').map((p) => p.trim());
        return parts[0] === selectedSubspecialty && (parts[1] || '') === selectedTheme;
      })
      .map((q) => {
        const question = questions.find((item) => item.id === q.questionId);
        return { ...q, number: question?.number ?? null, text: question?.text ?? '' };
      });
  }, [selectedTheme, selectedSpecialty, selectedSubspecialty, breakdown, questions]);

  const handleSelectSimulado = (sid: string) => {
    onSelectSimulado(sid);
    setSelectedSpecialty(null);
    setSelectedSubspecialty(null);
    setSelectedTheme(null);
  };

  return (
    <StaggerContainer className="space-y-6 md:space-y-8">
      {/* Tabs de simulado (apenas quando > 1) */}
      {simuladosWithResults.length > 1 && (
        <StaggerItem>
          <SimuladoTabs
            simulados={simuladosWithResults}
            selectedId={selectedSimuladoId}
            onSelect={handleSelectSimulado}
          />
        </StaggerItem>
      )}

      {/* Hero de performance */}
      <StaggerItem>
        <PerformanceHeroCard
          overall={overall}
          bestArea={bestArea}
          worstArea={worstArea}
          prefersReducedMotion={!!prefersReducedMotion}
          pdf={pdf}
          simuladoId={selectedSimuladoId ?? ''}
          correcaoVariant={resultNavVariant}
        />
      </StaggerItem>

      {/* Breadcrumb (drill-down) */}
      {(selectedSpecialty || selectedSubspecialty) && (
        <StaggerItem>
          <Breadcrumb
            specialty={selectedSpecialty}
            subspecialty={selectedSubspecialty}
            onReset={() => {
              setSelectedSpecialty(null);
              setSelectedSubspecialty(null);
              setSelectedTheme(null);
            }}
            onBackToSpecialty={() => {
              setSelectedSubspecialty(null);
              setSelectedTheme(null);
            }}
          />
        </StaggerItem>
      )}

      {/* Drill-down level 1: Especialidade */}
      {!selectedSpecialty && (
        <StaggerItem>
          <AreaGridSection title="Especialidade">
            {byArea.map((area, idx) => (
              <AreaCard
                key={area.area}
                label={area.area}
                correct={area.correct}
                total={area.questions}
                score={area.score}
                isBest={idx === 0 && byArea.length > 1}
                isWorst={idx === byArea.length - 1 && byArea.length > 1}
                onClick={() => {
                  setSelectedSpecialty(area.area);
                  setSelectedSubspecialty(null);
                  setSelectedTheme(null);
                }}
                prefersReducedMotion={!!prefersReducedMotion}
              />
            ))}
          </AreaGridSection>
        </StaggerItem>
      )}

      {/* Drill-down level 2: Subespecialidade */}
      {selectedSpecialty && !selectedSubspecialty && (
        <StaggerItem>
          <AnimatePresence mode="wait">
            <motion.div
              key={`subspec-${selectedSpecialty}`}
              initial={prefersReducedMotion ? false : { opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.22 }}
            >
              <AreaGridSection title="Subespecialidade">
                {subspecialtiesForSpecialty.length === 0 ? (
                  <EmptyDrill label="Nenhuma subespecialidade encontrada." />
                ) : (
                  subspecialtiesForSpecialty.map((sub, idx) => (
                    <AreaCard
                      key={sub.subspecialty}
                      label={sub.subspecialty}
                      correct={sub.correct}
                      total={sub.questions}
                      score={sub.score}
                      isBest={idx === 0 && subspecialtiesForSpecialty.length > 1}
                      isWorst={
                        idx === subspecialtiesForSpecialty.length - 1 &&
                        subspecialtiesForSpecialty.length > 1
                      }
                      onClick={() => {
                        setSelectedSubspecialty(sub.subspecialty);
                        setSelectedTheme(null);
                      }}
                      prefersReducedMotion={!!prefersReducedMotion}
                    />
                  ))
                )}
              </AreaGridSection>
            </motion.div>
          </AnimatePresence>
        </StaggerItem>
      )}

      {/* Drill-down level 3: Tema + Questões */}
      {selectedSpecialty && selectedSubspecialty && (
        <StaggerItem>
          <AnimatePresence mode="wait">
            <motion.div
              key={`theme-${selectedSubspecialty}`}
              initial={prefersReducedMotion ? false : { opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.22 }}
            >
              <section aria-label="Tema" className="rounded-2xl border border-border bg-card p-4 md:p-5">
                <SectionHeader title="Tema" />
                {themesForSubspecialty.length === 0 ? (
                  <EmptyDrill label="Nenhum tema encontrado." />
                ) : (
                  <div className="flex flex-col gap-2">
                  <AnimatePresence initial={false}>
                    {themesForSubspecialty.map((theme) => (
                      <ThemeAccordionRow
                        key={theme.theme}
                        theme={theme.theme}
                        score={theme.score}
                        correct={theme.correct}
                        total={theme.total}
                        isOpen={selectedTheme === theme.theme}
                        onToggle={() =>
                          setSelectedTheme((prev) =>
                            prev === theme.theme ? null : theme.theme,
                          )
                        }
                        questionResults={
                          selectedTheme === theme.theme ? questionResultsForTheme : []
                        }
                        simuladoId={selectedSimuladoId ?? ''}
                        prefersReducedMotion={!!prefersReducedMotion}
                        correcaoVariant={resultNavVariant}
                      />
                    ))}
                  </AnimatePresence>
                  </div>
                )}
              </section>
            </motion.div>
          </AnimatePresence>
        </StaggerItem>
      )}

      {/* Summary (Best + Worst) */}
      {byArea.length > 1 && bestArea && worstArea && (
        <StaggerItem>
          <SummarySection bestArea={bestArea} worstArea={worstArea} />
        </StaggerItem>
      )}

      {/* Evolução por especialidade */}
      {byArea.length > 0 && (
        <StaggerItem>
          <EvoBarsSection byArea={byArea} prefersReducedMotion={!!prefersReducedMotion} />
        </StaggerItem>
      )}
    </StaggerContainer>
  );
}
