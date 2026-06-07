/**
 * BulkGenerateModal — wizard de geração de flashcards em lote com o Prof. San.
 *
 * Passos: 1) escolher fonte → 2) configurar → 3) destino + gerar.
 * Salva o lote direto no deck (sem preview do verso) e fecha; a curadoria
 * acontece na revisão. Reaproveita AdaptiveModal e ProfSanorAvatar.
 *
 * Fontes: Tema/área, Caderno de erros, Pontos fracos, Simulado concluído,
 * Favoritas (questions) e Anotações (text).
 */
import { useState, useCallback } from 'react';
import { Sparkles, Loader2, BookOpen, Layers, ArrowLeft, FileText, TrendingDown, ClipboardCheck, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { logger } from '@/lib/logger';
import { toast } from '@/hooks/use-toast';
import { trackEvent } from '@/lib/analytics';
import { simuladosApi } from '@/services/simuladosApi';
import { Button } from '@/components/ui/button';
import { AdaptiveModal } from '@/components/caderno/ui';
import { ProfSanorAvatar } from '@/components/comparativo/ProfSanorAvatar';
import {
  suggestDeckName, mapGeneratedCardsToPayloads,
  type BatchGenerateInput,
} from '@/lib/bulkFlashcards';
import type { Deck } from '@/types/caderno';
import { TopicSourceForm } from './bulk/TopicSourceForm';
import { CadernoSourcePicker } from './bulk/CadernoSourcePicker';
import { DeckTargetSelect, type DeckTarget } from './bulk/DeckTargetSelect';
import { AnotacoesSourceForm } from './bulk/AnotacoesSourceForm';
import { WeakAreasSourcePicker } from './bulk/WeakAreasSourcePicker';
import { SimuladoSourcePicker } from './bulk/SimuladoSourcePicker';
import { FavoritesSourcePicker } from './bulk/FavoritesSourcePicker';

type SourceKey = 'topic' | 'caderno' | 'anotacoes' | 'fracos' | 'simulado' | 'favoritas';

interface SourceTile { key: SourceKey; label: string; description: string; icon: React.ReactNode }

const SOURCES: SourceTile[] = [
  { key: 'topic', label: 'Tema / área', description: 'O Prof. San cria cards sobre um assunto', icon: <Layers className="h-5 w-5" aria-hidden /> },
  { key: 'caderno', label: 'Caderno de erros', description: 'Vira suas questões erradas em cards', icon: <BookOpen className="h-5 w-5" aria-hidden /> },
  { key: 'fracos', label: 'Pontos fracos', description: 'Foca nos temas em que você mais erra', icon: <TrendingDown className="h-5 w-5" aria-hidden /> },
  { key: 'simulado', label: 'Simulado concluído', description: 'Cards das questões que você errou', icon: <ClipboardCheck className="h-5 w-5" aria-hidden /> },
  { key: 'favoritas', label: 'Favoritas', description: 'Usa as questões que você favoritou', icon: <Star className="h-5 w-5" aria-hidden /> },
  { key: 'anotacoes', label: 'Anotações', description: 'Cola um resumo ou usa uma anotação salva', icon: <FileText className="h-5 w-5" aria-hidden /> },
];

export interface BulkGenerateModalProps {
  decks: Deck[];
  defaultDeckId?: string | null;
  /** Chamado após salvar o lote, com o deckId de destino, para invalidar queries. */
  onDone: (deckId: string) => void;
  onClose: () => void;
}

export function BulkGenerateModal({ decks, onDone, onClose }: BulkGenerateModalProps) {
  const [step, setStep] = useState<'source' | 'config'>('source');
  const [source, setSource] = useState<SourceKey | null>(null);
  const [input, setInput] = useState<BatchGenerateInput | null>(null);
  const [target, setTarget] = useState<DeckTarget>({ deckId: decks[0]?.id ?? null, newName: null });
  const [generating, setGenerating] = useState(false);

  const suggestedName = input ? suggestDeckName(input) : 'Flashcards';

  const handlePickSource = (key: SourceKey) => {
    setSource(key);
    setInput(null);
    setStep('config');
  };

  const handleBack = () => { setStep('source'); setSource(null); setInput(null); };

  const resolveDeckId = useCallback(async (): Promise<string | null> => {
    if (target.deckId) return target.deckId;
    const name = (target.newName ?? suggestedName).trim() || suggestedName;
    const deck = await simuladosApi.createDeck(name);
    return deck.id;
  }, [target, suggestedName]);

  const handleGenerate = useCallback(async () => {
    if (!input) return;
    setGenerating(true);
    try {
      const { cards } = await simuladosApi.generateFlashcardsBatch(input);
      if (cards.length === 0) {
        toast({ title: 'A IA não retornou cards', description: 'Tente novamente ou ajuste a fonte.', variant: 'destructive' });
        return;
      }
      const deckId = await resolveDeckId();
      if (!deckId) {
        toast({ title: 'Selecione um deck de destino', variant: 'destructive' });
        return;
      }
      const payloads = mapGeneratedCardsToPayloads(cards, deckId);
      const created = await simuladosApi.createFlashcardsBulk(payloads);
      trackEvent('caderno_flashcards_bulk_generated', {
        mode: input.mode, count: created.length, deck_id: deckId,
      });
      const deckName = decks.find((d) => d.id === deckId)?.name ?? (target.newName ?? suggestedName);
      toast({ title: `${created.length} flashcards criados`, description: `Salvos em "${deckName}".` });
      onDone(deckId);
    } catch (err) {
      logger.error('[BulkGenerateModal] generate error:', err);
      toast({ title: 'Não foi possível gerar os flashcards', description: 'Tente novamente em instantes.', variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  }, [input, resolveDeckId, decks, target, suggestedName, onDone]);

  const deckChosen = !!target.deckId || !!(target.newName ?? suggestedName).trim();
  const canGenerate = !!input && deckChosen && !generating;

  return (
    <AdaptiveModal
      open
      onOpenChange={(open) => { if (!open && !generating) onClose(); }}
      title="Gerar flashcards em lote"
      size="lg"
      footer={
        step === 'config' ? (
          <div className="flex w-full items-center justify-between gap-2">
            <Button type="button" variant="ghost" onClick={handleBack} disabled={generating} className="gap-1.5">
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Voltar
            </Button>
            <Button
              type="button" disabled={!canGenerate} onClick={handleGenerate}
              className="min-w-[160px] gap-2 bg-gradient-to-r from-[var(--c-wine-500)] to-[var(--c-wine-700)] text-white shadow-[var(--c-shadow-glow)] hover:opacity-90"
            >
              {generating ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Sparkles className="h-4 w-4" aria-hidden />}
              {generating ? 'Gerando…' : 'Gerar e salvar'}
            </Button>
          </div>
        ) : undefined
      }
    >
      <div className="space-y-5 py-2">
        {step === 'source' ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {SOURCES.map((s) => (
              <button
                key={s.key} type="button" onClick={() => handlePickSource(s.key)}
                className={cn(
                  'flex flex-col items-start gap-2 rounded-2xl border border-[var(--c-border)] p-4 text-left transition-all',
                  'hover:border-[var(--c-wine-400)] hover:bg-[var(--c-wine-50)] hover:shadow-[var(--c-shadow-sm)]',
                )}
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--c-wine-500)]/10 text-[var(--c-wine-500)]">
                  {s.icon}
                </span>
                <span className="text-[14px] font-bold text-[var(--c-ink)]">{s.label}</span>
                <span className="text-[12px] text-[var(--c-muted)]">{s.description}</span>
              </button>
            ))}
          </div>
        ) : (
          <>
            <div className={cn(
              'flex items-center gap-3 rounded-2xl border border-amber-400/30 p-3',
              'bg-gradient-to-br from-amber-50 via-[var(--c-surface)] to-[var(--c-surface)]',
              'dark:from-amber-500/[0.1] dark:via-[var(--c-surface)] dark:to-[var(--c-surface)]',
            )}>
              <span className="block shrink-0 overflow-hidden rounded-full ring-2 ring-amber-300/50">
                <ProfSanorAvatar size={40} animated={generating} />
              </span>
              <p className="text-[12px] text-[var(--c-muted)]">
                {generating
                  ? 'O Prof. San está montando seus flashcards…'
                  : 'Configure a fonte e o Prof. San gera os cards de uma vez.'}
              </p>
            </div>

            {source === 'topic' && <TopicSourceForm onChange={setInput} />}
            {source === 'caderno' && <CadernoSourcePicker onChange={setInput} />}
            {source === 'fracos' && <WeakAreasSourcePicker onChange={setInput} />}
            {source === 'simulado' && <SimuladoSourcePicker onChange={setInput} />}
            {source === 'favoritas' && <FavoritesSourcePicker onChange={setInput} />}
            {source === 'anotacoes' && <AnotacoesSourceForm onChange={setInput} />}

            <div className="border-t border-[var(--c-border)] pt-4">
              <DeckTargetSelect
                decks={decks}
                suggestedName={suggestedName}
                value={target}
                onChange={setTarget}
              />
            </div>
          </>
        )}
      </div>
    </AdaptiveModal>
  );
}
