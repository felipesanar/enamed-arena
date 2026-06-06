/**
 * DayPlanCard — card do plano do dia / próximos dias no War Room ENAMED (premium v2).
 *
 * Desktop — card do dia de hoje: expandido por padrão, destaque wine hero, CTA grande.
 *           dias seguintes: colapsados por padrão, linha compacta com hover interativo.
 * Mobile  — card de hoje: expandido, CTA sticky via BottomActionBar delegado ao parent.
 *           dias seguintes: colapsáveis, tap em 44px.
 *
 * Preserva: CTA "/caderno/revisao?mode=due", evento não precisa de novo trackEvent aqui.
 */

import { Link } from 'react-router-dom';
import { Play, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { getReasonMeta } from '@/lib/errorNotebookReasons';
import { getAreaWeight } from '@/lib/enamedBlueprint';
import { CadernoCard } from '@/components/caderno/ui';
import type { RetaFinalEntry } from '@/lib/retaFinalPlan';

interface DayPlanCardProps {
  date: Date;
  entries: RetaFinalEntry[];
  isToday: boolean;
  /** Máximo de entradas a exibir antes de colapsar. @default 5 */
  previewLimit?: number;
  className?: string;
}

function formatDate(date: Date, isToday: boolean): string {
  if (isToday) return 'Hoje';
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (
    date.getDate() === tomorrow.getDate() &&
    date.getMonth() === tomorrow.getMonth() &&
    date.getFullYear() === tomorrow.getFullYear()
  ) {
    return 'Amanhã';
  }
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function pluralize(n: number, s: string, p: string) {
  return n === 1 ? s : p;
}

/** Badge compacto de peso ENAMED. */
function AreaWeightBadge({ area }: { area: string | null }) {
  const weight = getAreaWeight(area);
  const pct = Math.round(weight * 100);
  if (pct === 0) return null;
  return (
    <span
      className="shrink-0 rounded-full bg-[var(--c-wine-100)] dark:bg-[var(--c-wine-900)]/30 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-[var(--c-wine-700)] dark:text-[var(--c-wine-300)]"
      title={`${pct}% do ENAMED`}
      aria-label={`Peso no ENAMED: ${pct}%`}
    >
      {pct}%
    </span>
  );
}

/** Linha de entrada dentro do card. */
function EntryRow({ entry }: { entry: RetaFinalEntry }) {
  const meta = getReasonMeta((entry as any).reason ?? '');
  return (
    <li className="flex items-center gap-2.5 py-2">
      <span
        className="h-[18px] w-[3px] shrink-0 rounded-full"
        style={{ backgroundColor: meta.colorBase }}
        aria-hidden
      />
      <span className="min-w-0 flex-1 truncate text-[12px] text-[var(--c-ink)]">
        {entry.area && (
          <span className="font-semibold text-[var(--c-muted)]">{entry.area}</span>
        )}
        {entry.area && entry.theme && (
          <span className="text-[var(--c-muted-2)]"> › </span>
        )}
        {entry.theme && <span>{entry.theme}</span>}
        {!entry.area && !entry.theme && (
          <span className="text-[var(--c-muted)]">Questão sem área</span>
        )}
      </span>
      <AreaWeightBadge area={entry.area} />
    </li>
  );
}

// ─── Card "Hoje" (hero expandido) ────────────────────────────────────────────

function TodayCard({
  date,
  entries,
  previewLimit = 5,
  className,
}: Omit<DayPlanCardProps, 'isToday'>) {
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? entries : entries.slice(0, previewLimit);
  const hasMore = entries.length > previewLimit;

  return (
    <article
      className={cn(
        'caderno-root overflow-hidden rounded-[var(--c-radius-card)]',
        'border border-[var(--c-wine-500)]/25 bg-[var(--c-surface)]',
        'shadow-[var(--c-shadow-md)]',
        className,
      )}
      aria-label="Plano de revisão: Hoje"
    >
      {/* Header wine gradient */}
      <div
        className={cn(
          'flex items-center justify-between gap-3 px-5 py-4',
          'bg-gradient-to-r from-[var(--c-wine-50)] to-transparent',
          'dark:from-[var(--c-wine-900)]/25 dark:to-transparent',
          'border-b border-[var(--c-wine-200)]/60 dark:border-[var(--c-wine-700)]/30',
        )}
      >
        <div className="flex items-center gap-2.5">
          <span
            className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-[var(--c-wine-500)]"
            aria-hidden
          />
          <span className="text-[15px] font-bold text-[var(--c-wine-600)] dark:text-[var(--c-wine-300)]">
            Hoje
          </span>
          <span className="text-[12px] text-[var(--c-muted)]">
            {date.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'short' })}
          </span>
        </div>
        <span
          className={cn(
            'rounded-full px-2.5 py-0.5 text-[11px] font-bold tabular-nums',
            'bg-[var(--c-wine-100)] text-[var(--c-wine-700)]',
            'dark:bg-[var(--c-wine-900)]/40 dark:text-[var(--c-wine-300)]',
          )}
        >
          {entries.length} {pluralize(entries.length, 'questão', 'questões')}
        </span>
      </div>

      {/* Lista de entradas */}
      <div className="px-5">
        {entries.length === 0 ? (
          <p className="py-4 text-[13px] text-[var(--c-muted)]">
            Nenhuma questão para hoje.
          </p>
        ) : (
          <>
            <ul
              className="divide-y divide-[var(--c-border)]"
              aria-label="Questões para revisar hoje"
            >
              {shown.map((entry) => (
                <EntryRow key={entry.id} entry={entry} />
              ))}
            </ul>

            {hasMore && (
              <button
                type="button"
                onClick={() => setShowAll((v) => !v)}
                className={cn(
                  'mb-1 mt-0.5 flex items-center gap-1 text-[11px] font-semibold',
                  'text-[var(--c-wine-600)] dark:text-[var(--c-wine-300)]',
                  'hover:text-[var(--c-wine-700)] focus-visible:outline-none focus-visible:underline',
                  'transition-colors duration-[var(--c-duration-fast)]',
                )}
              >
                {showAll ? (
                  <>
                    <ChevronUp className="h-3.5 w-3.5" aria-hidden />
                    Ver menos
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3.5 w-3.5" aria-hidden />
                    +{entries.length - previewLimit} mais
                  </>
                )}
              </button>
            )}
          </>
        )}
      </div>

      {/* CTA "Começar revisão de hoje" */}
      {entries.length > 0 && (
        <div className="px-5 pb-5 pt-3">
          <Link
            to="/caderno/revisao?mode=due"
            className={cn(
              'group flex w-full items-center justify-center gap-2.5',
              'rounded-[var(--c-radius-control)] px-5 py-3.5',
              'text-[14px] font-bold text-white no-underline',
              '[background:var(--c-gradient-brand)]',
              'shadow-[var(--c-shadow-glow)]',
              'transition-all duration-[var(--c-duration-base)]',
              'hover:brightness-110 hover:shadow-[0_12px_48px_-8px_rgba(176,41,74,.5)]',
              'active:scale-[0.99]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-wine-400)] focus-visible:ring-offset-2',
            )}
            aria-label={`Começar revisão de hoje — ${entries.length} ${pluralize(entries.length, 'questão', 'questões')}`}
          >
            <Play
              className="h-4 w-4 fill-current transition-transform duration-[var(--c-duration-fast)] group-hover:scale-110"
              aria-hidden
            />
            Começar revisão de hoje
          </Link>
        </div>
      )}
    </article>
  );
}

// ─── Card de dias futuros (colapsável) ──────────────────────────────────────

function FutureCard({
  date,
  entries,
  previewLimit = 3,
  className,
}: Omit<DayPlanCardProps, 'isToday'>) {
  const [expanded, setExpanded] = useState(false);
  const label = formatDate(date, false);
  const shown = expanded ? entries : entries.slice(0, previewLimit);
  const hasMore = entries.length > previewLimit;

  return (
    <CadernoCard
      variant="interactive"
      className={cn('caderno-root overflow-hidden', className)}
      aria-label={`Plano de revisão: ${label}`}
    >
      {/* Cabeçalho — botão de colapso */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className={cn(
          'flex w-full items-center justify-between gap-3 px-4 py-3.5',
          'min-h-[44px]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-wine-400)]/50 rounded-[var(--c-radius-card)]',
        )}
        aria-expanded={expanded}
        aria-controls={`day-plan-list-${date.getTime()}`}
      >
        <div className="flex items-center gap-2.5">
          <span className="text-[13px] font-bold text-[var(--c-ink)]">{label}</span>
          <span className="text-[11px] text-[var(--c-muted)]">
            {date.toLocaleDateString('pt-BR', { weekday: 'short' })}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums',
              entries.length > 0
                ? 'bg-[var(--c-surface-2)] text-[var(--c-muted)]'
                : 'bg-[var(--c-success)]/10 text-[var(--c-success)]',
            )}
          >
            {entries.length > 0
              ? `${entries.length} ${pluralize(entries.length, 'questão', 'questões')}`
              : 'em dia'}
          </span>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-[var(--c-muted)]" aria-hidden />
          ) : (
            <ChevronDown className="h-4 w-4 text-[var(--c-muted)]" aria-hidden />
          )}
        </div>
      </button>

      {/* Lista colapsável */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="content"
            id={`day-plan-list-${date.getTime()}`}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            style={{ overflow: 'hidden' }}
          >
            {entries.length === 0 ? (
              <p className="px-4 pb-4 text-[12px] text-[var(--c-muted)]">
                Nenhuma questão para este dia.
              </p>
            ) : (
              <div className="px-4">
                <ul
                  className="divide-y divide-[var(--c-border)]"
                  aria-label={`Questões para revisar ${label.toLowerCase()}`}
                >
                  {shown.map((entry) => (
                    <EntryRow key={entry.id} entry={entry} />
                  ))}
                </ul>

                {hasMore && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpanded(true);
                    }}
                    className="mb-1 mt-0.5 text-[11px] font-semibold text-[var(--c-wine-600)] dark:text-[var(--c-wine-300)] hover:underline focus-visible:outline-none"
                  >
                    +{entries.length - previewLimit} mais
                  </button>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </CadernoCard>
  );
}

// ─── Export público ───────────────────────────────────────────────────────────

export function DayPlanCard({
  date,
  entries,
  isToday,
  previewLimit,
  className,
}: DayPlanCardProps) {
  if (isToday) {
    return (
      <TodayCard
        date={date}
        entries={entries}
        previewLimit={previewLimit}
        className={className}
      />
    );
  }
  return (
    <FutureCard
      date={date}
      entries={entries}
      previewLimit={previewLimit}
      className={className}
    />
  );
}
