/**
 * CadernoAnotacoesPage — aba Anotações do Caderno de Erros v2.
 *
 * Rota: /caderno/anotacoes  (gate PRO)
 *
 * Desktop ≥1024px:
 *   Master-detail: sidebar (lista + botão Nova) à esquerda + editor à direita.
 *   Largura máx 1120px, centrado no DashboardLayout.
 *
 * Mobile <768px:
 *   Lista 1 coluna. Ao abrir nota: editor tela cheia (estado mobileOpen).
 *   Voltar via MobileAppBar. Ação "Nova" via BottomActionBar.
 *
 * Backend: listNotes / createNote / updateNote / softDeleteNote (preservados).
 * Lógica de undo, autosave debounced, analytics — intactos.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Loader2, NotebookPen, BookOpen, PenLine } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { simuladosApi } from '@/services/simuladosApi';
import { trackEvent } from '@/lib/analytics';
import { logger } from '@/lib/logger';
import { toast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/useIsMobile';

import { PageTransition } from '@/components/premium/PageTransition';
import { ProGate } from '@/components/ProGate';

import { NoteList } from '@/components/caderno/anotacoes/NoteList';
import { NoteEditor } from '@/components/caderno/anotacoes/NoteEditor';
import { NotesEmptyState } from '@/components/caderno/anotacoes/NotesEmptyState';

import {
  MobileAppBar,
  BottomActionBar,
  SectionHeader,
  SkeletonLine,
} from '@/components/caderno/ui';

import { useUser } from '@/contexts/UserContext';
import { SEGMENT_ACCESS } from '@/types';
import type { UserNote, CreateNotePayload } from '@/types/caderno';

// ── Query key ────────────────────────────────────────────────────────────────

const NOTES_QUERY_KEY = ['caderno', 'notes'] as const;

// ── Loading skeleton ─────────────────────────────────────────────────────────

function NotesSkeleton() {
  return (
    <div
      className="flex h-[520px] gap-5 lg:gap-6"
      aria-busy="true"
      aria-label="Carregando anotações"
    >
      {/* Sidebar skeleton */}
      <div className="hidden w-64 shrink-0 flex-col gap-2 lg:flex xl:w-72">
        <SkeletonLine className="h-9 w-full rounded-[var(--c-radius-control)]" />
        {[1, 2, 3, 4].map((i) => (
          <SkeletonLine key={i} className="h-[72px] w-full rounded-[var(--c-radius-control)]" />
        ))}
      </div>
      {/* Editor skeleton */}
      <div className="flex flex-1 flex-col gap-3">
        <SkeletonLine className="h-10 w-3/5 rounded-md" />
        <SkeletonLine className="h-[440px] w-full rounded-[var(--c-radius-card)]" />
      </div>
    </div>
  );
}

// ── Mobile: "Nova nota" button (compact for AppBar action slot) ──────────────

function NewNoteButtonCompact({
  onClick,
  loading,
}: {
  onClick: () => void;
  loading: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      aria-label="Criar nova anotação"
      className={cn(
        'flex h-9 items-center gap-1.5 rounded-[var(--c-radius-control)]',
        'bg-gradient-to-r from-[var(--c-wine-500)] to-[var(--c-wine-700)]',
        'px-3 text-[12px] font-semibold text-white',
        'transition-all duration-150 hover:brightness-110',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--c-wine-500)_60%,transparent)] focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-60',
      )}
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
      ) : (
        <Plus className="h-3.5 w-3.5" aria-hidden />
      )}
      Nova
    </button>
  );
}

// ── Desktop: "Nova anotação" primary action button ────────────────────────────

function NewNoteButton({
  onClick,
  loading,
}: {
  onClick: () => void;
  loading: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      aria-label="Criar nova anotação"
      className={cn(
        'flex w-full items-center justify-center gap-2',
        'rounded-[var(--c-radius-control)] border border-[color-mix(in_srgb,var(--c-wine-500)_25%,transparent)]',
        'bg-gradient-to-r from-[color-mix(in_srgb,var(--c-wine-500)_8%,transparent)] to-[color-mix(in_srgb,var(--c-wine-700)_8%,transparent)]',
        'px-4 py-2.5 text-[13px] font-semibold text-[var(--c-wine-600)] dark:text-[var(--c-wine-400)]',
        'transition-all duration-[var(--c-duration-fast)]',
        'hover:border-[color-mix(in_srgb,var(--c-wine-500)_40%,transparent)] hover:bg-[color-mix(in_srgb,var(--c-wine-500)_12%,transparent)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--c-wine-500)_40%,transparent)] focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-60',
      )}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      ) : (
        <Plus className="h-4 w-4" aria-hidden />
      )}
      Nova anotação
    </button>
  );
}

// ── Editor placeholder (desktop: nothing selected yet) ────────────────────────

function EditorPlaceholder() {
  return (
    <div className="flex h-full flex-1 flex-col items-center justify-center gap-3 rounded-[var(--c-radius-card)] border border-dashed border-[var(--c-border)] bg-[var(--c-surface)]">
      <NotebookPen
        className="h-10 w-10 text-[color-mix(in_srgb,var(--c-muted-2)_30%,transparent)]"
        aria-hidden
      />
      <p className="text-[13px] text-[var(--c-muted)]">
        Selecione uma anotação para editar
      </p>
    </div>
  );
}

// ── Main content (inner, after PRO gate) ─────────────────────────────────────

function AnotacoesContent() {
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const didAutoSelect = useRef(false);

  // Mobile-only: whether the editor is shown (full-screen overlay)
  const [mobileEditorOpen, setMobileEditorOpen] = useState(false);

  // ── Fetch notes ──────────────────────────────────────────────────────────

  const { data: notes = [], isLoading, isError } = useQuery<UserNote[]>({
    queryKey: NOTES_QUERY_KEY,
    queryFn: () => simuladosApi.listNotes(),
    staleTime: 2 * 60 * 1000,
  });

  // Auto-select first note on first load (desktop)
  useEffect(() => {
    if (!isLoading && notes.length > 0 && !selectedId && !didAutoSelect.current && !isMobile) {
      didAutoSelect.current = true;
      setSelectedId(notes[0].id);
    }
  }, [isLoading, notes, selectedId, isMobile]);

  // ── Create note ──────────────────────────────────────────────────────────

  const createMutation = useMutation<UserNote, Error, CreateNotePayload>({
    mutationFn: (payload) => simuladosApi.createNote(payload),
    onSuccess: (created) => {
      queryClient.setQueryData<UserNote[]>(NOTES_QUERY_KEY, (prev = []) => [created, ...prev]);
      setSelectedId(created.id);
      setCreating(false);
      if (isMobile) setMobileEditorOpen(true);
      toast({ title: 'Anotação criada', description: 'Comece a escrever e será salva automaticamente.' });
      trackEvent('caderno_note_created', { note_id: created.id });
      logger.log('[CadernoAnotacoesPage] Note created:', created.id);
    },
    onError: (err) => {
      logger.error('[CadernoAnotacoesPage] Create note failed:', err);
      setCreating(false);
      toast({
        title: 'Não foi possível criar a anotação',
        description: 'Verifique sua conexão e tente novamente.',
        variant: 'destructive',
      });
    },
  });

  const handleCreateNote = useCallback(() => {
    if (creating || createMutation.isPending) return;
    setCreating(true);
    createMutation.mutate({ title: '', body_md: '' });
  }, [creating, createMutation]);

  // ── Delete note (optimistic + undo) ──────────────────────────────────────

  const handleDeleteNote = useCallback(
    (note: UserNote) => {
      const prevNotes = queryClient.getQueryData<UserNote[]>(NOTES_QUERY_KEY) ?? [];

      queryClient.setQueryData<UserNote[]>(NOTES_QUERY_KEY, (prev = []) =>
        prev.filter((n) => n.id !== note.id),
      );

      if (selectedId === note.id) {
        const idx = prevNotes.findIndex((n) => n.id === note.id);
        const next = prevNotes[idx + 1] ?? prevNotes[idx - 1] ?? null;
        setSelectedId(next?.id ?? null);
        if (isMobile) setMobileEditorOpen(false);
      }

      let undone = false;

      const toastInstance = toast({
        title: 'Anotação excluída',
        duration: 5000,
        action: (
          <ToastAction
            altText="Desfazer exclusão"
            onClick={() => {
              undone = true;
              queryClient.setQueryData<UserNote[]>(NOTES_QUERY_KEY, prevNotes);
              setSelectedId(note.id);
              toastInstance.dismiss();
            }}
          >
            Desfazer
          </ToastAction>
        ),
      });

      setTimeout(async () => {
        if (undone) return;
        try {
          await simuladosApi.softDeleteNote(note.id);
          logger.log('[CadernoAnotacoesPage] Note deleted:', note.id);
        } catch (err) {
          logger.error('[CadernoAnotacoesPage] Delete failed:', err);
          queryClient.setQueryData<UserNote[]>(NOTES_QUERY_KEY, prevNotes);
          setSelectedId(note.id);
          toast({
            title: 'Não foi possível excluir a anotação',
            description: 'Tente novamente em instantes.',
            variant: 'destructive',
          });
        }
      }, 5100);
    },
    [queryClient, selectedId, isMobile],
  );

  // ── Handle save from NoteEditor ───────────────────────────────────────────

  const handleNoteSaved = useCallback(
    (updated: UserNote) => {
      queryClient.setQueryData<UserNote[]>(NOTES_QUERY_KEY, (prev = []) => {
        const without = prev.filter((n) => n.id !== updated.id);
        return [updated, ...without];
      });
    },
    [queryClient],
  );

  // ── Derived ───────────────────────────────────────────────────────────────

  const selectedNote = notes.find((n) => n.id === selectedId) ?? null;
  const isBusy = createMutation.isPending || creating;

  // ── Loading & error states ─────────────────────────────────────────────────

  if (isLoading) return <NotesSkeleton />;

  if (isError) {
    return (
      <div className="rounded-[var(--c-radius-card)] border border-destructive/20 bg-destructive/[0.04] px-6 py-10 text-center">
        <p className="text-[13px] text-destructive">
          Não foi possível carregar as anotações. Verifique sua conexão e recarregue a página.
        </p>
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────────────────────
  // MOBILE layout
  // ────────────────────────────────────────────────────────────────────────────

  if (isMobile) {
    return (
      <div className="caderno-root relative">
        {/* ── Mobile: Note list view ── */}
        <AnimatePresence mode="wait">
          {!mobileEditorOpen && (
            <motion.div
              key="mobile-list"
              className="flex flex-col"
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            >
              {notes.length === 0 ? (
                <div className="px-4 py-8">
                  <NotesEmptyState onCreateNote={handleCreateNote} />
                </div>
              ) : (
                <div className="px-4 pb-[88px]">
                  <SectionHeader
                    title="Anotações"
                    count={notes.length}
                    className="pb-3 pt-2"
                  />
                  <NoteList
                    notes={notes}
                    selectedId={selectedId}
                    onSelect={(note) => {
                      setSelectedId(note.id);
                      setMobileEditorOpen(true);
                    }}
                    onDelete={handleDeleteNote}
                  />
                </div>
              )}

              {/* Mobile: BottomActionBar with "Nova" button */}
              <BottomActionBar>
                <button
                  type="button"
                  onClick={handleCreateNote}
                  disabled={isBusy}
                  aria-label="Criar nova anotação"
                  className={cn(
                    'flex flex-1 items-center justify-center gap-2',
                    'rounded-[var(--c-radius-control)]',
                    'bg-gradient-to-r from-[var(--c-wine-500)] to-[var(--c-wine-700)]',
                    'py-3 text-[14px] font-bold text-white',
                    'shadow-[var(--c-shadow-glow)]',
                    'transition-all duration-150 hover:brightness-110 active:scale-[0.98]',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--c-wine-500)_60%,transparent)] focus-visible:ring-offset-2',
                    'disabled:cursor-not-allowed disabled:opacity-60',
                  )}
                >
                  {isBusy ? (
                    <Loader2 className="h-[18px] w-[18px] animate-spin" aria-hidden />
                  ) : (
                    <PenLine className="h-[18px] w-[18px]" aria-hidden />
                  )}
                  Nova anotação
                </button>
              </BottomActionBar>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Mobile: Full-screen editor ── */}
        <AnimatePresence>
          {mobileEditorOpen && selectedNote && (
            <motion.div
              key="mobile-editor"
              className="fixed inset-0 z-40 flex flex-col bg-[var(--c-bg)]"
              initial={{ opacity: 0, x: 32 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 32 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            >
              <MobileAppBar
                title={selectedNote.title || 'Nova anotação'}
                onBack={() => {
                  setMobileEditorOpen(false);
                }}
                action={
                  <NewNoteButtonCompact onClick={handleCreateNote} loading={isBusy} />
                }
              />
              <div className="flex-1 overflow-y-auto px-4 py-4 pb-[80px]">
                <NoteEditor note={selectedNote} onSaved={handleNoteSaved} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────────────────────
  // DESKTOP layout — master-detail
  // ────────────────────────────────────────────────────────────────────────────

  return (
    <div
      className="caderno-root flex min-h-[560px] gap-5 lg:gap-6"
      aria-label="Anotações"
    >
      {/* ── Sidebar (master) ── */}
      <aside
        className={cn(
          'flex w-64 shrink-0 flex-col gap-3 xl:w-72',
          'hidden lg:flex',
        )}
        aria-label="Suas anotações"
      >
        <NewNoteButton onClick={handleCreateNote} loading={isBusy} />

        {notes.length > 0 && (
          <p className="select-none px-0.5 text-[11px] font-semibold text-[var(--c-muted-2)]">
            {notes.length} {notes.length === 1 ? 'anotação' : 'anotações'}
          </p>
        )}

        <div className="flex-1 overflow-y-auto pr-0.5">
          <NoteList
            notes={notes}
            selectedId={selectedId}
            onSelect={(note) => setSelectedId(note.id)}
            onDelete={handleDeleteNote}
          />
        </div>
      </aside>

      {/* ── Editor area (detail) ── */}
      <main
        className="flex min-h-[520px] flex-1 flex-col"
        aria-label="Editor de anotação"
      >
        <AnimatePresence mode="wait">
          {selectedNote ? (
            <motion.div
              key={selectedNote.id}
              className="flex h-full flex-1 flex-col"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            >
              <NoteEditor note={selectedNote} onSaved={handleNoteSaved} />
            </motion.div>
          ) : notes.length === 0 ? (
            <motion.div
              key="empty"
              className="flex flex-1 items-center justify-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <NotesEmptyState onCreateNote={handleCreateNote} />
            </motion.div>
          ) : (
            <motion.div
              key="placeholder"
              className="flex flex-1 flex-col"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <EditorPlaceholder />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

// ── Page export ───────────────────────────────────────────────────────────────

export default function CadernoAnotacoesPage() {
  const { profile } = useUser();
  const segment = profile?.segment ?? 'guest';
  const hasAccess = SEGMENT_ACCESS[segment].cadernoErros;

  return (
    <PageTransition>
      {!hasAccess ? (
        <ProGate
          icon={BookOpen}
          feature="Anotações do Caderno"
          description="Crie anotações livres com título e texto markdown. Organize resumos de temas, dicas clínicas e ideias de estudo em um só lugar."
          requiredSegment="pro"
          currentSegment={segment}
          benefits={[
            'Anotações com título e corpo em markdown',
            'Salvo automaticamente conforme você escreve',
            'Organizado junto com seus erros e favoritos',
          ]}
        />
      ) : (
        <AnotacoesContent />
      )}
    </PageTransition>
  );
}
