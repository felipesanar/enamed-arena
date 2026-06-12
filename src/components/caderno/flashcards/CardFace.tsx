/**
 * CardFace — uma face (frente ou verso) de um flashcard.
 * Usado pela FlashcardReviewSession e pelo FlashcardPreviewModal.
 * Render markdown + imagem opcional + badge da face.
 */

import ReactMarkdown from 'react-markdown';
import { Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface CardFaceProps {
  md: string;
  imageUrl: string | null;
  faceLabel: 'Frente' | 'Verso';
  isMobile: boolean;
}

export function CardFace({ md, imageUrl, faceLabel, isMobile }: CardFaceProps) {
  const isBack = faceLabel === 'Verso';
  return (
    <div
      className={cn(
        'flex flex-col gap-4',
        isMobile ? 'min-h-[240px] p-6' : 'min-h-[280px] p-8 sm:min-h-[320px]',
      )}
    >
      {/* Face label badge */}
      <span
        className={cn(
          'self-start rounded-[var(--c-radius-pill)] px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em]',
          isBack
            ? 'bg-[var(--c-surface-2)] text-[var(--c-muted)]'
            : 'bg-[var(--c-soft-wine-bg)] text-[var(--c-wine-600)] dark:text-[var(--c-wine-300)]',
        )}
      >
        {faceLabel}
      </span>

      {/* Image */}
      {imageUrl ? (
        <div className="overflow-hidden rounded-xl border border-[var(--c-border)]">
          <img
            src={imageUrl}
            alt={`Imagem do ${faceLabel.toLowerCase()} do flashcard`}
            className="max-h-48 w-full object-contain"
          />
        </div>
      ) : null}

      {/* Content */}
      {md.trim() ? (
        <div
          className={cn(
            'prose dark:prose-invert max-w-none flex-1',
            isMobile ? 'prose-sm text-[14px] leading-relaxed' : 'prose-base text-[15px] leading-relaxed',
          )}
        >
          <ReactMarkdown>{md}</ReactMarkdown>
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center gap-2 text-[var(--c-muted-2)]">
          <ImageIcon className="h-5 w-5" aria-hidden />
          <span className="text-[13px] italic">(conteúdo vazio)</span>
        </div>
      )}
    </div>
  );
}
