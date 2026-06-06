/**
 * InsightCard — renderiza um único insight do Prof. San macro.
 *
 * Suporta expansão inline (comparison_table), ícone por tipo,
 * barra lateral de severidade, e CTA rastreado.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import {
  Target,
  AlertCircle,
  Repeat2,
  BarChart2,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { trackEvent } from '@/lib/analytics';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { Insight, InsightType } from '@/types/caderno';

// ─── Severidade → tokens visuais ───

const SEVERITY_STYLES = {
  critical: {
    bar: 'bg-destructive',
    badge: 'bg-destructive/10 text-destructive border-destructive/20',
    label: 'Crítico',
  },
  attention: {
    bar: 'bg-warning',
    badge: 'bg-warning/10 text-warning border-warning/20',
    label: 'Atenção',
  },
  positive: {
    bar: 'bg-success',
    badge: 'bg-success/10 text-success border-success/20',
    label: 'Positivo',
  },
  info: {
    bar: 'bg-info',
    badge: 'bg-info/10 text-info border-info/20',
    label: 'Info',
  },
} as const;

// ─── Tipo → ícone + tooltip ───

function InsightIcon({ type }: { type: InsightType }) {
  const map: Record<InsightType, { Icon: React.ElementType; label: string }> = {
    weak_area: { Icon: Target, label: 'Área fraca detectada' },
    dominant_cause: { Icon: AlertCircle, label: 'Causa dominante de erros' },
    recurring_confusion: { Icon: Repeat2, label: 'Confusão recorrente' },
    overconfidence: { Icon: BarChart2, label: 'Padrão de overconfidence' },
    roi: { Icon: TrendingUp, label: 'Retorno sobre investimento no caderno' },
  };
  const { Icon, label } = map[type] ?? { Icon: AlertCircle, label: type };

  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>
        <span
          aria-label={label}
          className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-muted/60 shrink-0"
        >
          <Icon className="w-4 h-4 text-muted-foreground" aria-hidden />
        </span>
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
}

// ─── Props ───

interface InsightCardProps {
  insight: Insight;
}

// ─── Component ───

export function InsightCard({ insight }: InsightCardProps) {
  const prefersReducedMotion = useReducedMotion();
  const [expanded, setExpanded] = useState(false);

  const severityStyle = SEVERITY_STYLES[insight.severity] ?? SEVERITY_STYLES.info;
  const hasTable = !!insight.comparison_table;

  function handleToggleExpand() {
    const next = !expanded;
    setExpanded(next);
    if (next) {
      trackEvent('caderno_insight_expanded', {
        insight_id: insight.id,
        insight_type: insight.type,
        severity: insight.severity,
      });
    }
  }

  function handleCtaClick() {
    if (!insight.cta) return;
    trackEvent('caderno_insight_cta_clicked', {
      insight_id: insight.id,
      insight_type: insight.type,
      cta_label: insight.cta.label,
      cta_href: insight.cta.href,
    });
  }

  const isExternalCta = insight.cta?.href.startsWith('http');

  return (
    <article
      aria-label={insight.title}
      className={cn(
        'relative flex gap-0 overflow-hidden rounded-2xl border border-border bg-card',
        'transition-shadow duration-200 hover:shadow-md',
      )}
    >
      {/* Barra lateral de severidade */}
      <div className={cn('w-1 shrink-0 rounded-l-2xl', severityStyle.bar)} aria-hidden />

      <div className="flex flex-1 flex-col gap-3 p-4 md:p-5 min-w-0">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <InsightIcon type={insight.type} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h3 className="text-body font-bold text-foreground leading-snug">
                  {insight.title}
                </h3>
                {insight.metric && (
                  <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[12px] font-bold tabular-nums text-foreground">
                    {insight.metric}
                  </span>
                )}
              </div>
              <span
                className={cn(
                  'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                  severityStyle.badge,
                )}
              >
                {severityStyle.label}
              </span>
            </div>
          </div>

          {/* Botão expandir — sempre visível para rastreio; oculta tabela se não houver */}
          <button
            type="button"
            aria-expanded={expanded}
            aria-label={expanded ? 'Recolher detalhes' : 'Expandir detalhes'}
            onClick={handleToggleExpand}
            className={cn(
              'shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-lg',
              'text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            )}
          >
            {expanded ? (
              <ChevronUp className="w-4 h-4" aria-hidden />
            ) : (
              <ChevronDown className="w-4 h-4" aria-hidden />
            )}
          </button>
        </div>

        {/* Corpo sempre visível */}
        <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground [&_p]:leading-relaxed [&_strong]:text-foreground">
          <ReactMarkdown>{insight.body}</ReactMarkdown>
        </div>

        {/* Tabela diferencial (expandível — só se comparison_table existir) */}
        {hasTable && (
          <AnimatePresence initial={false}>
            {expanded && (
              <motion.div
                key="table"
                initial={prefersReducedMotion ? false : { opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={prefersReducedMotion ? false : { opacity: 0, height: 0 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className="overflow-hidden"
              >
                <div className="rounded-xl border border-border bg-muted/30 p-4 mt-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                    Tabela diferencial
                  </p>
                  <div className="prose prose-sm dark:prose-invert max-w-none overflow-x-auto [&_table]:text-[12px] [&_th]:bg-muted/60 [&_th]:px-3 [&_th]:py-1.5 [&_td]:px-3 [&_td]:py-1.5">
                    <ReactMarkdown>{insight.comparison_table}</ReactMarkdown>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        )}

        {/* CTA */}
        {insight.cta && (
          <div className="mt-1">
            {isExternalCta ? (
              <a
                href={insight.cta.href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleCtaClick}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-xl border border-primary/25 bg-primary/[0.06] px-3 py-2',
                  'text-[13px] font-semibold text-primary no-underline transition-all duration-150',
                  'hover:border-primary/40 hover:bg-primary/10',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                )}
              >
                {insight.cta.label}
                <ExternalLink className="w-3.5 h-3.5" aria-hidden />
              </a>
            ) : (
              <Link
                to={insight.cta.href}
                onClick={handleCtaClick}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-xl border border-primary/25 bg-primary/[0.06] px-3 py-2',
                  'text-[13px] font-semibold text-primary no-underline transition-all duration-150',
                  'hover:border-primary/40 hover:bg-primary/10',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                )}
              >
                {insight.cta.label}
              </Link>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
