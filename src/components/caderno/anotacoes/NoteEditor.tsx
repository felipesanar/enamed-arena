/**
 * NoteEditor — editor de anotação com campo de título + corpo markdown.
 *
 * Funcionalidades:
 * - Campo de título (corrige anti-padrão Medway m9)
 * - Textarea de corpo markdown com toolbar leve (B / I / lista)
 * - Autosave debounced (~1500ms) chamando updateNote
 * - Indicador "Salvo" / "Salvando…" / "Erro ao salvar"
 * - Ctrl/Cmd+S salva imediatamente
 * - Sem perder contexto ao navegar entre notas
 */

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useId,
} from 'react';
import { Bold, Italic, List, Save, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { simuladosApi } from '@/services/simuladosApi';
import { trackEvent } from '@/lib/analytics';
import { logger } from '@/lib/logger';
import type { UserNote, UpdateNotePayload } from '@/types/caderno';

// ── Types ──────────────────────────────────────────────────────────────────

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface NoteEditorProps {
  note: UserNote;
  /** Called after a successful save so the parent can update the list. */
  onSaved: (updated: UserNote) => void;
}

// ── Toolbar helper ─────────────────────────────────────────────────────────

function insertMarkdown(
  textarea: HTMLTextAreaElement,
  wrap: string,
  linePrefix?: string,
): string {
  const { selectionStart: start, selectionEnd: end, value } = textarea;
  const selected = value.slice(start, end);

  if (linePrefix) {
    // Line-prefix mode (e.g., "- " for lists)
    const lineStart = value.lastIndexOf('\n', start - 1) + 1;
    const before = value.slice(0, lineStart);
    const lineContent = value.slice(lineStart);
    const newValue = before + linePrefix + lineContent;
    const newCursor = start + linePrefix.length;
    // Return new value; caller sets textarea.value and selection
    textarea.value = newValue;
    textarea.setSelectionRange(newCursor, newCursor + (end - start));
    return newValue;
  }

  // Wrap mode (e.g., "**" for bold)
  const before = value.slice(0, start);
  const after = value.slice(end);
  const newValue = `${before}${wrap}${selected || 'texto'}${wrap}${after}`;
  const newStart = start + wrap.length;
  const newEnd = newStart + (selected || 'texto').length;
  textarea.value = newValue;
  textarea.setSelectionRange(newStart, newEnd);
  return newValue;
}

// ── Component ──────────────────────────────────────────────────────────────

export function NoteEditor({ note, onSaved }: NoteEditorProps) {
  const titleId = useId();
  const bodyId = useId();

  const [title, setTitle] = useState(note.title);
  const [body, setBody] = useState(note.body_md);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');

  const titleRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestTitle = useRef(title);
  const latestBody = useRef(body);
  // Track if the content actually changed from what's persisted
  const dirty = useRef(false);

  // When note prop changes (user selects a different note), reset state
  useEffect(() => {
    setTitle(note.title);
    setBody(note.body_md);
    latestTitle.current = note.title;
    latestBody.current = note.body_md;
    dirty.current = false;
    setSaveStatus('idle');
    if (autosaveTimer.current) {
      clearTimeout(autosaveTimer.current);
      autosaveTimer.current = null;
    }
  }, [note.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Save logic ──────────────────────────────────────────────────────────

  const doSave = useCallback(async () => {
    if (!dirty.current) return;
    setSaveStatus('saving');
    const payload: UpdateNotePayload = {
      title: latestTitle.current,
      body_md: latestBody.current,
    };
    try {
      const updated = await simuladosApi.updateNote(note.id, payload);
      dirty.current = false;
      setSaveStatus('saved');
      onSaved(updated);
      trackEvent('caderno_note_updated', {
        note_id: note.id,
        title_length: payload.title?.length ?? 0,
        body_length: payload.body_md?.length ?? 0,
      });
      logger.log('[NoteEditor] Note saved:', note.id);
      // Reset "Salvo" indicator after 3s
      setTimeout(() => setSaveStatus((s) => (s === 'saved' ? 'idle' : s)), 3000);
    } catch (err) {
      logger.error('[NoteEditor] Save failed:', err);
      setSaveStatus('error');
    }
  }, [note.id, onSaved]);

  // ── Debounced autosave ──────────────────────────────────────────────────

  const scheduleAutosave = useCallback(() => {
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      doSave();
    }, 1500);
  }, [doSave]);

  // ── Handlers ───────────────────────────────────────────────────────────

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setTitle(val);
    latestTitle.current = val;
    dirty.current = true;
    setSaveStatus('idle');
    scheduleAutosave();
  };

  const handleBodyChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setBody(val);
    latestBody.current = val;
    dirty.current = true;
    setSaveStatus('idle');
    scheduleAutosave();
  };

  // Ctrl/Cmd+S saves immediately
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (autosaveTimer.current) {
          clearTimeout(autosaveTimer.current);
          autosaveTimer.current = null;
        }
        doSave();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [doSave]);

  // Save on unmount if dirty
  useEffect(() => {
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
      if (dirty.current) {
        // Fire-and-forget on unmount
        simuladosApi
          .updateNote(note.id, {
            title: latestTitle.current,
            body_md: latestBody.current,
          })
          .catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note.id]);

  // ── Toolbar actions ────────────────────────────────────────────────────

  const applyFormat = (type: 'bold' | 'italic' | 'list') => {
    const ta = bodyRef.current;
    if (!ta) return;

    let newValue: string;
    if (type === 'bold') newValue = insertMarkdown(ta, '**');
    else if (type === 'italic') newValue = insertMarkdown(ta, '_');
    else newValue = insertMarkdown(ta, '', '- ');

    setBody(newValue);
    latestBody.current = newValue;
    dirty.current = true;
    setSaveStatus('idle');
    scheduleAutosave();
    // Restore focus
    ta.focus();
  };

  // ── Save status indicator ──────────────────────────────────────────────

  const SaveIndicator = () => {
    if (saveStatus === 'saving') {
      return (
        <span className="flex items-center gap-1 text-[11px] text-muted-foreground" role="status" aria-live="polite">
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
          Salvando…
        </span>
      );
    }
    if (saveStatus === 'saved') {
      return (
        <span className="flex items-center gap-1 text-[11px] text-success" role="status" aria-live="polite">
          <CheckCircle2 className="h-3 w-3" aria-hidden />
          Salvo
        </span>
      );
    }
    if (saveStatus === 'error') {
      return (
        <span className="flex items-center gap-1 text-[11px] text-destructive" role="status" aria-live="polite">
          <AlertCircle className="h-3 w-3" aria-hidden />
          Erro ao salvar
        </span>
      );
    }
    return null;
  };

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col">
      {/* Title field */}
      <div className="mb-3">
        <label htmlFor={titleId} className="sr-only">
          Título da anotação
        </label>
        <input
          ref={titleRef}
          id={titleId}
          type="text"
          value={title}
          onChange={handleTitleChange}
          placeholder="Título da anotação"
          maxLength={200}
          autoComplete="off"
          className={cn(
            'w-full rounded-xl border border-border bg-card px-4 py-3',
            'text-[17px] font-bold text-foreground placeholder:text-muted-foreground/50',
            'transition-colors duration-150',
            'focus-visible:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0',
          )}
          aria-describedby={`${titleId}-hint`}
        />
        <p id={`${titleId}-hint`} className="sr-only">
          Dê um título claro à sua anotação. Máximo 200 caracteres.
        </p>
      </div>

      {/* Toolbar + body */}
      <div
        className={cn(
          'flex flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card',
          'focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-0',
          'transition-colors duration-150',
        )}
      >
        {/* Toolbar */}
        <div
          className="flex items-center justify-between border-b border-border bg-muted/40 px-3 py-1.5"
          role="toolbar"
          aria-label="Formatação de texto"
        >
          <div className="flex items-center gap-0.5">
            <Tooltip delayDuration={300}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => applyFormat('bold')}
                  aria-label="Negrito (Ctrl+B não suportado, use botão)"
                  className={cn(
                    'rounded-md p-1.5 text-muted-foreground transition-colors',
                    'hover:bg-accent hover:text-foreground',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  )}
                >
                  <Bold className="h-3.5 w-3.5" aria-hidden />
                </button>
              </TooltipTrigger>
              <TooltipContent>Negrito (**texto**)</TooltipContent>
            </Tooltip>

            <Tooltip delayDuration={300}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => applyFormat('italic')}
                  aria-label="Itálico"
                  className={cn(
                    'rounded-md p-1.5 text-muted-foreground transition-colors',
                    'hover:bg-accent hover:text-foreground',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  )}
                >
                  <Italic className="h-3.5 w-3.5" aria-hidden />
                </button>
              </TooltipTrigger>
              <TooltipContent>Itálico (_texto_)</TooltipContent>
            </Tooltip>

            <Tooltip delayDuration={300}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => applyFormat('list')}
                  aria-label="Lista"
                  className={cn(
                    'rounded-md p-1.5 text-muted-foreground transition-colors',
                    'hover:bg-accent hover:text-foreground',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  )}
                >
                  <List className="h-3.5 w-3.5" aria-hidden />
                </button>
              </TooltipTrigger>
              <TooltipContent>Lista (- item)</TooltipContent>
            </Tooltip>

            <span className="mx-2 h-4 w-px bg-border" aria-hidden />

            <span className="text-[10px] font-medium text-muted-foreground/60">Markdown</span>
          </div>

          {/* Right: save status + manual save */}
          <div className="flex items-center gap-2">
            <SaveIndicator />
            <Tooltip delayDuration={300}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => {
                    if (autosaveTimer.current) {
                      clearTimeout(autosaveTimer.current);
                      autosaveTimer.current = null;
                    }
                    doSave();
                  }}
                  aria-label="Salvar agora (Ctrl+S)"
                  disabled={saveStatus === 'saving' || !dirty.current}
                  className={cn(
                    'rounded-md p-1.5 text-muted-foreground transition-colors',
                    'hover:bg-accent hover:text-foreground',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    'disabled:cursor-not-allowed disabled:opacity-40',
                  )}
                >
                  <Save className="h-3.5 w-3.5" aria-hidden />
                </button>
              </TooltipTrigger>
              <TooltipContent>Salvar agora (Ctrl+S)</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Textarea */}
        <label htmlFor={bodyId} className="sr-only">
          Corpo da anotação (markdown)
        </label>
        <textarea
          ref={bodyRef}
          id={bodyId}
          value={body}
          onChange={handleBodyChange}
          placeholder="Escreva sua anotação aqui… Suporte a markdown: **negrito**, _itálico_, - listas"
          className={cn(
            'flex-1 resize-none bg-transparent px-4 py-3',
            'font-mono text-[13px] leading-relaxed text-foreground placeholder:text-muted-foreground/40',
            'focus-visible:outline-none',
          )}
          aria-describedby={`${bodyId}-hint`}
          spellCheck
        />
        <p id={`${bodyId}-hint`} className="sr-only">
          Corpo da anotação em formato markdown. Use a barra de ferramentas para formatação.
          Ctrl+S salva imediatamente. As alterações são salvas automaticamente após 1,5 segundos.
        </p>
      </div>

      {/* Footer hint */}
      <p className="mt-2 text-right text-[11px] text-muted-foreground/50" aria-hidden>
        Ctrl+S para salvar · salvo automaticamente
      </p>
    </div>
  );
}
