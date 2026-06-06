/**
 * FlashcardsSection — showcase / mock da aba Flashcards redesenhada.
 *
 * Rota sandbox: /sandbox/caderno-v3#flashcards
 * Renderiza todas as superfícies com dados mock para QA no browser sem auth.
 * Não tem lógica real de dados — apenas apresentação visual.
 *
 * Cobre:
 * - DeckList com chips selecionáveis
 * - ReviewBanner (devidos)
 * - Grid de FlashcardItem (c/ imagem / sem imagem / dominado / devidos / agendado)
 * - Estado vazio de deck
 * - Estado zero-devidos (celebratório)
 * - FlashcardEditor (toggle para abrir AdaptiveModal)
 * - FlashcardReviewSession (toggle para entrar em tela cheia)
 * - ZeroDueState
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  Layers,
  Plus,
  Sparkles,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  PageHeaderPremium,
  SectionHeader,
  CadernoEmptyState,
  CadernoCard,
  FilterChip,
} from '@/components/caderno/ui';

import { DeckList } from '@/components/caderno/flashcards/DeckList';
import { FlashcardItem } from '@/components/caderno/flashcards/FlashcardItem';
import { FlashcardEditor } from '@/components/caderno/flashcards/FlashcardEditor';
import { FlashcardReviewSession } from '@/components/caderno/flashcards/FlashcardReviewSession';

import type { Deck, Flashcard } from '@/types/caderno';

/* ── Mock data ── */

const MOCK_DECKS: Deck[] = [
  { id: 'd1', user_id: 'u1', name: 'Cardiologia', created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z', deleted_at: null },
  { id: 'd2', user_id: 'u1', name: 'Clínica Médica', created_at: '2024-01-02T00:00:00Z', updated_at: '2024-01-02T00:00:00Z', deleted_at: null },
  { id: 'd3', user_id: 'u1', name: 'Pediatria', created_at: '2024-01-03T00:00:00Z', updated_at: '2024-01-03T00:00:00Z', deleted_at: null },
];

const now = new Date();
const yesterday = new Date(now.getTime() - 86400000).toISOString();
const tomorrow = new Date(now.getTime() + 86400000).toISOString();
const inFiveDays = new Date(now.getTime() + 5 * 86400000).toISOString();

const MOCK_CARDS: Flashcard[] = [
  {
    id: 'c1', deck_id: 'd1', user_id: 'u1',
    front_md: 'Quais são os critérios de Framingham para diagnóstico de IC?',
    back_md: '**Critérios maiores:** Cardiomegalia, EAP, turgência jugular…\n\n**Critérios menores:** Edema periférico, tosse noturna…',
    front_image_url: null, back_image_url: null,
    entry_id: null, question_id: null,
    srs_due_at: yesterday,
    srs_interval: 1, srs_reps: 3, srs_ease: 2.5,
    mastered_at: null,
    created_at: '2024-01-10T00:00:00Z', updated_at: '2024-01-10T00:00:00Z', deleted_at: null,
  },
  {
    id: 'c2', deck_id: 'd1', user_id: 'u1',
    front_md: 'ECG na pericardite aguda: achados típicos?',
    back_md: 'Supradesnivelamento difuso do ST (côncavo), depressão de PR, sem imagem em espelho.',
    front_image_url: 'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=120&h=120&fit=crop',
    back_image_url: null,
    entry_id: null, question_id: null,
    srs_due_at: tomorrow,
    srs_interval: 3, srs_reps: 5, srs_ease: 2.6,
    mastered_at: null,
    created_at: '2024-01-11T00:00:00Z', updated_at: '2024-01-11T00:00:00Z', deleted_at: null,
  },
  {
    id: 'c3', deck_id: 'd1', user_id: 'u1',
    front_md: 'Mecanismo de ação dos betabloqueadores na ICC',
    back_md: 'Redução da FC, da contratilidade e do consumo de O₂. Remodelamento reverso a longo prazo.',
    front_image_url: null, back_image_url: null,
    entry_id: null, question_id: null,
    srs_due_at: inFiveDays,
    srs_interval: 21, srs_reps: 8, srs_ease: 2.8,
    mastered_at: '2024-02-01T00:00:00Z',
    created_at: '2024-01-12T00:00:00Z', updated_at: '2024-01-12T00:00:00Z', deleted_at: null,
  },
  {
    id: 'c4', deck_id: 'd2', user_id: 'u1',
    front_md: 'Diagnóstico de diabetes mellitus tipo 2 — critérios ADA',
    back_md: 'Glicemia jejum ≥126 mg/dL, TOTG 2h ≥200 mg/dL, HbA1c ≥6,5%, glicemia aleatória ≥200 + sintomas.',
    front_image_url: null, back_image_url: null,
    entry_id: null, question_id: null,
    srs_due_at: null,
    srs_interval: 0, srs_reps: 0, srs_ease: 2.5,
    mastered_at: null,
    created_at: '2024-01-13T00:00:00Z', updated_at: '2024-01-13T00:00:00Z', deleted_at: null,
  },
];

const MOCK_DUE = MOCK_CARDS.filter((c) => {
  if (!c.srs_due_at) return false;
  return new Date(c.srs_due_at) <= new Date();
});

/* ── Seção showcase principal ── */

export function FlashcardsSection() {
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>('d1');
  const [editorOpen, setEditorOpen] = useState(false);
  const [reviewMode, setReviewMode] = useState(false);
  const [activeVariant, setActiveVariant] = useState<'normal' | 'empty-cards' | 'zero-due'>('normal');

  const filteredCards =
    activeVariant === 'empty-cards'
      ? []
      : activeVariant === 'zero-due'
      ? MOCK_CARDS.filter((c) => !c.mastered_at)
      : selectedDeckId
      ? MOCK_CARDS.filter((c) => c.deck_id === selectedDeckId)
      : MOCK_CARDS;

  const dueCards = activeVariant === 'zero-due' ? [] : MOCK_DUE;

  if (reviewMode) {
    return (
      <div className="caderno-root">
        <FlashcardReviewSession
          cards={MOCK_DUE.length > 0 ? MOCK_DUE : MOCK_CARDS.slice(0, 2)}
          onFinish={() => setReviewMode(false)}
        />
      </div>
    );
  }

  return (
    <div className="caderno-root space-y-8">
      {/* Controles de variante (dev only) */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-blue-400/30 bg-blue-400/5 p-3">
        <span className="text-[10px] font-bold uppercase tracking-wider text-blue-500">
          Showcase variant:
        </span>
        {(['normal', 'empty-cards', 'zero-due'] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setActiveVariant(v)}
            className={cn(
              'rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors',
              activeVariant === v
                ? 'border-blue-500 bg-blue-500/10 text-blue-600'
                : 'border-blue-400/30 text-blue-400 hover:border-blue-400',
            )}
          >
            {v}
          </button>
        ))}
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setEditorOpen(true)} className="gap-1.5 text-[11px]">
            <Plus className="h-3 w-3" />
            Abrir editor
          </Button>
          <Button size="sm" variant="outline" onClick={() => setReviewMode(true)} className="gap-1.5 text-[11px]">
            <Play className="h-3 w-3" />
            Modo review
          </Button>
        </div>
      </div>

      {/* ── PageHeaderPremium ── */}
      <section>
        <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-[var(--c-muted)]">
          PageHeaderPremium
        </p>
        <PageHeaderPremium
          title="Flashcards"
          subtitle="Revise com repetição espaçada inteligente"
          stats={[
            { label: 'Total', value: MOCK_CARDS.length },
            { label: 'Decks', value: MOCK_DECKS.length },
            { label: 'Devidos hoje', value: MOCK_DUE.length, color: 'var(--c-wine-500)' },
          ]}
          primaryAction={
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditorOpen(true)}
              className="gap-1.5 border-[var(--c-wine-500)]/25 text-[var(--c-wine-600)] hover:border-[var(--c-wine-400)] hover:bg-[var(--c-wine-50)]"
            >
              <Plus className="h-4 w-4" />
              Novo flashcard
            </Button>
          }
        />
      </section>

      {/* ── ReviewBanner ── */}
      <section>
        <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-[var(--c-muted)]">
          ReviewBanner (devidos)
        </p>
        <AnimatePresence>
          {dueCards.length > 0 && (
            <motion.button
              type="button"
              onClick={() => setReviewMode(true)}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22 }}
              className={cn(
                'group flex w-full items-center justify-between gap-4 overflow-hidden rounded-[var(--c-radius-card)]',
                'border border-[var(--c-wine-500)]/20 bg-gradient-to-r from-[var(--c-wine-500)]/8 via-[var(--c-wine-500)]/4 to-transparent',
                'px-5 py-4 transition-all hover:border-[var(--c-wine-500)]/40 hover:shadow-[var(--c-shadow-glow)]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-wine-500)]/50',
              )}
            >
              <div className="flex min-w-0 items-center gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--c-wine-500)]/10">
                  <Layers className="h-5 w-5 text-[var(--c-wine-500)]" />
                </div>
                <div className="text-left">
                  <p className="text-[14px] font-bold text-[var(--c-ink)]">Revisar devidos</p>
                  <p className="text-[12px] text-[var(--c-muted)]">{dueCards.length} flashcard{dueCards.length !== 1 ? 's' : ''} para hoje</p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--c-wine-500)] to-[var(--c-wine-700)] px-5 py-2.5 text-[13px] font-bold text-white shadow-[var(--c-shadow-glow)] transition-transform group-hover:scale-[1.03]">
                <Play className="h-3.5 w-3.5 fill-current" />
                Iniciar
              </div>
            </motion.button>
          )}
        </AnimatePresence>
        {dueCards.length === 0 && (
          <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
            <Sparkles className="h-4 w-4 shrink-0 text-emerald-500" />
            <p className="text-[13px] text-[var(--c-muted)]">
              <span className="font-bold text-[var(--c-ink)]">Nenhum card para revisar hoje</span>
              {' — todos em dia!'}
            </p>
          </div>
        )}
      </section>

      {/* ── DeckList ── */}
      <section>
        <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-[var(--c-muted)]">
          DeckList (chips seletores)
        </p>
        <DeckList
          decks={MOCK_DECKS}
          selectedDeckId={selectedDeckId}
          onSelect={setSelectedDeckId}
          onCreate={async (name) => { console.log('[Showcase] createDeck:', name); }}
          isCreating={false}
        />
      </section>

      {/* ── FlashcardItem grid ── */}
      <section>
        <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-[var(--c-muted)]">
          FlashcardItem grid
        </p>
        <SectionHeader
          title={selectedDeckId ? MOCK_DECKS.find((d) => d.id === selectedDeckId)?.name ?? 'Deck' : 'Todos os flashcards'}
          count={filteredCards.length}
          className="mb-4"
        />

        {filteredCards.length === 0 ? (
          <CadernoEmptyState
            icon={<Layers className="h-7 w-7 text-[var(--c-muted-2)]" />}
            title="Este deck não tem flashcards"
            description="Adicione o primeiro flashcard para começar a estudar."
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditorOpen(true)}
                className="gap-1.5 border-[var(--c-wine-500)]/30 text-[var(--c-wine-600)] hover:bg-[var(--c-wine-50)]"
              >
                <Plus className="h-3.5 w-3.5" />
                Adicionar flashcard
              </Button>
            }
          />
        ) : (
          <div className="space-y-3">
            {filteredCards.map((card) => (
              <FlashcardItem
                key={card.id}
                card={card}
                onEdit={(c) => { console.log('[Showcase] edit:', c.id); setEditorOpen(true); }}
                onDelete={(id) => { console.log('[Showcase] delete:', id); }}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── FilterChip states ── */}
      <section>
        <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-[var(--c-muted)]">
          FilterChip states
        </p>
        <div className="flex flex-wrap gap-2">
          <FilterChip label="Ativo" active count={3} onClick={() => {}} />
          <FilterChip label="Inativo" active={false} onClick={() => {}} />
          <FilterChip label="Com count" active={false} count={12} onClick={() => {}} />
          <FilterChip label="Ativo com count" active count={5} onClick={() => {}} />
        </div>
      </section>

      {/* ── CadernoCard variants ── */}
      <section>
        <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-[var(--c-muted)]">
          CadernoCard variants
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <CadernoCard className="p-5">
            <p className="text-[13px] font-semibold text-[var(--c-ink)]">Base card</p>
            <p className="mt-1 text-[11px] text-[var(--c-muted)]">radius-card + shadow-sm</p>
          </CadernoCard>
          <CadernoCard variant="interactive" className="p-5">
            <p className="text-[13px] font-semibold text-[var(--c-ink)]">Interactive card</p>
            <p className="mt-1 text-[11px] text-[var(--c-muted)]">Hover → eleva 2px + shadow-md</p>
          </CadernoCard>
          <CadernoCard hero className="p-5">
            <p className="text-[13px] font-semibold text-[var(--c-ink)]">Hero card</p>
            <p className="mt-1 text-[11px] text-[var(--c-muted)]">Borda wine + glow</p>
          </CadernoCard>
        </div>
      </section>

      {/* ── FlashcardEditor modal ── */}
      {editorOpen && (
        <FlashcardEditor
          defaultDeckId={selectedDeckId ?? MOCK_DECKS[0].id}
          onSave={(saved) => {
            console.log('[Showcase] saved:', saved);
            setEditorOpen(false);
          }}
          onClose={() => setEditorOpen(false)}
        />
      )}
    </div>
  );
}

export default FlashcardsSection;
