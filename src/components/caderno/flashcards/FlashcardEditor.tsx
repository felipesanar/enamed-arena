/**
 * FlashcardEditor — modal criar/editar flashcard.
 *
 * Funcionalidades:
 * - Campos frente/verso (textarea markdown)
 * - Upload de imagem frente E verso (drag-and-drop + fallback "selecionar arquivo")
 * - Preview do card antes de salvar (flip animado)
 * - Botão "Gerar com Prof. San" → generateFlashcard → pré-preenche frente/verso (corrige anti-padrão Medway)
 * - Dispara: caderno_flashcard_created, caderno_flashcard_ai_generated
 */

import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import {
  X,
  Sparkles,
  Loader2,
  Upload,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Trash2,
  RotateCcw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { logger } from '@/lib/logger';
import { toast } from '@/hooks/use-toast';
import { trackEvent } from '@/lib/analytics';
import { simuladosApi } from '@/services/simuladosApi';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { Flashcard, CreateFlashcardPayload, UpdateFlashcardPayload } from '@/types/caderno';

/* ── Types ── */

export interface FlashcardEditorProps {
  /** When provided, editor is in edit mode. */
  card?: Flashcard;
  /** Required for creation mode. */
  defaultDeckId?: string;
  /** Called when user saves successfully. */
  onSave: (card: Flashcard) => void;
  onClose: () => void;
  /** Optional context forwarded to generateFlashcard (entry_id, question_id…) */
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

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(true);
  };
  const handleDragLeave = () => setDragging(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFile(file);
  };

  return (
    <div className="space-y-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>

      {imageUrl ? (
        <div className="relative overflow-hidden rounded-xl border border-border/60">
          <img src={imageUrl} alt={`Imagem ${label}`} className="max-h-36 w-full object-cover" />
          <button
            type="button"
            aria-label={`Remover imagem ${label}`}
            onClick={onClear}
            className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-background/80 text-muted-foreground shadow-sm transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Trash2 className="h-3 w-3" aria-hidden />
          </button>
        </div>
      ) : (
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
            'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-5 transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            dragging
              ? 'border-primary bg-primary/5'
              : 'border-border/40 hover:border-border/80 hover:bg-muted/30',
          )}
        >
          {uploading ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden />
          ) : (
            <Upload className="h-5 w-5 text-muted-foreground/50" aria-hidden />
          )}
          <span className="text-[11px] text-muted-foreground/60">
            {uploading ? 'Enviando…' : 'Arraste ou clique para selecionar'}
          </span>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        aria-hidden="true"
        tabIndex={-1}
        onChange={handleInputChange}
      />
    </div>
  );
}

/* ── CardPreview ── */

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
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Preview — {flipped ? 'Verso' : 'Frente'}
        </span>
        <button
          type="button"
          onClick={() => setFlipped((f) => !f)}
          aria-label={flipped ? 'Ver frente' : 'Ver verso'}
          className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <RotateCcw className="h-3 w-3" aria-hidden />
          {flipped ? 'Ver frente' : 'Ver verso'}
        </button>
      </div>

      <div
        className="relative min-h-[100px] overflow-hidden rounded-xl border border-border bg-card"
        style={{ perspective: '1000px' }}
      >
        <AnimatePresence mode="wait">
          {!flipped ? (
            <motion.div
              key="front"
              initial={prefersReducedMotion ? false : { rotateY: -90, opacity: 0 }}
              animate={{ rotateY: 0, opacity: 1 }}
              exit={prefersReducedMotion ? undefined : { rotateY: 90, opacity: 0 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.25 }}
              className="p-4"
            >
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
                <p className="text-[13px] italic text-muted-foreground/50">(frente vazia)</p>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="back"
              initial={prefersReducedMotion ? false : { rotateY: 90, opacity: 0 }}
              animate={{ rotateY: 0, opacity: 1 }}
              exit={prefersReducedMotion ? undefined : { rotateY: -90, opacity: 0 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.25 }}
              className="p-4"
            >
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
                <p className="text-[13px] italic text-muted-foreground/50">(verso vazio)</p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ── FlashcardEditor (main) ── */

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
      toast({
        title: 'Falha no upload da imagem',
        description: 'Verifique sua conexão e tente novamente.',
        variant: 'destructive',
      });
    } finally {
      if (side === 'front') setUploadingFront(false);
      else setUploadingBack(false);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const context = generateContext ?? {};
      // If we have existing front/back content, include it as context for improvement
      if (frontMd.trim()) context['existing_front'] = frontMd;
      if (backMd.trim()) context['existing_back'] = backMd;

      const result = await simuladosApi.generateFlashcard(context);
      setFrontMd(result.front_md);
      setBackMd(result.back_md);
      // Auto-show preview after generation so user can review before saving
      setShowPreview(true);
      toast({ title: 'Flashcard gerado pelo Prof. San', description: 'Revise e ajuste se necessário.' });
      trackEvent('caderno_flashcard_ai_generated', {
        has_context: Object.keys(generateContext ?? {}).length > 0,
      });
    } catch (err) {
      logger.error('[FlashcardEditor] Generate error:', err);
      toast({
        title: 'Não foi possível gerar o flashcard',
        description: 'Tente novamente em instantes.',
        variant: 'destructive',
      });
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
        const payload: UpdateFlashcardPayload = {
          front_md: frontMd,
          back_md: backMd,
          front_image_url: frontImageUrl,
          back_image_url: backImageUrl,
        };
        saved = await simuladosApi.updateFlashcard(card.id, payload);
      } else {
        const payload: CreateFlashcardPayload = {
          deck_id: deckId,
          front_md: frontMd,
          back_md: backMd,
          front_image_url: frontImageUrl,
          back_image_url: backImageUrl,
        };
        saved = await simuladosApi.createFlashcard(payload);
        trackEvent('caderno_flashcard_created', {
          deck_id: deckId,
          has_image: !!(frontImageUrl || backImageUrl),
          ai_generated: false,
        });
      }
      toast({ title: isEditing ? 'Flashcard atualizado' : 'Flashcard criado' });
      onSave(saved);
    } catch (err) {
      logger.error('[FlashcardEditor] Save error:', err);
      toast({
        title: 'Não foi possível salvar',
        description: 'Tente novamente em instantes.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const isBusy = saving || generating || uploadingFront || uploadingBack;

  return (
    /* Overlay */
    <div
      role="dialog"
      aria-modal="true"
      aria-label={isEditing ? 'Editar flashcard' : 'Criar flashcard'}
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
    >
      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />

      {/* Panel */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 24 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className={cn(
          'relative z-10 flex max-h-[92dvh] w-full flex-col overflow-hidden bg-background shadow-2xl',
          'rounded-t-[24px] sm:max-w-2xl sm:rounded-[20px]',
        )}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-border/60 px-5 py-4">
          <h2 className="text-[15px] font-bold text-foreground">
            {isEditing ? 'Editar flashcard' : 'Novo flashcard'}
          </h2>
          <div className="flex items-center gap-2">
            {/* Botão Gerar com Prof. San */}
            <Tooltip delayDuration={300}>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isBusy}
                  onClick={handleGenerate}
                  className="gap-1.5 text-[12px]"
                  aria-label="Gerar frente e verso com Prof. San (IA)"
                >
                  {generating ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5 text-amber-400" aria-hidden />
                  )}
                  {generating ? 'Gerando…' : 'Gerar com Prof. San'}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                A IA rascunha a frente e o verso a partir do contexto do erro
              </TooltipContent>
            </Tooltip>

            {/* Toggle preview */}
            <Tooltip delayDuration={300}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label={showPreview ? 'Ocultar preview' : 'Ver preview do card'}
                  aria-pressed={showPreview}
                  onClick={() => setShowPreview((v) => !v)}
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-lg border transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    showPreview
                      ? 'border-primary/30 bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:bg-accent hover:text-foreground',
                  )}
                >
                  {showPreview ? (
                    <EyeOff className="h-3.5 w-3.5" aria-hidden />
                  ) : (
                    <Eye className="h-3.5 w-3.5" aria-hidden />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {showPreview ? 'Ocultar preview' : 'Preview do card'}
              </TooltipContent>
            </Tooltip>

            <button
              type="button"
              aria-label="Fechar editor"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>

        {/* Body (scrollable) */}
        <div className="flex-1 overflow-y-auto p-5">
          <div className="space-y-6">
            {/* Preview (condicional) */}
            <AnimatePresence>
              {showPreview && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
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
                <label
                  htmlFor="fc-front"
                  className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  Frente
                </label>
                <textarea
                  id="fc-front"
                  value={frontMd}
                  onChange={(e) => setFrontMd(e.target.value)}
                  rows={5}
                  placeholder="Pergunta, conceito ou imagem… (markdown suportado)"
                  className={cn(
                    'w-full resize-none rounded-xl border border-border bg-muted/30 px-3.5 py-3 text-[13px] leading-relaxed text-foreground',
                    'placeholder:text-muted-foreground/40 outline-none transition-colors',
                    'focus:border-primary/50 focus:ring-1 focus:ring-primary/20',
                  )}
                />
                <ImageUploadZone
                  label="Imagem da frente"
                  imageUrl={frontImageUrl}
                  uploading={uploadingFront}
                  onFile={(f) => handleUpload(f, 'front')}
                  onClear={() => setFrontImageUrl(null)}
                />
              </div>

              {/* Verso */}
              <div className="space-y-3">
                <label
                  htmlFor="fc-back"
                  className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  Verso
                </label>
                <textarea
                  id="fc-back"
                  value={backMd}
                  onChange={(e) => setBackMd(e.target.value)}
                  rows={5}
                  placeholder="Resposta, explicação ou gabarito… (markdown suportado)"
                  className={cn(
                    'w-full resize-none rounded-xl border border-border bg-muted/30 px-3.5 py-3 text-[13px] leading-relaxed text-foreground',
                    'placeholder:text-muted-foreground/40 outline-none transition-colors',
                    'focus:border-primary/50 focus:ring-1 focus:ring-primary/20',
                  )}
                />
                <ImageUploadZone
                  label="Imagem do verso"
                  imageUrl={backImageUrl}
                  uploading={uploadingBack}
                  onFile={(f) => handleUpload(f, 'back')}
                  onClear={() => setBackImageUrl(null)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-end gap-3 border-t border-border/60 px-5 py-4">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isBusy}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={isBusy || (!frontMd.trim() && !backMd.trim())}
            onClick={handleSave}
            className="min-w-[100px]"
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
      </motion.div>
    </div>
  );
}
