/**
 * TreinoLauncher — Painel de configuração e lançamento do Treino do Caderno.
 *
 * Redesign premium ("cockpit de treino"): cabeçalho com medalhão e leitura
 * rápida da área (pendentes / lapsos / domínio), seletor de quantidade em pills,
 * toggle cronometrado com visual rico e CTA primário com gradiente wine.
 * Totalmente responsivo (mobile usa BottomActionBar).
 *
 * Recebe a área selecionada pelo WeakAreaPicker e exibe:
 *   - Resumo da área escolhida (causa + lapsos + domínio)
 *   - Seletor de quantidade (5 / 10 / 15 / todas)
 *   - Toggle "Treino cronometrado" (~3 min/questão)
 *   - CTA primário: /caderno/revisao?mode=drill&area=...&[timed=1]
 *   - CTA secundário: /simulados?area=...
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Play, ExternalLink, BookOpen, Dumbbell, Timer, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { CadernoCard } from '@/components/caderno/ui/CadernoCard';
import { CauseBadge } from '@/components/caderno/ui/CauseBadge';
import { useIsMobile } from '@/hooks/useIsMobile';
import { BottomActionBar } from '@/components/caderno/ui/BottomActionBar';
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

function buildRevisaoUrl(area: RankedWeakArea, timed: boolean, count: number): string {
  const params = new URLSearchParams({ mode: 'drill', area: area.area });
  if (area.theme) params.set('theme', area.theme);
  if (timed) params.set('timed', '1');
  params.set('count', String(count));
  return `/caderno/revisao?${params.toString()}`;
}

function buildSimuladosUrl(area: RankedWeakArea): string {
  const params = new URLSearchParams({ area: area.area });
  if (area.theme) params.set('theme', area.theme);
  return `/simulados?${params.toString()}`;
}

// ─── Subcomponente: leitura rápida da área ───────────────────────────────────

function StatReadout({
  value,
  label,
  tone = 'ink',
}: {
  value: number | string;
  label: string;
  tone?: 'ink' | 'orange' | 'destructive' | 'success';
}) {
  const toneColor =
    tone === 'orange'
      ? 'text-orange-600 dark:text-orange-400'
      : tone === 'destructive'
        ? 'text-destructive'
        : tone === 'success'
          ? 'text-[var(--c-success)]'
          : 'text-[var(--c-ink)]';
  return (
    <div className="flex flex-1 flex-col items-center justify-center rounded-[var(--c-radius-control)] bg-[var(--c-surface-2)] px-2 py-2.5">
      <span className={cn('text-[18px] font-extrabold leading-none tabular-nums', toneColor)}>
        {value}
      </span>
      <span className="mt-1 text-center text-[9.5px] font-semibold uppercase tracking-[0.06em] text-[var(--c-muted)]">
        {label}
      </span>
    </div>
  );
}

// ─── Subcomponente: chip de quantidade ───────────────────────────────────────

interface QtyChipProps {
  value: number;
  label: string;
  selected: boolean;
  onClick: () => void;
}

function QtyChip({ value: _value, label, selected, onClick }: QtyChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={label}
      onClick={onClick}
      className={cn(
        'flex-1 rounded-[var(--c-radius-control)] border px-3 py-2 text-[13px] font-bold transition-all duration-[var(--c-duration-fast)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-wine-500)]/50 focus-visible:ring-offset-2',
        'min-h-[44px] whitespace-nowrap',
        selected
          ? [
              'border-[var(--c-wine-500)]/45 text-white',
              'shadow-[0_4px_14px_-6px_rgba(176,41,74,0.7)]',
            ].join(' ')
          : [
              'border-[var(--c-border)] bg-[var(--c-surface)] text-[var(--c-muted)]',
              'hover:border-[var(--c-wine-500)]/30 hover:text-[var(--c-ink)] hover:bg-[var(--c-surface-2)]',
            ].join(' '),
      )}
      style={
        selected
          ? { backgroundImage: 'linear-gradient(135deg, var(--c-wine-500,#B0294A), var(--c-wine-700,#7A1A32))' }
          : undefined
      }
    >
      {label}
    </button>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function TreinoLauncher({ area, timed, onTimedChange, onLaunch }: TreinoLauncherProps) {
  const isMobile = useIsMobile();
  const [selectedQty, setSelectedQty] = useState<number>(() => Math.min(10, area.pending));

  const label = area.theme ? `${area.area} › ${area.theme}` : area.area;
  const revisaoUrl = buildRevisaoUrl(area, timed, selectedQty);
  const simuladosUrl = buildSimuladosUrl(area);

  const mastered = Math.max(0, area.total - area.pending);
  const masteryPct = area.total > 0 ? Math.round((mastered / area.total) * 100) : 0;
  const estMinutes = selectedQty * 3;

  // Quantidade de opções renderizadas
  const qtyOptions = QTY_OPTIONS.filter((n) => n <= area.pending);
  const showAll = area.pending > Math.max(...(qtyOptions.length ? qtyOptions : [0]));

  const primaryCta = (
    <Link
      to={revisaoUrl}
      onClick={() => onLaunch(area, selectedQty, timed)}
      aria-label={`Iniciar recall do caderno: ${selectedQty} questões de ${label}${timed ? ' — cronometrado' : ''}`}
      className={cn(
        'group inline-flex items-center justify-center gap-2 rounded-[var(--c-radius-control)] px-5 py-3.5',
        'text-[14px] font-bold text-white no-underline',
        'shadow-[var(--c-shadow-glow)]',
        'transition-all duration-[var(--c-duration-base)]',
        'hover:opacity-95 hover:shadow-[0_10px_44px_-8px_rgba(176,41,74,.6)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-wine-500)]/60 focus-visible:ring-offset-2',
        'active:scale-[0.985]',
        'w-full',
      )}
      style={{ background: 'linear-gradient(135deg, var(--c-wine-500,#B0294A), var(--c-wine-700,#7A1A32))' }}
    >
      {timed ? (
        <Timer className="h-4 w-4 shrink-0" aria-hidden />
      ) : (
        <Play className="h-4 w-4 shrink-0 fill-current transition-transform group-hover:translate-x-0.5" aria-hidden />
      )}
      {timed ? 'Iniciar treino cronometrado' : 'Iniciar recall do caderno'}
      <span className="ml-0.5 rounded-full bg-white/20 px-1.5 py-0.5 text-[10px] font-bold tabular-nums tracking-wide">
        {timed ? `~${estMinutes} min` : `${selectedQty}q`}
      </span>
    </Link>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
    >
      <CadernoCard
        hero
        className={cn(
          'relative flex flex-col gap-5 overflow-hidden p-5',
          // Mobile: add bottom padding so content isn't hidden by BottomActionBar
          isMobile ? 'pb-24' : '',
        )}
      >
        {/* Glow atmosférico no topo */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full opacity-60 blur-[60px]"
          style={{ background: 'var(--c-gradient-glow)' }}
        />

        {/* ── Cabeçalho da área selecionada ──────────────────────────────── */}
        <div className="relative flex items-start gap-3">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--c-radius-control)] shadow-[0_6px_18px_-8px_rgba(176,41,74,0.7)]"
            style={{ background: 'linear-gradient(135deg, var(--c-wine-500,#B0294A), var(--c-wine-700,#7A1A32))' }}
            aria-hidden
          >
            <Dumbbell className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-[var(--c-wine-500)]">
              Área selecionada
            </p>
            <h3 className="text-[16px] font-extrabold leading-snug tracking-[-0.01em] text-[var(--c-ink)] truncate">
              {label}
            </h3>
            <div className="mt-1.5">
              <CauseBadge reason={area.topReason} size="sm" />
            </div>
          </div>
        </div>

        {/* ── Leitura rápida ─────────────────────────────────────────────── */}
        <div className="relative flex gap-2">
          <StatReadout value={area.pending} label="Pendentes" tone="orange" />
          <StatReadout
            value={area.totalLapses}
            label={area.totalLapses === 1 ? 'Lapso SRS' : 'Lapsos SRS'}
            tone={area.totalLapses > 0 ? 'destructive' : 'ink'}
          />
          <StatReadout value={`${masteryPct}%`} label="Domínio" tone={masteryPct > 0 ? 'success' : 'ink'} />
        </div>

        {/* ── Seletor de quantidade ──────────────────────────────────────── */}
        <div className="relative">
          <p
            className="mb-2.5 text-[11.5px] font-bold uppercase tracking-[0.06em] text-[var(--c-muted)]"
            id="treino-qty-label"
          >
            Questões do caderno para revisar
          </p>
          <div
            role="group"
            aria-labelledby="treino-qty-label"
            className="flex gap-2"
          >
            {qtyOptions.map((n) => (
              <QtyChip
                key={n}
                value={n}
                label={String(n)}
                selected={selectedQty === n}
                onClick={() => setSelectedQty(n)}
              />
            ))}
            {showAll && (
              <QtyChip
                value={area.pending}
                label={`Todas · ${area.pending}`}
                selected={selectedQty === area.pending}
                onClick={() => setSelectedQty(area.pending)}
              />
            )}
          </div>
        </div>

        {/* ── Toggle: treino cronometrado ────────────────────────────────── */}
        <button
          type="button"
          role="switch"
          aria-checked={timed}
          aria-label="Ativar treino cronometrado com ritmo de prova"
          onClick={() => onTimedChange(!timed)}
          className={cn(
            'relative flex items-start gap-3 rounded-[var(--c-radius-control)] border px-4 py-3 text-left w-full',
            'transition-all duration-[var(--c-duration-base)]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-wine-500)]/50 focus-visible:ring-offset-2',
            timed
              ? 'border-[var(--c-wine-500)]/35 bg-[var(--c-wine-500)]/[0.06]'
              : 'border-[var(--c-border)] bg-[var(--c-surface-2)] hover:border-[var(--c-wine-500)]/25',
          )}
        >
          {/* Toggle pill */}
          <span
            className={cn(
              'relative mt-0.5 flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200',
              timed ? 'shadow-[0_0_0_2px_rgba(176,41,74,0.2)]' : 'bg-[var(--c-surface-2)] ring-1 ring-[var(--c-border)]',
            )}
            style={timed ? { backgroundImage: 'linear-gradient(135deg, var(--c-wine-500,#B0294A), var(--c-wine-700,#7A1A32))' } : undefined}
            aria-hidden
          >
            <span
              className={cn(
                'pointer-events-none block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200',
                timed ? 'translate-x-4' : 'translate-x-0',
              )}
            />
          </span>

          {/* Conteúdo textual */}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <Timer
                className={cn('h-3.5 w-3.5 shrink-0', timed ? 'text-[var(--c-wine-500)]' : 'text-[var(--c-muted)]')}
                aria-hidden
              />
              <span className="text-[13px] font-bold text-[var(--c-ink)]">
                Treino cronometrado
              </span>
              <span
                className={cn(
                  'rounded-full border px-1.5 py-px text-[9px] font-bold uppercase tracking-wide transition-colors',
                  timed
                    ? 'border-[var(--c-wine-500)]/30 bg-[var(--c-wine-500)]/10 text-[var(--c-wine-600)]'
                    : 'border-[var(--c-border)] bg-[var(--c-surface)] text-[var(--c-muted)]',
                )}
              >
                Ritmo de prova
              </span>
            </div>
            <p className="mt-0.5 text-[11px] leading-snug text-[var(--c-muted)]">
              Cronômetro visível com alvo de ~3 min/questão. Sem avanço forçado — só pressão real.
            </p>
          </div>
        </button>

        {/* ── CTAs (desktop) — mobile usa BottomActionBar ──────────────── */}
        {!isMobile && (
          <div className="relative flex flex-col gap-2.5 pt-1">
            {primaryCta}

            {/* CTA secundário: questões novas no banco */}
            <Link
              to={simuladosUrl}
              aria-label={`Treinar questões novas de ${label} no banco de simulados`}
              className={cn(
                'inline-flex items-center justify-center gap-2 rounded-[var(--c-radius-control)] border border-[var(--c-border)] px-5 py-2.5',
                'text-[13px] font-semibold text-[var(--c-muted)] no-underline',
                'transition-all duration-[var(--c-duration-base)]',
                'hover:border-[var(--c-wine-500)]/30 hover:text-[var(--c-ink)] hover:bg-[var(--c-wine-500)]/[0.03]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-wine-500)]/50 focus-visible:ring-offset-2',
              )}
            >
              <BookOpen className="h-4 w-4 shrink-0" aria-hidden />
              Treinar questões novas no banco
              <ExternalLink className="h-3.5 w-3.5 shrink-0 text-[var(--c-muted-2)]" aria-hidden />
            </Link>
          </div>
        )}
      </CadernoCard>

      {/* ── Mobile: CTAs em BottomActionBar ──────────────────────────────── */}
      {isMobile && (
        <BottomActionBar className="flex-col gap-2 py-3">
          {primaryCta}
          <Link
            to={simuladosUrl}
            aria-label={`Treinar questões novas de ${label} no banco de simulados`}
            className={cn(
              'inline-flex w-full items-center justify-center gap-2 rounded-[var(--c-radius-control)] border border-[var(--c-border)] px-5 py-2.5',
              'text-[13px] font-semibold text-[var(--c-muted)] no-underline',
              'transition-all duration-[var(--c-duration-base)]',
              'hover:border-[var(--c-wine-500)]/30 hover:text-[var(--c-ink)]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-wine-500)]/50 focus-visible:ring-offset-2',
            )}
          >
            <Zap className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Questões novas no banco
            <ExternalLink className="h-3 w-3 shrink-0 opacity-50" aria-hidden />
          </Link>
        </BottomActionBar>
      )}
    </motion.div>
  );
}
