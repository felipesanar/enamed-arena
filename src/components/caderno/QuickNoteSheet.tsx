/**
 * NoteButton + QuickNoteSheet — ação de 1ª classe "Anotar" reutilizável.
 *
 * Plano 08 §2.1 / §3.3: disponibiliza "Anotar" em toda superfície onde aparece
 * uma questão (correção, gabarito, prova). Cria/edita uma `user_note` vinculada
 * a question_id/simulado_id/area/theme — a anotação aparece na aba Anotações e
 * contextualmente ao revisitar a questão.
 *
 * Distinção (plano §3.2):
 *   - `error_notebook.learning_text` = "lembrete do erro" (no fluxo de salvar erro)
 *   - `user_notes` (este componente)  = "anotação de estudo" livre
 *
 * Estado sincronizado via React Query key ['caderno','notes'] — compartilhada
 * com a aba Anotações para que tudo invalide em conjunto.
 *
 * Apenas PRO (canUseNotebook=true) enxerga o botão.
 */

import { useMemo, useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { NotebookPen, Loader2 } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { NoteEditor } from '@/components/caderno/anotacoes/NoteEditor';
import { useIsMobile } from '@/hooks/use-mobile';
import { simuladosApi } from '@/services/simuladosApi';
import { trackEvent } from '@/lib/analytics';
import { toast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';
import { cn } from '@/lib/utils';
import type { UserNote } from '@/types/caderno';

/* ── Constants ── */

export const NOTES_QUERY_KEY = ['caderno', 'notes'] as const;
const STALE_TIME = 5 * 60 * 1000;

/* ── Props ── */

export interface NoteButtonProps {
  questionId: string;
  simuladoId: string;
  area: string;
  theme: string;
  /** Número da questão (para o título default da anotação). */
  questionNumber?: number | null;
  /** Apenas PRO enxerga o botão. */
  canUseNotebook: boolean;
}

/* ── Public component ── */

export function NoteButton(props: NoteButtonProps) {
  if (!props.canUseNotebook) return null;
  return <NoteButtonInner {...props} />;
}

function NoteButtonInner({
  questionId,
  simuladoId,
  area,
  theme,
  questionNumber,
}: NoteButtonProps) {
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();

  const { data: notes = [] } = useQuery<UserNote[]>({
    queryKey: NOTES_QUERY_KEY,
    queryFn: () => simuladosApi.listNotes(),
    staleTime: STALE_TIME,
  });

  const existingNote = useMemo(
    () => notes.find((n) => n.question_id === questionId) ?? null,
    [notes, questionId],
  );
  const hasNote = !!existingNote;

  const handleOpen = useCallback(() => {
    setOpen(true);
    trackEvent('caderno_note_quick_opened', {
      question_id: questionId,
      has_existing: hasNote,
      area,
    });
  }, [questionId, hasNote, area]);

  const label = hasNote ? 'Editar anotação' : 'Anotar esta questão';

  return (
    <>
      <Tooltip delayDuration={250}>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={handleOpen}
            aria-label={label}
            aria-pressed={hasNote}
            className={cn(
              'relative inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-2 rounded-[var(--c-radius-control)] px-3.5 py-2.5',
              'text-[12px] font-semibold border',
              'transition-all duration-[var(--c-duration-base)] ease-[var(--c-ease-standard)]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-wine-500)]/50 focus-visible:ring-offset-1',
              hasNote
                ? [
                    'border-[var(--c-wine-300)] bg-[var(--c-wine-50)] text-[var(--c-wine-700)]',
                    'dark:bg-[var(--c-wine-900)]/40 dark:border-[var(--c-wine-700)]/60 dark:text-[var(--c-wine-300)]',
                  ].join(' ')
                : [
                    'border-[var(--c-border)] bg-[var(--c-surface-2)] text-[var(--c-muted)]',
                    'hover:border-[var(--c-wine-300)] hover:bg-[var(--c-wine-50)] hover:text-[var(--c-wine-700)]',
                    'dark:hover:bg-[var(--c-wine-900)]/30 dark:hover:text-[var(--c-wine-300)]',
                  ].join(' '),
            )}
          >
            <NotebookPen className="h-4 w-4" aria-hidden />
            <span>{hasNote ? 'Anotado' : 'Anotar'}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom">{label}</TooltipContent>
      </Tooltip>

      <QuickNoteSheet
        open={open}
        onOpenChange={setOpen}
        isMobile={isMobile}
        existingNote={existingNote}
        questionId={questionId}
        simuladoId={simuladoId}
        area={area}
        theme={theme}
        questionNumber={questionNumber ?? null}
      />
    </>
  );
}

/* ── Sheet ── */

interface QuickNoteSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isMobile: boolean;
  existingNote: UserNote | null;
  questionId: string;
  simuladoId: string;
  area: string;
  theme: string;
  questionNumber: number | null;
}

function QuickNoteSheet({
  open,
  onOpenChange,
  isMobile,
  existingNote,
  questionId,
  simuladoId,
  area,
  theme,
  questionNumber,
}: QuickNoteSheetProps) {
  const queryClient = useQueryClient();
  const [draftBody, setDraftBody] = useState('');
  const [creating, setCreating] = useState(false);

  // A nota "ativa" no editor: a existente, ou a recém-criada nesta sessão.
  const [createdNote, setCreatedNote] = useState<UserNote | null>(null);
  const activeNote = existingNote ?? createdNote;

  const defaultTitle = questionNumber
    ? `Questão ${questionNumber}${area ? ` · ${area}` : ''}`
    : area || 'Anotação';

  const upsertNoteInCache = useCallback(
    (note: UserNote) => {
      queryClient.setQueryData<UserNote[]>(NOTES_QUERY_KEY, (curr = []) => {
        const without = curr.filter((n) => n.id !== note.id);
        return [note, ...without];
      });
    },
    [queryClient],
  );

  const handleCreate = useCallback(async () => {
    if (creating || !draftBody.trim()) return;
    setCreating(true);
    try {
      const created = await simuladosApi.createNote({
        title: defaultTitle,
        body_md: draftBody.trim(),
        question_id: questionId,
        simulado_id: simuladoId,
        area: area || null,
        theme: theme || null,
      });
      upsertNoteInCache(created);
      setCreatedNote(created);
      setDraftBody('');
      trackEvent('caderno_note_created', {
        note_id: created.id,
        question_id: questionId,
        simulado_id: simuladoId,
        area,
      });
      toast({ title: 'Anotação salva', duration: 2500 });
    } catch (err) {
      logger.error('[QuickNoteSheet] Error creating note:', err);
      toast({ title: 'Não foi possível salvar a anotação', variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  }, [creating, draftBody, defaultTitle, questionId, simuladoId, area, theme, upsertNoteInCache]);

  // Reset do draft ao fechar (a nota criada vira existente via cache na próxima abertura).
  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) {
        setDraftBody('');
        setCreatedNote(null);
      }
      onOpenChange(next);
    },
    [onOpenChange],
  );

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={cn(
          'caderno-root flex flex-col gap-0 bg-[var(--c-surface)] p-0',
          isMobile
            ? 'h-[88vh] rounded-t-[24px]'
            : 'w-full sm:max-w-[480px]',
        )}
      >
        <SheetHeader className="space-y-1 border-b border-[var(--c-border)] px-5 py-4 text-left">
          <SheetTitle className="text-[15px] font-bold text-[var(--c-ink)]">
            {activeNote ? 'Sua anotação' : 'Nova anotação'}
          </SheetTitle>
          <SheetDescription className="text-[12px] text-[var(--c-muted)]">
            {questionNumber ? `Questão ${questionNumber}` : 'Questão'}
            {area ? ` · ${area}` : ''}
            {theme ? ` · ${theme}` : ''}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {activeNote ? (
            <NoteEditor note={activeNote} onSaved={upsertNoteInCache} />
          ) : (
            <div className="flex h-full flex-col gap-3">
              <textarea
                value={draftBody}
                onChange={(e) => setDraftBody(e.target.value)}
                autoFocus
                placeholder={
                  'Escreva sua anotação sobre esta questão…\n\nDica: anote o conceito-chave, a pegadinha ou o raciocínio que faltou.'
                }
                className={cn(
                  'min-h-[180px] flex-1 resize-none rounded-[var(--c-radius-card)] border border-[var(--c-border)] bg-[var(--c-surface-2)] px-4 py-3',
                  'text-[13px] leading-[1.7] text-[var(--c-ink)] placeholder:text-[var(--c-muted-2)]/50',
                  'focus-visible:border-[var(--c-wine-500)]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-wine-500)]/15',
                )}
                aria-label="Corpo da anotação"
              />
              <button
                type="button"
                onClick={handleCreate}
                disabled={creating || !draftBody.trim()}
                className={cn(
                  'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[var(--c-radius-control)] px-4 py-2.5',
                  'bg-[var(--c-wine-500)] text-[13px] font-semibold text-white',
                  'transition-all hover:bg-[var(--c-wine-600)]',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-wine-500)]/50 focus-visible:ring-offset-1',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                )}
              >
                {creating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    Salvando…
                  </>
                ) : (
                  <>
                    <NotebookPen className="h-4 w-4" aria-hidden />
                    Salvar anotação
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
