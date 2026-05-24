import { Link } from 'react-router-dom';
import { Clock, Target, Trophy, ArrowUpRight, Eye, BookmarkCheck } from 'lucide-react';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ComparativeEntryRich } from '@/hooks/useComparativeData';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: ComparativeEntryRich | null;
}

function fmtDuration(s: number | null): string {
  if (s == null) return '—';
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m === 0) return `${r}s`;
  if (r === 0) return `${m}min`;
  return `${m}min ${r}s`;
}

export function SimuladoSnapshotDrawer({ open, onOpenChange, entry }: Props) {
  if (!entry) return null;

  const areaEntries = Object.entries(entry.areaScores).sort((a, b) => b[1] - a[1]);
  const hcRate = entry.highConfidenceTotal > 0
    ? Math.round((entry.highConfidenceCorrect / entry.highConfidenceTotal) * 100)
    : null;

  const stats = [
    { label: 'Score', value: `${entry.percentageScore}%`, icon: Trophy },
    { label: 'Acertos', value: `${entry.totalCorrect}/${entry.totalQuestions}`, icon: Target },
    { label: 'Tempo', value: fmtDuration(entry.durationSeconds), icon: Clock },
    { label: 'Saídas', value: `${entry.tabExits + entry.fullscreenExits}`, icon: Eye },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="text-left">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-overline uppercase tracking-wider font-bold text-primary">
              Simulado #{entry.sequenceNumber}
            </span>
          </div>
          <SheetTitle className="text-heading-2 text-foreground">{entry.title}</SheetTitle>
          <SheetDescription>
            Snapshot da sua tentativa nesta prova.
          </SheetDescription>
        </SheetHeader>

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-2.5 mt-5">
          {stats.map(stat => (
            <div key={stat.label} className="rounded-2xl border border-border bg-card p-3">
              <div className="flex items-center gap-2 mb-1.5">
                <stat.icon className="h-3.5 w-3.5 text-muted-foreground" />
                <p className="text-caption text-muted-foreground">{stat.label}</p>
              </div>
              <p className="text-heading-2 text-foreground tabular-nums">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Breakdown por área */}
        {areaEntries.length > 0 && (
          <div className="mt-6">
            <p className="text-body font-semibold text-foreground mb-3">Performance por especialidade</p>
            <div className="space-y-2.5">
              {areaEntries.map(([area, score]) => (
                <div key={area}>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-body-sm text-foreground truncate">{area}</span>
                    <span className="text-body-sm font-bold text-foreground tabular-nums shrink-0">{score}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn(
                        'h-full transition-all',
                        score >= 60 ? 'bg-success' : score >= 40 ? 'bg-warning' : 'bg-destructive',
                      )}
                      style={{ width: `${score}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Detalhes de comportamento */}
        {(entry.markedForReview > 0 || entry.highConfidenceTotal > 0) && (
          <div className="mt-6 rounded-2xl border border-border bg-muted/30 p-4">
            <p className="text-caption font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">
              Comportamento
            </p>
            <div className="space-y-2">
              {entry.markedForReview > 0 && (
                <div className="flex items-center justify-between text-body-sm">
                  <span className="text-muted-foreground inline-flex items-center gap-1.5">
                    <BookmarkCheck className="h-3.5 w-3.5" /> Marcadas pra rever
                  </span>
                  <span className="font-semibold text-foreground tabular-nums">{entry.markedForReview}</span>
                </div>
              )}
              {hcRate != null && (
                <div className="flex items-center justify-between text-body-sm">
                  <span className="text-muted-foreground">Alta confiança — % acerto</span>
                  <span className={cn(
                    'font-semibold tabular-nums',
                    hcRate >= 70 ? 'text-success' : hcRate >= 40 ? 'text-warning' : 'text-destructive',
                  )}>
                    {hcRate}% ({entry.highConfidenceCorrect}/{entry.highConfidenceTotal})
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="mt-6 sticky bottom-0 bg-background pt-2">
          <Button asChild className="w-full !text-white">
            <Link to={`/desempenho?simulado=${entry.simuladoId}`}>
              Ver desempenho completo
              <ArrowUpRight className="h-4 w-4 ml-1.5" />
            </Link>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
