/**
 * TriageReasonPicker — seletor inline de motivo do erro.
 *
 * Abre um painel expandido com os 5 motivos disponíveis (sem modal).
 * O chip mostra o motivo selecionado com a cor semântica de `DB_REASON_META`.
 * Após edição manual exibe um marcador "você" para distinguir da sugestão da IA.
 */

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DB_REASON_META, type DbReason } from '@/lib/errorNotebookReasons';

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

  const meta = DB_REASON_META[reason];
  const isEdited = reason !== originalReason;
  const sourceLabel = isEdited ? 'você' : source === 'ia' ? 'IA' : 'automático';

  // Fecha o picker ao clicar fora
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  if (isLoading) {
    return (
      <div
        className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full animate-pulse bg-muted"
        style={{ width: 120 }}
        aria-label="Classificando..."
      />
    );
  }

  if (alreadyInNotebook) {
    return (
      <span
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-caption font-medium"
        style={{
          background: meta.colorBg,
          border: `1px solid ${meta.colorBorder}`,
          color: meta.colorText,
        }}
        aria-label={`Já no caderno · ${meta.label}`}
      >
        Já no caderno · {meta.badge}
      </span>
    );
  }

  return (
    <div ref={containerRef} className="relative inline-flex flex-col items-start">
      {/* Chip principal */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-caption font-semibold transition-all hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
        style={{
          background: meta.colorBg,
          border: `1.5px solid ${meta.colorBorder}`,
          color: meta.colorText,
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Motivo: ${meta.label}. Toque para alterar.`}
      >
        <span className="font-bold">{meta.badge}</span>
        <span
          className="font-normal opacity-60"
          aria-label={isEdited ? 'editado por você' : `sugerido pela ${sourceLabel}`}
        >
          · {sourceLabel}
        </span>
        {open ? (
          <ChevronUp className="h-3 w-3 shrink-0 opacity-60" aria-hidden />
        ) : (
          <ChevronDown className="h-3 w-3 shrink-0 opacity-60" aria-hidden />
        )}
      </button>

      {/* Dropdown inline */}
      {open && (
        <ul
          role="listbox"
          aria-label="Selecione o motivo"
          className="absolute top-full left-0 mt-1.5 z-20 min-w-[220px] rounded-xl border border-border bg-background shadow-lg overflow-hidden py-1"
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
                    'w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-body-sm transition-colors hover:bg-muted/60',
                    selected && 'bg-muted',
                  )}
                >
                  <span
                    className="shrink-0 w-2 h-2 rounded-full"
                    style={{ background: m.colorBase }}
                    aria-hidden
                  />
                  <span className="flex flex-col">
                    <span className="font-semibold text-foreground leading-tight">{m.badge}</span>
                    <span className="text-caption text-muted-foreground leading-snug">{m.label}</span>
                  </span>
                  {selected && (
                    <span className="ml-auto text-caption font-medium" style={{ color: m.colorText }}>
                      ✓
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
