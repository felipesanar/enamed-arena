/**
 * CadernoInsightsPage — aba Insights do Caderno de Erros v2.
 *
 * Rota: /caderno/insights
 * Gate PRO — mesma proteção que CadernoPage.
 *
 * Responsabilidades:
 *   - Busca insights via React Query (useQuery caderno-pattern-insights, staleTime 24h).
 *   - Busca histórico de scores por área (useQuery caderno-area-score-history, staleTime 5min).
 *   - Renderiza PageHeaderPremium com avatar Prof. San + botão Atualizar.
 *   - Desktop: grid 2-col para InsightCards; 1-col mobile.
 *   - Lista InsightCard agrupados por severidade (critical → attention → positive → info).
 *   - Exibe RoiPanel + CalibrationPanel em seções finais.
 *   - Estados: loading skeleton, has_sufficient_data=false, erro, from_cache, pronto.
 *   - Instrumentação de analytics (caderno_insights_viewed, caderno_insights_refreshed).
 */

import { useEffect, useRef } from 'react';
import { BookOpen, RefreshCw, WifiOff, Clock } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { trackEvent, setSuperProperties } from '@/lib/analytics';
import { logger } from '@/lib/logger';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/useIsMobile';

import { PageTransition, StaggerContainer, StaggerItem } from '@/components/premium/PageTransition';
import { ProGate } from '@/components/ProGate';

import { useUser } from '@/contexts/UserContext';
import { useAuth } from '@/contexts/AuthContext';
import { SEGMENT_ACCESS } from '@/types';
import { simuladosApi } from '@/services/simuladosApi';

import { ProfSanorAvatar } from '@/components/comparativo/ProfSanorAvatar';
import { InsightCard } from '@/components/caderno/insights/InsightCard';
import { RoiPanel } from '@/components/caderno/insights/RoiPanel';
import { CalibrationPanel } from '@/components/caderno/insights/CalibrationPanel';
import { InsightsEmptyState } from '@/components/caderno/insights/InsightsEmptyState';

import {
  CadernoCard,
  SectionHeader,
  CadernoCardSkeleton,
  SkeletonLine,
  MobileAppBar,
  PageHeaderPremium,
} from '@/components/caderno/ui';

import type { Insight } from '@/types/caderno';

// ─── Helpers ───

const SEVERITY_ORDER: Record<string, number> = {
  critical: 0,
  attention: 1,
  positive: 2,
  info: 3,
};

function sortBySeverity(insights: Insight[]): Insight[] {
  return [...insights].sort(
    (a, b) => (SEVERITY_ORDER[a.severity] ?? 99) - (SEVERITY_ORDER[b.severity] ?? 99),
  );
}

function relativeTime(iso: string): string {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: ptBR });
  } catch {
    return iso;
  }
}

// ─── InsightsSkeleton premium ───

function InsightsSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Carregando insights">
      {/* Header Prof. San skeleton */}
      <div className="flex items-center justify-between gap-3 pb-2">
        <div className="flex items-center gap-3">
          <SkeletonLine className="h-12 w-12 rounded-full" />
          <div className="space-y-1.5">
            <SkeletonLine className="h-4 w-44" />
            <SkeletonLine className="h-3 w-28" />
          </div>
        </div>
        <SkeletonLine className="h-9 w-36 rounded-xl" />
      </div>
      {/* Cards */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <CadernoCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

// ─── ProfSanHeader ───

interface ProfSanHeaderProps {
  userName: string;
  insightsFetching: boolean;
  fromCache: boolean;
  cacheLabel: string | null;
  generatedAt: string | null;
  onRefresh: () => void;
}

function ProfSanHeader({
  userName,
  insightsFetching,
  fromCache,
  cacheLabel,
  generatedAt,
  onRefresh,
}: ProfSanHeaderProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3',
        'rounded-[var(--c-radius-card)] border border-border bg-[var(--c-surface)]',
        'px-4 py-4 shadow-[var(--c-shadow-sm)]',
        'md:px-5',
      )}
    >
      {/* Avatar + texto */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="relative shrink-0">
          <div
            className={cn(
              'overflow-hidden rounded-full',
              'border-2 border-[var(--c-wine-200)] dark:border-[var(--c-wine-800)]',
              'shadow-sm',
            )}
          >
            <ProfSanorAvatar size={48} animated={insightsFetching} />
          </div>
          {/* Indicador online */}
          <span
            className="absolute bottom-0.5 right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[var(--c-surface)] bg-success"
            aria-hidden
          />
        </div>
        <div className="min-w-0">
          <p className="text-body font-bold text-foreground leading-snug">
            Análise do seu caderno pelo Prof. San
          </p>
          <p className="text-caption text-muted-foreground">
            {userName ? `Diagnóstico personalizado para ${userName}` : 'Diagnóstico personalizado'}
          </p>
        </div>
      </div>

      {/* Direita: cache label + botão */}
      <div className="flex shrink-0 items-center gap-2">
        {fromCache && cacheLabel && (
          <span
            className={cn(
              'hidden sm:inline-flex items-center gap-1',
              'rounded-full bg-[var(--c-surface-2)] border border-border',
              'px-2.5 py-1 text-[11px] font-medium text-muted-foreground',
            )}
            title={generatedAt ? `Gerado em: ${generatedAt}` : undefined}
          >
            <Clock className="h-3 w-3 shrink-0" aria-hidden />
            {cacheLabel}
          </span>
        )}

        <button
          type="button"
          onClick={onRefresh}
          disabled={insightsFetching}
          aria-label="Atualizar análise do Prof. San"
          className={cn(
            'inline-flex items-center gap-1.5 rounded-xl',
            'border border-border bg-[var(--c-surface-2)] px-3 py-2',
            'text-[12px] font-semibold text-muted-foreground',
            'transition-all duration-150',
            'hover:border-primary/30 hover:text-foreground hover:bg-[var(--c-surface)]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            'disabled:opacity-50 disabled:cursor-not-allowed',
          )}
        >
          <RefreshCw
            className={cn('h-3.5 w-3.5', insightsFetching && 'animate-spin')}
            aria-hidden
          />
          <span className="hidden sm:inline">
            {insightsFetching ? 'Atualizando...' : 'Atualizar análise'}
          </span>
          <span className="sm:hidden">
            {insightsFetching ? '...' : 'Atualizar'}
          </span>
        </button>
      </div>
    </div>
  );
}

// ─── InsightsContent ───

interface InsightsContentProps {
  userId: string;
  userName: string;
}

function InsightsContent({ userId, userName }: InsightsContentProps) {
  const isMobile = useIsMobile();
  const tracked = useRef(false);

  // ─── React Query: pattern insights (staleTime 24h conforme spec §A.3) ───
  const {
    data: insightsData,
    isLoading: insightsLoading,
    isError: insightsError,
    isFetching: insightsFetching,
    dataUpdatedAt: insightsUpdatedAt,
    refetch: refetchInsights,
  } = useQuery({
    queryKey: ['caderno-pattern-insights', userId],
    queryFn: () => simuladosApi.getPatternInsights(),
    staleTime: 1000 * 60 * 60 * 24,
    retry: 1,
  });

  // ─── React Query: área score history (staleTime 5min padrão) ───
  const {
    data: historyData,
    isLoading: historyLoading,
  } = useQuery({
    queryKey: ['caderno-area-score-history', userId],
    queryFn: () => simuladosApi.getAreaScoreHistory(userId),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  // ─── React Query: calibração de confiança ───
  const {
    data: calibrationData,
    isLoading: calibrationLoading,
  } = useQuery({
    queryKey: ['caderno-confidence-calibration', userId],
    queryFn: () => simuladosApi.getConfidenceCalibration(),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  // ─── Analytics: caderno_insights_viewed ───
  useEffect(() => {
    if (insightsLoading || tracked.current || !insightsData) return;
    tracked.current = true;

    const fromCache = (insightsData as { from_cache?: boolean }).from_cache ?? false;
    const cacheAgeHours = insightsData.generated_at
      ? Math.round((Date.now() - new Date(insightsData.generated_at).getTime()) / 3_600_000)
      : 0;

    setSuperProperties({ user_segment: 'pro' });
    trackEvent('caderno_insights_viewed', {
      from_cache: fromCache,
      cache_age_hours: cacheAgeHours,
      insight_count: insightsData.insights?.length ?? 0,
      has_sufficient_data: insightsData.has_sufficient_data,
    });
  }, [insightsLoading, insightsData]);

  // ─── Handlers ───

  function handleRefresh() {
    const cacheAgeHours = insightsData?.generated_at
      ? Math.round((Date.now() - new Date(insightsData.generated_at).getTime()) / 3_600_000)
      : 0;

    trackEvent('caderno_insights_refreshed', {
      previous_cache_age_hours: cacheAgeHours,
      entry_count: insightsData?.insights?.length ?? 0,
    });

    logger.log('[CadernoInsightsPage] Manual refresh triggered');
    tracked.current = false;
    refetchInsights();
  }

  // ─── Dados derivados ───

  const sorted = sortBySeverity(insightsData?.insights ?? []);
  const roiInsights = sorted.filter((i) => i.type === 'roi');
  const otherInsights = sorted.filter((i) => i.type !== 'roi');

  const insightsExtra = insightsData as (typeof insightsData & { from_cache?: boolean; message?: string }) | undefined;
  const fromCache = insightsExtra?.from_cache ?? false;
  const generatedAt = insightsData?.generated_at ?? null;
  const cacheLabel = generatedAt ? `Atualizado ${relativeTime(generatedAt)}` : null;

  const hasSufficient = insightsData?.has_sufficient_data ?? false;
  const apiMessage = insightsExtra?.message ?? null;

  // ─── Render ───

  return (
    <StaggerContainer className="space-y-6">
      {/* ── Estado: carregando (primeira vez) ── */}
      {insightsLoading && (
        <StaggerItem>
          <InsightsSkeleton />
        </StaggerItem>
      )}

      {!insightsLoading && (
        <>
          {/* ── Prof. San Header ── */}
          <StaggerItem>
            <ProfSanHeader
              userName={userName}
              insightsFetching={insightsFetching}
              fromCache={fromCache}
              cacheLabel={cacheLabel}
              generatedAt={generatedAt}
              onRefresh={handleRefresh}
            />
          </StaggerItem>

          {/* ── Estado: erro ── */}
          {insightsError && (
            <StaggerItem>
              <CadernoCard
                role="alert"
                className="flex flex-col items-center gap-4 px-6 py-10 text-center"
              >
                <WifiOff className="h-10 w-10 text-muted-foreground/40" aria-hidden />
                <div className="space-y-1">
                  <p className="text-body font-semibold text-foreground">
                    Diagnóstico temporariamente indisponível
                  </p>
                  <p className="text-caption text-muted-foreground">
                    Os dados do caderno estão íntegros. Tente novamente em instantes.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleRefresh}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-xl',
                    'bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground',
                    'shadow-sm transition-all hover:brightness-110',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  )}
                >
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                  Tentar novamente
                </button>
              </CadernoCard>
            </StaggerItem>
          )}

          {/* ── Estado: dados insuficientes ── */}
          {!insightsError && insightsData && !hasSufficient && (
            <>
              <StaggerItem>
                <InsightsEmptyState message={apiMessage} entryCount={0} />
              </StaggerItem>

              <StaggerItem>
                <div className="border-t border-border/60 pt-6">
                  <RoiPanel
                    history={(historyData as any) ?? null}
                    loading={historyLoading}
                    roiInsights={[]}
                  />
                </div>
              </StaggerItem>
            </>
          )}

          {/* ── Estado: insights prontos ── */}
          {!insightsError && hasSufficient && (
            <>
              {/* Cache / fetching bar */}
              {(fromCache || insightsFetching) && (
                <StaggerItem>
                  <div className="flex items-center gap-2 text-caption text-muted-foreground px-1">
                    {insightsFetching ? (
                      <span className="inline-flex items-center gap-1.5">
                        <RefreshCw className="h-3 w-3 animate-spin" aria-hidden />
                        Atualizando análise em background...
                      </span>
                    ) : (
                      cacheLabel && (
                        <span className="sm:hidden inline-flex items-center gap-1">
                          <Clock className="h-3 w-3 shrink-0" aria-hidden />
                          {cacheLabel}
                        </span>
                      )
                    )}
                  </div>
                </StaggerItem>
              )}

              {/* ── Insights (non-ROI): grid 2-col desktop ── */}
              {otherInsights.length > 0 && (
                <StaggerItem>
                  <SectionHeader
                    title="Diagnóstico"
                    count={otherInsights.length}
                    description="Padrões identificados pelo Prof. San no seu caderno"
                    className="mb-3"
                  />
                  <div
                    className="grid grid-cols-1 gap-3 lg:grid-cols-2"
                    role="list"
                    aria-label="Lista de insights do caderno"
                  >
                    {otherInsights.map((insight, idx) => (
                      <motion.div
                        key={insight.id}
                        role="listitem"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                          duration: 0.28,
                          delay: idx * 0.04,
                          ease: [0.22, 1, 0.36, 1],
                        }}
                      >
                        <InsightCard insight={insight} />
                      </motion.div>
                    ))}
                  </div>
                </StaggerItem>
              )}

              {/* ── ROI insights como InsightCards (1-col) ── */}
              {roiInsights.length > 0 && (
                <StaggerItem>
                  <div className="space-y-3">
                    {roiInsights.map((insight, idx) => (
                      <motion.div
                        key={insight.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                          duration: 0.28,
                          delay: idx * 0.04,
                          ease: [0.22, 1, 0.36, 1],
                        }}
                      >
                        <InsightCard insight={insight} />
                      </motion.div>
                    ))}
                  </div>
                </StaggerItem>
              )}

              {/* ── Divisor ── */}
              <StaggerItem>
                <div className="border-t border-border/60 pt-2" aria-hidden />
              </StaggerItem>

              {/* ── ROI Panel ── */}
              <StaggerItem>
                <RoiPanel
                  history={(historyData as any) ?? null}
                  loading={historyLoading}
                  roiInsights={roiInsights}
                />
              </StaggerItem>

              {/* ── Divisor ── */}
              <StaggerItem>
                <div className="border-t border-border/60 pt-2" aria-hidden />
              </StaggerItem>

              {/* ── Calibration Panel ── */}
              <StaggerItem>
                <CalibrationPanel
                  data={calibrationData ?? null}
                  loading={calibrationLoading}
                />
              </StaggerItem>
            </>
          )}
        </>
      )}
    </StaggerContainer>
  );
}

// ─── Page export ───

export default function CadernoInsightsPage() {
  const { profile } = useUser();
  const { user } = useAuth();
  const segment = profile?.segment ?? 'guest';
  const hasAccess = SEGMENT_ACCESS[segment].cadernoErros;

  const firstName = profile?.name?.split(' ')[0] ?? '';

  return (
    <PageTransition>
      {!hasAccess ? (
        <ProGate
          icon={BookOpen}
          feature="Caderno de Erros — Insights"
          description="Diagnóstico personalizado entre seus erros. O Prof. San analisa padrões, identifica seus calcanhares e mostra o retorno do caderno nos seus simulados."
          requiredSegment="pro"
          currentSegment={segment}
          benefits={[
            'Diagnóstico de área fraca, causa dominante e confusões recorrentes',
            'Tabela diferencial gerada pela IA para confusões frequentes',
            'Painel de ROI: veja o impacto real do caderno nos seus simulados',
          ]}
        />
      ) : (
        <InsightsContent userId={user?.id ?? ''} userName={firstName} />
      )}
    </PageTransition>
  );
}
