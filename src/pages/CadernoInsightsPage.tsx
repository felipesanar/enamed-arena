/**
 * CadernoInsightsPage — aba Insights do Caderno de Erros v2.
 *
 * Rota: /caderno/insights
 * Gate PRO — mesma proteção que CadernoPage.
 *
 * Responsabilidades:
 *   - Busca insights via React Query (useQuery caderno-pattern-insights, staleTime 24h).
 *   - Busca histórico de scores por área (useQuery caderno-area-score-history, staleTime 5min).
 *   - Renderiza PageHero + TabBar + Prof. San header.
 *   - Lista InsightCard agrupados por severidade (critical → attention → positive → info).
 *   - Exibe RoiPanel na seção final.
 *   - Estados: loading skeleton, has_sufficient_data=false, erro, from_cache, pronto.
 *   - Instrumentação de analytics (caderno_insights_viewed, caderno_insights_refreshed).
 */

import { useEffect, useRef } from 'react';
import { BookOpen, RefreshCw, WifiOff } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { trackEvent, setSuperProperties } from '@/lib/analytics';
import { logger } from '@/lib/logger';
import { cn } from '@/lib/utils';

import { PageTransition, StaggerContainer, StaggerItem } from '@/components/premium/PageTransition';
import { ProGate } from '@/components/ProGate';
import { Skeleton } from '@/components/ui/skeleton';

import { useUser } from '@/contexts/UserContext';
import { useAuth } from '@/contexts/AuthContext';
import { SEGMENT_ACCESS } from '@/types';
import { simuladosApi } from '@/services/simuladosApi';

import { TabBar } from '@/components/caderno/TabBar';
import { PageHero } from '@/components/caderno/PageHero';
import { ProfSanorAvatar } from '@/components/comparativo/ProfSanorAvatar';
import { InsightCard } from '@/components/caderno/insights/InsightCard';
import { RoiPanel } from '@/components/caderno/insights/RoiPanel';
import { CalibrationPanel } from '@/components/caderno/insights/CalibrationPanel';
import { InsightsEmptyState } from '@/components/caderno/insights/InsightsEmptyState';

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

// ─── InsightsSkeleton ───

function InsightsSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Carregando insights">
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-2xl border border-border bg-card p-5 space-y-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <Skeleton className="h-5 w-48" />
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-8 w-36 rounded-xl" />
        </div>
      ))}
    </div>
  );
}

// ─── InsightsContent ───

interface InsightsContentProps {
  userId: string;
  userName: string;
}

function InsightsContent({ userId, userName }: InsightsContentProps) {
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
    staleTime: 1000 * 60 * 60 * 24, // 24h — honra TTL do cache do backend
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

  // ─── React Query: calibração de confiança (staleTime 5min padrão) ───
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

    const fromCache = insightsData.from_cache ?? false;
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
    tracked.current = false; // permitir re-tracking após atualização
    refetchInsights();
  }

  // ─── Dados derivados ───

  const sorted = sortBySeverity(insightsData?.insights ?? []);
  const roiInsights = sorted.filter((i) => i.type === 'roi');
  const otherInsights = sorted.filter((i) => i.type !== 'roi');

  const fromCache = (insightsData as any)?.from_cache ?? false;
  const generatedAt = insightsData?.generated_at ?? null;
  const cacheLabel = generatedAt ? `Atualizado ${relativeTime(generatedAt)}` : null;

  const hasSufficient = insightsData?.has_sufficient_data ?? false;
  const apiMessage = (insightsData as any)?.message ?? null;

  // ─── Render ───

  return (
    <StaggerContainer className="space-y-6">
      {/* Hero */}
      <StaggerItem>
        <PageHero
          pendingCount={0}
          resolvedCount={0}
          totalCount={0}
          specialtyCount={0}
          streak={0}
        />
      </StaggerItem>

      {/* Prof. San header + Atualizar */}
      <StaggerItem>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              <div className="overflow-hidden rounded-full border-2 border-background bg-primary/[0.04] shadow-sm">
                <ProfSanorAvatar size={44} animated={insightsFetching} />
              </div>
              <span
                className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-background bg-success"
                aria-hidden
              />
            </div>
            <div>
              <p className="text-body font-bold text-foreground">
                Análise do seu caderno
              </p>
              <p className="text-caption text-muted-foreground">
                Prof. San{userName ? `, para ${userName}` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Selo from_cache */}
            {fromCache && cacheLabel && (
              <span
                className="hidden sm:inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground"
                title={`Gerado em: ${generatedAt}`}
              >
                {cacheLabel}
              </span>
            )}

            {/* Botão Atualizar */}
            <button
              type="button"
              onClick={handleRefresh}
              disabled={insightsFetching}
              aria-label="Atualizar análise do Prof. San"
              className={cn(
                'inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2',
                'text-[12px] font-semibold text-muted-foreground transition-all duration-150',
                'hover:border-primary/30 hover:text-foreground',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                'disabled:opacity-50 disabled:cursor-not-allowed',
              )}
            >
              <RefreshCw
                className={cn('h-3.5 w-3.5', insightsFetching && 'animate-spin')}
                aria-hidden
              />
              {insightsFetching ? 'Atualizando...' : 'Atualizar análise'}
            </button>
          </div>
        </div>
      </StaggerItem>

      {/* Estado: carregando (primeira vez) */}
      {insightsLoading && (
        <StaggerItem>
          <InsightsSkeleton />
        </StaggerItem>
      )}

      {/* Estado: erro */}
      {insightsError && !insightsLoading && (
        <StaggerItem>
          <div
            role="alert"
            className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-card px-6 py-10 text-center"
          >
            <WifiOff className="h-10 w-10 text-muted-foreground/50" aria-hidden />
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
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground shadow-sm transition-all hover:bg-wine-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden />
              Tentar novamente
            </button>
          </div>
        </StaggerItem>
      )}

      {/* Estado: dados insuficientes */}
      {!insightsLoading && !insightsError && insightsData && !hasSufficient && (
        <StaggerItem>
          <InsightsEmptyState message={apiMessage} entryCount={0} />
        </StaggerItem>
      )}

      {/* Estado: insights prontos */}
      {!insightsLoading && !insightsError && hasSufficient && (
        <>
          {/* Metadata bar */}
          {(fromCache || insightsData?.generated_at) && (
            <StaggerItem>
              <div className="flex items-center gap-2 text-caption text-muted-foreground">
                {insightsFetching && (
                  <span className="inline-flex items-center gap-1.5">
                    <RefreshCw className="h-3 w-3 animate-spin" aria-hidden />
                    Atualizando análise em background...
                  </span>
                )}
                {!insightsFetching && cacheLabel && fromCache && (
                  <span className="sm:hidden">{cacheLabel}</span>
                )}
              </div>
            </StaggerItem>
          )}

          {/* Insights: critical + attention + positive + info (sem roi) */}
          {otherInsights.length > 0 && (
            <StaggerItem>
              <div className="space-y-3" role="list" aria-label="Lista de insights do caderno">
                {otherInsights.map((insight) => (
                  <motion.div
                    key={insight.id}
                    role="listitem"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <InsightCard insight={insight} />
                  </motion.div>
                ))}
              </div>
            </StaggerItem>
          )}

          {/* ROI insights como InsightCards antes do painel */}
          {roiInsights.length > 0 && (
            <StaggerItem>
              <div className="space-y-3">
                {roiInsights.map((insight) => (
                  <motion.div
                    key={insight.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <InsightCard insight={insight} />
                  </motion.div>
                ))}
              </div>
            </StaggerItem>
          )}

          {/* Separador visual antes do painel ROI */}
          <StaggerItem>
            <div className="border-t border-border pt-2" aria-hidden />
          </StaggerItem>

          {/* Painel de ROI */}
          <StaggerItem>
            <RoiPanel
              history={(historyData as any) ?? null}
              loading={historyLoading}
              roiInsights={roiInsights}
            />
          </StaggerItem>

          {/* Separador visual antes do painel de Calibração */}
          <StaggerItem>
            <div className="border-t border-border pt-2" aria-hidden />
          </StaggerItem>

          {/* Painel de Calibração de Confiança */}
          <StaggerItem>
            <CalibrationPanel
              data={calibrationData ?? null}
              loading={calibrationLoading}
            />
          </StaggerItem>
        </>
      )}

      {/* Painel ROI mesmo sem insights (estado neutro) */}
      {!insightsLoading && !insightsError && hasSufficient === false && !insightsData && (
        <StaggerItem>
          <RoiPanel history={null} loading={false} />
        </StaggerItem>
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
      {/* TabBar antes do gate — sempre visível */}
      <TabBar />

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
