/**
 * TreinoLauncher — Painel de configuração e lançamento do Treino do Caderno.
 *
 * Recebe a área/tema selecionado pelo WeakAreaPicker e exibe:
 *   - Resumo da área escolhida
 *   - Seletor de quantidade de questões (5 / 10 / 15 / todas)
 *   - Toggle "Treino cronometrado" (~3 min/questão)
 *   - CTA primário: iniciar sessão de recall com filtro de área
 *     → /caderno/revisao?mode=drill&area=<área>[&theme=<tema>][&timed=1]
 *   - CTA secundário: treinar questões novas do tema no banco de questões
 *     → /simulados?area=<área>[&theme=<tema>]
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Play, ExternalLink, BookOpen, Dumbbell, Timer } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getReasonMeta } from '@/lib/errorNotebookReasons';
import type { RankedWeakArea } from '@/lib/weakAreas';

// ─── Tipos ─────────────────────────────────────────────────────────────────────

export interface TreinoLauncherProps {
  area: RankedWeakArea;
  /** timed — controlled externally (CadernoTreinoPage manages the toggle state) */
  timed: boolean;
  onTimedChange: (timed: boolean) => void;
  onLaunch: (area: RankedWeakArea, count: number, timed: boolean) => void;
}

// ─── Constantes ────────────────────────────────────────────────────────────────

const QTY_OPTIONS = [5, 10, 15] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildRevisaoUrl(area: RankedWeakArea, timed: boolean): string {
  const params = new URLSearchParams({ mode: 'drill', area: area.area });
  if (area.theme) params.set('theme', area.theme);
  if (timed) params.set('timed', '1');
  return `/caderno/revisao?${params.toString()}`;
}

function buildSimuladosUrl(area: RankedWeakArea): string {
  const params = new URLSearchParams({ area: area.area });
  if (area.theme) params.set('theme', area.theme);
  return `/simulados?${params.toString()}`;
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function TreinoLauncher({ area, timed, onTimedChange, onLaunch }: TreinoLauncherProps) {
  const [selectedQty, setSelectedQty] = useState<number>(
    Math.min(10, area.pending),
  );

  const reasonMeta = getReasonMeta(area.topReason as any);
  const label = area.theme ? `${area.area} › ${area.theme}` : area.area;
  const revisaoUrl = buildRevisaoUrl(area, timed);
  const simuladosUrl = buildSimuladosUrl(area);

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-5">
      {/* Cabeçalho da área selecionada */}
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <Dumbbell className="h-5 w-5 text-primary" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Área selecionada
          </p>
          <h3 className="text-[15px] font-bold leading-snug text-foreground truncate">
            {label}
          </h3>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <span>
              <strong className="text-foreground tabular-nums">{area.pending}</strong> pendente{area.pending !== 1 ? 's' : ''} no caderno
            </span>
            {area.totalLapses > 0 && (
              <>
                <span aria-hidden>·</span>
                <span>
                  <strong className="text-destructive tabular-nums">{area.totalLapses}</strong> lapso{area.totalLapses !== 1 ? 's' : ''} SRS
                </span>
              </>
            )}
            {reasonMeta && (
              <>
                <span aria-hidden>·</span>
                <span>motivo frequente: <strong className="text-foreground">{reasonMeta.label}</strong></span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Seletor de quantidade */}
      <div>
        <p
          className="mb-2 text-[12px] font-semibold text-muted-foreground"
          id="qty-label"
        >
          Quantas questões do caderno revisar?
        </p>
        <div
          role="group"
          aria-labelledby="qty-label"
          className="flex flex-wrap gap-2"
        >
          {QTY_OPTIONS.filter((n) => n <= area.pending).map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={selectedQty === n}
              aria-label={`${n} questões`}
              onClick={() => setSelectedQty(n)}
              className={cn(
                'rounded-xl border px-4 py-1.5 text-[13px] font-semibold transition-all duration-150',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                selectedQty === n
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-background text-muted-foreground hover:border-primary/30 hover:text-foreground',
              )}
            >
              {n}
            </button>
          ))}
          {/* "Todas" se houver mais que o último preset */}
          {area.pending > Math.max(...QTY_OPTIONS.filter((n) => n <= area.pending), 0) && (
            <button
              type="button"
              aria-pressed={selectedQty === area.pending}
              aria-label={`Todas as ${area.pending} questões`}
              onClick={() => setSelectedQty(area.pending)}
              className={cn(
                'rounded-xl border px-4 py-1.5 text-[13px] font-semibold transition-all duration-150',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                selectedQty === area.pending
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-background text-muted-foreground hover:border-primary/30 hover:text-foreground',
              )}
            >
              Todas ({area.pending})
            </button>
          )}
        </div>
      </div>

      {/* Toggle: treino cronometrado */}
      <div className="flex items-start gap-3 rounded-xl border border-border bg-background px-4 py-3">
        <button
          type="button"
          role="switch"
          aria-checked={timed}
          aria-label="Treino cronometrado (ritmo de prova)"
          onClick={() => onTimedChange(!timed)}
          className={cn(
            'relative mt-0.5 flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            timed ? 'bg-primary' : 'bg-muted',
          )}
        >
          <span
            className={cn(
              'pointer-events-none block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200',
              timed ? 'translate-x-4' : 'translate-x-0',
            )}
          />
        </button>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <Timer className="h-3.5 w-3.5 text-primary shrink-0" aria-hidden />
            <span className="text-[13px] font-semibold text-foreground">
              Treino cronometrado
            </span>
            <span className="rounded-full border border-primary/30 bg-primary/10 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-primary">
              Ritmo de prova
            </span>
          </div>
          <p className="mt-0.5 text-[11px] text-muted-foreground leading-snug">
            Cronômetro visível com alvo de ~3 min/questão. Sem avanço forçado — só pressão real.
          </p>
        </div>
      </div>

      {/* CTAs */}
      <div className="flex flex-col gap-3 pt-1">
        {/* CTA primário: recall do caderno */}
        <Link
          to={revisaoUrl}
          onClick={() => onLaunch(area, selectedQty, timed)}
          className={cn(
            'group inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3',
            'bg-primary text-primary-foreground text-[14px] font-bold no-underline',
            'shadow-[0_4px_14px_-4px_hsl(345_65%_30%/0.4)]',
            'transition-all duration-200 hover:bg-wine-hover hover:shadow-[0_6px_18px_-4px_hsl(345_65%_30%/0.5)]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            'active:scale-[0.99]',
          )}
          aria-label={`Iniciar recall do caderno: ${selectedQty} questões de ${label}${timed ? ' — cronometrado' : ''}`}
        >
          {timed ? <Timer className="h-4 w-4" aria-hidden /> : <Play className="h-4 w-4 fill-current" aria-hidden />}
          {timed ? 'Iniciar treino cronometrado' : 'Iniciar recall do caderno'}
        </Link>

        {/* CTA secundário: questões novas no banco */}
        <Link
          to={simuladosUrl}
          className={cn(
            'inline-flex items-center justify-center gap-2 rounded-xl border border-border px-5 py-3',
            'text-[13px] font-semibold text-muted-foreground no-underline',
            'transition-all duration-200 hover:border-primary/30 hover:text-foreground hover:bg-primary/[0.03]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          )}
          aria-label={`Treinar questões novas de ${label} no banco de simulados`}
        >
          <BookOpen className="h-4 w-4" aria-hidden />
          Treinar questões novas
          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/60" aria-hidden />
        </Link>
      </div>

    </div>
  );
}
