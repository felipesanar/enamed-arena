/**
 * InsightsSection — showcase com mock data para QA visual da aba Insights.
 *
 * Rota dev-only: /sandbox/caderno-v3 (conforme spec §8).
 * Renderiza todos os estados (loading / empty / erro / pronto) com toggle
 * de estado e de viewport (desktop / mobile). Não usa auth nem APIs reais.
 *
 * USO:
 *   import { InsightsSection } from '@/components/caderno/showcase/InsightsSection';
 *   // Adicione <InsightsSection /> na rota /sandbox/caderno-v3
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw, WifiOff, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

import { InsightCard } from '@/components/caderno/insights/InsightCard';
import { RoiPanel } from '@/components/caderno/insights/RoiPanel';
import { CalibrationPanel } from '@/components/caderno/insights/CalibrationPanel';
import { InsightsEmptyState } from '@/components/caderno/insights/InsightsEmptyState';
import { ProfSanorAvatar } from '@/components/comparativo/ProfSanorAvatar';
import {
  CadernoCard,
  SectionHeader,
  CadernoCardSkeleton,
  SkeletonLine,
} from '@/components/caderno/ui';

import type { Insight } from '@/types/caderno';
import type { ConfidenceCalibration } from '@/types/caderno';

// ─── Mock data ───

const MOCK_INSIGHTS: Insight[] = [
  {
    id: 'weak-area-cardio',
    type: 'weak_area',
    severity: 'critical',
    title: 'Cardiologia — área crítica',
    body: 'Seu acerto em **Cardiologia** está em **34%**, bem abaixo da média da turma (58%). As questões sobre insuficiência cardíaca e arritmias concentram 70% dos erros nessa área.',
    metric: '34%',
    comparison_table: `| Tema | Seus erros | Média turma |\n|---|---|---|\n| Insuficiência cardíaca | 8 | 3 |\n| Arritmias | 5 | 2 |\n| Coronariopatias | 3 | 4 |`,
    cta: { label: 'Revisar Cardiologia', href: '/caderno?area=Cardiologia' },
    data: {},
  },
  {
    id: 'dominant-cause-memory',
    type: 'dominant_cause',
    severity: 'attention',
    title: 'Causa dominante: lapso de memória',
    body: 'Em **62% dos seus erros** você marcou "não lembrei" como causa. Isso indica conteúdo estudado mas não consolidado — candidate ideal para revisão espaçada via caderno.',
    metric: '62%',
    comparison_table: undefined,
    cta: { label: 'Iniciar revisão espaçada', href: '/caderno' },
    data: {},
  },
  {
    id: 'confusion-bpm-pac',
    type: 'recurring_confusion',
    severity: 'attention',
    title: 'Confusão recorrente: BPM × PAC',
    body: 'Você confunde **Bloqueio de Ramo** com **Parassístole Atrial** em 4 questões. Um diferencial rápido pode resolver.',
    metric: '4x',
    comparison_table: `| Característica | Bloqueio de Ramo | Parassístole Atrial |\n|---|---|---|\n| QRS alargado | Sempre | Pode ocorrer |\n| Frequência | Variável | Independente |\n| Origem | His | Foco ectópico |`,
    cta: { label: 'Estudar diferencial', href: '/caderno?filter=recurring_confusion' },
    data: {},
  },
  {
    id: 'positive-infectologia',
    type: 'weak_area',
    severity: 'positive',
    title: 'Infectologia em evolução',
    body: 'Seu acerto em Infectologia subiu **+18pp** nas últimas 3 semanas após revisar as questões do caderno. Continue assim!',
    metric: '+18pp',
    comparison_table: undefined,
    cta: null,
    data: {},
  },
  {
    id: 'overconfidence-pneumo',
    type: 'overconfidence',
    severity: 'info',
    title: 'Overconfidence em Pneumologia',
    body: 'Você declarou confiança "alta" em **7 questões** de Pneumologia que errou. Vale revisar com mais atenção antes de marcar como "dominado".',
    metric: '7 questões',
    comparison_table: undefined,
    cta: { label: 'Ver questões de Pneumologia', href: '/caderno?area=Pneumologia' },
    data: {},
  },
  {
    id: 'roi-overall',
    type: 'roi',
    severity: 'positive',
    title: 'Caderno gerando retorno',
    body: 'Nas áreas onde você dominou questões do caderno, seu score médio subiu **+11pp**. O investimento está se pagando.',
    metric: '+11pp',
    comparison_table: undefined,
    cta: null,
    data: {},
  },
];

const MOCK_HISTORY = {
  global: Array.from({ length: 8 }, (_, i) => ({
    attempt_id: `att-${i}`,
    finished_at: new Date(Date.now() - (7 - i) * 14 * 24 * 60 * 60 * 1000).toISOString(),
    score_global: 0.42 + i * 0.04 + (i > 4 ? 0.05 : 0),
  })),
  by_area: {
    Cardiologia: Array.from({ length: 6 }, (_, i) => ({
      attempt_id: `att-c-${i}`,
      finished_at: new Date(Date.now() - (5 - i) * 10 * 24 * 60 * 60 * 1000).toISOString(),
      score: 0.3 + i * 0.06,
      questions_total: 10,
      questions_correct: Math.round((0.3 + i * 0.06) * 10),
    })),
    Infectologia: Array.from({ length: 4 }, (_, i) => ({
      attempt_id: `att-i-${i}`,
      finished_at: new Date(Date.now() - (3 - i) * 8 * 24 * 60 * 60 * 1000).toISOString(),
      score: 0.5 + i * 0.07,
      questions_total: 8,
      questions_correct: Math.round((0.5 + i * 0.07) * 8),
    })),
    Pneumologia: Array.from({ length: 3 }, (_, i) => ({
      attempt_id: `att-p-${i}`,
      finished_at: new Date(Date.now() - (2 - i) * 12 * 24 * 60 * 60 * 1000).toISOString(),
      score: 0.6 - i * 0.05,
      questions_total: 7,
      questions_correct: Math.round((0.6 - i * 0.05) * 7),
    })),
  },
};

const MOCK_CALIBRATION: ConfidenceCalibration = {
  buckets: [
    { confidence: 'baixa', total: 30, correct: 10, accuracy: 0.33 },
    { confidence: 'media', total: 45, correct: 27, accuracy: 0.60 },
    { confidence: 'alta', total: 25, correct: 19, accuracy: 0.76 },
  ],
  overall: {
    total_answered_with_confidence: 100,
    alta_but_wrong: 6,
    baixa_but_correct: 10,
  },
};

// ─── Estado do showcase ───

type ShowcaseState = 'ready' | 'loading' | 'empty' | 'error';

const STATE_LABELS: Record<ShowcaseState, string> = {
  ready: 'Pronto',
  loading: 'Carregando',
  empty: 'Sem dados suficientes',
  error: 'Erro',
};

// ─── Chip de toggle ───

function ToggleChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center rounded-full px-3.5 py-1.5 text-[12px] font-semibold',
        'border transition-all duration-150',
        active
          ? 'border-primary/40 bg-primary/10 text-primary'
          : 'border-border bg-[var(--c-surface-2)] text-muted-foreground hover:text-foreground',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      )}
    >
      {children}
    </button>
  );
}

// ─── Prof. San Header mock ───

function MockProfSanHeader({
  fetching,
  fromCache,
}: {
  fetching: boolean;
  fromCache: boolean;
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3',
        'rounded-[var(--c-radius-card)] border border-border bg-[var(--c-surface)]',
        'px-4 py-4 shadow-[var(--c-shadow-sm)]',
        'md:px-5',
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="relative shrink-0">
          <div className="overflow-hidden rounded-full border-2 border-[var(--c-wine-200)] shadow-sm">
            <ProfSanorAvatar size={48} animated={fetching} />
          </div>
          <span
            className="absolute bottom-0.5 right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[var(--c-surface)] bg-success"
            aria-hidden
          />
        </div>
        <div>
          <p className="text-body font-bold text-foreground leading-snug">
            Análise do seu caderno pelo Prof. San
          </p>
          <p className="text-caption text-muted-foreground">
            Diagnóstico personalizado para Marcos
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {fromCache && (
          <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-[var(--c-surface-2)] border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
            <Clock className="h-3 w-3 shrink-0" aria-hidden />
            há 2 horas
          </span>
        )}
        <button
          type="button"
          disabled={fetching}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-xl border border-border',
            'bg-[var(--c-surface-2)] px-3 py-2 text-[12px] font-semibold text-muted-foreground',
            'transition-all duration-150 hover:border-primary/30 hover:text-foreground',
            'disabled:opacity-50 disabled:cursor-not-allowed',
          )}
        >
          <RefreshCw className={cn('h-3.5 w-3.5', fetching && 'animate-spin')} aria-hidden />
          <span className="hidden sm:inline">{fetching ? 'Atualizando...' : 'Atualizar análise'}</span>
        </button>
      </div>
    </div>
  );
}

// ─── InsightsSection ───

export function InsightsSection() {
  const [state, setState] = useState<ShowcaseState>('ready');
  const [fromCache, setFromCache] = useState(false);

  const otherInsights = MOCK_INSIGHTS.filter((i) => i.type !== 'roi');
  const roiInsights = MOCK_INSIGHTS.filter((i) => i.type === 'roi');

  return (
    <section className="space-y-8">
      {/* ── Showcase controls ── */}
      <div
        className={cn(
          'rounded-[var(--c-radius-card)] border border-border',
          'bg-[var(--c-surface-2)] px-4 py-3',
          'flex flex-wrap items-center gap-3',
        )}
      >
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mr-1">
          Estado
        </span>
        {(Object.keys(STATE_LABELS) as ShowcaseState[]).map((s) => (
          <ToggleChip key={s} active={state === s} onClick={() => setState(s)}>
            {STATE_LABELS[s]}
          </ToggleChip>
        ))}

        <div className="ml-auto flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            from_cache
          </span>
          <ToggleChip active={fromCache} onClick={() => setFromCache((v) => !v)}>
            {fromCache ? 'Ligado' : 'Desligado'}
          </ToggleChip>
        </div>
      </div>

      {/* ── Estado: carregando ── */}
      {state === 'loading' && (
        <div className="space-y-4" aria-busy="true" aria-label="Carregando insights">
          <div className="flex items-center justify-between gap-3 pb-2">
            <div className="flex items-center gap-3">
              <SkeletonLine className="h-12 w-12 rounded-full" />
              <div className="space-y-1.5">
                <SkeletonLine className="h-4 w-44" />
                <SkeletonLine className="h-3 w-28" />
              </div>
            </div>
            <SkeletonLine className="h-9 w-36 rounded-xl" />
          </div>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <CadernoCardSkeleton key={i} />
            ))}
          </div>
        </div>
      )}

      {/* ── Estado: erro ── */}
      {state === 'error' && (
        <CadernoCard
          role="alert"
          className="flex flex-col items-center gap-4 px-6 py-10 text-center"
        >
          <WifiOff className="h-10 w-10 text-muted-foreground/40" aria-hidden />
          <div className="space-y-1">
            <p className="text-body font-semibold text-foreground">
              Diagnóstico temporariamente indisponível
            </p>
            <p className="text-caption text-muted-foreground">
              Os dados do caderno estão íntegros. Tente novamente em instantes.
            </p>
          </div>
          <button
            type="button"
            className={cn(
              'inline-flex items-center gap-1.5 rounded-xl',
              'bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground',
              'shadow-sm transition-all hover:brightness-110',
            )}
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            Tentar novamente
          </button>
        </CadernoCard>
      )}

      {/* ── Estado: sem dados ── */}
      {state === 'empty' && (
        <div className="space-y-6">
          <MockProfSanHeader fetching={false} fromCache={fromCache} />
          <InsightsEmptyState message={null} entryCount={2} />
          <div className="border-t border-border/60 pt-6">
            <RoiPanel history={MOCK_HISTORY as any} loading={false} roiInsights={[]} />
          </div>
        </div>
      )}

      {/* ── Estado: pronto ── */}
      {state === 'ready' && (
        <div className="space-y-6">
          <MockProfSanHeader fetching={false} fromCache={fromCache} />

          {fromCache && (
            <div className="flex items-center gap-1.5 text-caption text-muted-foreground px-1">
              <Clock className="h-3 w-3 shrink-0" aria-hidden />
              Análise em cache · atualizada há 2 horas
            </div>
          )}

          {/* Diagnóstico — grid 2-col */}
          <div>
            <SectionHeader
              title="Diagnóstico"
              count={otherInsights.length}
              description="Padrões identificados pelo Prof. San no seu caderno"
              className="mb-3"
            />
            <div
              className="grid grid-cols-1 gap-3 lg:grid-cols-2"
              role="list"
              aria-label="Lista de insights"
            >
              {otherInsights.map((insight, idx) => (
                <motion.div
                  key={insight.id}
                  role="listitem"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.28, delay: idx * 0.04, ease: [0.22, 1, 0.36, 1] }}
                >
                  <InsightCard insight={insight} />
                </motion.div>
              ))}
            </div>
          </div>

          {/* ROI InsightCards */}
          {roiInsights.length > 0 && (
            <div className="space-y-3">
              {roiInsights.map((insight) => (
                <InsightCard key={insight.id} insight={insight} />
              ))}
            </div>
          )}

          {/* Divisor */}
          <div className="border-t border-border/60 pt-2" aria-hidden />

          {/* ROI Panel */}
          <RoiPanel history={MOCK_HISTORY as any} loading={false} roiInsights={roiInsights} />

          {/* Divisor */}
          <div className="border-t border-border/60 pt-2" aria-hidden />

          {/* Calibration Panel */}
          <CalibrationPanel data={MOCK_CALIBRATION} loading={false} />
        </div>
      )}
    </section>
  );
}
