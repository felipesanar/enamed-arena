/**
 * TriagemSection — showcase da tela de Triagem Pós-Prova (Caderno v2).
 *
 * Rota de sandbox: /sandbox/caderno-v3 (já existente no projeto).
 * Renderiza todos os estados da triagem com mock data para QA no browser sem auth.
 *
 * Estados cobertos:
 *  1. Carregando (shimmer)
 *  2. Lista mista: classificado pela IA, classificado pela heurística (aguardando IA),
 *     "já no caderno", pulado.
 *  3. IA indisponível / fallback (todos source='heuristic', isClassifying=false)
 *  4. Vazio / gabaritou (celebratório)
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, Sparkles, Trophy, XCircle, AlertCircle, RefreshCw, Minus, RotateCcw, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DbReason } from '@/lib/errorNotebookReasons';
import { DB_REASON_META } from '@/lib/errorNotebookReasons';
import {
  CadernoSkeleton,
  CadernoEmptyState,
  PageHeaderPremium,
  CadernoCard,
  CauseBadge,
} from '@/components/caderno/ui';
import { TriageItemCard } from '@/components/triagem/TriageItemCard';
import { TriageSummaryBar } from '@/components/triagem/TriageSummaryBar';

// ─── Mock data ────────────────────────────────────────────────────────────────

interface MockItem {
  questionId: string;
  questionNumber: number;
  area: string;
  theme: string;
  isCorrect: boolean;
  reason: DbReason;
  originalReason: DbReason;
  source: 'ia' | 'heuristic';
  rationale: string | null;
  aiCertainty: 'alta' | 'baixa' | null;
  isLoading: boolean;
  alreadyInNotebook: boolean;
  skipped: boolean;
}

const MOCK_ITEMS_CLASSIFIED: MockItem[] = [
  {
    questionId: 'q1',
    questionNumber: 3,
    area: 'Clínica Médica',
    theme: 'Pneumonia Adquirida na Comunidade',
    isCorrect: false,
    reason: 'did_not_know',
    originalReason: 'did_not_know',
    source: 'ia',
    rationale: 'Você selecionou Haemophilus influenzae em vez de Streptococcus pneumoniae como agente mais comum — indica lacuna conceitual no agente etiológico principal.',
    aiCertainty: 'alta',
    isLoading: false,
    alreadyInNotebook: false,
    skipped: false,
  },
  {
    questionId: 'q2',
    questionNumber: 7,
    area: 'Cardiologia',
    theme: 'Síndrome Coronariana Aguda — IAMCSST',
    isCorrect: false,
    reason: 'did_not_remember',
    originalReason: 'did_not_remember',
    source: 'ia',
    rationale: 'O critério eletrocardiográfico para IAMCSST foi confundido com IAMSST — conteúdo já visto mas não consolidado.',
    aiCertainty: 'alta',
    isLoading: false,
    alreadyInNotebook: false,
    skipped: false,
  },
  {
    questionId: 'q3',
    questionNumber: 12,
    area: 'Neurologia',
    theme: 'AVC Isquêmico — janela terapêutica',
    isCorrect: false,
    reason: 'reading_error',
    originalReason: 'reading_error',
    source: 'heuristic',
    rationale: null,
    aiCertainty: null,
    isLoading: false,
    alreadyInNotebook: false,
    skipped: false,
  },
  {
    questionId: 'q4',
    questionNumber: 18,
    area: 'Cirurgia',
    theme: 'Abdome agudo inflamatório — Apendicite',
    isCorrect: false,
    reason: 'confused_alternatives',
    originalReason: 'confused_alternatives',
    source: 'ia',
    rationale: 'Você escolheu o sinal de Blumberg como patognomônico; na verdade é inespecífico — confusão de alternativas similares.',
    aiCertainty: 'baixa',
    isLoading: false,
    alreadyInNotebook: true,
    skipped: false,
  },
  {
    questionId: 'q5',
    questionNumber: 22,
    area: 'Pediatria',
    theme: 'Desidratação — classificação OMS',
    isCorrect: true,
    reason: 'guessed_correctly',
    originalReason: 'guessed_correctly',
    source: 'ia',
    rationale: 'Resposta correta por eliminação sem certeza no critério de desidratação grave — recomendo revisão.',
    aiCertainty: 'alta',
    isLoading: false,
    alreadyInNotebook: false,
    skipped: false,
  },
];

const MOCK_ITEMS_LOADING: MockItem[] = MOCK_ITEMS_CLASSIFIED.slice(0, 3).map((it): MockItem => ({
  ...it,
  source: 'heuristic' as const,
  isLoading: true,
  rationale: null,
}));

// ─── Sub-seção helper ─────────────────────────────────────────────────────────

function SectionLabel({ label }: { label: string }) {
  return (
    <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--c-muted)]">
      {label}
    </p>
  );
}

// ─── Estado: loading ──────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="caderno-root space-y-6">
      <SectionLabel label="Estado: carregando classificação IA (shimmer)" />
      <div className="max-w-2xl space-y-3">
        {/* Header skeleton */}
        <div className="mb-6 space-y-2">
          <div className="h-3 w-24 animate-pulse rounded-full bg-[var(--c-surface-2)]" />
          <div className="h-6 w-72 animate-pulse rounded-lg bg-[var(--c-surface-2)]" />
          <div className="h-4 w-44 animate-pulse rounded-md bg-[var(--c-surface-2)]" />
        </div>
        <CadernoSkeleton count={3} />
      </div>
    </div>
  );
}

// ─── Estado: lista mista ──────────────────────────────────────────────────────

function ClassifiedState() {
  const [items, setItems] = useState<MockItem[]>(MOCK_ITEMS_CLASSIFIED);

  const handleReasonChange = (questionId: string, reason: DbReason) =>
    setItems(prev => prev.map(it => it.questionId === questionId ? { ...it, reason } : it));

  const handleSkip = (questionId: string) =>
    setItems(prev => prev.map(it => it.questionId === questionId ? { ...it, skipped: true } : it));

  const handleUnskip = (questionId: string) =>
    setItems(prev => prev.map(it => it.questionId === questionId ? { ...it, skipped: false } : it));

  const selected = items.filter(it => !it.skipped);

  return (
    <div className="caderno-root space-y-6">
      <SectionLabel label="Estado: classificado (IA + heurística + já no caderno + pulado)" />
      <div className="max-w-2xl">
        <PageHeaderPremium
          title="Transforme seus erros em plano de estudo"
          subtitle="5 questões pré-classificadas"
          stats={[
            { label: 'Para revisar', value: items.length, color: 'var(--c-wine-500)' },
            { label: 'Selecionadas', value: selected.length, color: 'var(--c-ink)' },
            { label: 'Via IA', value: items.filter(it => it.source === 'ia').length, color: 'var(--c-success)' },
          ]}
          className="mb-4"
        />
        <div className="mb-2 flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-[var(--c-wine-500)]" aria-hidden />
          <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--c-wine-500)]">
            Caderno de Erros
          </span>
        </div>

        <ul className="space-y-3" aria-label="Questões para o caderno">
          {items.map((item, idx) => (
            <motion.li
              key={item.questionId}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, delay: idx * 0.04, ease: [0.22, 1, 0.36, 1] }}
            >
              <TriageItemCard
                questionId={item.questionId}
                questionNumber={item.questionNumber}
                area={item.area}
                theme={item.theme}
                isCorrect={item.isCorrect}
                reason={item.reason}
                originalReason={item.originalReason}
                source={item.source}
                rationale={item.rationale}
                aiCertainty={item.aiCertainty}
                isLoading={item.isLoading}
                alreadyInNotebook={item.alreadyInNotebook}
                skipped={item.skipped}
                onReasonChange={handleReasonChange}
                onSkip={handleSkip}
                onUnskip={handleUnskip}
              />
            </motion.li>
          ))}
        </ul>

        {/* Summary bar in static (non-sticky) position for showcase */}
        <div className="mt-6 border-t border-[var(--c-border)] pt-4">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--c-muted)]">
            TriageSummaryBar (desktop, não sticky no showcase)
          </p>
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-[var(--c-muted)]">
              {selected.length} de {items.length} selecionadas
            </span>
            <button
              type="button"
              className={cn(
                'inline-flex flex-1 items-center justify-center gap-2 rounded-[var(--c-radius-control)] px-5 py-3',
                'text-sm font-semibold text-white [background:var(--c-gradient-brand)]',
                'shadow-[var(--c-shadow-sm)] hover:brightness-110 transition-all',
              )}
            >
              <BookOpen className="h-4 w-4" aria-hidden />
              Adicionar {selected.length} ao caderno
            </button>
            <button
              type="button"
              className="rounded-[var(--c-radius-control)] border border-[var(--c-border)] px-4 py-3 text-sm font-medium text-[var(--c-muted)] hover:bg-[var(--c-surface-2)] transition-colors"
            >
              Agora não
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Estado: IA indisponível / fallback ───────────────────────────────────────

function FallbackState() {
  const [items, setItems] = useState<MockItem[]>(
    MOCK_ITEMS_CLASSIFIED.map((it): MockItem => ({
      ...it,
      source: 'heuristic' as const,
      rationale: null,
      aiCertainty: null,
      isLoading: false,
    })),
  );

  const handleReasonChange = (questionId: string, reason: DbReason) =>
    setItems(prev => prev.map(it => it.questionId === questionId ? { ...it, reason } : it));
  const handleSkip = (questionId: string) =>
    setItems(prev => prev.map(it => it.questionId === questionId ? { ...it, skipped: true } : it));
  const handleUnskip = (questionId: string) =>
    setItems(prev => prev.map(it => it.questionId === questionId ? { ...it, skipped: false } : it));

  return (
    <div className="caderno-root space-y-6">
      <SectionLabel label="Estado: IA indisponível — heurística permanece (sem mensagem de erro)" />
      <div className="max-w-2xl space-y-3">
        {items.map(item => (
          <TriageItemCard
            key={item.questionId}
            questionId={item.questionId}
            questionNumber={item.questionNumber}
            area={item.area}
            theme={item.theme}
            isCorrect={item.isCorrect}
            reason={item.reason}
            originalReason={item.originalReason}
            source={item.source}
            rationale={null}
            aiCertainty={null}
            isLoading={false}
            alreadyInNotebook={item.alreadyInNotebook}
            skipped={item.skipped}
            onReasonChange={handleReasonChange}
            onSkip={handleSkip}
            onUnskip={handleUnskip}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Estado: aguardando IA (isLoading=true) ───────────────────────────────────

function ClassifyingState() {
  return (
    <div className="caderno-root space-y-6">
      <SectionLabel label="Estado: aguardando IA (chips pulsando)" />
      <div className="max-w-2xl space-y-3">
        {MOCK_ITEMS_LOADING.map(item => (
          <TriageItemCard
            key={item.questionId}
            questionId={item.questionId}
            questionNumber={item.questionNumber}
            area={item.area}
            theme={item.theme}
            isCorrect={item.isCorrect}
            reason={item.reason}
            originalReason={item.originalReason}
            source={item.source}
            rationale={null}
            aiCertainty={null}
            isLoading
            alreadyInNotebook={false}
            skipped={false}
            onReasonChange={() => undefined}
            onSkip={() => undefined}
            onUnskip={() => undefined}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Estado: vazio / gabaritou ────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="caderno-root space-y-6">
      <SectionLabel label="Estado: vazio / gabaritou (celebratório)" />
      <div className="max-w-md">
        <CadernoEmptyState
          variant="celebratory"
          icon={<Trophy className="h-8 w-8 text-[var(--c-wine-500)]" aria-hidden />}
          title="Parabéns, nenhum erro para revisar!"
          description="Continue assim. Sua performance foi excelente neste simulado."
          action={
            <button
              type="button"
              className={cn(
                'inline-flex items-center gap-2 rounded-[var(--c-radius-control)] px-6 py-3',
                'text-sm font-semibold text-white [background:var(--c-gradient-brand)]',
                'shadow-[var(--c-shadow-sm)] hover:shadow-[var(--c-shadow-glow)]',
                'hover:brightness-110 transition-all active:scale-[0.98]',
              )}
            >
              <BookOpen className="h-4 w-4" aria-hidden />
              Ver resultado
            </button>
          }
        />
      </div>
    </div>
  );
}

// ─── Paleta de causas (referência visual) ─────────────────────────────────────

function CausePalette() {
  const reasons = Object.entries(DB_REASON_META) as [string, typeof DB_REASON_META[keyof typeof DB_REASON_META]][];

  return (
    <div className="caderno-root space-y-4">
      <SectionLabel label="Paleta de causas — CauseBadge + faixa lateral" />
      <div className="flex flex-wrap gap-2">
        {reasons.map(([key, meta]) => (
          <div key={key} className="flex items-center gap-2">
            <span
              className="h-5 w-1 rounded-full"
              style={{ background: meta.colorBase }}
              aria-hidden
            />
            <CauseBadge reason={key} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Export principal ─────────────────────────────────────────────────────────

export function TriagemSection() {
  return (
    <div className="caderno-root space-y-12 bg-[var(--c-bg)] p-6 md:p-10">
      <div>
        <h2 className="text-heading-2 font-bold text-[var(--c-ink)] mb-1">
          Triagem Pós-Prova
        </h2>
        <p className="text-body text-[var(--c-muted)]">
          Showcase de todos os estados da tela de triagem — Caderno de Erros v2.
        </p>
      </div>

      <div className="h-px bg-[var(--c-border)]" aria-hidden />
      <CausePalette />
      <div className="h-px bg-[var(--c-border)]" aria-hidden />
      <LoadingState />
      <div className="h-px bg-[var(--c-border)]" aria-hidden />
      <ClassifyingState />
      <div className="h-px bg-[var(--c-border)]" aria-hidden />
      <ClassifiedState />
      <div className="h-px bg-[var(--c-border)]" aria-hidden />
      <FallbackState />
      <div className="h-px bg-[var(--c-border)]" aria-hidden />
      <EmptyState />
    </div>
  );
}

export default TriagemSection;
