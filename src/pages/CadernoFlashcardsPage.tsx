/**
 * CadernoFlashcardsPage — aba Flashcards do Caderno de Erros v2 (redesign premium).
 *
 * Rota: /caderno/flashcards  (gate PRO).
 *
 * Desktop: PageHeaderPremium + dois blocos lado a lado (StudyPanel "Estudar"
 *          com devidos + modos de treino, e CreatePanel "Criar" com Prof. San +
 *          criação manual) + DeckList chips + grid de FlashcardItem
 *          (clique abre FlashcardPreviewModal).
 * Mobile: 1 coluna, FlashcardEditor em bottom sheet (AdaptiveModal),
 *         review session em tela cheia com BottomActionBar.
 *
 * PRESERVADO:
 * - listDecks/createDeck/listFlashcards/createFlashcard/updateFlashcard
 * - softDeleteFlashcard, getDueFlashcards, scheduleFlashcardReview
 * - generateFlashcard/uploadFlashcardImage
 * - Eventos analytics, confirmação+undo (5s)
 * - Query keys, staleTime, invalidateQueries
 */

import { useState, useCallback, useRef } from 'react';
import { AnimatePresence } from 'framer-motion';
import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import {
  BookOpen,
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

import {
  PageHeaderPremium,
  SectionHeader,
  CadernoEmptyState,
  SkeletonLine,
} from '@/components/caderno/ui';

import { DeckList } from '@/components/caderno/flashcards/DeckList';
import { FlashcardItem } from '@/components/caderno/flashcards/FlashcardItem';
import { FlashcardEditor } from '@/components/caderno/flashcards/FlashcardEditor';
import { FlashcardReviewSession } from '@/components/caderno/flashcards/FlashcardReviewSession';
import { BulkGenerateModal } from '@/components/caderno/flashcards/BulkGenerateModal';
import { FlashcardPreviewModal } from '@/components/caderno/flashcards/FlashcardPreviewModal';
import { StudyPanel } from '@/components/caderno/flashcards/StudyPanel';
import { CreatePanel } from '@/components/caderno/flashcards/CreatePanel';
import { buildReviewPool } from '@/lib/flashcardReviewModes';

import { useUser } from '@/contexts/UserContext';
import { useAdminAuth } from '@/admin/hooks/useAdminAuth';
import { Navigate } from 'react-router-dom';
import type { Deck, Flashcard, ReviewMode } from '@/types/caderno';

/* ── Query keys ── */

const QUERY_DECKS = ['caderno', 'decks'] as const;
const queryFlashcards = (deckId: string | null) =>
  ['caderno', 'flashcards', deckId ?? 'all'] as const;
const QUERY_DUE = ['caderno', 'flashcards', 'due'] as const;

/* ── Skeleton ── */

function FlashcardsSkeletonGrid() {
  return (
    <div
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
      aria-busy="true"
      aria-label="Carregando flashcards"
    >
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="flex flex-col gap-3 rounded-[var(--c-radius-card)] border border-[var(--c-border)] bg-[var(--c-surface)] p-4"
        >
          <SkeletonLine className="h-3.5 w-full" />
          <SkeletonLine className="h-3.5 w-2/3" />
          <SkeletonLine className="mt-4 h-5 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}

/* ── EmptyDecks — CTA criar deck ── */

interface EmptyDecksStateProps {
  onCreate: (name: string) => Promise<void>;
  isCreating: boolean;
}

function EmptyDecksState({ onCreate, isCreating }: EmptyDecksStateProps) {
  const [showInput, setShowInput] = useState(false);
  const [newName, setNewName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleShow = () => {
    setShowInput(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleConfirm = async () => {
    const trimmed = newName.trim();
    if (!trimmed || isCreating) return;
    await onCreate(trimmed);
    setNewName('');
    setShowInput(false);
  };

  return (
    <CadernoEmptyState
      icon={<Layers className="h-8 w-8 text-[var(--c-wine-500)]" />}
      title="Nenhum deck ainda"
      description="Crie seu primeiro deck para organizar os flashcards por tema, área ou prova."
      action={
        showInput ? (
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleConfirm();
                if (e.key === 'Escape') { setShowInput(false); setNewName(''); }
              }}
              maxLength={60}
              placeholder="Nome do deck…"
              aria-label="Nome do primeiro deck"
              className={cn(
                'h-9 w-48 rounded-[var(--c-radius-pill)] border border-[color-mix(in_srgb,var(--c-wine-500)_40%,transparent)] bg-[var(--c-surface)] px-3',
                'text-[13px] font-medium text-[var(--c-ink)] placeholder:text-[var(--c-muted-2)]',
                'outline-none focus:border-[var(--c-wine-500)] focus:ring-1 focus:ring-[color-mix(in_srgb,var(--c-wine-500)_20%,transparent)]',
              )}
            />
            <Button
              size="sm"
              onClick={handleConfirm}
              disabled={!newName.trim() || isCreating}
              className="gap-1.5 bg-gradient-to-r from-[var(--c-wine-500)] to-[var(--c-wine-700)] text-white"
            >
              {isCreating ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Plus className="h-3.5 w-3.5" aria-hidden />}
              Criar
            </Button>
          </div>
        ) : (
          <Button
            onClick={handleShow}
            className="gap-2 bg-gradient-to-r from-[var(--c-wine-500)] to-[var(--c-wine-700)] text-white shadow-[var(--c-shadow-glow)]"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Criar primeiro deck
          </Button>
        )
      }
    />
  );
}

/* ── EmptyCards ── */

function EmptyCardsState({ onAdd }: { onAdd: () => void }) {
  return (
    <CadernoEmptyState
      icon={<BookOpen className="h-7 w-7 text-[var(--c-muted-2)]" />}
      title="Este deck não tem flashcards"
      description="Adicione o primeiro flashcard para começar a estudar."
      action={
        <Button
          variant="outline"
          size="sm"
          onClick={onAdd}
          className="gap-1.5 border-[color-mix(in_srgb,var(--c-wine-500)_30%,transparent)] text-[var(--c-wine-600)] hover:bg-[var(--c-wine-50)] hover:border-[var(--c-wine-400)]"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
          Adicionar primeiro flashcard
        </Button>
      }
    />
  );
}

/* ── ZeroDue — celebratório ── */

function ZeroDueState({ total }: { total: number }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
      <Sparkles className="h-4 w-4 shrink-0 text-emerald-500" aria-hidden />
      <p className="text-[13px] text-[var(--c-muted)]">
        <span className="font-bold text-[var(--c-ink)]">Nenhum card para revisar hoje</span>
        {' — '}
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
  const [reviewMode, setReviewMode] = useState<ReviewMode | null>(null);
  const [reviewCards, setReviewCards] = useState<Flashcard[]>([]);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [previewCard, setPreviewCard] = useState<Flashcard | null>(null);

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
    async (name: string) => { await createDeckMut(name); },
    [createDeckMut],
  );

  const handleOpenEditor = (card?: Flashcard) => {
    setEditingCard(card ?? null);
    setEditorOpen(true);
  };

  const handleEditorSave = (_saved: Flashcard) => {
    qc.invalidateQueries({ queryKey: queryFlashcards(selectedDeckId) });
    qc.invalidateQueries({ queryKey: QUERY_DUE });
    setEditorOpen(false);
    setEditingCard(null);
  };

  const handleBulkDone = useCallback(
    (deckId: string) => {
      setBulkOpen(false);
      setSelectedDeckId(deckId);
      qc.invalidateQueries({ queryKey: QUERY_DECKS });
      qc.invalidateQueries({ queryKey: queryFlashcards(deckId) });
      qc.invalidateQueries({ queryKey: queryFlashcards(null) });
      qc.invalidateQueries({ queryKey: QUERY_DUE });
    },
    [qc],
  );

  const handleDelete = useCallback(
    (id: string) => {
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

  const handleStartReview = useCallback(
    (mode: ReviewMode) => {
      const pool = mode === 'due' ? dueFlashcards : buildReviewPool(mode, flashcards);
      if (pool.length === 0) return;
      setReviewCards(pool);
      setReviewMode(mode);
      trackEvent('caderno_flashcard_reviewed', {
        source: 'review_session_started',
        mode,
        count: pool.length,
      } as any);
    },
    [dueFlashcards, flashcards],
  );

  const handleReviewFinish = () => {
    setReviewMode(null);
    setReviewCards([]);
    qc.invalidateQueries({ queryKey: QUERY_DUE });
    qc.invalidateQueries({ queryKey: queryFlashcards(selectedDeckId) });
  };

  /* ── Review mode (tela cheia) ── */

  if (reviewMode && reviewCards.length > 0) {
    return (
      <FlashcardReviewSession
        cards={reviewCards}
        mode={reviewMode}
        onFinish={handleReviewFinish}
      />
    );
  }

  /* ── Loading ── */

  if (decksLoading) {
    return (
      <div className="space-y-5">
        <SkeletonLine className="h-6 w-48" />
        <div className="flex gap-2">
          {[1, 2, 3].map((i) => <SkeletonLine key={i} className="h-8 w-24 rounded-full" />)}
        </div>
        <FlashcardsSkeletonGrid />
      </div>
    );
  }

  /* ── Erro de carregamento ── */

  if (decksError) {
    return (
      <div className="flex flex-col items-center gap-4 py-14 text-center">
        <AlertCircle className="h-8 w-8 text-destructive/50" aria-hidden />
        <p className="text-[13px] text-[var(--c-muted)]">Não foi possível carregar os decks.</p>
        <Button variant="outline" size="sm" onClick={() => refetchDecks()} className="gap-2">
          <RefreshCw className="h-3.5 w-3.5" aria-hidden />
          Tentar novamente
        </Button>
      </div>
    );
  }

  /* ── Sem decks ── */

  if (decks.length === 0) {
    return <EmptyDecksState onCreate={handleCreateDeck} isCreating={creatingDeck} />;
  }

  const resolvedDeck = selectedDeckId
    ? decks.find((d: Deck) => d.id === selectedDeckId)
    : null;

  const deckTitle = resolvedDeck ? resolvedDeck.name : 'Todos os flashcards';

  return (
    <>
      <StaggerContainer className="space-y-6">
        {/* Header premium */}
        <StaggerItem>
          <PageHeaderPremium
            title="Flashcards"
            subtitle="Revise no intervalo certo para fixar de vez."
            stats={[
              { label: 'Total', value: flashcards.length },
              { label: 'Decks', value: decks.length },
              { label: 'Para hoje', value: dueFlashcards.length, color: dueFlashcards.length > 0 ? 'var(--c-wine-500)' : undefined },
            ]}
          />
        </StaggerItem>

        {/* Ações: dois blocos lado a lado — Estudar | Criar */}
        <StaggerItem>
          <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-[1.5fr_1fr]">
            <StudyPanel
              dueCount={dueFlashcards.length}
              cards={flashcards}
              onStart={handleStartReview}
            />
            <CreatePanel
              onGenerate={() => setBulkOpen(true)}
              onCreate={() => handleOpenEditor()}
              createDisabled={!selectedDeckId && decks.length > 0}
            />
          </div>
        </StaggerItem>

        {/* DeckList chips */}
        <StaggerItem>
          <DeckList
            decks={decks}
            selectedDeckId={selectedDeckId}
            onSelect={setSelectedDeckId}
            onCreate={handleCreateDeck}
            isCreating={creatingDeck}
          />
        </StaggerItem>

        {/* Section header da lista de cards */}
        <StaggerItem>
          <SectionHeader
            title={deckTitle}
            count={cardsLoading ? undefined : flashcards.length}
          />
        </StaggerItem>

        {/* Lista de flashcards */}
        <StaggerItem>
          {cardsLoading ? (
            <FlashcardsSkeletonGrid />
          ) : cardsError ? (
            <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-6 text-center text-[13px] text-[var(--c-muted)]">
              <AlertCircle className="mx-auto mb-2 h-5 w-5 text-destructive/40" aria-hidden />
              Não foi possível carregar os flashcards.
            </div>
          ) : flashcards.length === 0 ? (
            selectedDeckId ? (
              <EmptyCardsState onAdd={() => handleOpenEditor()} />
            ) : (
              <CadernoEmptyState
                icon={<Layers className="h-7 w-7 text-[var(--c-muted-2)]" />}
                title="Nenhum flashcard ainda"
                description="Seus decks ainda estão vazios. Escolha um deck acima e crie o primeiro flashcard, ou gere vários de uma vez com o Prof. San."
              />
            )
          ) : (
            <div className="space-y-3">
              {/* Zero devidos (celebratório) */}
              {dueFlashcards.length === 0 && flashcards.length > 0 && (
                <ZeroDueState
                  total={flashcards.filter((c: Flashcard) => !c.mastered_at).length}
                />
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <AnimatePresence mode="popLayout">
                  {flashcards.map((card: Flashcard) => (
                    <FlashcardItem
                      key={card.id}
                      card={card}
                      onPreview={setPreviewCard}
                      onEdit={handleOpenEditor}
                      onDelete={handleDelete}
                    />
                  ))}
                </AnimatePresence>
              </div>
            </div>
          )}
        </StaggerItem>
      </StaggerContainer>

      {/* FlashcardEditor (AdaptiveModal: Dialog desktop / Drawer mobile) */}
      {editorOpen && (
        <FlashcardEditor
          card={editingCard ?? undefined}
          defaultDeckId={selectedDeckId ?? decks[0]?.id}
          onSave={handleEditorSave}
          onClose={() => { setEditorOpen(false); setEditingCard(null); }}
        />
      )}
      {bulkOpen && (
        <BulkGenerateModal
          decks={decks}
          defaultDeckId={selectedDeckId}
          onDone={handleBulkDone}
          onClose={() => setBulkOpen(false)}
        />
      )}
      {previewCard && (
        <FlashcardPreviewModal
          card={previewCard}
          onEdit={(card) => { setPreviewCard(null); handleOpenEditor(card); }}
          onDelete={(id) => { setPreviewCard(null); handleDelete(id); }}
          onClose={() => setPreviewCard(null)}
        />
      )}
    </>
  );
}

/* ── Page export ── */

export default function CadernoFlashcardsPage() {
  const { profile } = useUser();
  const { isAdmin, loading: adminLoading } = useAdminAuth();
  const segment = profile?.segment ?? 'guest';
  const hasAccess = SEGMENT_ACCESS[segment].cadernoErros;

  // Flashcards está restrito a admins (em desenvolvimento). Enquanto o status
  // de admin carrega não renderizamos nada para evitar flash; depois, quem não
  // é admin é redirecionado para a aba inicial do Caderno.
  if (adminLoading) return null;
  if (!isAdmin) return <Navigate to="/caderno" replace />;

  return (
    <PageTransition>
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
            'Revisão espaçada: cada card volta na hora certa de lembrar',
          ]}
        />
      ) : (
        <FlashcardsContent />
      )}
    </PageTransition>
  );
}
