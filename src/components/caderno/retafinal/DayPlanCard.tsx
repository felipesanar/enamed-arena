/**
 * DayPlanCard — card do plano do dia / próximos dias no War Room ENAMED.
 *
 * Exibe:
 *   - Cabeçalho: data relativa ("Hoje", "Amanhã", "dd/mm") + contagem
 *   - Lista compacta de entradas (área + tema + badge de causa)
 *   - CTA "Começar revisão de hoje" (só no card do dia atual)
 */

import { Link } from 'react-router-dom';
import { Play, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { getReasonMeta } from '@/lib/errorNotebookReasons';
import { getAreaWeight } from '@/lib/enamedBlueprint';
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

/** Badge inline de área + peso ENAMED (compacto para o card do dia). */
function AreaWeightBadge({ area }: { area: string | null }) {
  const weight = getAreaWeight(area);
  const pct = Math.round(weight * 100);
  return (
    <span
      className="shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-primary"
      title={`${pct}% do ENAMED`}
      aria-label={`Peso no ENAMED: ${pct}%`}
    >
      {pct}%
    </span>
  );
}

/** Linha de entrada compacta dentro do card do dia. */
function EntryRow({ entry }: { entry: RetaFinalEntry }) {
  const meta = getReasonMeta((entry as any).reason ?? '');
  return (
    <li className="flex items-center gap-2 py-1.5">
      {/* Barra de cor por causa */}
      <span
        className="h-4 w-[3px] shrink-0 rounded-full"
        style={{ backgroundColor: meta.colorBase }}
        aria-hidden
      />
      <span className="min-w-0 flex-1 truncate text-[12px] text-foreground">
        {entry.area && (
          <span className="font-semibold text-muted-foreground">{entry.area}</span>
        )}
        {entry.area && entry.theme && (
          <span className="text-muted-foreground/60"> › </span>
        )}
        {entry.theme && (
          <span>{entry.theme}</span>
        )}
        {!entry.area && !entry.theme && (
          <span className="text-muted-foreground">Questão sem área</span>
        )}
      </span>
      <AreaWeightBadge area={entry.area} />
    </li>
  );
}

export function DayPlanCard({
  date,
  entries,
  isToday,
  previewLimit = 5,
  className,
}: DayPlanCardProps) {
  const [expanded, setExpanded] = useState(isToday);
  const label = formatDate(date, isToday);
  const shown = expanded ? entries : entries.slice(0, previewLimit);
  const hasMore = entries.length > previewLimit;

  return (
    <article
      className={cn(
        'rounded-2xl border bg-card transition-all duration-200',
        isToday
          ? 'border-primary/30 shadow-[0_4px_20px_-8px_hsl(345_65%_30%/0.25)]'
          : 'border-border',
        className,
      )}
      aria-label={`Plano de revisão: ${label}`}
    >
      {/* Cabeçalho */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className={cn(
          'flex w-full items-center justify-between gap-3 px-4 py-3.5',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-2xl',
        )}
        aria-expanded={expanded}
        aria-controls={`day-plan-list-${date.getTime()}`}
      >
        <div className="flex items-center gap-2.5">
          {isToday && (
            <span className="h-2 w-2 shrink-0 rounded-full bg-primary animate-pulse" aria-hidden />
          )}
          <span
            className={cn(
              'text-[14px] font-bold',
              isToday ? 'text-primary' : 'text-foreground',
            )}
          >
            {label}
          </span>
          {!isToday && (
            <span className="text-[11px] text-muted-foreground">
              {date.toLocaleDateString('pt-BR', { weekday: 'short' })}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground">
            {entries.length}{' '}
            {pluralize(entries.length, 'questão', 'questões')}
          </span>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" aria-hidden />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden />
          )}
        </div>
      </button>

      {/* Lista de entradas */}
      {expanded && (
        <div id={`day-plan-list-${date.getTime()}`}>
          {entries.length === 0 ? (
            <p className="px-4 pb-4 text-[12px] text-muted-foreground">
              Nenhuma questão para este dia.
            </p>
          ) : (
            <ul
              className="divide-y divide-border px-4"
              aria-label={`Questões para revisar ${label.toLowerCase()}`}
            >
              {shown.map((entry) => (
                <EntryRow key={entry.id} entry={entry} />
              ))}
            </ul>
          )}

          {/* Mostrar mais / menos */}
          {hasMore && (
            <div className="px-4 pb-2 pt-1">
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="text-[11px] font-semibold text-primary hover:text-wine-hover focus-visible:outline-none focus-visible:underline"
              >
                {expanded && shown.length === entries.length
                  ? 'Ver menos'
                  : `+${entries.length - previewLimit} mais`}
              </button>
            </div>
          )}

          {/* CTA "Começar revisão de hoje" — apenas no card do dia atual */}
          {isToday && entries.length > 0 && (
            <div className="px-4 pb-4 pt-2">
              <Link
                to="/caderno/revisao?mode=due"
                className={cn(
                  'group inline-flex w-full items-center justify-center gap-2',
                  'rounded-xl bg-primary px-5 py-2.5',
                  'text-[13px] font-semibold text-primary-foreground no-underline',
                  'shadow-[0_4px_14px_-4px_hsl(345_65%_30%/0.4)]',
                  'transition-all duration-200 hover:bg-wine-hover hover:shadow-[0_6px_18px_-4px_hsl(345_65%_30%/0.5)]',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  'active:scale-[0.99]',
                )}
                aria-label={`Começar revisão de hoje — ${entries.length} ${pluralize(entries.length, 'questão', 'questões')}`}
              >
                <Play className="h-3.5 w-3.5 fill-current transition-transform group-hover:scale-110" aria-hidden />
                Começar revisão de hoje
              </Link>
            </div>
          )}
        </div>
      )}
    </article>
  );
}
