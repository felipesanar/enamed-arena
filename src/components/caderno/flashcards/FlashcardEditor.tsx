/**
 * FlashcardEditor — modal criar/editar flashcard (redesign premium).
 *
 * Desktop: AdaptiveModal → Dialog centralizado, 2 colunas (frente/verso),
 *          preview 3D flip, upload drag&drop, botão "Gerar com Prof. San".
 * Mobile: AdaptiveModal → bottom sheet, 1 coluna, upload via file picker.
 *
 * PRESERVADO (lógica/dados):
 * - simuladosApi.createFlashcard / updateFlashcard / uploadFlashcardImage / generateFlashcard
 * - Eventos analytics: caderno_flashcard_created, caderno_flashcard_ai_generated
 * - Validação de deck/conteúdo antes de salvar
 */

import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import {
  Sparkles,
  Loader2,
  Upload,
  Image as ImageIcon,
  Trash2,
  RotateCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { logger } from '@/lib/logger';
import { toast } from '@/hooks/use-toast';
import { trackEvent } from '@/lib/analytics';
import { simuladosApi } from '@/services/simuladosApi';
import { Button } from '@/components/ui/button';
import { AdaptiveModal } from '@/components/caderno/ui';
import type { Flashcard, CreateFlashcardPayload, UpdateFlashcardPayload } from '@/types/caderno';

/* ── Types ── */

export interface FlashcardEditorProps {
  card?: Flashcard;
  defaultDeckId?: string;
  onSave: (card: Flashcard) => void;
  onClose: () => void;
  generateContext?: Record<string, unknown>;
}

/* ── ImageUploadZone ── */

interface ImageUploadZoneProps {
  label: string;
  imageUrl: string | null;
  uploading: boolean;
  onFile: (file: File) => void;
  onClear: () => void;
}

function ImageUploadZone({ label, imageUrl, uploading, onFile, onClear }: ImageUploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith('image/')) onFile(file);
    },
    [onFile],
  );

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); setDragging(true); };
  const handleDragLeave = () => setDragging(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFile(file);
  };

  if (imageUrl) {
    return (
      <div className="relative overflow-hidden rounded-xl border border-[var(--c-border)]">
        <img
          src={imageUrl}
          alt={`Imagem ${label}`}
          className="max-h-36 w-full object-cover"
        />
        <button
          type="button"
          aria-label={`Remover imagem ${label}`}
          onClick={onClear}
          className={cn(
            'absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full',
            'bg-[var(--c-surface)]/90 text-[var(--c-muted)] shadow-sm backdrop-blur-sm',
            'transition-colors hover:bg-destructive/10 hover:text-destructive',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/50',
          )}
        >
          <Trash2 className="h-3 w-3" aria-hidden />
        </button>
      </div>
    );
  }

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        aria-label={`Área de upload de imagem ${label} — arraste ou clique para selecionar`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click(); }}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-4 transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-wine-500)]/50',
          dragging
            ? 'border-[var(--c-wine-500)] bg-[var(--c-wine-50)]'
            : 'border-[var(--c-border)] hover:border-[var(--c-wine-300)] hover:bg-[var(--c-surface-2)]',
        )}
      >
        {uploading ? (
          <Loader2 className="h-4 w-4 animate-spin text-[var(--c-muted)]" aria-hidden />
        ) : (
          <Upload className="h-4 w-4 text-[var(--c-muted-2)]" aria-hidden />
        )}
        <span className="text-center text-[11px] text-[var(--c-muted)]">
          {uploading ? 'Enviando…' : (
            <>
              <span className="hidden sm:inline">Arraste ou </span>
              <span className="font-semibold text-[var(--c-wine-600)]">selecione</span>
            </>
          )}
        </span>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        aria-hidden="true"
        tabIndex={-1}
        onChange={handleInputChange}
      />
    </>
  );
}

/* ── CardPreview com flip 3D ── */

interface CardPreviewProps {
  frontMd: string;
  backMd: string;
  frontImageUrl: string | null;
  backImageUrl: string | null;
}

function CardPreview({ frontMd, backMd, frontImageUrl, backImageUrl }: CardPreviewProps) {
  const prefersReducedMotion = useReducedMotion();
  const [flipped, setFlipped] = useState(false);

  return (
    <div className="space-y-2">
      {/* Label + botão flip */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--c-muted)]">
          Preview — {flipped ? 'Verso' : 'Frente'}
        </span>
        <button
          type="button"
          onClick={() => setFlipped((f) => !f)}
          aria-label={flipped ? 'Ver frente do card' : 'Ver verso do card'}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-[var(--c-radius-control)] border px-2.5 py-1',
            'border-[var(--c-border)] text-[11px] font-semibold text-[var(--c-muted)]',
            'transition-colors hover:border-[var(--c-wine-300)] hover:text-[var(--c-wine-600)]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-wine-500)]/50',
          )}
        >
          <RotateCw className="h-3 w-3" aria-hidden />
          {flipped ? 'Ver frente' : 'Ver verso'}
        </button>
      </div>

      {/* Card com flip 3D */}
      <div
        style={{ perspective: '1200px' }}
        className="relative min-h-[120px]"
      >
        <AnimatePresence mode="wait">
          {!flipped ? (
            <motion.div
              key="front"
              initial={prefersReducedMotion ? false : { rotateY: -90, opacity: 0 }}
              animate={{ rotateY: 0, opacity: 1 }}
              exit={prefersReducedMotion ? undefined : { rotateY: 90, opacity: 0 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden rounded-xl border border-[var(--c-wine-500)]/20 bg-[var(--c-surface)] shadow-[var(--c-shadow-sm)]"
            >
              <div className="px-1 py-1">
                <span className="inline-block rounded-t-none rounded-b-lg bg-[var(--c-wine-50)] px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-[var(--c-wine-600)]">
                  Frente
                </span>
              </div>
              <div className="px-4 pb-4 pt-1">
                {frontImageUrl && (
                  <img
                    src={frontImageUrl}
                    alt="Frente"
                    className="mb-3 max-h-28 w-full rounded-lg object-cover"
                  />
                )}
                {frontMd.trim() ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none text-[13px]">
                    <ReactMarkdown>{frontMd}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-[12px] italic text-[var(--c-muted-2)]">(frente vazia)</p>
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="back"
              initial={prefersReducedMotion ? false : { rotateY: 90, opacity: 0 }}
              animate={{ rotateY: 0, opacity: 1 }}
              exit={prefersReducedMotion ? undefined : { rotateY: -90, opacity: 0 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden rounded-xl border border-[var(--c-border)] bg-[var(--c-surface-2)] shadow-[var(--c-shadow-sm)]"
            >
              <div className="px-1 py-1">
                <span className="inline-block rounded-t-none rounded-b-lg bg-[var(--c-surface)] px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-[var(--c-muted)]">
                  Verso
                </span>
              </div>
              <div className="px-4 pb-4 pt-1">
                {backImageUrl && (
                  <img
                    src={backImageUrl}
                    alt="Verso"
                    className="mb-3 max-h-28 w-full rounded-lg object-cover"
                  />
                )}
                {backMd.trim() ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none text-[13px]">
                    <ReactMarkdown>{backMd}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-[12px] italic text-[var(--c-muted-2)]">(verso vazio)</p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ── FlashcardEditor ── */

export function FlashcardEditor({
  card,
  defaultDeckId,
  onSave,
  onClose,
  generateContext,
}: FlashcardEditorProps) {
  const isEditing = !!card;

  const [frontMd, setFrontMd] = useState(card?.front_md ?? '');
  const [backMd, setBackMd] = useState(card?.back_md ?? '');
  const [frontImageUrl, setFrontImageUrl] = useState<string | null>(card?.front_image_url ?? null);
  const [backImageUrl, setBackImageUrl] = useState<string | null>(card?.back_image_url ?? null);
  const [uploadingFront, setUploadingFront] = useState(false);
  const [uploadingBack, setUploadingBack] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const handleUpload = async (file: File, side: 'front' | 'back') => {
    if (side === 'front') setUploadingFront(true);
    else setUploadingBack(true);
    try {
      const url = await simuladosApi.uploadFlashcardImage(file, side);
      if (side === 'front') setFrontImageUrl(url);
      else setBackImageUrl(url);
    } catch (err) {
      logger.error('[FlashcardEditor] Upload error:', err);
      toast({ title: 'Falha no upload da imagem', description: 'Verifique sua conexão e tente novamente.', variant: 'destructive' });
    } finally {
      if (side === 'front') setUploadingFront(false);
      else setUploadingBack(false);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const context = generateContext ? { ...generateContext } : {};
      if (frontMd.trim()) context['existing_front'] = frontMd;
      if (backMd.trim()) context['existing_back'] = backMd;
      const result = await simuladosApi.generateFlashcard(context);
      setFrontMd(result.front_md);
      setBackMd(result.back_md);
      setShowPreview(true);
      toast({ title: 'Flashcard gerado pelo Prof. San', description: 'Revise e ajuste se necessário.' });
      trackEvent('caderno_flashcard_ai_generated', {
        has_context: Object.keys(generateContext ?? {}).length > 0,
      });
    } catch (err) {
      logger.error('[FlashcardEditor] Generate error:', err);
      toast({ title: 'Não foi possível gerar o flashcard', description: 'Tente novamente em instantes.', variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    const deckId = card?.deck_id ?? defaultDeckId;
    if (!deckId) {
      toast({ title: 'Selecione um deck antes de salvar.', variant: 'destructive' });
      return;
    }
    if (!frontMd.trim() && !backMd.trim()) {
      toast({ title: 'Preencha ao menos frente ou verso.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      let saved: Flashcard;
      if (isEditing) {
        const payload: UpdateFlashcardPayload = { front_md: frontMd, back_md: backMd, front_image_url: frontImageUrl, back_image_url: backImageUrl };
        saved = await simuladosApi.updateFlashcard(card.id, payload);
      } else {
        const payload: CreateFlashcardPayload = { deck_id: deckId, front_md: frontMd, back_md: backMd, front_image_url: frontImageUrl, back_image_url: backImageUrl };
        saved = await simuladosApi.createFlashcard(payload);
        trackEvent('caderno_flashcard_created', { deck_id: deckId, has_image: !!(frontImageUrl || backImageUrl), ai_generated: false });
      }
      toast({ title: isEditing ? 'Flashcard atualizado' : 'Flashcard criado' });
      onSave(saved);
    } catch (err) {
      logger.error('[FlashcardEditor] Save error:', err);
      toast({ title: 'Não foi possível salvar', description: 'Tente novamente em instantes.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const isBusy = saving || generating || uploadingFront || uploadingBack;
  const canSave = frontMd.trim() || backMd.trim();

  return (
    <AdaptiveModal
      open={true}
      onOpenChange={(open) => { if (!open) onClose(); }}
      title={isEditing ? 'Editar flashcard' : 'Novo flashcard'}
      size="lg"
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          {/* Gerar com Prof. San */}
          <button
            type="button"
            disabled={isBusy}
            onClick={handleGenerate}
            aria-label="Gerar frente e verso com Prof. San (IA)"
            className={cn(
              'inline-flex items-center gap-2 rounded-[var(--c-radius-control)] border px-4 py-2',
              'border-amber-400/30 bg-amber-400/8 text-[13px] font-semibold text-amber-600',
              'transition-all hover:border-amber-400/60 hover:bg-amber-400/12',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50',
              'disabled:cursor-not-allowed disabled:opacity-50',
            )}
          >
            {generating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
            )}
            {generating ? 'Gerando…' : 'Gerar com Prof. San'}
          </button>

          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={isBusy}>
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={isBusy || !canSave}
              onClick={handleSave}
              className="min-w-[120px] bg-gradient-to-r from-[var(--c-wine-500)] to-[var(--c-wine-700)] text-white shadow-[var(--c-shadow-glow)] transition-opacity hover:opacity-90"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />
                  Salvando…
                </>
              ) : isEditing ? (
                'Salvar alterações'
              ) : (
                'Criar flashcard'
              )}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-5 py-2">
        {/* Toggle preview */}
        <button
          type="button"
          aria-pressed={showPreview}
          onClick={() => setShowPreview((v) => !v)}
          className={cn(
            'inline-flex items-center gap-2 rounded-[var(--c-radius-control)] border px-3 py-1.5 text-[11px] font-semibold',
            'transition-colors duration-150',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-wine-500)]/50',
            showPreview
              ? 'border-[var(--c-wine-500)]/30 bg-[var(--c-wine-50)] text-[var(--c-wine-700)]'
              : 'border-[var(--c-border)] text-[var(--c-muted)] hover:border-[var(--c-wine-300)] hover:text-[var(--c-wine-600)]',
          )}
        >
          <ImageIcon className="h-3.5 w-3.5" aria-hidden />
          {showPreview ? 'Ocultar preview' : 'Ver preview do card'}
        </button>

        {/* Preview animado */}
        <AnimatePresence>
          {showPreview && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              style={{ overflow: 'hidden' }}
            >
              <CardPreview
                frontMd={frontMd}
                backMd={backMd}
                frontImageUrl={frontImageUrl}
                backImageUrl={backImageUrl}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Grid frente / verso */}
        <div className="grid gap-5 sm:grid-cols-2">
          {/* Frente */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[var(--c-wine-500)]" aria-hidden />
              <label
                htmlFor="fc-front"
                className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--c-muted)]"
              >
                Frente
              </label>
            </div>
            <textarea
              id="fc-front"
              value={frontMd}
              onChange={(e) => setFrontMd(e.target.value)}
              rows={5}
              placeholder="Pergunta, conceito ou imagem… (markdown suportado)"
              className={cn(
                'w-full resize-none rounded-xl border bg-[var(--c-surface-2)] px-3.5 py-3',
                'text-[13px] leading-relaxed text-[var(--c-ink)]',
                'placeholder:text-[var(--c-muted-2)] outline-none transition-colors',
                'border-[var(--c-border)] focus:border-[var(--c-wine-400)] focus:ring-1 focus:ring-[var(--c-wine-500)]/20',
              )}
            />
            <ImageUploadZone
              label="da frente"
              imageUrl={frontImageUrl}
              uploading={uploadingFront}
              onFile={(f) => handleUpload(f, 'front')}
              onClear={() => setFrontImageUrl(null)}
            />
          </div>

          {/* Verso */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[var(--c-surface-2)] ring-2 ring-[var(--c-border)]" aria-hidden />
              <label
                htmlFor="fc-back"
                className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--c-muted)]"
              >
                Verso
              </label>
            </div>
            <textarea
              id="fc-back"
              value={backMd}
              onChange={(e) => setBackMd(e.target.value)}
              rows={5}
              placeholder="Resposta, explicação ou gabarito… (markdown suportado)"
              className={cn(
                'w-full resize-none rounded-xl border bg-[var(--c-surface-2)] px-3.5 py-3',
                'text-[13px] leading-relaxed text-[var(--c-ink)]',
                'placeholder:text-[var(--c-muted-2)] outline-none transition-colors',
                'border-[var(--c-border)] focus:border-[var(--c-wine-400)] focus:ring-1 focus:ring-[var(--c-wine-500)]/20',
              )}
            />
            <ImageUploadZone
              label="do verso"
              imageUrl={backImageUrl}
              uploading={uploadingBack}
              onFile={(f) => handleUpload(f, 'back')}
              onClear={() => setBackImageUrl(null)}
            />
          </div>
        </div>
      </div>
    </AdaptiveModal>
  );
}
