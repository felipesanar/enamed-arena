/**
 * SessionQueuePanel — Painel de fila da sessão de recall.
 *
 * Desktop: sidebar premium sticky à direita (lg:w-72).
 * Mobile: bottom sheet (AdaptiveModal) acionado por botão compacto.
 *
 * Redesign: CadernoCard container, indicadores de causa coloridos,
 * progress ring, item ativo destacado com wine.
 */

import { useState } from 'react';
import { ChevronRight, Clock, CheckCircle2, List, Flame } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getReasonMeta } from '@/lib/errorNotebookReasons';
import { ProgressBar } from '@/components/caderno/ui/ProgressRing';
import { AdaptiveModal } from '@/components/caderno/ui/AdaptiveModal';
import type { RecallEntry } from '@/hooks/useActiveRecallSession';

interface SessionQueuePanelProps {
  entries: RecallEntry[];
  currentIndex: number;
  onJump: (index: number) => void;
  dominated: number;
  initialTotal: number;
}

// ─── Shared queue list ────────────────────────────────────────────────────────

function QueueList({
  entries,
  currentIndex,
  onJump,
  dominated,
  initialTotal,
  onItemClick,
}: SessionQueuePanelProps & { onItemClick?: (i: number) => void }) {
  const completionPct = initialTotal === 0 ? 0 : Math.round((dominated / initialTotal) * 100);

  return (
    <div
      className="flex flex-col overflow-hidden rounded-[var(--c-radius-card)] border border-[var(--c-border)] bg-[var(--c-surface)] shadow-[var(--c-shadow-sm)]"
      style={{ maxHeight: 'calc(100vh - 9rem)' }}
      role="navigation"
      aria-label="Fila da sessão"
    >
      {/* Header */}
      <div className="border-b border-[var(--c-border)] px-4 py-3.5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--c-muted)]">
            Sessão
          </span>
          <span className="text-[12px] font-extrabold tabular-nums text-[var(--c-ink)]">
            {dominated}/{initialTotal}
          </span>
        </div>
        <ProgressBar
          value={completionPct}
          label="Progresso da sessão"
          className="h-[5px]"
        />
        {dominated > 0 && (
          <div className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold [color:var(--c-success)]">
            <Flame className="h-3 w-3" aria-hidden />
            <span>{dominated} dominada{dominated > 1 ? 's' : ''}</span>
          </div>
        )}
      </div>

      {/* Entry list */}
      <ul className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
        {entries.length === 0 && (
          <li className="px-3 py-8 text-center text-caption text-[var(--c-muted)]">
            Fila vazia.
          </li>
        )}
        {entries.map((e, i) => {
          const isCurrent = i === currentIndex;
          const meta = getReasonMeta(e.reason);
          const isDue = e.srsDueAt && new Date(e.srsDueAt).getTime() <= Date.now();

          return (
            <li key={e.id}>
              <button
                type="button"
                onClick={() => (onItemClick ?? onJump)(i)}
                className={cn(
                  'group w-full flex items-center gap-2.5 rounded-[var(--c-radius-control)] px-2.5 py-2.5 text-left transition-all duration-150',
                  isCurrent
                    ? 'bg-[var(--c-wine-500)]/[0.08] ring-1 ring-[var(--c-wine-500)]/25'
                    : 'hover:bg-[var(--c-surface-2)]',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-wine-500)]/50',
                )}
                aria-current={isCurrent ? 'true' : undefined}
              >
                {/* Cause color strip */}
                <span
                  aria-hidden
                  className="h-7 w-[3px] shrink-0 rounded-full"
                  style={{ background: meta.colorBase }}
                />

                {/* Text */}
                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      'block truncate text-[12px] font-semibold leading-snug',
                      isCurrent ? 'text-[var(--c-wine-500)]' : 'text-[var(--c-ink)]',
                    )}
                  >
                    Q{e.questionNumber ?? '?'} · {e.area ?? '—'}
                  </span>
                  <span className="block truncate text-[10px] text-[var(--c-muted)]">
                    {e.theme ?? meta.badge}
                  </span>
                </span>

                {/* Indicators */}
                <div className="flex shrink-0 items-center gap-1">
                  {isDue && (
                    <Clock className="h-3 w-3 [color:var(--c-warning)]" aria-label="Vencida" />
                  )}
                  {isCurrent && (
                    <ChevronRight className="h-3.5 w-3.5 text-[var(--c-wine-500)]" aria-hidden />
                  )}
                </div>
              </button>
            </li>
          );
        })}
      </ul>

      {/* Footer */}
      {dominated > 0 && (
        <div className="border-t border-[var(--c-border)] px-4 py-2.5 text-[11px] font-semibold [color:var(--c-success)] flex items-center gap-1.5">
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
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-[var(--c-radius-control)] border border-[var(--c-border)] bg-[var(--c-surface)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--c-ink)] transition-all duration-150 hover:border-[var(--c-wine-500)]/30 hover:bg-[var(--c-wine-500)]/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-wine-500)]/50 lg:hidden"
        aria-label="Ver fila da sessão"
      >
        <List className="h-3.5 w-3.5" aria-hidden />
        <span>Fila</span>
        <span className="rounded-full bg-[var(--c-wine-500)]/10 px-1.5 py-0.5 text-[10px] font-bold text-[var(--c-wine-500)] tabular-nums">
          {entries.length}
        </span>
      </button>

      <AdaptiveModal
        open={open}
        onOpenChange={setOpen}
        title="Fila da sessão"
        size="md"
      >
        <div className="pb-2">
          <QueueList
            entries={entries}
            currentIndex={currentIndex}
            onJump={onJump}
            dominated={dominated}
            initialTotal={initialTotal}
            onItemClick={(i) => {
              onJump(i);
              setOpen(false);
            }}
          />
        </div>
      </AdaptiveModal>
    </>
  );
}

// ─── Desktop sidebar ──────────────────────────────────────────────────────────

export function DesktopQueuePanel(props: SessionQueuePanelProps) {
  return (
    <aside
      className="hidden lg:block lg:w-72 lg:shrink-0 lg:self-start"
      style={{ position: 'sticky', top: '4.5rem' }}
    >
      <QueueList {...props} />
    </aside>
  );
}
