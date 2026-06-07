import React from 'react';
import { Link } from 'react-router-dom';
import { Trophy } from 'lucide-react';
import type { RankingParticipant } from '@/services/rankingApi';
import type { CutoffScoreRow } from '@/services/rankingApi';

type CutoffState = 'no_profile' | 'loading' | 'no_match' | 'pass' | 'fail';

interface ThemeTokens {
  kpiPerfGoodBg: string;
  kpiPerfGoodBorder: string;
  kpiPerfGoodShadow: string;
  kpiPerfGoodOrb: string;
  kpiPerfGoodTag: string;
  kpiPerfGoodVal: string;
  kpiPerfBadBg: string;
  kpiPerfBadBorder: string;
  kpiPerfBadShadow: string;
  kpiPerfBadOrb: string;
  kpiPerfBadTag: string;
  kpiPerfBadVal: string;
  kpiPerfSubtext: string;
  kpiEmptyBg: string;
  kpiEmptyBorder: string;
  kpiEmptyTag: string;
  kpiEmptyText: string;
  kpiEmptyCta: string;
  kpiCutPassBg: string;
  kpiCutPassBorder: string;
  kpiCutPassShadow: string;
  kpiCutPassOrb: string;
  kpiCutPassTag: string;
  kpiCutPassVal: string;
  kpiCutPassSub: string;
  kpiCutPassStrong: string;
  kpiCutPassLink: string;
  kpiCutFailBg: string;
  kpiCutFailBorder: string;
  kpiCutFailShadow: string;
  kpiCutFailOrb: string;
  kpiCutFailTag: string;
  kpiCutFailVal: string;
  kpiCutFailGap: string;
  kpiCutFailSub: string;
  kpiCutFailStrong: string;
  kpiCutFailLink: string;
}

interface Props {
  currentUser: RankingParticipant;
  filteredParticipants: RankingParticipant[];
  stats: { notaMedia: number };
  delta: number;
  deltaPrefix: string;
  deltaColor: string;
  perfState: 'good' | 'bad';
  perfMessage: string;
  perfSubtext: string;
  cutoffState: CutoffState;
  cutoff: CutoffScoreRow | null;
  isDark: boolean;
  t: ThemeTokens;
  setCutoffModalOpen: (open: boolean) => void;
  cutoffComfortMessage: (gap: number) => { body: string };
}

export function RankingHeroStats({
  currentUser,
  filteredParticipants,
  stats,
  delta,
  deltaPrefix,
  deltaColor,
  perfState,
  perfMessage,
  perfSubtext,
  cutoffState,
  cutoff,
  isDark,
  t,
  setCutoffModalOpen,
  cutoffComfortMessage,
}: Props) {
  return (
    <div className="md:grid md:grid-cols-2 md:gap-5 mb-5">
      {/* Hero card */}
      <div
        className="rounded-[22px] p-5 mb-4 md:mb-0 relative overflow-hidden"
        style={{
          background:
            'linear-gradient(155deg, #7a1a32 0%, #5c1225 45%, #3d0b18 100%)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)',
        }}
      >
        <div
          className="absolute pointer-events-none"
          style={{
            top: '-50px',
            right: '-50px',
            width: '200px',
            height: '200px',
            background:
              'radial-gradient(circle, rgba(255,255,255,0.06) 0%, transparent 70%)',
          }}
          aria-hidden
        />
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className="h-[46px] w-[46px] rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'rgba(255,255,255,0.12)' }}
            >
              <Trophy className="h-5 w-5 text-white" aria-hidden />
            </div>
            <div>
              <p
                className="text-xs font-semibold uppercase tracking-widest mb-0.5"
                style={{ color: 'rgba(255,255,255,0.45)' }}
              >
                Sua posição
              </p>
              <p
                className="font-bold text-white md:text-5xl text-3xl tabular-nums leading-none"
                aria-label={`Posição ${currentUser.position} de ${filteredParticipants.length}`}
              >
                #{currentUser.position}
                <span
                  className="text-base font-semibold ml-1"
                  style={{ color: 'rgba(255,255,255,0.45)' }}
                >
                  de {filteredParticipants.length}
                </span>
              </p>
            </div>
          </div>
          <div className="text-right">
            <p
              className="text-xs font-semibold uppercase tracking-widest mb-0.5"
              style={{ color: 'rgba(255,255,255,0.45)' }}
            >
              Sua nota
            </p>
            <p
              className="font-bold tabular-nums md:text-4xl text-2xl leading-none"
              style={{ color: '#ffcbd8' }}
              aria-label={`Nota ${currentUser.score}%`}
            >
              {currentUser.score}%
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Média: {stats.notaMedia}%
            </p>
            <p
              className="text-xs font-semibold mt-0.5"
              style={{ color: deltaColor }}
            >
              {deltaPrefix} {Math.abs(delta)}% {delta >= 0 ? 'acima da média' : 'abaixo da média'}
            </p>
          </div>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-2.5">
        {/* Card 1: Desempenho */}
        <div
          className="rounded-[18px] relative overflow-hidden flex flex-col justify-between"
          style={{
            padding: '15px 13px 13px',
            minHeight: '96px',
            background: perfState === 'good' ? t.kpiPerfGoodBg : t.kpiPerfBadBg,
            border: perfState === 'good' ? t.kpiPerfGoodBorder : t.kpiPerfBadBorder,
            boxShadow: perfState === 'good' ? t.kpiPerfGoodShadow : t.kpiPerfBadShadow,
          }}
        >
          <div
            className="absolute pointer-events-none"
            style={{
              top: '-30px',
              right: '-30px',
              width: '100px',
              height: '100px',
              borderRadius: '50%',
              background: perfState === 'good' ? t.kpiPerfGoodOrb : t.kpiPerfBadOrb,
            }}
            aria-hidden
          />
          <div className="relative z-10">
            <p
              className="font-bold uppercase mb-[7px]"
              style={{
                fontSize: '0.65rem',
                letterSpacing: '.09em',
                color: perfState === 'good' ? t.kpiPerfGoodTag : t.kpiPerfBadTag,
              }}
            >
              Seu desempenho
            </p>
            <p
              className="font-bold leading-snug mb-[5px]"
              style={{
                fontSize: '1.1rem',
                color: perfState === 'good' ? t.kpiPerfGoodVal : t.kpiPerfBadVal,
              }}
            >
              {perfMessage}
            </p>
            <p
              className="leading-snug"
              style={{ fontSize: '0.72rem', color: t.kpiPerfSubtext }}
            >
              {perfSubtext}
            </p>
          </div>
        </div>

        {/* Card 2: Nota de Corte */}
        {(cutoffState === 'no_profile' || cutoffState === 'no_match') && (
          <div
            className="rounded-[18px] relative overflow-hidden flex flex-col"
            style={{
              padding: '15px 13px 13px',
              minHeight: '96px',
              background: t.kpiEmptyBg,
              border: t.kpiEmptyBorder,
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
            }}
          >
            <p
              className="font-bold uppercase mb-[7px] relative z-10"
              style={{
                fontSize: '0.65rem',
                letterSpacing: '.09em',
                color: t.kpiEmptyTag,
              }}
            >
              Nota de corte
            </p>
            <div className="relative z-10 flex flex-col gap-[5px] flex-1 justify-center">
              <span style={{ fontSize: '1.4rem', lineHeight: 1 }}>🎯</span>
              {cutoffState === 'no_profile' ? (
                <>
                  <p
                    className="leading-snug"
                    style={{ fontSize: '0.72rem', color: t.kpiEmptyText }}
                  >
                    Preencha sua especialidade e instituição para ver se você passaria.
                  </p>
                  <Link
                    to="/configuracoes"
                    className="font-semibold inline-flex items-center gap-[3px]"
                    style={{ fontSize: '0.7rem', color: t.kpiEmptyCta }}
                  >
                    Completar perfil →
                  </Link>
                </>
              ) : (
                <>
                  <p
                    className="leading-snug"
                    style={{ fontSize: '0.72rem', color: t.kpiEmptyText }}
                  >
                    Não encontramos nota de corte para sua combinação.
                  </p>
                  <button
                    type="button"
                    onClick={() => setCutoffModalOpen(true)}
                    className="font-semibold inline-flex items-center gap-[3px] text-left"
                    style={{ fontSize: '0.7rem', color: t.kpiEmptyCta }}
                  >
                    Ver todas →
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {cutoffState === 'loading' && (
          <div
            className="rounded-[18px] flex items-center justify-center"
            style={{
              padding: '15px 13px 13px',
              minHeight: '96px',
              background: t.kpiEmptyBg,
              border: t.kpiEmptyBorder,
            }}
          >
            <p style={{ fontSize: '0.72rem', color: t.kpiEmptyText }}>
              Carregando...
            </p>
          </div>
        )}

        {cutoffState === 'pass' && cutoff && (
          <div
            className="rounded-[18px] relative overflow-hidden flex flex-col justify-between"
            style={{
              padding: '15px 13px 13px',
              minHeight: '96px',
              background: t.kpiCutPassBg,
              border: t.kpiCutPassBorder,
              boxShadow: t.kpiCutPassShadow,
            }}
          >
            <div
              className="absolute pointer-events-none"
              style={{
                top: '-30px',
                right: '-30px',
                width: '100px',
                height: '100px',
                borderRadius: '50%',
                background: t.kpiCutPassOrb,
              }}
              aria-hidden
            />
            <div className="relative z-10">
              <p
                className="font-bold uppercase mb-[7px]"
                style={{
                  fontSize: '0.65rem',
                  letterSpacing: '.09em',
                  color: t.kpiCutPassTag,
                }}
              >
                Nota de corte
              </p>
              <p
                className="font-bold leading-snug mb-[5px]"
                style={{ fontSize: '1.1rem', color: t.kpiCutPassVal }}
              >
                Passaria ✓
              </p>
              <p
                className="leading-snug"
                style={{ fontSize: '0.72rem', color: t.kpiCutPassSub }}
              >
                Corte geral:{' '}
                <strong style={{ color: t.kpiCutPassStrong }}>
                  {cutoff.cutoff_score_general}%
                </strong>
                {cutoff.cutoff_score_quota != null && (
                  <>
                    {' '}
                    · Cotas:{' '}
                    <strong style={{ color: t.kpiCutPassStrong }}>
                      {cutoff.cutoff_score_quota}%
                    </strong>
                  </>
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setCutoffModalOpen(true)}
              className="relative z-10 inline-flex items-center gap-[3px] mt-[7px]"
              style={{ fontSize: '0.68rem', color: t.kpiCutPassLink }}
            >
              Ver todas as notas ↗
            </button>
          </div>
        )}

        {cutoffState === 'fail' && cutoff && (
          <div
            className="rounded-[18px] relative overflow-hidden flex flex-col justify-between"
            style={{
              padding: '15px 13px 13px',
              minHeight: '96px',
              background: t.kpiCutFailBg,
              border: t.kpiCutFailBorder,
              boxShadow: t.kpiCutFailShadow,
            }}
          >
            <div
              className="absolute pointer-events-none"
              style={{
                top: '-30px',
                right: '-30px',
                width: '100px',
                height: '100px',
                borderRadius: '50%',
                background: t.kpiCutFailOrb,
              }}
              aria-hidden
            />
            <div className="relative z-10">
              <p
                className="font-bold uppercase mb-[7px]"
                style={{
                  fontSize: '0.65rem',
                  letterSpacing: '.09em',
                  color: t.kpiCutFailTag,
                }}
              >
                Nota de corte
              </p>
              <p
                className="font-bold leading-snug mb-[4px]"
                style={{ fontSize: '1.1rem', color: t.kpiCutFailVal }}
              >
                Ainda não passou
              </p>
              <p
                className="leading-snug mb-[5px]"
                style={{ fontSize: '0.72rem', color: t.kpiCutFailSub }}
              >
                Sua nota é{' '}
                <strong style={{ color: t.kpiCutFailGap }}>
                  {cutoff.cutoff_score_general - currentUser.score}% abaixo
                </strong>{' '}
                do corte geral de{' '}
                <strong style={{ color: t.kpiCutFailStrong }}>
                  {cutoff.cutoff_score_general}%
                </strong>
              </p>
              <p
                className="leading-snug"
                style={{ fontSize: '0.7rem', color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)', fontStyle: 'italic' }}
              >
                {cutoffComfortMessage(cutoff.cutoff_score_general - currentUser.score).body}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setCutoffModalOpen(true)}
              className="relative z-10 inline-flex items-center gap-[3px] mt-[7px]"
              style={{ fontSize: '0.68rem', color: t.kpiCutFailLink }}
            >
              Ver todas as notas ↗
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
