/**
 * AnswerSheetGrid
 *
 * 2-column bubble grid for offline answer submission.
 * Left column: Q1–Q50 | Right column: Q51–Q100
 * Auto-advances focus to the next unanswered question after each selection.
 */
import { useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';

const LABELS = ['A', 'B', 'C', 'D'] as const;

export interface AnswerSheetQuestion {
  id: string;
  number: number;
  options: Array<{ id: string; label: string }>;
}

interface AnswerSheetGridProps {
  questions: AnswerSheetQuestion[];
  /** question_id → selected option_id */
  answers: Record<string, string>;
  onSelect: (questionId: string, optionId: string) => void;
  focusedQuestionId: string | null;
}

export function AnswerSheetGrid({
  questions,
  answers,
  onSelect,
  focusedQuestionId,
}: AnswerSheetGridProps) {
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const setRef = useCallback(
    (qId: string) => (el: HTMLDivElement | null) => {
      rowRefs.current[qId] = el;
    },
    [],
  );

  const third1 = Math.ceil(questions.length / 3);
  const third2 = Math.ceil((questions.length * 2) / 3);
  const col1 = questions.slice(0, third1);
  const col2 = questions.slice(third1, third2);
  const col3 = questions.slice(third2);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-0">
      <Column
        questions={col1}
        answers={answers}
        onSelect={onSelect}
        focusedQuestionId={focusedQuestionId}
        setRef={setRef}
      />
      <Column
        questions={col2}
        answers={answers}
        onSelect={onSelect}
        focusedQuestionId={focusedQuestionId}
        setRef={setRef}
      />
      <Column
        questions={col3}
        answers={answers}
        onSelect={onSelect}
        focusedQuestionId={focusedQuestionId}
        setRef={setRef}
      />
    </div>
  );
}

// ─── Column ───────────────────────────────────────────────────────────────────

interface ColumnProps {
  questions: AnswerSheetQuestion[];
  answers: Record<string, string>;
  onSelect: (questionId: string, optionId: string) => void;
  focusedQuestionId: string | null;
  setRef: (qId: string) => (el: HTMLDivElement | null) => void;
}

function Column({ questions, answers, onSelect, focusedQuestionId, setRef }: ColumnProps) {
  return (
    <div className="divide-y divide-border/50">
      {questions.map(q => (
        <QuestionRow
          key={q.id}
          question={q}
          selectedOptionId={answers[q.id] ?? null}
          isFocused={focusedQuestionId === q.id}
          onSelect={onSelect}
          ref={setRef(q.id)}
        />
      ))}
    </div>
  );
}

// ─── QuestionRow ──────────────────────────────────────────────────────────────

interface QuestionRowProps {
  question: AnswerSheetQuestion;
  selectedOptionId: string | null;
  isFocused: boolean;
  onSelect: (questionId: string, optionId: string) => void;
  ref: (el: HTMLDivElement | null) => void;
}

function QuestionRow({
  question,
  selectedOptionId,
  isFocused,
  onSelect,
  ref,
}: QuestionRowProps) {
  return (
    <div
      ref={ref}
      className={cn(
        'flex items-center gap-3 px-2 py-2.5 transition-colors',
        isFocused && 'bg-primary/5 rounded-lg',
      )}
    >
      {/* Question number */}
      <span
        className={cn(
          'w-8 text-right text-xs font-semibold tabular-nums shrink-0',
          isFocused ? 'text-primary' : 'text-muted-foreground',
        )}
      >
        {question.number}
      </span>

      {/* Bubbles A B C D */}
      <div className="flex gap-2">
        {LABELS.map(label => {
          const option = question.options.find(o => o.label === label);
          if (!option) return null;
          const isSelected = selectedOptionId === option.id;

          return (
            <button
              key={label}
              type="button"
              onClick={() => onSelect(question.id, option.id)}
              aria-label={`Questão ${question.number} — alternativa ${label}`}
              aria-pressed={isSelected}
              className={cn(
                'h-8 w-8 rounded-full border-2 text-xs font-bold transition-all',
                'flex items-center justify-center shrink-0',
                isSelected
                  ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                  : 'border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-primary',
              )}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
