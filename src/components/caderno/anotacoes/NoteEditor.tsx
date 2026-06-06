/**
 * NoteEditor — editor premium com campo de título + corpo markdown.
 *
 * Funcionalidades (lógica preservada integralmente):
 * - Campo de título destacado (heading premium)
 * - Textarea de corpo markdown com toolbar leve (B / I / lista / heading / código)
 * - Autosave debounced (~1500ms) chamando updateNote
 * - Indicador "Salvo" / "Salvando…" / "Erro ao salvar" integrado à toolbar
 * - Ctrl/Cmd+S salva imediatamente
 * - Race-fix do unmount (flush do nó anterior antes de mudar de nota)
 *
 * Design:
 * - Título: campo transparente fullwidth com text-heading-1, borda bottom ao focar
 * - Toolbar: separador sutil, botões com tooltip, indicador autosave à direita
 * - Textarea: flex-1, fonte de leitura, padding generoso, sem border própria
 * - Contentor: CadernoCard com borda wine ao focar (focus-within)
 */

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useId,
} from 'react';
import {
  Bold,
  Italic,
  List,
  Save,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Heading2,
  Code,
} from 'lucide-react';
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
    const lineStart = value.lastIndexOf('\n', start - 1) + 1;
    const before = value.slice(0, lineStart);
    const lineContent = value.slice(lineStart);
    const newValue = before + linePrefix + lineContent;
    const newCursor = start + linePrefix.length;
    textarea.value = newValue;
    textarea.setSelectionRange(newCursor, newCursor + (end - start));
    return newValue;
  }

  const before = value.slice(0, start);
  const after = value.slice(end);
  const newValue = `${before}${wrap}${selected || 'texto'}${wrap}${after}`;
  const newStart = start + wrap.length;
  const newEnd = newStart + (selected || 'texto').length;
  textarea.value = newValue;
  textarea.setSelectionRange(newStart, newEnd);
  return newValue;
}

// ── SaveIndicator (inline) ─────────────────────────────────────────────────

function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === 'saving') {
    return (
      <span
        className="flex items-center gap-1 text-[11px] font-medium text-[var(--c-muted)]"
        role="status"
        aria-live="polite"
      >
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
        Salvando…
      </span>
    );
  }
  if (status === 'saved') {
    return (
      <span
        className="flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400"
        role="status"
        aria-live="polite"
      >
        <CheckCircle2 className="h-3 w-3" aria-hidden />
        Salvo
      </span>
    );
  }
  if (status === 'error') {
    return (
      <span
        className="flex items-center gap-1 text-[11px] font-medium text-destructive"
        role="status"
        aria-live="polite"
      >
        <AlertCircle className="h-3 w-3" aria-hidden />
        Erro ao salvar
      </span>
    );
  }
  return null;
}

// ── ToolbarButton ──────────────────────────────────────────────────────────

interface ToolbarButtonProps {
  onClick: () => void;
  disabled?: boolean;
  label: string;
  tooltip: string;
  children: React.ReactNode;
}

function ToolbarButton({ onClick, disabled, label, tooltip, children }: ToolbarButtonProps) {
  return (
    <Tooltip delayDuration={300}>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          aria-label={label}
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded-lg transition-colors',
            'text-[var(--c-muted)] duration-[var(--c-duration-fast)]',
            'hover:bg-[var(--c-surface-2)] hover:text-[var(--c-ink)]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-wine-500)]/40',
            'disabled:cursor-not-allowed disabled:opacity-40',
          )}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent className="text-[11px]">{tooltip}</TooltipContent>
    </Tooltip>
  );
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
  const dirty = useRef(false);
  const activeNoteId = useRef(note.id);

  // When note prop changes, flush pending save of the PREVIOUS note BEFORE resetting state.
  useEffect(() => {
    const prevId = activeNoteId.current;
    const prevTitle = latestTitle.current;
    const prevBody = latestBody.current;
    const wasDirty = dirty.current;

    if (autosaveTimer.current) {
      clearTimeout(autosaveTimer.current);
      autosaveTimer.current = null;
    }
    if (wasDirty && prevId) {
      simuladosApi
        .updateNote(prevId, { title: prevTitle, body_md: prevBody })
        .catch(() => {});
    }

    activeNoteId.current = note.id;
    setTitle(note.title);
    setBody(note.body_md);
    latestTitle.current = note.title;
    latestBody.current = note.body_md;
    dirty.current = false;
    setSaveStatus('idle');
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
      setTimeout(() => setSaveStatus((s) => (s === 'saved' ? 'idle' : s)), 3000);
    } catch (err) {
      logger.error('[NoteEditor] Save failed:', err);
      setSaveStatus('error');
    }
  }, [note.id, onSaved]);

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
        simuladosApi
          .updateNote(activeNoteId.current, {
            title: latestTitle.current,
            body_md: latestBody.current,
          })
          .catch(() => {});
      }
    };
  }, []);

  // ── Toolbar actions ────────────────────────────────────────────────────

  const applyFormat = (type: 'bold' | 'italic' | 'list' | 'heading' | 'code') => {
    const ta = bodyRef.current;
    if (!ta) return;

    let newValue: string;
    if (type === 'bold') newValue = insertMarkdown(ta, '**');
    else if (type === 'italic') newValue = insertMarkdown(ta, '_');
    else if (type === 'list') newValue = insertMarkdown(ta, '', '- ');
    else if (type === 'heading') newValue = insertMarkdown(ta, '', '## ');
    else newValue = insertMarkdown(ta, '`');

    setBody(newValue);
    latestBody.current = newValue;
    dirty.current = true;
    setSaveStatus('idle');
    scheduleAutosave();
    ta.focus();
  };

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col gap-0">
      {/* ── Title field ── */}
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
            'w-full border-0 border-b-2 border-transparent bg-transparent px-1 py-2',
            'text-[22px] font-extrabold tracking-tight text-[var(--c-ink)] placeholder:text-[var(--c-muted-2)]/50',
            'transition-colors duration-[var(--c-duration-fast)]',
            'focus-visible:border-b-[var(--c-wine-500)]/50 focus-visible:outline-none',
          )}
          aria-describedby={`${titleId}-hint`}
        />
        <p id={`${titleId}-hint`} className="sr-only">
          Dê um título claro à sua anotação. Máximo 200 caracteres.
        </p>
      </div>

      {/* ── Editor card (toolbar + textarea) ── */}
      <div
        className={cn(
          'flex flex-1 flex-col overflow-hidden',
          'rounded-[var(--c-radius-card)] border border-[var(--c-border)] bg-[var(--c-surface)]',
          'shadow-[var(--c-shadow-sm)]',
          'transition-all duration-[var(--c-duration-fast)]',
          'focus-within:border-[var(--c-wine-500)]/40 focus-within:shadow-[0_0_0_3px_rgba(176,41,74,.07)]',
        )}
      >
        {/* Toolbar */}
        <div
          className={cn(
            'flex items-center justify-between gap-2',
            'border-b border-[var(--c-border)] bg-[var(--c-surface-2)]/60 px-3 py-1.5',
          )}
          role="toolbar"
          aria-label="Formatação de texto"
        >
          {/* Left: format buttons */}
          <div className="flex items-center gap-0.5">
            <ToolbarButton
              onClick={() => applyFormat('bold')}
              label="Negrito"
              tooltip="Negrito (**texto**)"
            >
              <Bold className="h-3.5 w-3.5" aria-hidden />
            </ToolbarButton>

            <ToolbarButton
              onClick={() => applyFormat('italic')}
              label="Itálico"
              tooltip="Itálico (_texto_)"
            >
              <Italic className="h-3.5 w-3.5" aria-hidden />
            </ToolbarButton>

            <ToolbarButton
              onClick={() => applyFormat('heading')}
              label="Título"
              tooltip="Título (## texto)"
            >
              <Heading2 className="h-3.5 w-3.5" aria-hidden />
            </ToolbarButton>

            <ToolbarButton
              onClick={() => applyFormat('list')}
              label="Lista"
              tooltip="Lista (- item)"
            >
              <List className="h-3.5 w-3.5" aria-hidden />
            </ToolbarButton>

            <ToolbarButton
              onClick={() => applyFormat('code')}
              label="Código inline"
              tooltip="Código (`código`)"
            >
              <Code className="h-3.5 w-3.5" aria-hidden />
            </ToolbarButton>

            <span
              className="mx-1.5 h-4 w-px bg-[var(--c-border)]"
              aria-hidden
            />
            <span className="select-none text-[10px] font-semibold uppercase tracking-wide text-[var(--c-muted-2)]">
              Markdown
            </span>
          </div>

          {/* Right: save status + manual save */}
          <div className="flex items-center gap-2">
            <SaveIndicator status={saveStatus} />

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
                    'flex h-7 w-7 items-center justify-center rounded-lg transition-colors',
                    'text-[var(--c-muted)] duration-[var(--c-duration-fast)]',
                    'hover:bg-[var(--c-wine-50)] hover:text-[var(--c-wine-500)]',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-wine-500)]/40',
                    'disabled:cursor-not-allowed disabled:opacity-40',
                  )}
                >
                  <Save className="h-3.5 w-3.5" aria-hidden />
                </button>
              </TooltipTrigger>
              <TooltipContent className="text-[11px]">Salvar agora (Ctrl+S)</TooltipContent>
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
          placeholder={
            'Escreva sua anotação aqui…\n\nSuporta markdown: **negrito**, _itálico_, ## título, - listas, `código`'
          }
          className={cn(
            'flex-1 resize-none bg-transparent px-4 py-4',
            'font-mono text-[13px] leading-[1.75] text-[var(--c-ink)]',
            'placeholder:text-[var(--c-muted-2)]/40',
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
      <p
        className="mt-1.5 text-right text-[11px] text-[var(--c-muted-2)]/60 select-none"
        aria-hidden
      >
        Salvo automaticamente · Ctrl+S para salvar agora
      </p>
    </div>
  );
}
