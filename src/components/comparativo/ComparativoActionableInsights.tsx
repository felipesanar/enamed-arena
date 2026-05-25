import { AlertTriangle, Sparkles, TrendingUp, Info, Lightbulb, ArrowUpRight, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PremiumCard } from '@/components/PremiumCard';
import { cn } from '@/lib/utils';
import { computeActionableInsights, type ActionableSeverity } from '@/lib/comparativeInsights';
import type { ComparativeEntryRich } from '@/hooks/useComparativeData';

interface Props {
  entries: ComparativeEntryRich[];
}

const STYLES: Record<ActionableSeverity, {
  icon: LucideIcon;
  badge: string;
  badgeBg: string;
  border: string;
  bg: string;
  accent: string;
}> = {
  critical: {
    icon: AlertTriangle,
    badge: 'Crítico',
    badgeBg: 'bg-destructive text-white',
    border: 'border-destructive/30',
    bg: 'bg-destructive/[0.04]',
    accent: 'text-destructive',
  },
  attention: {
    icon: Info,
    badge: 'Atenção',
    badgeBg: 'bg-warning/15 text-warning',
    border: 'border-warning/30',
    bg: 'bg-warning/[0.04]',
    accent: 'text-warning',
  },
  positive: {
    icon: TrendingUp,
    badge: 'Positivo',
    badgeBg: 'bg-success/15 text-success',
    border: 'border-success/30',
    bg: 'bg-success/[0.04]',
    accent: 'text-success',
  },
  info: {
    icon: Sparkles,
    badge: 'Sinal',
    badgeBg: 'bg-info/15 text-info',
    border: 'border-info/30',
    bg: 'bg-info/[0.04]',
    accent: 'text-info',
  },
};

export function ComparativoActionableInsights({ entries }: Props) {
  const allInsights = computeActionableInsights(entries);

  // Limita a 3 cards: 1 crítico + 1 atenção + 1 positivo (na ordem).
  // Pega o primeiro de cada severidade conforme a ordem retornada pelo helper.
  const insights = (['critical', 'attention', 'positive'] as const)
    .map((sev) => allInsights.find((i) => i.severity === sev))
    .filter((i): i is NonNullable<typeof i> => Boolean(i));

  if (insights.length === 0) {
    return null;
  }

  return (
    <div>
      <div className="flex items-end justify-between mb-3">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-primary" />
          <div>
            <p className="text-heading-3 text-foreground">O que fazer agora</p>
            <p className="text-caption text-muted-foreground">
              Recomendações geradas a partir dos seus dados
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
        {insights.map((insight, idx) => {
          const style = STYLES[insight.severity];
          const Icon = style.icon;
          return (
            <PremiumCard
              key={insight.id}
              delay={idx * 0.05}
              className={cn('p-4 md:p-5 border', style.border, style.bg)}
            >
              <div className="flex items-start gap-3">
                <div className={cn('h-9 w-9 rounded-xl bg-card border border-border/40 flex items-center justify-center shrink-0')}>
                  <Icon className={cn('h-[18px] w-[18px]', style.accent)} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className={cn('inline-flex items-center text-overline uppercase tracking-wider font-bold px-2 py-0.5 rounded-md', style.badgeBg)}>
                      {style.badge}
                    </span>
                    {insight.metric && (
                      <span className={cn('text-heading-3 font-bold tabular-nums shrink-0', style.accent)}>
                        {insight.metric}
                      </span>
                    )}
                  </div>
                  <p className="text-body font-semibold text-foreground mb-1">{insight.title}</p>
                  <p className="text-body-sm text-muted-foreground leading-relaxed">{insight.description}</p>
                  {insight.cta && (
                    <Link
                      to={insight.cta.href}
                      className={cn(
                        'inline-flex items-center gap-1 mt-3 text-body-sm font-semibold hover:underline group',
                        style.accent,
                      )}
                    >
                      {insight.cta.label}
                      <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    </Link>
                  )}
                </div>
              </div>
            </PremiumCard>
          );
        })}
      </div>
    </div>
  );
}
