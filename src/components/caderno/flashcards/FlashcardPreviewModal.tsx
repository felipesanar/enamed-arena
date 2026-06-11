/**
 * FlashcardPreviewModal — preview de um flashcard com flip (frente → verso).
 *
 * Aberto ao clicar no card da listagem. Mostra só a frente; "Mostrar resposta"
 * (ou Espaço) revela o verso. Editar/Excluir no rodapé.
 * Desktop: Dialog. Mobile: bottom sheet (via AdaptiveModal).
 */

import { useEffect, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Pencil, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { AdaptiveModal } from '@/components/caderno/ui';
import { CardFace } from './CardFace';
import { useIsMobile } from '@/hooks/useIsMobile';
import type { Flashcard } from '@/types/caderno';

export interface FlashcardPreviewModalProps {
  card: Flashcard;
  onEdit: (card: Flashcard) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export function FlashcardPreviewModal({ card, onEdit, onDelete, onClose }: FlashcardPreviewModalProps) {
  const prefersReducedMotion = useReducedMotion();
  const isMobile = useIsMobile();
  const [revealed, setRevealed] = useState(false);

  // Espaço revela o verso (paridade com a sessão de revisão).
  // preventDefault incondicional: espaço não deve ativar o botão focado
  // (Radix auto-foca "Excluir") nem rolar o fundo.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== ' ') return;
      e.preventDefault();
      if (!revealed) setRevealed(true);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [revealed]);

  const flip = prefersReducedMotion
    ? { initial: {}, animate: { opacity: 1, rotateY: 0 }, exit: {} }
    : {
        initial: { opacity: 0, rotateY: -90 },
        animate: { opacity: 1, rotateY: 0 },
        exit: { opacity: 0, rotateY: 90 },
      };

  return (
    <AdaptiveModal
      open
      onOpenChange={(open) => { if (!open) onClose(); }}
      title="Flashcard"
      size="lg"
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { onClose(); onDelete(card.id); }}
            className="gap-1.5 text-[var(--c-muted)] hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
            Excluir
          </Button>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => { onClose(); onEdit(card); }}
              className="gap-1.5 border-[color-mix(in_srgb,var(--c-wine-500)_25%,transparent)] text-[var(--c-wine-600)] hover:border-[var(--c-wine-400)] hover:bg-[var(--c-wine-50)]"
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden />
              Editar
            </Button>
            {!revealed && (
              <Button
                size="sm"
                onClick={() => setRevealed(true)}
                className="bg-gradient-to-r from-[var(--c-wine-500)] to-[var(--c-wine-700)] text-white shadow-[var(--c-shadow-glow)] hover:opacity-90"
              >
                Mostrar resposta
                {!isMobile && (
                  <kbd className="ml-2 rounded border border-white/20 bg-white/10 px-1.5 py-0.5 text-[10px] font-mono">
                    Espaço
                  </kbd>
                )}
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div style={{ perspective: '1400px' }} className="py-1">
        <AnimatePresence mode="wait">
          {!revealed ? (
            <motion.div
              key="front"
              initial={false}
              animate={flip.animate}
              exit={flip.exit}
              transition={{ duration: prefersReducedMotion ? 0 : 0.3, ease: [0.22, 1, 0.36, 1] }}
              onClick={() => setRevealed(true)}
              className={cn(
                'cursor-pointer overflow-hidden rounded-[var(--c-radius-card)] border bg-[var(--c-surface)]',
                'border-[color-mix(in_srgb,var(--c-wine-500)_15%,transparent)] shadow-[var(--c-shadow-sm)]',
                'active:scale-[0.99]',
              )}
            >
              <CardFace md={card.front_md} imageUrl={card.front_image_url} faceLabel="Frente" isMobile={isMobile} />
            </motion.div>
          ) : (
            <motion.div
              key="back"
              initial={flip.initial}
              animate={flip.animate}
              transition={{ duration: prefersReducedMotion ? 0 : 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden rounded-[var(--c-radius-card)] border border-[var(--c-border)] bg-[var(--c-surface-2)] shadow-[var(--c-shadow-sm)]"
            >
              <CardFace md={card.back_md} imageUrl={card.back_image_url} faceLabel="Verso" isMobile={isMobile} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AdaptiveModal>
  );
}
