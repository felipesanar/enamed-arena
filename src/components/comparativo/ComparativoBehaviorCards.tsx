import { Clock, Eye, BookmarkCheck, ShieldCheck, ArrowUpRight, ArrowDownRight, Minus, LucideIcon } from 'lucide-react';
import { PremiumCard } from '@/components/PremiumCard';
import { cn } from '@/lib/utils';
import type { ComparativeEntryRich } from '@/hooks/useComparativeData';

interface Props {
  entries: ComparativeEntryRich[];
}

interface BehaviorMetric {
  key: string;
  label: string;
  icon: LucideIcon;
  /** valor formatado para cada entry, na ordem de entries */
  values: string[];
  /** sinal de evolução: 'good' = melhorou, 'bad' = piorou, 'neutral' = igual / sem sinal */
  trend: 'good' | 'bad' | 'neutral';
  trendLabel?: string;
  helper?: string;
  /** Quando true, recurso ainda não foi usado (sem dados pra mostrar evolução) */
  empty?: boolean;
}

function fmtDuration(seconds: number | null): string {
  if (seconds == null) return '—';
  const m = Math.floor(seconds / 60);
  const r = seconds % 60;
  if (m === 0) return `${r}s`;
  if (r === 0) return `${m}min`;
  return `${m}min ${r}s`;
}

function buildMetrics(entries: ComparativeEntryRich[]): BehaviorMetric[] {
  const first = entries[0];
  const last = entries[entries.length - 1];

  // Duração
  const fSec = first.durationSeconds;
  const lSec = last.durationSeconds;
  let timeTrend: BehaviorMetric['trend'] = 'neutral';
  let timeTrendLabel: string | undefined;
  if (fSec != null && lSec != null) {
    const ratio = lSec / fSec;
    if (ratio < 0.5) {
      timeTrend = 'bad';
      timeTrendLabel = 'Ritmo despencou';
    } else if (lSec > fSec) {
      timeTrend = 'good';
      timeTrendLabel = 'Mais cauteloso';
    } else if (lSec < fSec) {
      timeTrend = 'neutral';
      timeTrendLabel = 'Mais ágil';
    }
  }

  // Saídas (tab+fullscreen)
  const fExits = first.tabExits + first.fullscreenExits;
  const lExits = last.tabExits + last.fullscreenExits;
  let exitsTrend: BehaviorMetric['trend'] = 'neutral';
  if (lExits < fExits) exitsTrend = 'good';
  else if (lExits > fExits) exitsTrend = 'bad';

  // Marcadas pra rever
  const fMark = first.markedForReview;
  const lMark = last.markedForReview;
  let markTrend: BehaviorMetric['trend'] = 'neutral';
  if (lMark > fMark) markTrend = 'good';
  else if (lMark < fMark && fMark > 0) markTrend = 'neutral';

  // Alta confiança (% de acerto entre as marcadas)
  const fHCRate = first.highConfidenceTotal > 0
    ? Math.round((first.highConfidenceCorrect / first.highConfidenceTotal) * 100)
    : null;
  const lHCRate = last.highConfidenceTotal > 0
    ? Math.round((last.highConfidenceCorrect / last.highConfidenceTotal) * 100)
    : null;
  let hcTrend: BehaviorMetric['trend'] = 'neutral';
  if (fHCRate != null && lHCRate != null) {
    if (lHCRate > fHCRate) hcTrend = 'good';
    else if (lHCRate < fHCRate) hcTrend = 'bad';
  }

  return [
    {
      key: 'time',
      label: 'Tempo de prova',
      icon: Clock,
      values: entries.map(e => fmtDuration(e.durationSeconds)),
      trend: timeTrend,
      trendLabel: timeTrendLabel,
      helper: 'do início ao fim',
    },
    {
      key: 'exits',
      label: 'Saídas de foco',
      icon: Eye,
      values: entries.map(e => `${e.tabExits + e.fullscreenExits}`),
      trend: exitsTrend,
      helper: 'troca de aba ou saída de tela cheia',
    },
    {
      key: 'marked',
      label: 'Marcadas pra rever',
      icon: BookmarkCheck,
      values: entries.map(e => `${e.markedForReview}`),
      trend: markTrend,
      helper: entries.every(e => e.markedForReview === 0)
        ? 'recurso ainda não usado'
        : 'questões sinalizadas durante a prova',
      empty: entries.every(e => e.markedForReview === 0),
    },
    {
      key: 'highconf',
      label: 'Alta confiança — % acerto',
      icon: ShieldCheck,
      values: entries.map(e =>
        e.highConfidenceTotal > 0
          ? `${Math.round((e.highConfidenceCorrect / e.highConfidenceTotal) * 100)}%`
          : '—',
      ),
      trend: hcTrend,
      helper: entries.some(e => e.highConfidenceTotal > 0)
        ? 'qualidade das certezas'
        : 'recurso ainda não usado',
      empty: entries.every(e => e.highConfidenceTotal === 0),
    },
  ];
}

const trendStyles: Record<BehaviorMetric['trend'], { color: string; ringBg: string; Icon: LucideIcon }> = {
  good:    { color: 'text-success',          ringBg: 'bg-success/10',         Icon: ArrowUpRight },
  bad:     { color: 'text-destructive',      ringBg: 'bg-destructive/10',     Icon: ArrowDownRight },
  neutral: { color: 'text-muted-foreground', ringBg: 'bg-muted',              Icon: Minus },
};

export function ComparativoBehaviorCards({ entries }: Props) {
  const metrics = buildMetrics(entries);
  const first = entries[0];
  const last = entries[entries.length - 1];

  return (
    <div>
      <div className="flex items-end justify-between mb-3">
        <div>
          <p className="text-heading-3 text-foreground">Comportamento na prova</p>
          <p className="text-caption text-muted-foreground">
            Como você se comportou em cada simulado
          </p>
        </div>
        <div className="hidden md:flex items-center gap-1.5 text-caption text-muted-foreground">
          <span className="font-mono">#{first.sequenceNumber}</span>
          <span>→</span>
          <span className="font-mono">#{last.sequenceNumber}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {metrics.map((m, idx) => {
          const Icon = m.icon;
          const ts = trendStyles[m.trend];
          const Trend = ts.Icon;
          const isEmpty = !!m.empty;
          return (
            <PremiumCard
              key={m.key}
              delay={idx * 0.05}
              className={cn(
                'p-4 transition-opacity',
                isEmpty && 'border-dashed bg-muted/20 opacity-70',
              )}
            >
              <div className="flex items-center justify-between mb-3">
                <div className={cn(
                  'h-9 w-9 rounded-xl flex items-center justify-center',
                  isEmpty ? 'bg-muted' : 'bg-accent',
                )}>
                  <Icon className={cn('h-[18px] w-[18px]', isEmpty ? 'text-muted-foreground' : 'text-primary')} />
                </div>
                {!isEmpty && (
                  <div className={cn('h-7 w-7 rounded-lg flex items-center justify-center', ts.ringBg)}>
                    <Trend className={cn('h-4 w-4', ts.color)} />
                  </div>
                )}
              </div>
              <p className="text-caption text-muted-foreground mb-1">{m.label}</p>
              {/* Valores em sequência separados por seta */}
              <div className="flex items-baseline gap-1.5 flex-wrap">
                {m.values.map((v, i) => (
                  <span key={i} className="contents">
                    {i > 0 && <span className="text-caption text-muted-foreground">→</span>}
                    <span
                      className={cn(
                        'tabular-nums leading-none',
                        i === m.values.length - 1
                          ? (isEmpty
                              ? 'text-heading-3 text-muted-foreground font-medium'
                              : 'text-heading-2 text-foreground font-semibold')
                          : 'text-heading-3 text-muted-foreground',
                      )}
                    >
                      {v}
                    </span>
                  </span>
                ))}
              </div>
              {(m.trendLabel || m.helper) && (
                <p className="text-caption text-muted-foreground mt-2 leading-tight">
                  {m.trendLabel ?? m.helper}
                </p>
              )}
            </PremiumCard>
          );
        })}
      </div>
    </div>
  );
}
