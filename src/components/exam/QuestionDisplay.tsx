import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { Question } from '@/types';
import type { ExamAnswer } from '@/types/exam';
import { Trash2, Undo2, ZoomIn, X } from 'lucide-react';

interface QuestionDisplayProps {
  question: Question;
  answer: ExamAnswer | undefined;
  onSelectOption: (optionId: string) => void;
  onEliminateOption: (optionId: string) => void;
}

export function QuestionDisplay({ question, answer, onSelectOption, onEliminateOption }: QuestionDisplayProps) {
  const selectedId = answer?.selectedOption ?? null;
  const eliminated = answer?.eliminatedAlternatives ?? [];
  const [lightboxOpen, setLightboxOpen] = useState(false);

  return (
    <div>
      <a
        href="#exam-options"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-10 focus:px-3 focus:py-1.5 focus:rounded-lg focus:bg-primary focus:text-primary-foreground focus:text-body-sm"
      >
        Pular para alternativas
      </a>
      {/* Area + theme */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className="px-2.5 py-1 rounded-md bg-accent text-accent-foreground text-caption font-medium">
          {question.area}
        </span>
        <span className="px-2.5 py-1 rounded-md bg-muted text-muted-foreground text-caption">
          {question.theme}
        </span>
      </div>

      {/* Question number + statement */}
      <div className="mb-6">
        <p className="text-body font-bold text-primary tracking-tight mb-2">
          Questão {question.number}
        </p>
        <p className="text-[17px] leading-[1.75] text-[hsl(var(--exam-text))] whitespace-pre-line">
          {question.text}
        </p>
      </div>

      {/* Question image with lightbox */}
      {question.imageUrl && (
        <div className="mb-6">
          <button
            type="button"
            onClick={() => setLightboxOpen(true)}
            className="relative group cursor-zoom-in rounded-xl overflow-hidden border border-[hsl(var(--exam-border))] bg-[hsl(var(--exam-surface))] inline-block"
          >
            <img
              src={question.imageUrl}
              alt={`Imagem da questão ${question.number}`}
              className="max-w-full max-h-80 object-contain"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/10 transition-colors flex items-center justify-center">
              <ZoomIn className="h-6 w-6 text-foreground/0 group-hover:text-foreground/70 transition-colors" />
            </div>
          </button>
        </div>
      )}

      {/* Lightbox overlay */}
      <AnimatePresence>
        {lightboxOpen && question.imageUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[60] bg-foreground/80 backdrop-blur-md flex items-center justify-center p-4"
            onClick={() => setLightboxOpen(false)}
          >
            <button
              type="button"
              onClick={() => setLightboxOpen(false)}
              className="absolute top-4 right-4 h-10 w-10 rounded-full bg-card flex items-center justify-center text-foreground hover:bg-muted transition-colors z-10"
              aria-label="Fechar imagem"
            >
              <X className="h-5 w-5" />
            </button>
            <motion.img
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              src={question.imageUrl}
              alt={`Imagem da questão ${question.number}`}
              className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Options — inspired by Academy's AlternativaProva, elevated visually */}
      <div id="exam-options" className="space-y-3" role="radiogroup" aria-label={`Alternativas da questão ${question.number}`}>
        {question.options.map((opt) => {
          const isSelected = selectedId === opt.id;
          const isEliminated = eliminated.includes(opt.id);

          return (
            <div key={opt.id} className="group relative">
              <button
                role="radio"
                aria-checked={isSelected}
                onClick={() => {
                  if (isEliminated) {
                    onEliminateOption(opt.id); // restore first
                  }
                  onSelectOption(opt.id);
                }}
                className={cn(
                  'w-full text-left p-4 pr-14 sm:pr-24 rounded-xl transition-all duration-150',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                  isSelected
                    ? 'border-2 border-info bg-info/10 shadow-[var(--exam-shadow-selected)]'
                    : isEliminated
                      ? 'border border-transparent bg-muted/15 opacity-35'
                      : 'border border-transparent bg-[hsl(var(--exam-surface))] hover:bg-[hsl(var(--exam-surface-hover))]',
                )}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={cn(
                      'flex-shrink-0 h-7 w-7 rounded-full flex items-center justify-center font-mono text-[13px] font-semibold transition-all duration-150',
                      isSelected
                        ? 'bg-info text-info-foreground scale-105'
                        : 'bg-muted/60 text-muted-foreground',
                    )}
                  >
                    {opt.label}
                  </span>
                  <span className={cn(
                    'text-[15px] leading-[1.6] text-[hsl(var(--exam-text))] pt-0.5 break-words',
                    isEliminated && 'line-through text-muted-foreground',
                  )}>
                    {opt.text}
                  </span>
                </div>
              </button>

              {/* Eliminate/restore — icon on mobile, icon+label on desktop hover */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onEliminateOption(opt.id);
                }}
                className={cn(
                  'absolute right-3 top-1/2 -translate-y-1/2',
                  'flex items-center gap-1 px-2 py-1.5 rounded-lg',
                  'transition-all duration-150 text-muted-foreground hover:text-foreground hover:bg-muted',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  'active:scale-90 min-h-[44px] min-w-[44px] sm:min-h-[36px] sm:min-w-0',
                  isEliminated ? 'opacity-100 text-destructive hover:text-destructive' : 'opacity-100 sm:opacity-0 sm:group-hover:opacity-100',
                )}
                title={isEliminated ? 'Restaurar alternativa' : 'Eliminar alternativa'}
                aria-label={isEliminated ? 'Restaurar alternativa' : 'Eliminar alternativa'}
              >
                {isEliminated
                  ? <><Undo2 className="h-3.5 w-3.5 shrink-0" aria-hidden /><span className="hidden sm:inline text-[11px] font-medium">Restaurar</span></>
                  : <><Trash2 className="h-3.5 w-3.5 shrink-0" aria-hidden /><span className="hidden sm:inline text-[11px] font-medium">Eliminar</span></>
                }
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}