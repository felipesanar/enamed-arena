import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { PercentileRing } from './PercentileRing';
import { ClimbBadge } from './ClimbBadge';
import { EvolutionSparkline } from './EvolutionSparkline';
import type { RankingEvolution } from '@/hooks/useRankingEvolution';

export interface HeroStanding {
  position: number;
  total: number;
  percentil: number;
  score: number;
}

interface Props {
  simuladoTitle?: string;
  standing: HeroStanding | null;
  notaMedia: number;
  evolution: RankingEvolution | null;
}

const WINE = 'linear-gradient(155deg,#7a1a32 0%,#5c1225 46%,#3d0b18 100%)';

/** Hero "Você primeiro": colocação pessoal, percentil, climb e evolução. Superfície wine always-dark. */
export function RankingHero({ simuladoTitle, standing, notaMedia, evolution }: Props) {
  return (
    <section
      className="relative overflow-hidden rounded-[22px] p-6 text-white"
      style={{
        background: WINE,
        boxShadow: '0 24px 56px -14px rgba(142,31,61,0.6), inset 0 1px 0 rgba(255,255,255,0.08)',
      }}
      aria-label="Resumo da sua colocação no ranking"
    >
      <div
        className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(255,180,200,0.16) 0%, transparent 70%)' }}
      />
      <div
        className="pointer-events-none absolute -bottom-20 left-20 h-44 w-44 rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.05) 0%, transparent 70%)' }}
      />

      <p className="relative mb-5 text-[11px] font-medium uppercase tracking-[0.14em] text-white/55">
        Ranking ENAMED 2026{simuladoTitle ? ` · ${simuladoTitle}` : ''}
      </p>

      {!standing ? (
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-heading-2 font-bold">Você ainda não está no ranking</p>
            <p className="mt-1 max-w-md text-[13px] text-white/60">
              Conclua o simulado e aguarde a liberação dos resultados para ver sua colocação aqui.
            </p>
          </div>
          <Link
            to="/simulados"
            className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-white/12 px-4 py-2 text-caption font-semibold text-white transition-colors hover:bg-white/20"
          >
            Ver simulados <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>
      ) : (
        <div className="relative flex flex-col items-center gap-6 md:flex-row md:items-center md:gap-7">
          <PercentileRing position={standing.position} total={standing.total} percentil={standing.percentil} />

          <div className="min-w-0 flex-1 text-center md:text-left">
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-white/50">Sua colocação</p>
            <p className="mt-1 text-[22px] font-bold leading-snug">{aheadHeadline(standing)}</p>
            {evolution && evolution.climb.kind !== 'debut' && (
              <div className="mt-3 flex justify-center md:justify-start">
                <ClimbBadge climb={evolution.climb} />
              </div>
            )}
            <p className="mt-3 text-[12px] leading-relaxed text-white/55">
              {standing.position}º de {standing.total} candidatos neste simulado.
            </p>
          </div>

          <div className="flex w-full shrink-0 flex-col gap-2.5 md:w-44">
            <div className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3">
              <span className="text-[11px] text-white/55">Sua nota</span>
              <div className="flex items-baseline gap-2">
                <span className="text-[26px] font-bold leading-snug text-[#ffcbd8]">{standing.score}%</span>
                <DeltaVsMedia score={standing.score} media={notaMedia} />
              </div>
            </div>
            {evolution && evolution.scoreSeries.length >= 2 && (
              <div className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-2.5">
                <span className="text-[11px] text-white/55">Sua evolução</span>
                <div className="mt-1">
                  <EvolutionSparkline series={evolution.scoreSeries} />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

/** Frase de colocação focada em posição (sem "Top X%", que confunde em posições baixas). */
function aheadHeadline(standing: HeroStanding): string {
  const ahead = Math.max(0, standing.total - standing.position);
  if (ahead === 0) return 'Você está no início da escalada';
  return `Você supera ${ahead} candidato${ahead === 1 ? '' : 's'}`;
}

function DeltaVsMedia({ score, media }: { score: number; media: number }) {
  const delta = score - media;
  return (
    <span className={'text-[12px] font-medium ' + (delta >= 0 ? 'text-[#86efac]' : 'text-[#fca5a5]')}>
      {delta >= 0 ? '+' : ''}
      {delta} vs média
    </span>
  );
}
