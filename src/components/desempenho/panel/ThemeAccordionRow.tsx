import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, Check, X, Minus, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { trackEvent } from '@/lib/analytics';
import { scoreTier } from './helpers';

function QuestionRow({
  number,
  text,
  isCorrect,
  wasAnswered,
  href,
  fallbackIdx,
}: {
  number: number | null;
  text: string;
  isCorrect: boolean;
  wasAnswered: boolean;
  href: string;
  fallbackIdx: number;
}) {
  const tone = isCorrect ? 'success' : wasAnswered ? 'destructive' : 'neutral';
  const badgeClass =
    tone === 'success'
      ? 'bg-success/10 text-success'
      : tone === 'destructive'
        ? 'bg-destructive/10 text-destructive'
        : 'bg-warning/15 text-warning-foreground';
  const Icon = isCorrect ? Check : wasAnswered ? X : Minus;
  const badgeLabel = isCorrect ? 'Acerto' : wasAnswered ? 'Erro' : 'Em branco';

  return (
    <Link
      to={href}
      className="group flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 no-underline transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <span className="min-w-0 flex-1 truncate text-[12px] text-foreground">
        <span className="mr-1.5 text-[11px] font-semibold text-muted-foreground tabular-nums">
          Q{number ?? fallbackIdx}
        </span>
        {text || `Questão ${number ?? fallbackIdx}`}
      </span>
      <span
        className={cn(
          'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold',
          badgeClass,
        )}
      >
        <Icon className="h-3 w-3" strokeWidth={2.5} aria-hidden />
        {badgeLabel}
      </span>
    </Link>
  );
}

export function ThemeAccordionRow({
  theme,
  score,
  correct,
  total,
  isOpen,
  onToggle,
  questionResults,
  simuladoId,
  prefersReducedMotion,
  correcaoVariant,
  showCadernoLink,
  cadernoBase,
  specialty,
}: {
  theme: string;
  score: number;
  correct: number;
  total: number;
  isOpen: boolean;
  onToggle: () => void;
  questionResults: Array<{
    questionId: string;
    number: number | null;
    text: string;
    isCorrect: boolean;
    wasAnswered: boolean;
  }>;
  simuladoId: string;
  prefersReducedMotion: boolean;
  correcaoVariant: 'public' | 'admin';
  showCadernoLink: boolean;
  cadernoBase: string;
  specialty: string;
}) {
  const tier = scoreTier(score);
  const scoreColor =
    tier === 'success' ? 'text-success' : tier === 'warning' ? 'text-warning' : 'text-destructive';

  const correcaoBase =
    correcaoVariant === 'admin'
      ? `/admin/preview/simulados/${simuladoId}/correcao`
      : `/simulados/${simuladoId}/correcao`;

  const contentId = `theme-content-${theme.replace(/\s+/g, '-')}`;

  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border transition-colors duration-200',
        isOpen ? 'border-primary/30 bg-card' : 'border-border bg-card/60 hover:border-primary/20',
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={contentId}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-inset"
      >
        <div className="flex min-w-0 items-center gap-2">
          <ChevronRight
            className={cn(
              'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
              isOpen && 'rotate-90 text-primary',
            )}
            aria-hidden
          />
          <span className="truncate text-[13px] font-semibold text-foreground">{theme}</span>
        </div>
        <span className={cn('shrink-0 text-[13px] font-bold tabular-nums', scoreColor)}>
          {correct}
          <span className="text-muted-foreground/40">/</span>
          {total}
        </span>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            id={contentId}
            key="content"
            initial={prefersReducedMotion ? { height: 'auto', opacity: 1 } : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.22, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="overflow-hidden"
          >
            <div className="border-t border-border/60 bg-muted/30 px-2 py-1.5">
              {questionResults.length === 0 ? (
                <p className="px-2 py-3 text-[12px] text-muted-foreground">
                  Nenhuma questão encontrada.
                </p>
              ) : (
                <ul className="flex flex-col">
                  {questionResults.map((q, idx) => (
                    <li key={q.questionId}>
                      <QuestionRow
                        number={q.number}
                        text={q.text}
                        isCorrect={q.isCorrect}
                        wasAnswered={q.wasAnswered}
                        href={`${correcaoBase}?q=${q.number ?? idx + 1}`}
                        fallbackIdx={idx + 1}
                      />
                    </li>
                  ))}
                </ul>
              )}
              {showCadernoLink && (
                <div className="px-2 pt-1.5 pb-1">
                  <Link
                    to={`${cadernoBase}?area=${encodeURIComponent(specialty)}&theme=${encodeURIComponent(theme)}`}
                    onClick={() =>
                      trackEvent('desempenho_to_caderno_clicked', {
                        target: 'erros',
                        area: specialty,
                        theme,
                      })
                    }
                    className="inline-flex items-center gap-1 rounded text-[11px] font-semibold text-primary no-underline transition-colors hover:text-primary/80 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <BookOpen className="h-3 w-3" aria-hidden />
                    Ver meus erros deste tema
                  </Link>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
