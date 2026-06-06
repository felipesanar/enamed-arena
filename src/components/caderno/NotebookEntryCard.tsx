/**
 * NotebookEntryCard — card unificado do Caderno v2 (redesign premium).
 *
 * Visual:
 *  - CauseBar lateral (4px, cor da causa, full height)
 *  - Q#·Área›Tema em heading, prova·data relativa em caption
 *  - Preview expansível do enunciado
 *  - Badge causa + status SRS + leech badge
 *  - Ações com hover (desktop) / swipe → resolver / ← adiar (mobile)
 *  - Checkbox em selection mode
 *
 * Props existentes preservadas integralmente.
 */

import { useState, useRef } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, useReducedMotion } from 'framer-motion';
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
import { useIsMobile } from '@/hooks/useIsMobile';
import { CadernoCard, CauseBadge } from '@/components/caderno/ui';
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
  // SRS fields — may be absent until migration
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
  if (masteredAt) return { label: 'dominada', colorClass: '[color:var(--c-success)]' };

  const srsDueAt = (entry as any).srsDueAt ?? (entry as any).srs_due_at ?? entry.nextReviewAt;
  if (!srsDueAt) return null;

  const dueMs = new Date(srsDueAt).getTime();
  const now = Date.now();
  if (dueMs <= now) return { label: 'devida hoje', colorClass: '[color:var(--c-warning)]' };

  const diffDays = Math.ceil((dueMs - now) / 86_400_000);
  return {
    label: `volta em ${diffDays}d`,
    colorClass: 'text-[var(--c-muted)]',
  };
}

/* ── Skeleton ── */

export function NotebookEntryCardSkeleton() {
  return (
    <div className="flex h-[72px] animate-pulse items-stretch gap-0 rounded-[var(--c-radius-card)] border border-[var(--c-border)] bg-[var(--c-surface)] overflow-hidden">
      <div className="w-1 shrink-0 self-stretch bg-[var(--c-surface-2)]" />
      <div className="flex flex-1 flex-col justify-center gap-2 px-4 py-3">
        <div className="h-3 w-2/5 rounded-md bg-[var(--c-surface-2)]" />
        <div className="h-2.5 w-3/5 rounded-md bg-[var(--c-surface-2)]/70" />
      </div>
      <div className="flex shrink-0 items-center gap-2 px-3">
        <div className="h-6 w-14 rounded-full bg-[var(--c-surface-2)]" />
        <div className="h-8 w-8 rounded-[var(--c-radius-control)] bg-[var(--c-surface-2)]" />
      </div>
    </div>
  );
}

/* ── Swipeable wrapper (mobile only) ── */

interface SwipeableProps {
  onSwipeRight: () => void;
  onSwipeLeft: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}

function SwipeableCard({ onSwipeRight, onSwipeLeft, children, disabled }: SwipeableProps) {
  const prefersReducedMotion = useReducedMotion();
  const x = useMotionValue(0);
  const swipeThreshold = 80;

  // Tint the background as the user swipes (green → resolve, amber → snooze)
  const bgRight = useTransform(x, [0, swipeThreshold], ['rgba(22,163,74,0)', 'rgba(22,163,74,0.12)']);
  const bgLeft  = useTransform(x, [-swipeThreshold, 0], ['rgba(245,158,11,0.12)', 'rgba(245,158,11,0)']);

  if (disabled || prefersReducedMotion) {
    return <>{children}</>;
  }

  return (
    <div className="relative overflow-hidden rounded-[var(--c-radius-card)]">
      {/* Hint underlay — resolve (right) */}
      <motion.div
        style={{ backgroundColor: bgRight, color: 'var(--c-success)' }}
        className="absolute inset-0 flex items-center pl-5 pointer-events-none"
        aria-hidden
      >
        <Check className="h-5 w-5" strokeWidth={2.5} />
      </motion.div>
      {/* Hint underlay — snooze (left) */}
      <motion.div
        style={{ backgroundColor: bgLeft, color: 'var(--c-warning)' }}
        className="absolute inset-0 flex items-center justify-end pr-5 pointer-events-none"
        aria-hidden
      >
        <AlarmClock className="h-5 w-5" />
      </motion.div>

      <motion.div
        style={{ x }}
        drag="x"
        dragConstraints={{ left: -swipeThreshold * 1.5, right: swipeThreshold * 1.5 }}
        dragElastic={0.15}
        onDragEnd={(_, info) => {
          if (info.offset.x > swipeThreshold) {
            onSwipeRight();
          } else if (info.offset.x < -swipeThreshold) {
            onSwipeLeft();
          }
        }}
        whileDrag={{ scale: 1.01 }}
        transition={{ type: 'spring', stiffness: 400, damping: 40 }}
      >
        {children}
      </motion.div>
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
  const isMobile = useIsMobile();
  const meta = getReasonMeta(entry.reason as DbReason);
  const mastered = !!(
    (entry as any).masteredAt ??
    (entry as any).mastered_at ??
    entry.resolvedAt
  );
  const srsStatus = calcSrsStatus(entry);

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
    onRemove(entry.id);
  };

  const handleToggleMastered = () => {
    if (!onToggleMastered) return;
    onToggleMastered(entry.id, !mastered);
    toast({ title: mastered ? 'Reaberto' : 'Marcado como dominado' });
  };

  const isCompact = variant === 'compact';

  const cardInner = (
    <CadernoCard
      variant="interactive"
      className={cn(
        'group relative flex flex-col overflow-hidden',
        // Override radius to match card system but keep sharp look for list items
        'rounded-[var(--c-radius-card)]',
        mastered && 'opacity-60',
        selectable && selected && [
          'border-[var(--c-wine-400)] bg-[var(--c-wine-50)]',
          'dark:bg-[var(--c-wine-900)]/20',
          'ring-1 ring-[var(--c-wine-400)]/30',
        ],
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
              'flex w-10 shrink-0 items-center justify-center self-stretch border-r transition-colors duration-[var(--c-duration-fast)]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-wine-500)]/50',
              selected
                ? 'border-[var(--c-wine-300)] bg-[var(--c-wine-50)] dark:bg-[var(--c-wine-900)]/30 text-[var(--c-wine-600)]'
                : 'border-[var(--c-border)]/60 bg-[var(--c-surface-2)]/40 text-[var(--c-muted)]/50 hover:bg-[var(--c-surface-2)] hover:text-[var(--c-muted)]',
            )}
          >
            <div
              className={cn(
                'flex h-4 w-4 items-center justify-center rounded border-2 transition-all duration-[var(--c-duration-fast)]',
                selected
                  ? 'border-[var(--c-wine-500)] bg-[var(--c-wine-500)] text-white'
                  : 'border-[var(--c-muted)]/40',
              )}
            >
              {selected && <Check className="h-2.5 w-2.5" strokeWidth={3} aria-hidden />}
            </div>
          </button>
        )}

        {/* Cause accent bar — 4px full-height, color of cause */}
        <div
          aria-hidden
          className="w-1 shrink-0 self-stretch"
          style={{ background: meta.colorBase }}
        />

        <div className="flex min-w-0 flex-1 flex-col gap-0 p-3.5">
          {/* Row 1: title + badges */}
          <div className="flex min-w-0 items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <span
                className={cn(
                  'block truncate text-[13px] font-semibold tracking-[-0.01em] text-[var(--c-ink)]',
                  mastered && 'line-through decoration-[var(--c-muted)]/50',
                )}
              >
                {title}
              </span>
              <span className="mt-0.5 block truncate text-[11px] text-[var(--c-muted)]">
                {subtitle}
              </span>
            </div>

            <div className="flex shrink-0 items-start gap-1.5 self-start">
              {/* Leech badge */}
              {isLeech && (
                <Tooltip delayDuration={300}>
                  <TooltipTrigger asChild>
                    <span
                      aria-label="Questão travada — muitos erros nas revisões"
                      className="inline-flex items-center gap-1 rounded-full border border-[var(--c-destructive)]/30 bg-[var(--c-destructive)]/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--c-destructive)]"
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

              {/* Causa badge — usa primitivo CauseBadge */}
              <Tooltip delayDuration={300}>
                <TooltipTrigger asChild>
                  <span className="hidden sm:inline-flex">
                    <CauseBadge reason={entry.reason} size="sm" />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top">{meta.label}</TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* Row 2: preview expansível */}
          {showPreview && !isCompact && entry.questionText && (
            <div className="mt-2">
              <AnimatePresence initial={false}>
                <motion.p
                  key={expanded ? 'expanded' : 'collapsed'}
                  initial={false}
                  animate={{ opacity: 1 }}
                  className={cn(
                    'text-[12px] leading-relaxed text-[var(--c-muted)]/80',
                    !expanded && 'line-clamp-2',
                  )}
                >
                  {entry.questionText}
                </motion.p>
              </AnimatePresence>
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--c-wine-600)] hover:text-[var(--c-wine-500)] focus-visible:outline-none focus-visible:underline"
                aria-label={expanded ? 'Colapsar enunciado' : 'Expandir enunciado'}
              >
                {expanded ? (
                  <>Ver menos <ChevronUp className="h-3 w-3" aria-hidden /></>
                ) : (
                  <>Ver mais <ChevronDown className="h-3 w-3" aria-hidden /></>
                )}
              </button>
            </div>
          )}

          {/* Row 3: nota de aprendizado */}
          {!isCompact && entry.learningNote && (
            <p className="mt-2 rounded-[var(--c-radius-control)] border border-[var(--c-border)]/60 bg-[var(--c-surface-2)] px-3 py-2 text-[11px] italic leading-relaxed text-[var(--c-muted)]">
              &ldquo;{entry.learningNote}&rdquo;
            </p>
          )}
        </div>

        {/* Actions column — visible on hover (desktop) / always (mobile) */}
        <div
          className={cn(
            'flex shrink-0 flex-col items-center justify-center gap-1 border-l border-[var(--c-border)]/60 px-2.5 py-2',
            // Desktop: show on group hover only (subtle)
            'opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-[var(--c-duration-fast)]',
          )}
        >
          {/* Revisar */}
          <Tooltip delayDuration={250}>
            <TooltipTrigger asChild>
              <Link
                to={`/caderno/revisao?entry=${entry.id}`}
                onClick={() => onReview?.(entry.id)}
                aria-label={`Revisar questão ${entry.questionNumber ?? ''}`}
                className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--c-radius-control)] text-[var(--c-muted)] transition-colors duration-[var(--c-duration-fast)] hover:bg-[var(--c-wine-50)] hover:text-[var(--c-wine-600)] dark:hover:bg-[var(--c-wine-900)]/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-wine-500)]/50"
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
                    'inline-flex h-8 w-8 items-center justify-center rounded-[var(--c-radius-control)] border transition-all duration-[var(--c-duration-fast)]',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-wine-500)]/50',
                    mastered
                      ? 'border-[var(--c-success)]/40 bg-[var(--c-success)]/15 text-[var(--c-success)]'
                      : 'border-[var(--c-border)] bg-[var(--c-surface-2)] text-[var(--c-muted)] hover:border-[var(--c-success)]/40 hover:bg-[var(--c-success)]/10 hover:text-[var(--c-success)]',
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
                    className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--c-radius-control)] text-[var(--c-muted)] transition-colors duration-[var(--c-duration-fast)] hover:bg-[var(--c-surface-2)] hover:text-[var(--c-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-wine-500)]/50"
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
                className="text-[var(--c-destructive)] focus:text-[var(--c-destructive)]"
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
        <div className="flex items-center justify-end border-t border-[var(--c-border)]/40 bg-[var(--c-surface-2)]/50 px-3.5 py-1.5">
          <span className={cn('inline-flex items-center gap-1 text-[10px] font-semibold', srsStatus.colorClass)}>
            <Clock className="h-2.5 w-2.5" aria-hidden />
            {srsStatus.label}
          </span>
        </div>
      )}
    </CadernoCard>
  );

  // Mobile: enable swipe gestures (→ resolver, ← adiar 1 dia)
  if (isMobile && !selectable) {
    return (
      <SwipeableCard
        onSwipeRight={() => {
          if (onToggleMastered) {
            onToggleMastered(entry.id, true);
            toast({ title: 'Marcado como dominado' });
          }
        }}
        onSwipeLeft={() => {
          if (onSnooze) {
            onSnooze(entry.id, 1);
            toast({ title: 'Volta em 1 dia' });
          }
        }}
      >
        {cardInner}
      </SwipeableCard>
    );
  }

  return cardInner;
}
