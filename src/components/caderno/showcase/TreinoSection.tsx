/**
 * TreinoSection — Showcase (mock) da aba Treino do Caderno v2.
 *
 * Renderiza todas as superfícies redesenhadas com dados simulados para QA
 * visual sem auth. Acessível via /sandbox/caderno-v3 (toggle "Treino").
 *
 * Estados cobertos:
 * - Estado principal: PageHeaderPremium + WeakAreaPicker + TreinoLauncher
 * - Estado sem dados: CadernoEmptyState com CTAs para simulados/caderno
 * - Estado loading: CadernoSkeleton
 * - Picker sem seleção vs com seleção
 * - Toggle cronometrado
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Dumbbell, Zap, BookOpen } from 'lucide-react';

import { WeakAreaPicker } from '@/components/caderno/treino/WeakAreaPicker';
import { TreinoLauncher } from '@/components/caderno/treino/TreinoLauncher';
import {
  PageHeaderPremium,
  SectionHeader,
  CadernoEmptyState,
  CadernoSkeleton,
} from '@/components/caderno/ui';
import { cn } from '@/lib/utils';
import type { RankedWeakArea } from '@/lib/weakAreas';

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_WEAK_AREAS: RankedWeakArea[] = [
  {
    area: 'Cardiologia',
    theme: null,
    total: 18,
    pending: 12,
    totalLapses: 4,
    score: 160,
    topReason: 'did_not_know',
    entryIds: Array.from({ length: 12 }, (_, i) => `c-${i}`),
  },
  {
    area: 'Endocrinologia',
    theme: null,
    total: 14,
    pending: 9,
    totalLapses: 2,
    score: 111,
    topReason: 'did_not_remember',
    entryIds: Array.from({ length: 9 }, (_, i) => `e-${i}`),
  },
  {
    area: 'Neurologia',
    theme: 'AVC Isquêmico',
    total: 10,
    pending: 7,
    totalLapses: 3,
    score: 100,
    topReason: 'confused_alternatives',
    entryIds: Array.from({ length: 7 }, (_, i) => `n-${i}`),
  },
  {
    area: 'Pneumologia',
    theme: null,
    total: 8,
    pending: 5,
    totalLapses: 0,
    score: 65,
    topReason: 'reading_error',
    entryIds: Array.from({ length: 5 }, (_, i) => `p-${i}`),
  },
  {
    area: 'Gastroenterologia',
    theme: null,
    total: 6,
    pending: 4,
    totalLapses: 1,
    score: 55,
    topReason: 'guessed_correctly',
    entryIds: Array.from({ length: 4 }, (_, i) => `g-${i}`),
  },
];

const MOCK_HEADER_STATS = [
  { label: 'Pendentes', value: MOCK_WEAK_AREAS.reduce((a, x) => a + x.pending, 0), color: '#f97316' },
  { label: 'Áreas fracas', value: MOCK_WEAK_AREAS.length, color: '#B0294A' },
  { label: 'Dominadas', value: 7, color: '#16a34a' },
];

// ─── State types ──────────────────────────────────────────────────────────────

type ShowcaseState = 'main' | 'insufficient' | 'loading';

const STATES: { value: ShowcaseState; label: string }[] = [
  { value: 'main', label: 'Estado principal' },
  { value: 'insufficient', label: 'Sem dados' },
  { value: 'loading', label: 'Loading' },
];

// ─── Componente ───────────────────────────────────────────────────────────────

export function TreinoSection() {
  const [showcaseState, setShowcaseState] = useState<ShowcaseState>('main');
  const [selectedArea, setSelectedArea] = useState<RankedWeakArea | null>(null);
  const [timed, setTimed] = useState(false);

  const noop = () => {};

  return (
    <div className="caderno-root space-y-10 py-8">
      {/* ── State controls ────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        {STATES.map((s) => (
          <button
            key={s.value}
            type="button"
            onClick={() => {
              setShowcaseState(s.value);
              setSelectedArea(null);
            }}
            className={cn(
              'rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-all duration-150',
              showcaseState === s.value
                ? 'border-[var(--c-wine-500)] bg-[var(--c-wine-500)]/10 text-[var(--c-wine-500)]'
                : 'border-[var(--c-border)] bg-[var(--c-surface)] text-[var(--c-muted)] hover:border-[var(--c-wine-500)]/30 hover:text-[var(--c-ink)]',
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* ── Loading ──────────────────────────────────────────────────── */}
      {showcaseState === 'loading' && (
        <section aria-labelledby="sh-loading">
          <SectionHeader id="sh-loading" title="Loading (skeleton)" className="mb-4" />
          <CadernoSkeleton count={3} />
        </section>
      )}

      {/* ── Insufficient data ─────────────────────────────────────────── */}
      {showcaseState === 'insufficient' && (
        <section aria-labelledby="sh-insufficient">
          <SectionHeader id="sh-insufficient" title="Sem dados suficientes" className="mb-4" />
          <CadernoEmptyState
            icon={<Dumbbell className="h-8 w-8 text-[var(--c-wine-500)]" />}
            title="Dados insuficientes para o Treino"
            description="Você precisa de pelo menos 3 questões pendentes no caderno para gerar um treino focado. Complete alguns simulados e adicione seus erros ao caderno."
            action={
              <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                <Link
                  to="/simulados"
                  className={cn(
                    'inline-flex items-center gap-2 rounded-[var(--c-radius-control)] px-5 py-2.5',
                    'text-[13px] font-bold text-white no-underline',
                    'shadow-[var(--c-shadow-glow)]',
                    'transition-all duration-[var(--c-duration-base)] hover:opacity-90',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-wine-500)]/50 focus-visible:ring-offset-2',
                  )}
                  style={{ background: 'linear-gradient(135deg, var(--c-wine-500,#B0294A), var(--c-wine-700,#7A1A32))' }}
                >
                  <Zap className="h-4 w-4" aria-hidden />
                  Ver simulados disponíveis
                </Link>
                <Link
                  to="/caderno"
                  className={cn(
                    'inline-flex items-center gap-2 rounded-[var(--c-radius-control)] border border-[var(--c-border)] px-5 py-2.5',
                    'text-[13px] font-semibold text-[var(--c-muted)] no-underline',
                    'transition-all duration-[var(--c-duration-base)] hover:border-[var(--c-wine-500)]/30 hover:text-[var(--c-ink)]',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-wine-500)]/50 focus-visible:ring-offset-2',
                  )}
                >
                  <BookOpen className="h-4 w-4" aria-hidden />
                  Ver Caderno
                </Link>
              </div>
            }
            className="mx-auto max-w-xl"
          />
        </section>
      )}

      {/* ── Main state ───────────────────────────────────────────────── */}
      {showcaseState === 'main' && (
        <>
          {/* PageHeaderPremium */}
          <section aria-labelledby="sh-header">
            <SectionHeader id="sh-header" title="PageHeaderPremium" className="mb-4" />
            <PageHeaderPremium
              title="Treine seus pontos fracos"
              subtitle="Ranqueamento automático das suas áreas mais fracas pelo histórico de erros."
              stats={MOCK_HEADER_STATS}
              onBack={noop}
            />
          </section>

          {/* Two-column layout: picker + launcher */}
          <section aria-labelledby="sh-main">
            <SectionHeader
              id="sh-main"
              title="Layout principal (desktop 2 colunas)"
              className="mb-4"
            />
            <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[1fr_400px] lg:items-start">
              {/* Picker */}
              <div className="flex flex-col gap-3">
                <SectionHeader
                  title="WeakAreaPicker"
                  count={MOCK_WEAK_AREAS.length}
                  description="Ranqueadas por erros pendentes, lapsos SRS e frequência recente."
                />
                <WeakAreaPicker
                  areas={MOCK_WEAK_AREAS}
                  selectedArea={selectedArea}
                  onSelectArea={(area) => {
                    setSelectedArea(area);
                  }}
                />
                {!selectedArea && (
                  <p className="text-center text-[12px] text-[var(--c-muted)]">
                    Selecione uma área acima para ver as opções de treino.
                  </p>
                )}
              </div>

              {/* Launcher */}
              <div className="lg:sticky lg:top-6">
                {selectedArea ? (
                  <div>
                    <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-[var(--c-muted)]">
                      TreinoLauncher
                    </p>
                    <TreinoLauncher
                      area={selectedArea}
                      timed={timed}
                      onTimedChange={setTimed}
                      onLaunch={(area, count, isTimed) => {
                        console.info('[TreinoSection showcase] launch', { area: area.area, count, isTimed });
                      }}
                    />
                  </div>
                ) : (
                  <div className="hidden lg:flex flex-col items-center justify-center rounded-[var(--c-radius-card)] border border-dashed border-[var(--c-border)] bg-[var(--c-surface)] p-10 text-center min-h-[280px]">
                    <Dumbbell className="mb-3 h-6 w-6 text-[var(--c-muted-2,#A89DA1)]" aria-hidden />
                    <p className="text-[13px] font-semibold text-[var(--c-ink)]">
                      Selecione uma área
                    </p>
                    <p className="mt-1 text-[12px] text-[var(--c-muted)] max-w-[180px]">
                      O launcher aparecerá aqui.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Launcher in isolation (for design review) */}
          <section aria-labelledby="sh-launcher-iso">
            <SectionHeader
              id="sh-launcher-iso"
              title="TreinoLauncher — isolado"
              description="Área pré-selecionada para revisão do componente."
              className="mb-4"
            />
            <div className="max-w-[440px]">
              <TreinoLauncher
                area={MOCK_WEAK_AREAS[0]}
                timed={timed}
                onTimedChange={setTimed}
                onLaunch={noop}
              />
            </div>
          </section>
        </>
      )}
    </div>
  );
}
