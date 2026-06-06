/**
 * CadernoAnotacoesPage — aba Anotações do Caderno de Erros v2.
 *
 * Rota: /caderno/anotacoes  (gate PRO)
 * Estrutura:
 *   - Sidebar: NoteList + botão "Nova anotação"
 *   - Main: NoteEditor (nota selecionada) ou NotesEmptyState
 *
 * Backend via simuladosApi:
 *   listNotes() · createNote() · updateNote() · softDeleteNote()
 *
 * Padrão de undo: optimistic remove + toast com ação "Desfazer" (5s).
 * Analytics: caderno_note_created / caderno_note_updated.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Loader2, NotebookPen, BookOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { simuladosApi } from '@/services/simuladosApi';
import { trackEvent } from '@/lib/analytics';
import { logger } from '@/lib/logger';
import { toast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { cn } from '@/lib/utils';

import { PageTransition } from '@/components/premium/PageTransition';
import { ProGate } from '@/components/ProGate';
import { TabBar } from '@/components/caderno/TabBar';

import { NoteList } from '@/components/caderno/anotacoes/NoteList';
import { NoteEditor } from '@/components/caderno/anotacoes/NoteEditor';
import { NotesEmptyState } from '@/components/caderno/anotacoes/NotesEmptyState';

import { useUser } from '@/contexts/UserContext';
import { SEGMENT_ACCESS } from '@/types';
import type { UserNote, CreateNotePayload } from '@/types/caderno';

// ── Query key ────────────────────────────────────────────────────────────────

const NOTES_QUERY_KEY = ['caderno', 'notes'] as const;

// ── Loading skeleton ─────────────────────────────────────────────────────────

function NotesSkeleton() {
  return (
    <div className="flex h-[520px] gap-5" aria-busy="true" aria-label="Carregando anotações">
      {/* Sidebar skeleton */}
      <div className="w-64 shrink-0 space-y-2 lg:w-72">
        <div className="h-9 w-full animate-pulse rounded-xl bg-muted" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
      {/* Editor skeleton */}
      <div className="flex-1 space-y-3">
        <div className="h-12 animate-pulse rounded-xl bg-muted" />
        <div className="h-[440px] animate-pulse rounded-xl bg-muted" />
      </div>
    </div>
  );
}

// ── Main content (inner, after PRO gate) ─────────────────────────────────────

function AnotacoesContent() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const didAutoSelect = useRef(false);

  // ── Fetch notes ──────────────────────────────────────────────────────────

  const { data: notes = [], isLoading, isError } = useQuery<UserNote[]>({
    queryKey: NOTES_QUERY_KEY,
    queryFn: () => simuladosApi.listNotes(),
    staleTime: 2 * 60 * 1000,
  });

  // Auto-select first note on first load
  useEffect(() => {
    if (!isLoading && notes.length > 0 && !selectedId && !didAutoSelect.current) {
      didAutoSelect.current = true;
      setSelectedId(notes[0].id);
    }
  }, [isLoading, notes, selectedId]);

  // ── Create note ──────────────────────────────────────────────────────────

  const createMutation = useMutation<UserNote, Error, CreateNotePayload>({
    mutationFn: (payload) => simuladosApi.createNote(payload),
    onSuccess: (created) => {
      queryClient.setQueryData<UserNote[]>(NOTES_QUERY_KEY, (prev = []) => [created, ...prev]);
      setSelectedId(created.id);
      setCreating(false);
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
    createMutation.mutate({
      title: '',
      body_md: '',
    });
  }, [creating, createMutation]);

  // ── Delete note (optimistic + undo) ──────────────────────────────────────

  const handleDeleteNote = useCallback(
    (note: UserNote) => {
      const prevNotes = queryClient.getQueryData<UserNote[]>(NOTES_QUERY_KEY) ?? [];

      // Optimistic remove
      queryClient.setQueryData<UserNote[]>(NOTES_QUERY_KEY, (prev = []) =>
        prev.filter((n) => n.id !== note.id),
      );

      // Select adjacent note if deleted note was selected
      if (selectedId === note.id) {
        const idx = prevNotes.findIndex((n) => n.id === note.id);
        const next = prevNotes[idx + 1] ?? prevNotes[idx - 1] ?? null;
        setSelectedId(next?.id ?? null);
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

      // Commit after 5s if not undone
      setTimeout(async () => {
        if (undone) return;
        try {
          await simuladosApi.softDeleteNote(note.id);
          logger.log('[CadernoAnotacoesPage] Note deleted:', note.id);
        } catch (err) {
          logger.error('[CadernoAnotacoesPage] Delete failed:', err);
          // Restore on API failure
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
    [queryClient, selectedId],
  );

  // ── Handle save from NoteEditor ───────────────────────────────────────────

  const handleNoteSaved = useCallback(
    (updated: UserNote) => {
      queryClient.setQueryData<UserNote[]>(NOTES_QUERY_KEY, (prev = []) => {
        // Move updated note to top, update its data
        const without = prev.filter((n) => n.id !== updated.id);
        return [updated, ...without];
      });
    },
    [queryClient],
  );

  // ── Derived ───────────────────────────────────────────────────────────────

  const selectedNote = notes.find((n) => n.id === selectedId) ?? null;
  const isBusy = createMutation.isPending || creating;

  // ── Render ────────────────────────────────────────────────────────────────

  if (isLoading) return <NotesSkeleton />;

  if (isError) {
    return (
      <div className="rounded-2xl border border-destructive/20 bg-destructive/[0.04] px-6 py-10 text-center">
        <p className="text-body-sm text-destructive">
          Não foi possível carregar as anotações. Verifique sua conexão e recarregue a página.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-[520px] flex-col gap-5 lg:flex-row lg:gap-6">
      {/* ── Sidebar ── */}
      <aside
        className="flex w-full shrink-0 flex-col gap-3 lg:w-64 xl:w-72"
        aria-label="Suas anotações"
      >
        {/* New note button */}
        <button
          type="button"
          onClick={handleCreateNote}
          disabled={isBusy}
          aria-label="Criar nova anotação"
          className={cn(
            'flex w-full items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/[0.06]',
            'px-4 py-2.5 text-[13px] font-semibold text-primary',
            'transition-all duration-150 hover:bg-primary/10',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-60',
          )}
        >
          {isBusy ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Plus className="h-4 w-4" aria-hidden />
          )}
          Nova anotação
        </button>

        {/* Count */}
        {notes.length > 0 && (
          <p className="text-[11px] text-muted-foreground">
            {notes.length} {notes.length === 1 ? 'anotação' : 'anotações'}
          </p>
        )}

        {/* Note list */}
        <NoteList
          notes={notes}
          selectedId={selectedId}
          onSelect={(note) => setSelectedId(note.id)}
          onDelete={handleDeleteNote}
        />
      </aside>

      {/* ── Editor area ── */}
      <main className="flex flex-1 flex-col" aria-label="Editor de anotação">
        <AnimatePresence mode="wait">
          {selectedNote ? (
            <motion.div
              key={selectedNote.id}
              className="flex h-full flex-1 flex-col"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18 }}
            >
              <NoteEditor
                note={selectedNote}
                onSaved={handleNoteSaved}
              />
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
              className="flex flex-1 items-center justify-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <div className="text-center">
                <NotebookPen className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" aria-hidden />
                <p className="text-body-sm text-muted-foreground">
                  Selecione uma anotação ao lado para editar.
                </p>
              </div>
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
      <TabBar />

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
