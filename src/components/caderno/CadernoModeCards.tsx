/**
 * CadernoModeCards — os 3 modos de estudo do Caderno como cards explicativos.
 *
 * Objetivo de UX: deixar claro O QUE cada modo é e QUANDO usar, com destaque
 * real e um sinal "Recomendado agora" no modo mais relevante (baseado em
 * devidas hoje / proximidade do ENAMED). Substitui os 3 botões apertados da hero.
 *
 *   • Revisão espaçada — recall ativo no momento certo (SRS)
 *   • Treino direcionado — sessão cronometrada nos pontos fracos
 *   • Reta Final — plano diário priorizado pelo peso ENAMED
 */

import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { RotateCcw, Target, Swords, ArrowRight, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ProfSanorAvatar } from '@/components/comparativo/ProfSanorAvatar';

type ModeKey = 'revisao' | 'treino' | 'reta';

export interface CadernoModeCardsProps {
  devidasHoje: number;
  daysLeft: number;
  isEnamedNear: boolean;
  hasPending: boolean;
  revisaoTo: string;
  treinoTo: string;
  retaFinalTo: string;
  prefersReducedMotion: boolean;
  onSelect?: (mode: ModeKey) => void;
}

export function CadernoModeCards({
  devidasHoje,
  daysLeft,
  isEnamedNear,
  hasPending,
  revisaoTo,
  treinoTo,
  retaFinalTo,
  prefersReducedMotion,
  onSelect,
}: CadernoModeCardsProps) {
  const recommended: ModeKey =
    hasPending && devidasHoje > 0 ? 'revisao' : isEnamedNear ? 'reta' : 'treino';

  const modes = [
    {
      key: 'revisao' as const,
      to: revisaoTo,
      icon: RotateCcw,
      title: 'Revisão espaçada',
      desc: 'Revê o que você errou na hora certa de lembrar. Fixa o conteúdo sem reestudar tudo.',
      hint:
        devidasHoje > 0
          ? `${devidasHoje} ${devidasHoje === 1 ? 'devida hoje' : 'devidas hoje'}`
          : 'tudo em dia',
      hintUrgent: devidasHoje > 0,
      // wine
      iconWrap: 'bg-[color-mix(in_srgb,var(--c-wine-500)_12%,transparent)] text-[var(--c-wine-600)] dark:text-[var(--c-wine-300)]',
      accentText: 'text-[var(--c-wine-600)] dark:text-[var(--c-wine-300)]',
      recRing: 'border-[var(--c-wine-400)] ring-2 ring-[color-mix(in_srgb,var(--c-wine-300)_45%,transparent)]',
      recGlow: 'shadow-[0_18px_40px_-22px_rgba(176,41,74,0.55)]',
    },
    {
      key: 'treino' as const,
      to: treinoTo,
      icon: Target,
      title: 'Treino direcionado',
      desc: 'Sessão cronometrada nas suas áreas mais fracas. Treino de verdade, sob pressão.',
      hint: 'foco nos pontos fracos',
      hintUrgent: false,
      // sky
      iconWrap: 'bg-sky-500/12 text-sky-600 dark:text-sky-300',
      accentText: 'text-sky-600 dark:text-sky-300',
      recRing: 'border-sky-400 ring-2 ring-sky-300/45',
      recGlow: 'shadow-[0_18px_40px_-22px_rgba(14,165,233,0.5)]',
    },
    {
      key: 'reta' as const,
      to: retaFinalTo,
      icon: Swords,
      title: 'Reta Final ENAMED',
      desc: 'Um plano para cada dia, priorizando as áreas que mais caem conforme a prova chega.',
      hint: daysLeft > 0 ? `faltam ${daysLeft} ${daysLeft === 1 ? 'dia' : 'dias'}` : 'Reta Final',
      hintUrgent: isEnamedNear,
      // amber
      iconWrap: 'bg-amber-500/14 text-amber-600 dark:text-amber-300',
      accentText: 'text-amber-600 dark:text-amber-300',
      recRing: 'border-amber-400 ring-2 ring-amber-300/45',
      recGlow: 'shadow-[0_18px_40px_-22px_rgba(245,158,11,0.5)]',
    },
  ];

  return (
    <section aria-label="Modos de estudo" className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--c-muted-2)]">
            Modos de estudo
          </p>
          <h2 className="mt-0.5 text-[17px] font-bold tracking-[-0.01em] text-[var(--c-ink)]">
            Como você quer estudar agora?
          </h2>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {modes.map((m, i) => {
          const Icon = m.icon;
          const isRec = m.key === recommended;
          return (
            <motion.div
              key={m.key}
              initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.45, ease: 'easeOut', delay: prefersReducedMotion ? 0 : 0.05 * i }}
            >
              <Link
                to={m.to}
                onClick={() => onSelect?.(m.key)}
                aria-label={`${m.title}${isRec ? ' (recomendado agora)' : ''}`}
                className={cn(
                  'group relative flex h-full flex-col gap-3.5 rounded-2xl border p-5 no-underline',
                  'bg-[var(--c-surface)] transition-all duration-200',
                  'hover:-translate-y-1 hover:shadow-[0_20px_44px_-26px_rgba(24,10,16,0.4)]',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-wine-400)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--c-bg)]',
                  isRec
                    ? cn('border-transparent', m.recRing, m.recGlow)
                    : 'border-[var(--c-border)] hover:border-[var(--c-border-strong,var(--c-muted-2))]/40',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <span
                    className={cn(
                      'inline-flex h-11 w-11 items-center justify-center rounded-xl',
                      m.iconWrap,
                    )}
                    aria-hidden
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  {isRec && (
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                        'border-current/30 bg-current/10',
                        m.accentText,
                      )}
                    >
                      <Sparkles className="h-3 w-3" aria-hidden />
                      Recomendado
                    </span>
                  )}
                </div>

                <div className="space-y-1">
                  <h3 className="text-[15.5px] font-bold leading-snug tracking-[-0.01em] text-[var(--c-ink)]">
                    {m.title}
                  </h3>
                  <p className="text-[12.5px] leading-relaxed text-[var(--c-muted)]">{m.desc}</p>
                </div>

                {/* Prof. San (IA) acompanha o estudo neste modo */}
                <div className="inline-flex items-center gap-1.5 self-start rounded-full border border-[var(--c-border)] bg-[var(--c-surface-2)] py-1 pl-1 pr-2.5">
                  <span className="relative inline-flex">
                    <span className="overflow-hidden rounded-full ring-1 ring-[var(--c-border)]">
                      <ProfSanorAvatar size={20} />
                    </span>
                    <span
                      className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border-2 border-[var(--c-surface-2)] bg-[var(--c-success)]"
                      aria-hidden
                    />
                  </span>
                  <span className="text-[11px] font-semibold text-[var(--c-muted)]">
                    com Prof. San
                  </span>
                </div>

                <div className="mt-auto flex items-center justify-between gap-2 pt-1">
                  <span
                    className={cn(
                      'inline-flex items-center gap-1.5 text-[12px] font-semibold',
                      m.hintUrgent ? m.accentText : 'text-[var(--c-muted-2)]',
                    )}
                  >
                    {m.hintUrgent && (
                      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
                    )}
                    {m.hint}
                  </span>
                  <span
                    className={cn(
                      'inline-flex h-8 w-8 items-center justify-center rounded-full',
                      'bg-[var(--c-surface-2)] text-[var(--c-muted)] transition-all duration-200',
                      'group-hover:bg-[var(--c-wine-500)] group-hover:text-white group-hover:translate-x-0.5',
                    )}
                    aria-hidden
                  >
                    <ArrowRight className="h-4 w-4" />
                  </span>
                </div>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
