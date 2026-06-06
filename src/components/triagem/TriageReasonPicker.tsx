/**
 * TriageReasonPicker v2 — seletor de motivo do erro.
 *
 * Desktop: dropdown inline flutuante com opções grandes e coloridas.
 * Mobile: AdaptiveModal (bottom sheet via Drawer) com alvos ≥44px.
 *
 * NÃO altera lógica de razões, mapeamentos ou eventos — só apresentação.
 */

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronUp, Check, Pencil } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { DB_REASON_META, type DbReason } from '@/lib/errorNotebookReasons';
import { AdaptiveModal } from '@/components/caderno/ui';
import { useIsMobile } from '@/hooks/useIsMobile';

/** Motivos exibidos na triagem (exclui o legado `did_not_understand`). */
const TRIAGE_REASONS: DbReason[] = [
  'did_not_know',
  'did_not_remember',
  'reading_error',
  'confused_alternatives',
  'guessed_correctly',
];

export interface TriageReasonPickerProps {
  reason: DbReason;
  /** Sugestão original (IA ou heurística) — se `reason !== originalReason`, exibe "você". */
  originalReason: DbReason;
  /** 'ia' quando classificado pela edge function; 'heuristic' quando fallback. */
  source: 'ia' | 'heuristic';
  /** Classificação em andamento (exibe skeleton no chip). */
  isLoading?: boolean;
  /** Questão já existe no caderno (troca chip por badge "Já no caderno"). */
  alreadyInNotebook?: boolean;
  onChange: (reason: DbReason) => void;
}

export function TriageReasonPicker({
  reason,
  originalReason,
  source,
  isLoading = false,
  alreadyInNotebook = false,
  onChange,
}: TriageReasonPickerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  const meta = DB_REASON_META[reason];
  const isEdited = reason !== originalReason;
  const sourceLabel = isEdited ? 'você' : source === 'ia' ? 'IA' : 'auto';

  // Fecha o dropdown desktop ao clicar fora
  useEffect(() => {
    if (!open || isMobile) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, isMobile]);

  // ── Loading shimmer ───────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div
        className="inline-flex h-7 w-32 animate-pulse rounded-[var(--c-radius-pill)] bg-[var(--c-surface-2)]"
        aria-label="Classificando..."
        role="status"
      />
    );
  }

  // ── Já no caderno ─────────────────────────────────────────────────────────
  if (alreadyInNotebook) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-[var(--c-radius-pill)] border px-3 py-1',
          'text-[11px] font-semibold leading-none',
        )}
        style={{
          background: meta.colorBg,
          borderColor: meta.colorBorder,
          color: meta.colorText,
        }}
        aria-label={`Já no caderno · ${meta.label}`}
      >
        <Check className="h-3 w-3 shrink-0" aria-hidden />
        Já no caderno · {meta.badge}
      </span>
    );
  }

  // ── Chip + picker ─────────────────────────────────────────────────────────
  const chip = (
    <button
      type="button"
      onClick={() => setOpen(v => !v)}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-[var(--c-radius-pill)] border px-3 py-1.5',
        'text-[11px] font-semibold leading-none',
        'transition-all duration-[var(--c-duration-fast)]',
        'hover:brightness-95 active:scale-[0.97]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
      )}
      style={{
        background: meta.colorBg,
        borderColor: meta.colorBorder,
        color: meta.colorText,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ['--tw-ring-color' as any]: meta.colorBorder,
      }}
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-label={`Motivo: ${meta.label}. Toque para alterar.`}
    >
      <span className="font-bold">{meta.badge}</span>
      <span className="opacity-60">· {sourceLabel}</span>
      {isEdited && (
        <Pencil className="h-2.5 w-2.5 shrink-0 opacity-60" aria-hidden />
      )}
      {open ? (
        <ChevronUp className="h-3 w-3 shrink-0 opacity-60" aria-hidden />
      ) : (
        <ChevronDown className="h-3 w-3 shrink-0 opacity-60" aria-hidden />
      )}
    </button>
  );

  // ── Opções (compartilhadas entre desktop dropdown e mobile sheet) ─────────
  const options = (
    <ul
      role="listbox"
      aria-label="Selecione o motivo"
      className="flex flex-col divide-y divide-[var(--c-border)]"
    >
      {TRIAGE_REASONS.map(r => {
        const m = DB_REASON_META[r];
        const selected = r === reason;
        return (
          <li key={r} role="option" aria-selected={selected}>
            <button
              type="button"
              onClick={() => {
                onChange(r);
                setOpen(false);
              }}
              className={cn(
                'flex w-full items-center gap-3 px-4 py-3.5 text-left',
                'transition-colors duration-[var(--c-duration-fast)]',
                'hover:bg-[var(--c-surface-2)]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--c-wine-500)]/40',
                selected && 'bg-[var(--c-surface-2)]',
              )}
            >
              {/* Color swatch */}
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--c-radius-control)] text-[11px] font-bold"
                style={{ background: m.colorBg, color: m.colorText }}
                aria-hidden
              >
                {m.badge.slice(0, 3)}
              </span>
              {/* Label + hint */}
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-sm font-semibold leading-tight text-[var(--c-ink)]">
                  {m.badge}
                  <span className="ml-1.5 font-normal text-[var(--c-muted)]">
                    — {m.label}
                  </span>
                </span>
                <span className="truncate text-[11px] leading-snug text-[var(--c-muted)]">
                  {m.hint}
                </span>
              </span>
              {/* Check */}
              {selected && (
                <Check
                  className="h-4 w-4 shrink-0"
                  style={{ color: m.colorText }}
                  aria-hidden
                />
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );

  // ── Mobile: AdaptiveModal (bottom sheet) ──────────────────────────────────
  if (isMobile) {
    return (
      <>
        {chip}
        <AdaptiveModal
          open={open}
          onOpenChange={setOpen}
          title="Motivo do erro"
          description="Como você classificaria esta questão?"
          size="md"
        >
          <div className="-mx-1">{options}</div>
        </AdaptiveModal>
      </>
    );
  }

  // ── Desktop: dropdown inline flutuante ────────────────────────────────────
  return (
    <div ref={containerRef} className="relative inline-flex flex-col items-start">
      {chip}

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
              'absolute top-full left-0 z-30 mt-2',
              'w-[300px] overflow-hidden',
              'rounded-[var(--c-radius-card)] border border-[var(--c-border)]',
              'bg-[var(--c-surface)] shadow-[var(--c-shadow-md)]',
            )}
          >
            {options}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
