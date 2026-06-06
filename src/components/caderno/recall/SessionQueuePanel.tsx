/**
 * SessionQueuePanel
 *
 * Desktop: sticky sidebar (lg:w-72, lg:sticky lg:top-16).
 * Mobile: bottom sheet (shadcn Sheet side="bottom") triggered by "Fila ▾" button.
 *
 * Shows the current session queue with phase icons and progress bar.
 */

import { useState } from 'react';
import { ChevronRight, Clock, CheckCircle2, List } from 'lucide-react';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { getReasonMeta } from '@/lib/errorNotebookReasons';
import type { RecallEntry } from '@/hooks/useActiveRecallSession';

interface SessionQueuePanelProps {
  entries: RecallEntry[];
  currentIndex: number;
  onJump: (index: number) => void;
  dominated: number;
  initialTotal: number;
}

function QueueList({
  entries,
  currentIndex,
  onJump,
  dominated,
  initialTotal,
}: SessionQueuePanelProps) {
  const completionPct = initialTotal === 0 ? 0 : Math.round((dominated / initialTotal) * 100);

  return (
    <div
      className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm flex flex-col max-h-[calc(100vh-9rem)] lg:max-h-[calc(100vh-9rem)]"
      role="navigation"
      aria-label="Fila da sessão"
    >
      {/* Header with progress */}
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="text-overline font-bold uppercase tracking-wider text-muted-foreground">
            Sessão
          </span>
          <span className="text-caption font-bold tabular-nums text-foreground">
            {dominated}/{initialTotal}
          </span>
        </div>
        <div
          className="mt-2 h-1 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={dominated}
          aria-valuemax={initialTotal}
          aria-label="Progresso da sessão"
        >
          <div
            className="h-full rounded-full bg-success transition-[width] duration-500 ease-out"
            style={{ width: `${completionPct}%` }}
          />
        </div>
      </div>

      {/* Entry list */}
      <ul className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
        {entries.length === 0 && (
          <li className="px-3 py-6 text-center text-caption text-muted-foreground">
            Fila vazia.
          </li>
        )}
        {entries.map((e, i) => {
          const isCurrent = i === currentIndex;
          const meta = getReasonMeta(e.reason);
          return (
            <li key={e.id}>
              <button
                type="button"
                onClick={() => onJump(i)}
                className={cn(
                  'group w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors',
                  isCurrent
                    ? 'bg-primary/[0.08] ring-1 ring-primary/30'
                    : 'hover:bg-muted/60',
                )}
                aria-current={isCurrent ? 'true' : undefined}
              >
                <span
                  aria-hidden
                  className="h-6 w-[3px] shrink-0 rounded-full"
                  style={{ background: meta.colorBase }}
                />
                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      'block truncate text-[12px] font-semibold',
                      isCurrent ? 'text-foreground' : 'text-foreground/85',
                    )}
                  >
                    Q{e.questionNumber ?? '?'} · {e.area ?? '—'}
                  </span>
                  <span className="block truncate text-[10px] text-muted-foreground">
                    {e.theme ?? meta.badge}
                  </span>
                </span>
                {e.srsDueAt && new Date(e.srsDueAt).getTime() <= Date.now() && (
                  <Clock className="h-3 w-3 shrink-0 text-warning" aria-hidden title="Vencida" />
                )}
                {isCurrent && (
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {/* Footer — dominated count */}
      {dominated > 0 && (
        <div className="border-t border-border px-4 py-2.5 text-caption text-success font-semibold flex items-center gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
          <span aria-label={`${dominated} dominadas nesta sessão`}>
            {dominated} dominada{dominated > 1 ? 's' : ''} nesta sessão
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Mobile bottom sheet trigger ─────────────────────────────────────────────

export function MobileQueueTrigger({
  entries,
  currentIndex,
  onJump,
  dominated,
  initialTotal,
}: SessionQueuePanelProps) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1.5 text-[11px] font-semibold text-foreground hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 lg:hidden"
          aria-label="Ver fila da sessão"
        >
          <List className="h-3.5 w-3.5" aria-hidden />
          Fila ▾
        </button>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-[60vh] p-0 flex flex-col">
        <SheetTitle className="sr-only">Fila da sessão</SheetTitle>
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-muted-foreground/20" aria-hidden />
        </div>
        <div className="flex-1 overflow-hidden px-3 pb-4">
          <QueueList
            entries={entries}
            currentIndex={currentIndex}
            onJump={(i) => {
              onJump(i);
              setOpen(false);
            }}
            dominated={dominated}
            initialTotal={initialTotal}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Desktop sidebar (hidden on mobile) ──────────────────────────────────────

export function DesktopQueuePanel(props: SessionQueuePanelProps) {
  return (
    <aside className="hidden lg:block lg:w-72 lg:shrink-0 lg:sticky lg:top-16 lg:self-start">
      <QueueList {...props} />
    </aside>
  );
}
