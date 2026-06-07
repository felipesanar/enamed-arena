import type { ReactNode } from 'react';
import { Star, TrendingDown, Dumbbell } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { trackEvent } from '@/lib/analytics';
import { SectionHeader } from './primitives';

function SummaryCard({
  icon: Icon,
  tone,
  title,
  area,
  correct,
  total,
  score,
  description,
  action,
}: {
  icon: typeof Star;
  tone: 'success' | 'destructive';
  title: string;
  area: string;
  correct: number;
  total: number;
  score: number;
  description: string;
  action?: ReactNode;
}) {
  const toneClasses =
    tone === 'success'
      ? 'border-success/20 bg-success/[0.04]'
      : 'border-destructive/20 bg-destructive/[0.04]';
  const iconTone = tone === 'success' ? 'text-success' : 'text-destructive';
  const iconBg = tone === 'success' ? 'bg-success/15' : 'bg-destructive/15';
  const scoreTone = tone === 'success' ? 'text-success' : 'text-destructive';

  return (
    <div
      className={cn(
        'rounded-2xl border p-4 transition-shadow duration-200 hover:shadow-[0_8px_22px_-14px_rgba(0,0,0,0.12)]',
        toneClasses,
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
            iconBg,
          )}
        >
          <Icon className={cn('h-4 w-4', iconTone)} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h4 className={cn('text-[13px] font-bold uppercase tracking-wide', iconTone)}>
            {title}
          </h4>
          <p className="mt-1 truncate text-[15px] font-bold text-foreground" title={area}>
            {area}
          </p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className={cn('text-[18px] font-extrabold leading-none tabular-nums', scoreTone)}>
              {correct}
              <span className="text-muted-foreground/40">/</span>
              {total}
            </span>
            <span className="text-[11px] font-semibold text-muted-foreground tabular-nums">
              {score}%
            </span>
          </div>
          <p className="mt-2 text-[12px] leading-snug text-muted-foreground">{description}</p>
          {action}
        </div>
      </div>
    </div>
  );
}

export function SummarySection({
  bestArea,
  worstArea,
  showCadernoLink,
  cadernoTreino,
}: {
  bestArea: { area: string; score: number; correct: number; questions: number };
  worstArea: { area: string; score: number; correct: number; questions: number };
  showCadernoLink: boolean;
  cadernoTreino: string;
}) {
  return (
    <section aria-label="Resumo do desempenho">
      <SectionHeader title="Resumo do desempenho" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <SummaryCard
          icon={Star}
          tone="success"
          title="Onde você brilha"
          area={bestArea.area}
          correct={bestArea.correct}
          total={bestArea.questions}
          score={bestArea.score}
          description={`Sua principal fortaleza foi em ${bestArea.area} com ${bestArea.correct}/${bestArea.questions} acertos.`}
        />
        <SummaryCard
          icon={TrendingDown}
          tone="destructive"
          title="Próximo foco"
          area={worstArea.area}
          correct={worstArea.correct}
          total={worstArea.questions}
          score={worstArea.score}
          description={`A especialidade com maior oportunidade é ${worstArea.area} com ${worstArea.correct}/${worstArea.questions} acertos.`}
          action={
            showCadernoLink ? (
              <Link
                to={`${cadernoTreino}?area=${encodeURIComponent(worstArea.area)}`}
                onClick={() =>
                  trackEvent('desempenho_to_caderno_clicked', {
                    target: 'treinar',
                    area: worstArea.area,
                  })
                }
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 bg-destructive/[0.06] px-3 py-1.5 text-[12px] font-semibold text-destructive no-underline transition-colors hover:bg-destructive/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <Dumbbell className="h-3.5 w-3.5" aria-hidden />
                Treinar {worstArea.area}
              </Link>
            ) : undefined
          }
        />
      </div>
    </section>
  );
}
