/**
 * RecallSection — Showcase (mock) da sessão de Recall Ativo.
 *
 * Renderiza todas as superfícies redesenhadas com dados simulados
 * para QA visual sem auth. Acessível via /sandbox/caderno-v3.
 *
 * Estados cobertos:
 * - Fase 1: enunciado + alternativas neutras (seleção)
 * - Fase 2: ConfidenceStep
 * - Fase 3: RevealPanel (gabarito revelado + Prof. San)
 * - Fase 4: SelfGradeBar
 * - SessionSummaryV2 (pós-sessão)
 * - SessionQueuePanel (desktop + mobile trigger)
 * - DrillTimerBar (normal + atrasado)
 */

import { useState } from 'react';
import { RecallQuestionCard } from '@/components/caderno/recall/RecallQuestionCard';
import { ConfidenceStep } from '@/components/caderno/recall/ConfidenceStep';
import { RevealPanel } from '@/components/caderno/recall/RevealPanel';
import { SelfGradeBar } from '@/components/caderno/recall/SelfGradeBar';
import { SessionSummaryV2 } from '@/components/caderno/recall/SessionSummaryV2';
import { DesktopQueuePanel, MobileQueueTrigger } from '@/components/caderno/recall/SessionQueuePanel';
import { DrillTimerBar } from '@/components/caderno/recall/DrillTimerBar';
import { SectionHeader } from '@/components/caderno/ui/SectionHeader';
import { CadernoCard } from '@/components/caderno/ui/CadernoCard';
import type { RecallEntry, EntryReviewData, SessionStats } from '@/hooks/useActiveRecallSession';
import type { Question } from '@/types';

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_OPTIONS = [
  { id: 'opt-a', label: 'A', text: 'Síndrome de Cushing por neoplasia suprarrenal.' },
  { id: 'opt-b', label: 'B', text: 'Hipotireoidismo primário com mixedema.' },
  { id: 'opt-c', label: 'C', text: 'Feocromocitoma em crise hipertensiva.' },
  { id: 'opt-d', label: 'D', text: 'Síndrome metabólica com resistência insulínica.' },
  { id: 'opt-e', label: 'E', text: 'Insuficiência suprarrenal primária (Addison).' },
];

const MOCK_QUESTION: Question = {
  id: 'q-mock-01',
  number: 47,
  text: 'Paciente do sexo feminino, 34 anos, apresenta ganho de peso de 12 kg em 8 meses, fraqueza muscular proximal, estrias violáceas no abdômen, hipertensão arterial de difícil controle e alterações menstruais. Exames laboratoriais mostram hiperglicemia e hipocalemia. Qual é o diagnóstico mais provável?',
  imageUrl: null,
  correctOptionId: 'opt-a',
  options: MOCK_OPTIONS,
  explanation: 'A Síndrome de Cushing se manifesta com hipercortisolismo...',
  area: 'Endocrinologia',
  theme: 'Hipercortisolismo',
};

const MOCK_ENTRY: RecallEntry = {
  id: 'entry-mock-01',
  questionId: 'q-mock-01',
  simuladoId: 'sim-01',
  simuladoTitle: 'Simulado ENARE 2024',
  area: 'Endocrinologia',
  theme: 'Hipercortisolismo',
  questionNumber: 47,
  reason: 'did_not_remember',
  learningNote: 'Lembrar: estrias violáceas + fraqueza proximal = Cushing.',
  wasCorrect: false,
  addedAt: new Date(Date.now() - 5 * 86_400_000).toISOString(),
  srsDueAt: new Date().toISOString(),
  srsEase: 2.1,
  lastReviewOutcome: 'errei',
  srsLapses: 2,
  masteredAt: null,
};

const MOCK_REVIEW_DATA: EntryReviewData = {
  question: MOCK_QUESTION,
  originalSelectedOptionId: 'opt-c',
  aiReviewMd: `## Por que A está correta?

A **Síndrome de Cushing** é causada por excesso de cortisol. Os achados clássicos incluem:
- Obesidade centrípeta com estrias violáceas
- Fraqueza muscular proximal (miopatia)
- Hipertensão de difícil controle
- Hiperglicemia e hipocalemia

### Por que C estava errada?
O feocromocitoma causa crises hipertensivas paroxísticas com sudorese, cefaleia e palpitações — não há estrias nem ganho de peso progressivo.

### Dica de prova
Estrias violáceas + fraqueza proximal + hiperglicemia = Cushing. Grave esse tríade.`,
  aiPractice: {
    area: 'Endocrinologia',
    theme: 'Hipercortisolismo',
    topic: 'Síndrome de Cushing',
    suggestedCount: 5,
  },
  aiOptionRationales: {
    B: 'Hipotireoidismo causa ganho de peso mas sem estrias, sem fraqueza proximal e sem hiperglicemia.',
    C: 'Feocromocitoma: crises paroxísticas de HAS, não quadro progressivo com estrias.',
    D: 'Síndrome metabólica não cursa com estrias violáceas nem fraqueza proximal.',
    E: 'Addison: hipotensão, hiperpigmentação, hipoglicemia — oposto de Cushing.',
  },
  chatCount: 2,
};

const MOCK_QUEUE_ENTRIES: RecallEntry[] = [
  { ...MOCK_ENTRY, id: 'e1', questionNumber: 47, area: 'Endocrinologia', theme: 'Cushing', reason: 'did_not_remember' },
  { ...MOCK_ENTRY, id: 'e2', questionNumber: 12, area: 'Cardiologia', theme: 'IAM', reason: 'did_not_know', srsDueAt: new Date(Date.now() - 86400000).toISOString() },
  { ...MOCK_ENTRY, id: 'e3', questionNumber: 33, area: 'Neurologia', theme: 'AVC', reason: 'reading_error', srsDueAt: new Date(Date.now() + 86400000).toISOString() },
  { ...MOCK_ENTRY, id: 'e4', questionNumber: 8, area: 'Pneumologia', theme: 'DPOC', reason: 'confused_alternatives' },
  { ...MOCK_ENTRY, id: 'e5', questionNumber: 55, area: 'Gastroenterologia', theme: 'Cirrose', reason: 'guessed_correctly', srsDueAt: null },
];

const MOCK_STATS: SessionStats = {
  dominated: 3,
  scheduled: 5,
  skipped: 1,
  initialTotal: 10,
  startedAt: Date.now() - 18 * 60 * 1000,
  areaMap: new Map([
    ['Endocrinologia', 2],
    ['Cardiologia', 1],
    ['Neurologia', 1],
  ]),
};

// ─── Phase toggle states ──────────────────────────────────────────────────────

type ShowcasePhase = 'answering' | 'answering-selected' | 'confidence' | 'revealed' | 'self-grade' | 'summary';

const PHASES: { value: ShowcasePhase; label: string }[] = [
  { value: 'answering', label: 'Fase 1: Enunciado' },
  { value: 'answering-selected', label: 'Fase 1: Selecionada' },
  { value: 'confidence', label: 'Fase 2: Confiança' },
  { value: 'revealed', label: 'Fase 3: Gabarito' },
  { value: 'self-grade', label: 'Fase 4: Autoavaliação' },
  { value: 'summary', label: 'Pós-sessão' },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function RecallSection() {
  const [phase, setPhase] = useState<ShowcasePhase>('answering');
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [queueIndex, setQueueIndex] = useState(0);

  const isAnsweringSelected = phase === 'answering-selected';
  const isConfidence = phase === 'confidence';
  const isRevealed = phase === 'revealed' || phase === 'self-grade';
  const isSelfGrade = phase === 'self-grade';
  const isSummary = phase === 'summary';

  const effectiveSelected =
    phase === 'answering-selected' || phase === 'confidence'
      ? 'opt-c'
      : isRevealed
      ? 'opt-c'
      : null;

  const noop = async () => {};
  const noopSync = () => {};

  const timerStartedAtNormal = Date.now() - 4 * 60 * 1000;
  const timerStartedAtLate = Date.now() - 14 * 60 * 1000;

  return (
    <div className="caderno-root space-y-10 py-8">
      {/* Phase controls */}
      <div className="flex flex-wrap gap-2">
        {PHASES.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => {
              setPhase(p.value);
              setSelectedOption(null);
            }}
            className={`rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-all duration-150 ${
              phase === p.value
                ? 'border-[var(--c-wine-500)] bg-[color-mix(in_srgb,var(--c-wine-500)_10%,transparent)] text-[var(--c-wine-500)]'
                : 'border-[var(--c-border)] bg-[var(--c-surface)] text-[var(--c-muted)] hover:border-[color-mix(in_srgb,var(--c-wine-500)_30%,transparent)] hover:text-[var(--c-ink)]'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* ── Summary ──────────────────────────────────────────────────────── */}
      {isSummary && (
        <section aria-labelledby="sh-summary">
          <SectionHeader id="sh-summary" title="Pós-sessão" className="mb-4" />
          <SessionSummaryV2
            stats={MOCK_STATS}
            remainingCount={2}
            onContinue={() => setPhase('answering')}
          />
        </section>
      )}

      {/* ── Recall session ────────────────────────────────────────────────── */}
      {!isSummary && (
        <section aria-labelledby="sh-recall">
          <SectionHeader id="sh-recall" title="Sessão de Recall" className="mb-4" />

          <div className="flex items-start gap-6">
            {/* Main column */}
            <div className="min-w-0 flex-1 space-y-4">
              {/* Question card */}
              <RecallQuestionCard
                entry={MOCK_ENTRY}
                question={MOCK_QUESTION}
                reviewData={MOCK_REVIEW_DATA}
                revealCorrect={isRevealed}
                selectedOptionId={effectiveSelected}
                onSelectOption={(id) => {
                  setSelectedOption(id);
                  if (phase === 'answering') setPhase('answering-selected');
                }}
              />

              {/* Phase 2: confidence */}
              {isConfidence && (
                <ConfidenceStep onSelect={() => setPhase('revealed')} />
              )}

              {/* Phase 3: reveal */}
              {isRevealed && (
                <RevealPanel
                  entry={MOCK_ENTRY}
                  reviewData={MOCK_REVIEW_DATA}
                  generatingAi={false}
                  chatOpen={false}
                  chatMessages={[
                    { role: 'user', content: 'Por que não pode ser feocromocitoma?' },
                    { role: 'assistant', content: 'Feocromocitoma cursa com crises paroxísticas de HAS associadas a cefaleia, sudorese e palpitações. Não há ganho de peso progressivo, estrias nem fraqueza proximal como na Síndrome de Cushing.' },
                  ]}
                  chatInput=""
                  chatLoading={false}
                  onGenerateAi={noop}
                  onChatOpen={noopSync}
                  onChatInputChange={noopSync}
                  onChatSend={noop}
                />
              )}

              {/* Phase 4: self-grade */}
              {isSelfGrade && (
                <SelfGradeBar
                  wasCorrect={false}
                  isLoading={false}
                  onGrade={() => {}}
                />
              )}

              {/* Confirm CTA (answering-selected) */}
              {isAnsweringSelected && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setPhase('confidence')}
                    className="inline-flex items-center gap-2 rounded-[var(--c-radius-control)] px-5 py-2.5 text-[13px] font-bold text-white shadow-[0_4px_14px_-4px_rgba(176,41,74,.45)] transition-all hover:opacity-90"
                    style={{
                      background: 'linear-gradient(135deg, var(--c-wine-500), var(--c-wine-700))',
                    }}
                  >
                    Confirmar resposta
                  </button>
                </div>
              )}
            </div>

            {/* Desktop queue panel */}
            <DesktopQueuePanel
              entries={MOCK_QUEUE_ENTRIES}
              currentIndex={queueIndex}
              onJump={setQueueIndex}
              dominated={MOCK_STATS.dominated}
              initialTotal={MOCK_STATS.initialTotal}
            />
          </div>
        </section>
      )}

      {/* ── Timer states ─────────────────────────────────────────────────── */}
      {!isSummary && (
        <section aria-labelledby="sh-timer">
          <SectionHeader id="sh-timer" title="DrillTimerBar" className="mb-3" />
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-[var(--c-muted)]">
                No prazo
              </p>
              <DrillTimerBar
                startedAt={timerStartedAtNormal}
                totalQuestions={5}
                questionsAnswered={2}
              />
            </div>
            <div>
              <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-[var(--c-muted)]">
                Atrasado
              </p>
              <DrillTimerBar
                startedAt={timerStartedAtLate}
                totalQuestions={5}
                questionsAnswered={2}
              />
            </div>
          </div>
        </section>
      )}

      {/* ── Mobile trigger preview ─────────────────────────────────────────── */}
      {!isSummary && (
        <section aria-labelledby="sh-mobile">
          <SectionHeader id="sh-mobile" title="Mobile Queue Trigger" className="mb-3" />
          <CadernoCard className="flex items-center gap-3 p-4">
            <span className="text-[12px] text-[var(--c-muted)]">Simula topbar mobile →</span>
            <MobileQueueTrigger
              entries={MOCK_QUEUE_ENTRIES}
              currentIndex={queueIndex}
              onJump={setQueueIndex}
              dominated={MOCK_STATS.dominated}
              initialTotal={MOCK_STATS.initialTotal}
            />
          </CadernoCard>
        </section>
      )}
    </div>
  );
}
