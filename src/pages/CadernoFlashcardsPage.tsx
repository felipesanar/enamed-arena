/**
 * CadernoFlashcardsPage — aba Flashcards do Caderno de Erros v2 (Fase 2).
 *
 * Rota: /caderno/flashcards  (gate PRO).
 *
 * Funcionalidades:
 * - Lista de decks (DeckList) + criar deck
 * - Lista de flashcards por deck (FlashcardItem) com React Query
 * - Criar/editar via FlashcardEditor (modal)
 * - Sessão de revisão SRS (FlashcardReviewSession)
 * - Botão "Revisar devidos" sempre visível quando há cards devidos
 * - Estados: vazio, loading, erro, zero-devidos
 * - Exclusão com optimistic update + toast undo (5s)
 */

import { useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import {
  BookOpen,
  Play,
  Plus,
  Layers,
  Loader2,
  AlertCircle,
  RefreshCw,
  Sparkles,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { logger } from '@/lib/logger';
import { toast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { trackEvent } from '@/lib/analytics';
import { simuladosApi } from '@/services/simuladosApi';
import { Button } from '@/components/ui/button';
import { SEGMENT_ACCESS } from '@/types';

import { PageTransition, StaggerContainer, StaggerItem } from '@/components/premium/PageTransition';
import { ProGate } from '@/components/ProGate';
import { TabBar } from '@/components/caderno/TabBar';

import { DeckList } from '@/components/caderno/flashcards/DeckList';
import { FlashcardItem } from '@/components/caderno/flashcards/FlashcardItem';
import { FlashcardEditor } from '@/components/caderno/flashcards/FlashcardEditor';
import { FlashcardReviewSession } from '@/components/caderno/flashcards/FlashcardReviewSession';

import { useUser } from '@/contexts/UserContext';
import type { Deck, Flashcard } from '@/types/caderno';

/* ── Query keys ── */

const QUERY_DECKS = ['caderno', 'decks'] as const;
const queryFlashcards = (deckId: string | null) =>
  ['caderno', 'flashcards', deckId ?? 'all'] as const;
const QUERY_DUE = ['caderno', 'flashcards', 'due'] as const;

/* ── Skeleton ── */

function FlashcardsSkeletonList() {
  return (
    <div className="flex flex-col gap-2" aria-busy="true" aria-label="Carregando flashcards">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="flex h-[88px] animate-pulse items-start gap-3 rounded-xl border border-border bg-card p-4"
        >
          <div className="h-14 w-14 shrink-0 rounded-lg bg-muted/60" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-3/4 rounded bg-muted/60" />
            <div className="h-3 w-1/2 rounded bg-muted/40" />
            <div className="h-5 w-16 rounded-full bg-muted/40" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── EmptyDecks state ── */

function EmptyDecksState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="mx-auto max-w-md rounded-3xl border-2 border-dashed border-primary/20 bg-primary/[0.03] p-10 text-center">
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent">
        <Layers className="h-7 w-7 text-primary" aria-hidden />
      </div>
      <h3 className="text-heading-2 text-foreground">Nenhum deck ainda</h3>
      <p className="mx-auto mt-2 max-w-sm text-body leading-relaxed text-muted-foreground">
        Crie seu primeiro deck para organizar flashcards por tema, área ou prova.
      </p>
      <Button onClick={onCreate} className="mt-6 gap-2">
        <Plus className="h-4 w-4" aria-hidden />
        Criar primeiro deck
      </Button>
    </div>
  );
}

/* ── EmptyCards state ── */

function EmptyCardsState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/40 px-6 py-10 text-center">
      <BookOpen className="mx-auto mb-3 h-8 w-8 text-muted-foreground/30" aria-hidden />
      <p className="text-[13px] font-medium text-muted-foreground">
        Este deck não tem flashcards ainda.
      </p>
      <button
        type="button"
        onClick={onAdd}
        className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-semibold text-primary transition-colors hover:text-primary/80 focus-visible:outline-none focus-visible:underline"
      >
        <Plus className="h-3.5 w-3.5" aria-hidden />
        Adicionar primeiro flashcard
      </button>
    </div>
  );
}

/* ── ZeroDueState ── */

function ZeroDueState({ total }: { total: number }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
      <Sparkles className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden />
      <p className="text-[13px] text-muted-foreground">
        <span className="font-semibold text-foreground">Nenhum card para revisar hoje</span> —{' '}
        {total} {total === 1 ? 'card' : 'cards'} agendado{total === 1 ? '' : 's'} para o futuro.
      </p>
    </div>
  );
}

/* ── FlashcardsContent ── */

function FlashcardsContent() {
  const qc = useQueryClient();

  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<Flashcard | null>(null);
  const [reviewMode, setReviewMode] = useState(false);
  const [reviewCards, setReviewCards] = useState<Flashcard[]>([]);

  /* ── Queries ── */

  const {
    data: decks = [],
    isLoading: decksLoading,
    isError: decksError,
    refetch: refetchDecks,
  } = useQuery({
    queryKey: QUERY_DECKS,
    queryFn: () => simuladosApi.listDecks(),
  });

  const {
    data: flashcards = [],
    isLoading: cardsLoading,
    isError: cardsError,
  } = useQuery({
    queryKey: queryFlashcards(selectedDeckId),
    queryFn: () => simuladosApi.listFlashcards(selectedDeckId ?? undefined),
  });

  const { data: dueFlashcards = [] } = useQuery({
    queryKey: QUERY_DUE,
    queryFn: () => simuladosApi.getDueFlashcards(),
    staleTime: 2 * 60 * 1000,
  });

  /* ── Mutations ── */

  const { mutateAsync: createDeckMut, isPending: creatingDeck } = useMutation({
    mutationFn: (name: string) => simuladosApi.createDeck(name),
    onSuccess: (deck) => {
      qc.invalidateQueries({ queryKey: QUERY_DECKS });
      setSelectedDeckId(deck.id);
      toast({ title: `Deck "${deck.name}" criado` });
    },
    onError: (err) => {
      logger.error('[CadernoFlashcardsPage] createDeck error:', err);
      toast({ title: 'Não foi possível criar o deck', variant: 'destructive' });
    },
  });

  /* ── Handlers ── */

  const handleCreateDeck = useCallback(
    async (name: string) => {
      await createDeckMut(name);
    },
    [createDeckMut],
  );

  const handleOpenEditor = (card?: Flashcard) => {
    setEditingCard(card ?? null);
    setEditorOpen(true);
  };

  const handleEditorSave = (saved: Flashcard) => {
    qc.invalidateQueries({ queryKey: queryFlashcards(selectedDeckId) });
    qc.invalidateQueries({ queryKey: QUERY_DUE });
    setEditorOpen(false);
    setEditingCard(null);
  };

  const handleDelete = useCallback(
    (id: string) => {
      // Optimistic: remove from cache
      const prev = qc.getQueryData<Flashcard[]>(queryFlashcards(selectedDeckId)) ?? [];
      qc.setQueryData<Flashcard[]>(queryFlashcards(selectedDeckId), (old) =>
        (old ?? []).filter((c) => c.id !== id),
      );

      let undone = false;
      const t = toast({
        title: 'Flashcard removido',
        duration: 5000,
        action: (
          <ToastAction
            altText="Desfazer remoção"
            onClick={() => {
              undone = true;
              qc.setQueryData<Flashcard[]>(queryFlashcards(selectedDeckId), prev);
              t.dismiss();
            }}
          >
            Desfazer
          </ToastAction>
        ),
      });

      setTimeout(async () => {
        if (undone) return;
        try {
          await simuladosApi.softDeleteFlashcard(id);
          qc.invalidateQueries({ queryKey: QUERY_DUE });
        } catch (err) {
          logger.error('[CadernoFlashcardsPage] softDelete error:', err);
          qc.setQueryData<Flashcard[]>(queryFlashcards(selectedDeckId), prev);
          toast({ title: 'Não foi possível remover', variant: 'destructive' });
        }
      }, 5100);
    },
    [qc, selectedDeckId],
  );

  const handleStartReview = () => {
    if (dueFlashcards.length === 0) return;
    setReviewCards(dueFlashcards);
    setReviewMode(true);
    trackEvent('caderno_flashcard_reviewed', { source: 'review_session_started', count: dueFlashcards.length } as any);
  };

  const handleReviewFinish = () => {
    setReviewMode(false);
    setReviewCards([]);
    qc.invalidateQueries({ queryKey: QUERY_DUE });
    qc.invalidateQueries({ queryKey: queryFlashcards(selectedDeckId) });
  };

  /* ── Review mode ── */

  if (reviewMode && reviewCards.length > 0) {
    return (
      <FlashcardReviewSession cards={reviewCards} onFinish={handleReviewFinish} />
    );
  }

  /* ── States ── */

  if (decksLoading) {
    return (
      <div className="flex flex-col gap-5">
        <div className="h-8 w-48 animate-pulse rounded-full bg-muted/60" aria-hidden />
        <FlashcardsSkeletonList />
      </div>
    );
  }

  if (decksError) {
    return (
      <div className="flex flex-col items-center gap-4 py-12 text-center">
        <AlertCircle className="h-8 w-8 text-destructive/50" aria-hidden />
        <p className="text-[13px] text-muted-foreground">Não foi possível carregar os decks.</p>
        <Button variant="outline" size="sm" onClick={() => refetchDecks()} className="gap-2">
          <RefreshCw className="h-3.5 w-3.5" aria-hidden />
          Tentar novamente
        </Button>
      </div>
    );
  }

  if (decks.length === 0) {
    return <EmptyDecksState onCreate={() => handleOpenEditor()} />;
  }

  const resolvedDeck = selectedDeckId
    ? decks.find((d) => d.id === selectedDeckId)
    : null;

  return (
    <>
      <StaggerContainer className="space-y-6">
        {/* Botão "Revisar devidos" — destaque quando há cards devidos */}
        {dueFlashcards.length > 0 && (
          <StaggerItem>
            <button
              type="button"
              onClick={handleStartReview}
              className={cn(
                'group flex w-full items-center justify-between gap-4 overflow-hidden rounded-2xl',
                'border border-primary/20 bg-gradient-to-r from-primary/[0.07] via-primary/[0.04] to-transparent',
                'px-5 py-4 transition-all duration-200',
                'hover:border-primary/40 hover:shadow-[0_8px_24px_-12px_hsl(345_65%_30%/0.35)]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              )}
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                  <Layers className="h-5 w-5 text-primary" aria-hidden />
                </div>
                <div className="min-w-0 text-left">
                  <p className="text-[14px] font-bold text-foreground">Revisar devidos</p>
                  <p className="text-[12px] text-muted-foreground">
                    {dueFlashcards.length}{' '}
                    {dueFlashcards.length === 1 ? 'flashcard' : 'flashcards'} para hoje
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground shadow-[0_4px_14px_-4px_hsl(345_65%_30%/0.4)] transition-transform group-hover:scale-[1.02]">
                <Play className="h-3.5 w-3.5 fill-current" aria-hidden />
                Iniciar
              </div>
            </button>
          </StaggerItem>
        )}

        {/* DeckList */}
        <StaggerItem>
          <DeckList
            decks={decks}
            selectedDeckId={selectedDeckId}
            onSelect={setSelectedDeckId}
            onCreate={handleCreateDeck}
            isCreating={creatingDeck}
          />
        </StaggerItem>

        {/* Header da lista de cards + botão novo card */}
        <StaggerItem>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-[15px] font-bold text-foreground">
                {resolvedDeck ? resolvedDeck.name : 'Todos os flashcards'}
              </h2>
              {!cardsLoading && (
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {flashcards.length}{' '}
                  {flashcards.length === 1 ? 'flashcard' : 'flashcards'}
                </p>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleOpenEditor()}
              className="gap-1.5 text-[12px]"
              disabled={!selectedDeckId && decks.length > 0}
              title={!selectedDeckId ? 'Selecione um deck para adicionar um flashcard' : undefined}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
              Novo flashcard
            </Button>
          </div>
        </StaggerItem>

        {/* Lista de flashcards */}
        <StaggerItem>
          {cardsLoading ? (
            <FlashcardsSkeletonList />
          ) : cardsError ? (
            <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-6 text-center text-[13px] text-muted-foreground">
              <AlertCircle className="mx-auto mb-2 h-5 w-5 text-destructive/40" aria-hidden />
              Não foi possível carregar os flashcards.
            </div>
          ) : flashcards.length === 0 ? (
            selectedDeckId ? (
              <EmptyCardsState onAdd={() => handleOpenEditor()} />
            ) : (
              <div className="rounded-2xl border border-dashed border-border bg-card/40 px-6 py-10 text-center">
                <Layers className="mx-auto mb-3 h-8 w-8 text-muted-foreground/30" aria-hidden />
                <p className="text-[13px] text-muted-foreground">
                  Selecione um deck para ver seus flashcards.
                </p>
              </div>
            )
          ) : (
            <div className="space-y-2">
              {/* Zero devidos (só mostra quando há cards mas nenhum é devido) */}
              {dueFlashcards.length === 0 && flashcards.length > 0 && (
                <ZeroDueState total={flashcards.filter((c) => !c.mastered_at).length} />
              )}

              <AnimatePresence mode="popLayout">
                {flashcards.map((card) => (
                  <FlashcardItem
                    key={card.id}
                    card={card}
                    onEdit={handleOpenEditor}
                    onDelete={handleDelete}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </StaggerItem>
      </StaggerContainer>

      {/* FlashcardEditor modal */}
      <AnimatePresence>
        {editorOpen && (
          <FlashcardEditor
            card={editingCard ?? undefined}
            defaultDeckId={selectedDeckId ?? decks[0]?.id}
            onSave={handleEditorSave}
            onClose={() => { setEditorOpen(false); setEditingCard(null); }}
          />
        )}
      </AnimatePresence>
    </>
  );
}

/* ── Page export ── */

export default function CadernoFlashcardsPage() {
  const { profile } = useUser();
  const segment = profile?.segment ?? 'guest';
  const hasAccess = SEGMENT_ACCESS[segment].cadernoErros;

  return (
    <PageTransition>
      <TabBar />

      {!hasAccess ? (
        <ProGate
          icon={Layers}
          feature="Flashcards"
          description="Crie flashcards com imagem e texto, revise com repetição espaçada inteligente e deixe o Prof. San gerar os cards por você."
          requiredSegment="pro"
          currentSegment={segment}
          benefits={[
            'Flashcards com imagem na frente e no verso',
            'Geração automática por IA (Prof. San)',
            'Revisão com algoritmo de repetição espaçada (SRS)',
          ]}
        />
      ) : (
        <FlashcardsContent />
      )}
    </PageTransition>
  );
}
