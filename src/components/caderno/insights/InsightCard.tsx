/**
 * InsightCard — renderiza um único insight do Prof. San macro.
 *
 * Suporta expansão inline (comparison_table), ícone por tipo,
 * barra lateral de severidade, métrica em destaque, tabela diferencial
 * e CTA rastreado.
 *
 * Design: Clínico premium — barra de cor lateral subtil, ícone
 * contextualizado no chip de severidade, métrica de destaque flutuante.
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
  ExternalLink,
  ArrowUpRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { trackEvent } from '@/lib/analytics';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { CadernoCard } from '@/components/caderno/ui';
import type { Insight, InsightType } from '@/types/caderno';

// ─── Severidade → tokens visuais ───

const SEVERITY_CONFIG = {
  critical: {
    bar: 'bg-destructive',
    icon: 'bg-destructive/10 text-destructive',
    badge: 'bg-destructive/10 text-destructive border-destructive/25',
    metric: 'bg-destructive/10 text-destructive border border-destructive/20',
    label: 'Crítico',
  },
  attention: {
    bar: 'bg-warning',
    icon: 'bg-warning/10 text-warning',
    badge: 'bg-warning/10 text-warning border-warning/25',
    metric: 'bg-warning/10 text-warning border border-warning/20',
    label: 'Atenção',
  },
  positive: {
    bar: 'bg-success',
    icon: 'bg-success/10 text-success',
    badge: 'bg-success/10 text-success border-success/25',
    metric: 'bg-success/10 text-success border border-success/20',
    label: 'Positivo',
  },
  info: {
    bar: 'bg-info',
    icon: 'bg-info/10 text-info',
    badge: 'bg-info/10 text-info border-info/25',
    metric: 'bg-info/10 text-info border border-info/20',
    label: 'Info',
  },
} as const;

// ─── Tipo → ícone + label ───

const TYPE_META: Record<InsightType, { Icon: React.ElementType; label: string }> = {
  weak_area: { Icon: Target, label: 'Área fraca detectada' },
  dominant_cause: { Icon: AlertCircle, label: 'Causa dominante de erros' },
  recurring_confusion: { Icon: Repeat2, label: 'Confusão recorrente' },
  overconfidence: { Icon: BarChart2, label: 'Padrão de overconfidence' },
  roi: { Icon: TrendingUp, label: 'Retorno sobre investimento no caderno' },
};

// ─── Props ───

interface InsightCardProps {
  insight: Insight;
}

// ─── Component ───

export function InsightCard({ insight }: InsightCardProps) {
  const prefersReducedMotion = useReducedMotion();
  const [expanded, setExpanded] = useState(false);

  const sev = SEVERITY_CONFIG[insight.severity] ?? SEVERITY_CONFIG.info;
  const { Icon, label: iconLabel } = TYPE_META[insight.type] ?? {
    Icon: AlertCircle,
    label: insight.type,
  };
  const hasTable = !!insight.comparison_table;
  const isExternalCta = insight.cta?.href.startsWith('http');

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

  return (
    <CadernoCard
      variant="interactive"
      asChild={false}
      aria-label={insight.title}
      className="relative flex gap-0 overflow-hidden"
      role="article"
    >
      {/* Barra lateral de severidade */}
      <div className={cn('w-[3px] shrink-0', sev.bar)} aria-hidden />

      <div className="flex flex-1 flex-col gap-3.5 p-4 md:p-5 min-w-0">
        {/* ── Header ── */}
        <div className="flex items-start gap-3">
          {/* Ícone contextualizado */}
          <Tooltip delayDuration={200}>
            <TooltipTrigger asChild>
              <span
                aria-label={iconLabel}
                className={cn(
                  'inline-flex shrink-0 items-center justify-center',
                  'h-9 w-9 rounded-[10px]',
                  sev.icon,
                )}
              >
                <Icon className="h-4.5 w-4.5" aria-hidden />
              </span>
            </TooltipTrigger>
            <TooltipContent side="top">{iconLabel}</TooltipContent>
          </Tooltip>

          {/* Título + badge + métrica */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 mb-1.5">
              <h3 className="text-body font-bold text-foreground leading-snug">
                {insight.title}
              </h3>
              {insight.metric && (
                <span
                  className={cn(
                    'inline-flex items-center rounded-full px-2.5 py-0.5',
                    'text-[12px] font-extrabold tabular-nums',
                    sev.metric,
                  )}
                >
                  {insight.metric}
                </span>
              )}
            </div>

            {/* Severity badge */}
            <span
              className={cn(
                'inline-flex items-center rounded-full border px-2 py-0.5',
                'text-[10px] font-bold uppercase tracking-[0.07em]',
                sev.badge,
              )}
            >
              {sev.label}
            </span>
          </div>

          {/* Botão expandir — visível apenas quando há tabela */}
          {hasTable && (
            <button
              type="button"
              aria-expanded={expanded}
              aria-label={expanded ? 'Recolher tabela diferencial' : 'Ver tabela diferencial'}
              onClick={handleToggleExpand}
              className={cn(
                'shrink-0 inline-flex items-center justify-center',
                'h-8 w-8 rounded-lg',
                'text-muted-foreground transition-all duration-150',
                'hover:bg-muted hover:text-foreground',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              )}
            >
              <ChevronDown
                className={cn(
                  'h-4 w-4 transition-transform duration-200',
                  expanded && 'rotate-180',
                )}
                aria-hidden
              />
            </button>
          )}
        </div>

        {/* ── Corpo (markdown) ── */}
        <div
          className={cn(
            'prose prose-sm dark:prose-invert max-w-none',
            'text-muted-foreground',
            '[&_p]:leading-relaxed [&_p]:mb-0',
            '[&_strong]:text-foreground [&_strong]:font-semibold',
            '[&_ul]:mt-1.5 [&_li]:text-muted-foreground',
          )}
        >
          <ReactMarkdown>{insight.body}</ReactMarkdown>
        </div>

        {/* ── Tabela diferencial (expandível) ── */}
        {hasTable && (
          <AnimatePresence initial={false}>
            {expanded && (
              <motion.div
                key="table"
                initial={prefersReducedMotion ? false : { opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={prefersReducedMotion ? false : { opacity: 0, height: 0 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                className="overflow-hidden"
              >
                <div className="rounded-xl border border-border bg-[var(--c-surface-2)] p-4 mt-0.5">
                  <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground mb-2.5">
                    Tabela diferencial
                  </p>
                  <div
                    className={cn(
                      'prose prose-sm dark:prose-invert max-w-none overflow-x-auto',
                      '[&_table]:text-[12px] [&_table]:w-full',
                      '[&_th]:bg-muted/50 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold [&_th]:text-foreground',
                      '[&_td]:px-3 [&_td]:py-2 [&_td]:text-muted-foreground',
                      '[&_tr]:border-b [&_tr]:border-border/50',
                      '[&_tr:last-child]:border-0',
                    )}
                  >
                    <ReactMarkdown>{insight.comparison_table}</ReactMarkdown>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        )}

        {/* ── CTA ── */}
        {insight.cta && (
          <div className="pt-0.5">
            {isExternalCta ? (
              <a
                href={insight.cta.href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleCtaClick}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-xl',
                  'border border-primary/20 bg-primary/[0.06] px-3.5 py-2',
                  'text-[13px] font-semibold text-primary no-underline',
                  'transition-all duration-150',
                  'hover:border-primary/35 hover:bg-primary/10',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                )}
              >
                {insight.cta.label}
                <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
              </a>
            ) : (
              <Link
                to={insight.cta.href}
                onClick={handleCtaClick}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-xl',
                  'border border-primary/20 bg-primary/[0.06] px-3.5 py-2',
                  'text-[13px] font-semibold text-primary no-underline',
                  'transition-all duration-150',
                  'hover:border-primary/35 hover:bg-primary/10',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                )}
              >
                {insight.cta.label}
                <ArrowUpRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
              </Link>
            )}
          </div>
        )}
      </div>
    </CadernoCard>
  );
}
