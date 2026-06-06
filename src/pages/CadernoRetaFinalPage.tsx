/**
 * CadernoRetaFinalPage — War Room ENAMED (Fase 3, Inovação I3) — premium redesign v2.
 *
 * Rota: /caderno/reta-final
 * Gate: PRO (cadernoErros).
 *
 * Monta o plano de revisão por contagem regressiva para o ENAMED.
 * Usa buildRetaFinalPlan() (client-side, sem novas RPCs — contrato §13).
 *
 * Layout desktop: RetaFinalHero full-width impactante → SectionHeader "Hoje, domine X" →
 *                 TodayCard em destaque → timeline colapsável dos próximos dias.
 * Layout mobile:  hero compacto → MobileAppBar opcional → 1 coluna, dias colapsáveis.
 *
 * Estados:
 *   - Loading        → skeleton
 *   - Prova passou   → mensagem motivacional (CadernoEmptyState)
 *   - Sem entradas   → CTA para adicionar questões (CadernoEmptyState)
 *   - Em dia         → hero + hoje + próximos dias
 *   - Sem pendências hoje → CadernoEmptyState celebratório
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen,
  Target,
  Zap,
  CalendarCheck2,
  ChevronDown,
  ChevronUp,
  Trophy,
} from 'lucide-react';

import { trackEvent } from '@/lib/analytics';
import { logger } from '@/lib/logger';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

import { PageTransition, StaggerContainer, StaggerItem } from '@/components/premium/PageTransition';
import { ProGate } from '@/components/ProGate';
import { CadernoSkeleton } from '@/components/caderno/CadernoSkeleton';
import { RetaFinalHero } from '@/components/caderno/retafinal/RetaFinalHero';
import { DayPlanCard } from '@/components/caderno/retafinal/DayPlanCard';

import {
  SectionHeader,
  CadernoEmptyState,
  BottomActionBar,
} from '@/components/caderno/ui';

import { useUser } from '@/contexts/UserContext';
import { useAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/useIsMobile';
import { SEGMENT_ACCESS } from '@/types';
import { simuladosApi } from '@/services/simuladosApi';
import { ENAMED_DATE } from '@/components/caderno/PageHero';
import { buildRetaFinalPlan, type RetaFinalEntry, type RetaFinalPlan } from '@/lib/retaFinalPlan';

/** Quantidade máxima de dias futuros exibidos além de hoje. */
const MAX_FUTURE_DAYS = 6;

// ─── CTA button reutilizável ─────────────────────────────────────────────────

function PrimaryCta({
  to,
  icon: Icon,
  children,
}: {
  to: string;
  icon: React.FC<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      className={cn(
        'inline-flex items-center gap-2 rounded-[var(--c-radius-control,12px)] px-5 py-2.5',
        'text-[13px] font-bold text-white no-underline',
        '[background:linear-gradient(135deg,#B0294A,#7A1A32)]',
        'shadow-[0_8px_40px_-12px_rgba(176,41,74,.35)]',
        'transition-all duration-200 hover:brightness-110',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B0294A]/50 focus-visible:ring-offset-2',
        'active:scale-[0.99]',
      )}
    >
      <Icon className="h-4 w-4" aria-hidden />
      {children}
    </Link>
  );
}

// ─── Estado: prova já passou ─────────────────────────────────────────────────

function ExamPassedState() {
  return (
    <CadernoEmptyState
      className="caderno-root mx-auto max-w-xl"
      icon={<CalendarCheck2 className="h-8 w-8 text-[var(--c-wine-500)]" aria-hidden />}
      title="O ENAMED já aconteceu!"
      description="O War Room estará disponível no próximo ciclo. Continue revisando seu caderno de erros para manter o ritmo."
      action={<PrimaryCta to="/caderno" icon={BookOpen}>Ir para o Caderno</PrimaryCta>}
    />
  );
}

// ─── Estado: sem entradas ────────────────────────────────────────────────────

function EmptyNotebookState() {
  return (
    <CadernoEmptyState
      className="caderno-root mx-auto max-w-xl"
      icon={<Target className="h-8 w-8 text-[var(--c-wine-500)]" aria-hidden />}
      title="Caderno vazio"
      description="O War Room monta seu plano com base nas questões do seu Caderno de Erros. Adicione questões na correção do simulado para ativar o plano."
      action={<PrimaryCta to="/simulados" icon={Zap}>Ver simulados disponíveis</PrimaryCta>}
    />
  );
}

// ─── Estado: em dia (sem pendências hoje) ────────────────────────────────────

function UpToDateState({ daysUntil }: { daysUntil: number }) {
  return (
    <CadernoEmptyState
      className="caderno-root"
      variant="celebratory"
      icon={<Trophy className="h-8 w-8 text-[var(--c-wine-500)]" aria-hidden />}
      title="Você está em dia!"
      description={`Nenhuma revisão pendente para hoje. Continue assim — faltam ${daysUntil} ${daysUntil === 1 ? 'dia' : 'dias'} para o ENAMED.`}
    />
  );
}

// ─── Seção de próximos dias ──────────────────────────────────────────────────

function UpcomingDays({
  plans,
}: {
  plans: ReturnType<typeof buildRetaFinalPlan>['plan'];
}) {
  const [showAll, setShowAll] = useState(false);
  const PREVIEW_COUNT = 3;
  const displayed = showAll ? plans : plans.slice(0, PREVIEW_COUNT);
  const hasMore = plans.length > PREVIEW_COUNT;

  return (
    <div className="caderno-root space-y-2.5">
      <AnimatePresence initial={false}>
        {displayed.map((dayPlan, idx) => (
          <motion.div
            key={dayPlan.date.getTime()}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{
              duration: 0.22,
              delay: idx * 0.03,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            <DayPlanCard
              date={dayPlan.date}
              entries={dayPlan.entries}
              isToday={false}
              previewLimit={3}
            />
          </motion.div>
        ))}
      </AnimatePresence>

      {hasMore && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className={cn(
            'flex w-full items-center justify-center gap-1.5 py-2',
            'text-[12px] font-semibold text-[var(--c-muted)]',
            'hover:text-[var(--c-ink)] transition-colors duration-150',
            'focus-visible:outline-none focus-visible:underline',
          )}
        >
          {showAll ? (
            <>
              <ChevronUp className="h-4 w-4" aria-hidden />
              Ver menos dias
            </>
          ) : (
            <>
              <ChevronDown className="h-4 w-4" aria-hidden />
              Ver mais {plans.length - PREVIEW_COUNT} dias
            </>
          )}
        </button>
      )}
    </div>
  );
}

// ─── Conteúdo principal ──────────────────────────────────────────────────────

function RetaFinalContent({ userId }: { userId: string }) {
  const { profile } = useUser();
  const isMobile = useIsMobile();
  const [plan, setPlan] = useState<RetaFinalPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const tracked = useRef(false);

  const fetchAndBuild = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const rawEntries = await simuladosApi.getErrorNotebook(userId);

      const entries: RetaFinalEntry[] = rawEntries.map((row: any) => ({
        id: row.id,
        area: row.area ?? null,
        theme: row.theme ?? null,
        reason: row.reason ?? null,
        srs_due_at: (row.srs_due_at as string | null) ?? null,
        srs_reps: (row.srs_reps as number | null) ?? null,
        srs_lapses: (row.srs_lapses as number | null) ?? null,
        mastered_at: (row.mastered_at as string | null) ?? null,
      }));

      const built = buildRetaFinalPlan({
        entries,
        enamedDate: ENAMED_DATE,
        today: new Date(),
      });

      setPlan(built);
    } catch (err) {
      logger.error('[CadernoRetaFinalPage] Erro ao carregar entradas:', err);
      toast({
        title: 'Não foi possível carregar o War Room',
        description: 'Verifique sua conexão e tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchAndBuild();
  }, [fetchAndBuild]);

  // Analytics — preservado intacto
  useEffect(() => {
    if (loading || !plan || tracked.current) return;
    tracked.current = true;
    trackEvent('caderno_reta_final_viewed', {
      days_until: plan.daysUntil,
      total_active: plan.stats.totalActive,
      overdue: plan.stats.overdue,
      covered: plan.stats.covered,
      uncovered: plan.stats.uncovered,
      segment: profile?.segment ?? 'guest',
    });
  }, [loading, plan, profile?.segment]);

  if (loading) return <CadernoSkeleton />;
  if (!plan) return null;

  // ── Estado: prova passou ──
  if (plan.examPassed) {
    return (
      <StaggerContainer className="space-y-5">
        <StaggerItem><ExamPassedState /></StaggerItem>
      </StaggerContainer>
    );
  }

  // ── Estado: caderno vazio ──
  if (plan.stats.totalActive === 0 && plan.stats.mastered === 0) {
    return (
      <StaggerContainer className="space-y-5">
        <StaggerItem><EmptyNotebookState /></StaggerItem>
      </StaggerContainer>
    );
  }

  const todayPlan = plan.plan[0] ?? null;
  const upcomingPlans = plan.plan.slice(1, 1 + MAX_FUTURE_DAYS);
  const todayHasEntries = (todayPlan?.entries.length ?? 0) > 0;

  return (
    <div className="caderno-root space-y-6 md:space-y-8">
      {/* ── Hero impactante ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      >
        <RetaFinalHero daysUntil={plan.daysUntil} stats={plan.stats} />
      </motion.div>

      {/* ── Aviso de descobertas ── */}
      {plan.stats.uncovered > 0 && (
        <motion.p
          className="rounded-[var(--c-radius-control)] border px-4 py-2.5 text-[12px] text-[var(--c-ink)]"
          style={{
            background: 'color-mix(in srgb, var(--c-warning) 10%, transparent)',
            borderColor: 'color-mix(in srgb, var(--c-warning) 30%, transparent)',
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15, duration: 0.22 }}
        >
          <span className="font-bold tabular-nums" style={{ color: 'var(--c-warning)' }}>
            {plan.stats.uncovered}
          </span>{' '}
          {plan.stats.uncovered === 1
            ? 'questão não caberá no plano antes do ENAMED'
            : 'questões não caberão no plano antes do ENAMED'}
          . Considere aumentar o ritmo diário ou focar nas mais vencidas.
        </motion.p>
      )}

      {/* ── Hoje ── */}
      {todayPlan && (
        <motion.div
          className="space-y-3"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        >
          <SectionHeader
            title={
              todayHasEntries
                ? `Hoje, domine ${todayPlan.entries.length === 1
                    ? 'esta 1 questão'
                    : `estas ${todayPlan.entries.length} questões`}`
                : 'Hoje'
            }
            description={
              todayHasEntries
                ? 'Questões priorizadas por lapso, peso ENAMED e vencimento.'
                : undefined
            }
          />

          {todayHasEntries ? (
            <DayPlanCard
              date={todayPlan.date}
              entries={todayPlan.entries}
              isToday
              previewLimit={5}
            />
          ) : (
            <UpToDateState daysUntil={plan.daysUntil} />
          )}
        </motion.div>
      )}

      {/* ── Próximos dias ── */}
      {upcomingPlans.length > 0 && (
        <motion.div
          className="space-y-3"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18, duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        >
          <SectionHeader
            title="Próximos dias"
            count={upcomingPlans.length}
            description="Toque em qualquer dia para ver as questões agendadas."
          />
          <UpcomingDays plans={upcomingPlans} />
        </motion.div>
      )}

      {/* ── Mobile: BottomActionBar com CTA de revisão ── */}
      {isMobile && todayHasEntries && (
        <BottomActionBar>
          <Link
            to="/caderno/revisao?mode=due"
            className={cn(
              'flex flex-1 items-center justify-center gap-2 rounded-[var(--c-radius-control)] px-5 py-3',
              'text-[14px] font-bold text-white no-underline',
              '[background:var(--c-gradient-brand)]',
              'shadow-[var(--c-shadow-glow)]',
              'active:scale-[0.99] transition-all',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-wine-400)]/50',
            )}
          >
            <Zap className="h-4 w-4" aria-hidden />
            Começar revisão de hoje
          </Link>
        </BottomActionBar>
      )}
    </div>
  );
}

// ─── Export da página ────────────────────────────────────────────────────────

export default function CadernoRetaFinalPage() {
  const { profile } = useUser();
  const { user } = useAuth();
  const segment = profile?.segment ?? 'guest';
  const hasAccess = SEGMENT_ACCESS[segment].cadernoErros;

  return (
    <PageTransition>
      {!hasAccess ? (
        <ProGate
          icon={Target}
          feature="War Room ENAMED"
          description="Monte seu plano de revisão personalizado com contagem regressiva para o ENAMED. Priorização inteligente por área, lapsos e peso na prova."
          requiredSegment="pro"
          currentSegment={segment}
          benefits={[
            'Plano dia a dia até a data da prova',
            'Priorização por frequência de erro e peso no ENAMED',
            'CTA direto para a sessão de revisão das questões do dia',
          ]}
        />
      ) : (
        <RetaFinalContent userId={user?.id ?? ''} />
      )}
    </PageTransition>
  );
}
