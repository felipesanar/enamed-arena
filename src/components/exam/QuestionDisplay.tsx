import { useState } from 'react';
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
    <div className="animate-fade-in">
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
        <p className="text-overline uppercase text-muted-foreground mb-2">
          Questão {question.number}
        </p>
        <p className="text-body-lg text-foreground leading-relaxed whitespace-pre-line">
          {question.text}
        </p>
      </div>

      {/* Question image with lightbox */}
      {question.imageUrl && (
        <div className="mb-6">
          <button
            type="button"
            onClick={() => setLightboxOpen(true)}
            className="relative group cursor-zoom-in rounded-xl overflow-hidden border border-border bg-muted/30 inline-block"
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
      {lightboxOpen && question.imageUrl && (
        <div
          className="fixed inset-0 z-[60] bg-foreground/80 backdrop-blur-sm flex items-center justify-center p-4"
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
          <img
            src={question.imageUrl}
            alt={`Imagem da questão ${question.number}`}
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Options — inspired by Academy's AlternativaProva, elevated visually */}
      <div className="space-y-3" role="radiogroup" aria-label={`Alternativas da questão ${question.number}`}>
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
                  'w-full text-left p-4 rounded-xl border-2 transition-all duration-200',
                  'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
                  'active:scale-[0.995]',
                  isSelected
                    ? 'border-primary bg-primary/5 shadow-md ring-2 ring-primary/20'
                    : isEliminated
                      ? 'border-border bg-muted/20 opacity-40'
                      : 'border-border bg-card hover:border-primary/40 hover:bg-muted/30',
                )}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={cn(
                      'flex-shrink-0 h-7 w-7 rounded-full flex items-center justify-center text-caption font-bold transition-colors',
                      isSelected
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {opt.label}
                  </span>
                  <span className={cn(
                    'text-body text-foreground pt-0.5',
                    isEliminated && 'line-through',
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