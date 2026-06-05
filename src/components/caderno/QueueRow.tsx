import { Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { getReasonMeta } from '@/lib/errorNotebookReasons';
import { CheckButton } from './CheckButton';
import { fmtDate, type NotebookEntry } from './helpers';

/* ──────────────────────────────────────────────────────────────────────────
 * Queue row — padrão content card premium
 * ────────────────────────────────────────────────────────────────────────── */

export function QueueRow({
  entry,
  onRemove,
  onToggleResolved,
}: {
  entry: NotebookEntry;
  onRemove: (id: string) => void;
  onToggleResolved: (id: string, resolved: boolean) => void;
}) {
  const meta = getReasonMeta(entry.reason);
  const resolved = !!entry.resolvedAt;
  const title = `Q${entry.questionNumber ?? '?'} · ${entry.area ?? '—'}${
    entry.theme ? ` — ${entry.theme}` : ''
  }`;

  return (
    <div
      className={cn(
        'group relative flex items-stretch gap-3 rounded-xl border bg-card px-3 py-2.5 transition-all duration-200',
        'border-border hover:border-primary/25 hover:shadow-[0_8px_20px_-14px_hsl(345_65%_30%/0.25)]',
        resolved && 'opacity-60',
      )}
    >
      {/* Accent bar */}
      <div
        aria-hidden
        className="w-[3px] shrink-0 self-stretch rounded-full"
        style={{ background: meta.colorBase }}
      />

      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
        <div
          className={cn(
            'truncate text-[13px] font-semibold tracking-[-0.005em] text-foreground',
            resolved && 'line-through decoration-muted-foreground/60',
          )}
        >
          {title}
        </div>
        <div className="truncate text-[11px] text-muted-foreground">
          {resolved && entry.resolvedAt
            ? `Resolvida em ${fmtDate(entry.resolvedAt)}`
            : `${entry.simuladoTitle ?? 'Simulado'} · ${fmtDate(entry.addedAt)}`}
        </div>
      </div>

      {/* Type chip */}
      <span
        className="hidden shrink-0 items-center self-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide sm:inline-flex"
        style={{
          background: meta.colorBg,
          color: meta.colorText,
          borderColor: meta.colorBorder,
        }}
      >
        {meta.badge}
      </span>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-1.5 self-center">
        <Tooltip delayDuration={250}>
          <TooltipTrigger asChild>
            <span>
              <CheckButton
                done={resolved}
                onToggle={() => onToggleResolved(entry.id, !resolved)}
                label={`Marcar questão ${entry.questionNumber ?? ''} como ${
                  resolved ? 'pendente' : 'resolvida'
                }`}
              />
            </span>
          </TooltipTrigger>
          <TooltipContent side="top">
            {resolved ? 'Marcar como pendente' : 'Marcar como resolvida'}
          </TooltipContent>
        </Tooltip>
        <Tooltip delayDuration={250}>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => onRemove(entry.id)}
              aria-label={`Remover questão ${entry.questionNumber ?? ''} do caderno`}
              className="inline-flex h-7 w-7 items-center justify-center rounded-[8px] text-muted-foreground/70 transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">Remover do caderno</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
