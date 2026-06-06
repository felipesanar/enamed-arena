/**
 * CadernoRetaFinalPage — War Room ENAMED (Fase 3, Inovação I3).
 *
 * Rota: /caderno/reta-final
 * Gate: PRO (cadernoErros).
 *
 * Monta o plano de revisão por contagem regressiva para o ENAMED.
 * Usa buildRetaFinalPlan() (client-side, sem novas RPCs — contrato §13).
 *
 * Estados:
 *   - Loading        → skeleton
 *   - Prova passou   → mensagem motivacional
 *   - Sem entradas   → CTA para adicionar questões ao caderno
 *   - Em dia         → hero + hoje (DayPlanCard) + próximos dias
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Target, Zap, CalendarCheck2 } from 'lucide-react';
import { motion } from 'framer-motion';

import { trackEvent } from '@/lib/analytics';
import { logger } from '@/lib/logger';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

import { PageTransition, StaggerContainer, StaggerItem } from '@/components/premium/PageTransition';
import { ProGate } from '@/components/ProGate';
import { CadernoSkeleton } from '@/components/caderno/CadernoSkeleton';
import { TabBar } from '@/components/caderno/TabBar';
import { RetaFinalHero } from '@/components/caderno/retafinal/RetaFinalHero';
import { DayPlanCard } from '@/components/caderno/retafinal/DayPlanCard';

import { useUser } from '@/contexts/UserContext';
import { useAuth } from '@/contexts/AuthContext';
import { SEGMENT_ACCESS } from '@/types';
import { simuladosApi } from '@/services/simuladosApi';
import { ENAMED_DATE } from '@/components/caderno/PageHero';
import { buildRetaFinalPlan, type RetaFinalEntry, type RetaFinalPlan } from '@/lib/retaFinalPlan';

/** Quantidade máxima de dias futuros exibidos além de hoje. */
const MAX_FUTURE_DAYS = 6;

// ─── Estado: prova já passou ─────────────────────────────────────────────────

function ExamPassedState() {
  return (
    <div className="mx-auto max-w-xl rounded-3xl border-2 border-dashed border-primary/25 bg-primary/[0.04] p-10 text-center">
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent">
        <CalendarCheck2 className="h-7 w-7 text-primary" aria-hidden />
      </div>
      <h3 className="text-heading-2 text-foreground">O ENAMED já aconteceu!</h3>
      <p className="mx-auto mt-2 max-w-md text-body leading-relaxed text-muted-foreground">
        O War Room ENAMED estará disponível no próximo ciclo. Enquanto isso, continue revisando
        seu caderno de erros para manter o ritmo.
      </p>
      <Link
        to="/caderno"
        className={cn(
          'mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5',
          'text-body-sm font-semibold text-primary-foreground no-underline',
          'shadow-[0_4px_14px_-4px_hsl(345_65%_30%/0.4)] transition-all duration-200',
          'hover:bg-wine-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.99]',
        )}
      >
        <BookOpen className="h-4 w-4" aria-hidden />
        Ir para o Caderno
      </Link>
    </div>
  );
}

// ─── Estado: sem entradas ────────────────────────────────────────────────────

function EmptyNotebookState() {
  return (
    <div className="mx-auto max-w-xl rounded-3xl border-2 border-dashed border-primary/25 bg-primary/[0.04] p-10 text-center">
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent">
        <Target className="h-7 w-7 text-primary" aria-hidden />
      </div>
      <h3 className="text-heading-2 text-foreground">Caderno vazio</h3>
      <p className="mx-auto mt-2 max-w-md text-body leading-relaxed text-muted-foreground">
        O War Room monta seu plano com base nas questões do seu Caderno de Erros. Adicione
        questões na correção do simulado para ativar o plano.
      </p>
      <Link
        to="/simulados"
        className={cn(
          'mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5',
          'text-body-sm font-semibold text-primary-foreground no-underline',
          'shadow-[0_4px_14px_-4px_hsl(345_65%_30%/0.4)] transition-all duration-200',
          'hover:bg-wine-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.99]',
        )}
      >
        <Zap className="h-4 w-4" aria-hidden />
        Ver simulados disponíveis
      </Link>
    </div>
  );
}

// ─── Estado: em dia (sem pendências hoje) ────────────────────────────────────

function UpToDateState({ daysUntil }: { daysUntil: number }) {
  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/30 p-6 text-center">
      <p className="text-[28px]" aria-hidden>
        🎯
      </p>
      <h3 className="mt-2 text-heading-2 text-emerald-800 dark:text-emerald-300">
        Você está em dia!
      </h3>
      <p className="mt-1 text-body-sm text-emerald-700 dark:text-emerald-400">
        Nenhuma revisão pendente para hoje. Continue assim — faltam{' '}
        <strong className="font-bold tabular-nums">{daysUntil}</strong>{' '}
        {daysUntil === 1 ? 'dia' : 'dias'} para o ENAMED.
      </p>
    </div>
  );
}

// ─── Conteúdo principal ──────────────────────────────────────────────────────

function RetaFinalContent({ userId }: { userId: string }) {
  const { profile } = useUser();
  const [plan, setPlan] = useState<RetaFinalPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const tracked = useRef(false);

  const fetchAndBuild = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const rawEntries = await simuladosApi.getErrorNotebook(userId);

      // Mapear campos do banco para o contrato RetaFinalEntry
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

  // Analytics
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

  // Estado: prova passou
  if (plan.examPassed) {
    return (
      <StaggerContainer className="space-y-5 md:space-y-6">
        <StaggerItem>
          <ExamPassedState />
        </StaggerItem>
      </StaggerContainer>
    );
  }

  // Estado: sem entradas ativas
  if (plan.stats.totalActive === 0 && plan.stats.mastered === 0) {
    return (
      <StaggerContainer className="space-y-5 md:space-y-6">
        <StaggerItem>
          <EmptyNotebookState />
        </StaggerItem>
      </StaggerContainer>
    );
  }

  // Hoje e próximos dias (limitado a MAX_FUTURE_DAYS a partir de amanhã)
  const todayPlan = plan.plan[0] ?? null;
  const upcomingPlans = plan.plan.slice(1, 1 + MAX_FUTURE_DAYS);
  const todayHasEntries = (todayPlan?.entries.length ?? 0) > 0;

  return (
    <StaggerContainer className="space-y-5 md:space-y-6">
      {/* Hero */}
      <StaggerItem>
        <RetaFinalHero daysUntil={plan.daysUntil} stats={plan.stats} />
      </StaggerItem>

      {/* Hoje */}
      {todayPlan && (
        <StaggerItem>
          <div>
            <p className="mb-3 text-overline font-bold uppercase tracking-wider text-muted-foreground">
              Hoje, domine {todayPlan.entries.length > 0
                ? `${todayPlan.entries.length} ${todayPlan.entries.length === 1 ? 'questão' : 'questões'}`
                : 'o que puder'}
            </p>

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
          </div>
        </StaggerItem>
      )}

      {/* Próximos dias */}
      {upcomingPlans.length > 0 && (
        <StaggerItem>
          <div>
            <p className="mb-3 text-overline font-bold uppercase tracking-wider text-muted-foreground">
              Próximos dias
            </p>
            <div className="flex flex-col gap-2.5">
              {upcomingPlans.map((dayPlan) => (
                <motion.div
                  key={dayPlan.date.getTime()}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                >
                  <DayPlanCard
                    date={dayPlan.date}
                    entries={dayPlan.entries}
                    isToday={false}
                    previewLimit={3}
                  />
                </motion.div>
              ))}
            </div>
          </div>
        </StaggerItem>
      )}

      {/* Aviso de entradas descobertas */}
      {plan.stats.uncovered > 0 && (
        <StaggerItem>
          <p className="text-center text-caption text-muted-foreground">
            <span className="font-semibold text-orange-500 tabular-nums dark:text-orange-400">
              {plan.stats.uncovered}
            </span>{' '}
            {plan.stats.uncovered === 1
              ? 'questão não caberá no plano antes do ENAMED'
              : 'questões não caberão no plano antes do ENAMED'}
            . Considere aumentar o ritmo diário ou focar nas mais vencidas.
          </p>
        </StaggerItem>
      )}
    </StaggerContainer>
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
      <TabBar />

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
