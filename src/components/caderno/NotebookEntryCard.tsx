/**
 * NotebookEntryCard — card unificado do Caderno v2.
 *
 * Substitui QueueRow (produção) e EntryCard (sandbox).
 * Spec 05 §3: barra de cor, Q# · Área › Tema, prova · data relativa,
 * preview expansível, badge causa, status SRS, ações com undo+toast.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  ChevronDown,
  ChevronUp,
  Play,
  Trash2,
  MoreHorizontal,
  Check,
  Clock,
  AlarmClock,
  ShieldAlert,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getReasonMeta, type DbReason } from '@/lib/errorNotebookReasons';
import { isLeechEntry } from '@/lib/cadernoStatus';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from '@/hooks/use-toast';

/* ── Types ── */

export interface NotebookEntry {
  id: string;
  questionId: string | null;
  simuladoId: string | null;
  simuladoTitle: string | null;
  area: string | null;
  theme: string | null;
  questionNumber: number | null;
  reason: string;
  learningNote: string | null;
  wasCorrect: boolean;
  addedAt: string;
  resolvedAt: string | null;
  nextReviewAt: string | null;
  // SRS fields — may be absent until migration (use `as any` reads, treat undefined gracefully)
  srsReps?: number | null;
  srsDueAt?: string | null;
  srsInterval?: number | null;
  masteredAt?: string | null;
  // Enunciado preview — populated when available from join
  questionText?: string | null;
}

export interface NotebookEntryCardProps {
  entry: NotebookEntry;
  variant?: 'queue' | 'compact';
  onReview?: (id: string) => void;
  onRemove?: (id: string) => void;
  onToggleMastered?: (id: string, mastered: boolean) => void;
  onSnooze?: (id: string, days: number) => void;
  showSrsStatus?: boolean;
  showPreview?: boolean;
  /** Seleção em lote: quando `selectable=true`, exibe checkbox no card */
  selectable?: boolean;
  /** Estado atual de seleção do card (controlado externamente) */
  selected?: boolean;
  /** Callback ao toggling a seleção */
  onToggleSelect?: (id: string) => void;
}

/* ── Helpers ── */

function fmtDateRelative(iso: string): string {
  const now = Date.now();
  const d = new Date(iso).getTime();
  const diff = now - d;
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return 'hoje';
  if (days === 1) return 'ontem';
  if (days < 30) return `há ${days} dias`;
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

function calcSrsStatus(entry: NotebookEntry): { label: string; colorClass: string } | null {
  const masteredAt = (entry as any).masteredAt ?? (entry as any).mastered_at;
  if (masteredAt) return { label: 'dominada', colorClass: 'text-emerald-500' };

  const srsDueAt = (entry as any).srsDueAt ?? (entry as any).srs_due_at ?? entry.nextReviewAt;
  if (!srsDueAt) return null;

  const dueMs = new Date(srsDueAt).getTime();
  const now = Date.now();
  if (dueMs <= now) return { label: 'devida hoje', colorClass: 'text-orange-400' };

  const diffDays = Math.ceil((dueMs - now) / 86_400_000);
  return {
    label: `volta em ${diffDays}d`,
    colorClass: 'text-muted-foreground',
  };
}

/* ── Skeleton ── */

export function NotebookEntryCardSkeleton() {
  return (
    <div className="flex h-[64px] animate-pulse items-stretch gap-3 rounded-xl border border-border bg-card px-3 py-2.5">
      <div className="w-[3px] shrink-0 self-stretch rounded-full bg-muted/60" />
      <div className="flex flex-1 flex-col justify-center gap-2">
        <div className="h-3 w-2/5 rounded-md bg-muted/60" />
        <div className="h-2.5 w-3/5 rounded-md bg-muted/40" />
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <div className="h-6 w-16 rounded-full bg-muted/60" />
        <div className="h-7 w-7 rounded-[8px] bg-muted/60" />
      </div>
    </div>
  );
}

/* ── Card ── */

export function NotebookEntryCard({
  entry,
  variant = 'queue',
  onReview,
  onRemove,
  onToggleMastered,
  onSnooze,
  showSrsStatus = true,
  showPreview = true,
  selectable = false,
  selected = false,
  onToggleSelect,
}: NotebookEntryCardProps) {
  const [expanded, setExpanded] = useState(false);
  const meta = getReasonMeta(entry.reason as DbReason);
  const mastered = !!(
    (entry as any).masteredAt ??
    (entry as any).mastered_at ??
    entry.resolvedAt
  );
  const srsStatus = calcSrsStatus(entry);

  // Derive leech status using cadernoStatus helpers (SRS fields may be snake or camel)
  const srsShape = {
    last_review_outcome: (entry as any).lastReviewOutcome ?? (entry as any).last_review_outcome ?? null,
    srs_lapses: (entry as any).srsLapses ?? (entry as any).srs_lapses ?? null,
    mastered_at: (entry as any).masteredAt ?? (entry as any).mastered_at ?? null,
    srs_due_at: (entry as any).srsDueAt ?? (entry as any).srs_due_at ?? entry.nextReviewAt ?? null,
  };
  const isLeech = isLeechEntry(srsShape);

  const title = [
    entry.questionNumber != null ? `Q${entry.questionNumber}` : null,
    entry.area ?? null,
    entry.theme ? `› ${entry.theme}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const subtitle = `${entry.simuladoTitle ?? 'Simulado'} · ${fmtDateRelative(entry.addedAt)}`;

  const handleRemove = () => {
    if (!onRemove) return;
    // Toast + undo + delayed API delete are managed by the parent (CadernoPage).
    // The card just signals the intent immediately.
    onRemove(entry.id);
  };

  const handleToggleMastered = () => {
    if (!onToggleMastered) return;
    onToggleMastered(entry.id, !mastered);
    toast({ title: mastered ? 'Reaberto' : 'Marcado como dominado' });
  };

  const isCompact = variant === 'compact';

  return (
    <div
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-xl border bg-card transition-all duration-200',
        'border-border hover:border-primary/20 hover:shadow-[0_6px_18px_-12px_hsl(345_65%_30%/0.2)]',
        mastered && 'opacity-60',
        selectable && selected && 'border-primary/50 bg-primary/[0.03] ring-1 ring-primary/20',
      )}
    >
      {/* Main row */}
      <div className="flex items-stretch gap-0">
        {/* Checkbox (selection mode) */}
        {selectable && (
          <button
            type="button"
            aria-pressed={selected}
            aria-label={selected ? 'Desmarcar questão' : 'Selecionar questão'}
            onClick={() => onToggleSelect?.(entry.id)}
            className={cn(
              'flex w-9 shrink-0 items-center justify-center self-stretch border-r transition-colors duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              selected
                ? 'border-primary/30 bg-primary/10 text-primary'
                : 'border-border/40 bg-muted/20 text-muted-foreground/50 hover:bg-muted/40 hover:text-muted-foreground',
            )}
          >
            <div
              className={cn(
                'flex h-4 w-4 items-center justify-center rounded border-2 transition-all duration-150',
                selected ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/40',
              )}
            >
              {selected && <Check className="h-2.5 w-2.5" strokeWidth={3} aria-hidden />}
            </div>
          </button>
        )}

        {/* Accent bar */}
        <div
          aria-hidden
          className="w-[3px] shrink-0 self-stretch"
          style={{ background: meta.colorBase }}
        />

        <div className="flex min-w-0 flex-1 flex-col gap-0 p-3">
          {/* Row 1: title + badges */}
          <div className="flex min-w-0 items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <span
                className={cn(
                  'block truncate text-[13px] font-semibold tracking-[-0.005em] text-foreground',
                  mastered && 'line-through decoration-muted-foreground/50',
                )}
              >
                {title}
              </span>
              <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                {subtitle}
              </span>
            </div>

            <div className="flex shrink-0 items-start gap-1.5 self-start">
              {/* Leech badge — discreto, com tooltip explicativo */}
              {isLeech && (
                <Tooltip delayDuration={300}>
                  <TooltipTrigger asChild>
                    <span
                      aria-label="Questão travada — muitos erros nas revisões"
                      className="inline-flex items-center gap-1 rounded-full border border-destructive/30 bg-destructive/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-destructive"
                    >
                      <ShieldAlert className="h-2.5 w-2.5" aria-hidden />
                      Travada
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    Travada — você errou várias vezes. Entre na revisão para desbloqueá-la.
                  </TooltipContent>
                </Tooltip>
              )}

              {/* Causa badge */}
              <Tooltip delayDuration={300}>
                <TooltipTrigger asChild>
                  <span
                    className="hidden shrink-0 items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide sm:inline-flex"
                    style={{
                      background: meta.colorBg,
                      color: meta.colorText,
                      borderColor: meta.colorBorder,
                    }}
                  >
                    {meta.badge}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top">{meta.label}</TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* Row 2: preview expansível */}
          {showPreview && !isCompact && entry.questionText && (
            <div className="mt-1.5">
              <AnimatePresence initial={false}>
                <motion.p
                  key={expanded ? 'expanded' : 'collapsed'}
                  initial={false}
                  animate={{ opacity: 1 }}
                  className={cn(
                    'text-[12px] leading-relaxed text-muted-foreground/80',
                    !expanded && 'line-clamp-2',
                  )}
                >
                  {entry.questionText}
                </motion.p>
              </AnimatePresence>
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:text-wine-hover focus-visible:outline-none focus-visible:underline"
                aria-label={expanded ? 'Colapsar enunciado' : 'Expandir enunciado'}
              >
                {expanded ? (
                  <>
                    Ver menos <ChevronUp className="h-3 w-3" aria-hidden />
                  </>
                ) : (
                  <>
                    Ver mais <ChevronDown className="h-3 w-3" aria-hidden />
                  </>
                )}
              </button>
            </div>
          )}

          {/* Row 3: nota de aprendizado */}
          {!isCompact && entry.learningNote && (
            <p className="mt-1.5 rounded-lg border border-border/60 bg-muted/30 px-2.5 py-1.5 text-[11px] italic leading-relaxed text-muted-foreground/80">
              "{entry.learningNote}"
            </p>
          )}
        </div>

        {/* Actions column */}
        <div className="flex shrink-0 flex-col items-center justify-center gap-1.5 border-l border-border/60 px-2.5 py-2">
          {/* Revisar */}
          <Tooltip delayDuration={250}>
            <TooltipTrigger asChild>
              <Link
                to={`/caderno/revisao?entry=${entry.id}`}
                onClick={() => onReview?.(entry.id)}
                aria-label={`Revisar questão ${entry.questionNumber ?? ''}`}
                className="inline-flex h-7 w-7 items-center justify-center rounded-[8px] text-muted-foreground/70 transition-colors hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <Play className="h-3.5 w-3.5 fill-current" aria-hidden />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="left">Revisar</TooltipContent>
          </Tooltip>

          {/* Toggle dominado */}
          {onToggleMastered && (
            <Tooltip delayDuration={250}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={handleToggleMastered}
                  aria-label={mastered ? 'Reabrir questão' : 'Marcar como dominada'}
                  aria-pressed={mastered}
                  className={cn(
                    'inline-flex h-7 w-7 items-center justify-center rounded-[8px] border transition-all duration-150',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                    mastered
                      ? 'border-success/40 bg-success/15 text-success'
                      : 'border-border bg-muted/50 text-muted-foreground hover:border-success/40 hover:bg-success/10 hover:text-success',
                  )}
                >
                  <Check className="h-3.5 w-3.5" strokeWidth={2.75} aria-hidden />
                </button>
              </TooltipTrigger>
              <TooltipContent side="left">
                {mastered ? 'Reabrir' : 'Marcar como dominada'}
              </TooltipContent>
            </Tooltip>
          )}

          {/* Mais ações */}
          <DropdownMenu>
            <Tooltip delayDuration={250}>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label="Mais ações"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-[8px] text-muted-foreground/70 transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <MoreHorizontal className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side="left">Mais ações</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end" className="w-48">
              {onSnooze && (
                <>
                  <DropdownMenuItem onClick={() => { onSnooze(entry.id, 1); toast({ title: 'Volta em 1 dia' }); }}>
                    <AlarmClock className="mr-2 h-3.5 w-3.5" aria-hidden />
                    Adiar 1 dia
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { onSnooze(entry.id, 3); toast({ title: 'Volta em 3 dias' }); }}>
                    <AlarmClock className="mr-2 h-3.5 w-3.5" aria-hidden />
                    Adiar 3 dias
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { onSnooze(entry.id, 7); toast({ title: 'Volta em 7 dias' }); }}>
                    <AlarmClock className="mr-2 h-3.5 w-3.5" aria-hidden />
                    Adiar 7 dias
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={handleRemove}
              >
                <Trash2 className="mr-2 h-3.5 w-3.5" aria-hidden />
                Remover do caderno
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Footer: SRS status */}
      {showSrsStatus && srsStatus && (
        <div className="flex items-center justify-end border-t border-border/40 bg-muted/20 px-3 py-1">
          <span className={cn('inline-flex items-center gap-1 text-[10px] font-semibold', srsStatus.colorClass)}>
            <Clock className="h-2.5 w-2.5" aria-hidden />
            {srsStatus.label}
          </span>
        </div>
      )}
    </div>
  );
}
