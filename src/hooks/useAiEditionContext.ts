import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useCutoffContext, useCutoffEditionFlag } from '@/hooks/useCutoffContext';
import { editionsApi } from '@/services/editionsApi';
import { buildAiEditionContext, resolveSeriesEditionId } from '@/lib/ai-edition-context';
import { buildSummaryCacheKey, clearOtherSummaryCaches, readCachedSummary, writeCachedSummary } from '@/lib/profSanCache';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

/** Resolves only exam/series metadata. Never substitutes the user's target edition. */
export function useAiEditionContext(editionIds: readonly (string | null | undefined)[], percentile: number | null = null) {
  const { user } = useAuth();
  const flag = useCutoffEditionFlag();
  const editionsUi = flag.editionsUi;
  const editionId = resolveSeriesEditionId(editionIds);
  const catalog = useQuery({
    queryKey: ['ai-exam-editions', user?.id ?? null], queryFn: editionsApi.getExamEditions,
    enabled: flag.ready && !!user && editionsUi && !!editionId, staleTime: 60 * 60 * 1000, retry: false,
  });
  const { cutoffContext, loading: cutoffLoading } = useCutoffContext({
    editionsUi, referenceEditionId: editionId,
    enabled: !editionsUi || (!!editionId && catalog.isSuccess),
  });
  const editionContext = editionsUi ? buildAiEditionContext(catalog.data ?? [], editionIds, percentile, cutoffContext) : null;
  const loading = flag.loading || cutoffLoading || (flag.ready && editionsUi && !!editionId && catalog.isPending);
  return { userId: user?.id ?? null, editionsUi, editionContext, cutoffContext, loading,
    canGenerate: flag.ready && !!user && !loading && new Set(editionIds.filter(Boolean)).size <= 1 && (!editionsUi || !!editionContext) };
}

interface SummaryOptions {
  kind: 'performance' | 'ranking' | 'comparative';
  simuladoIds: readonly string[];
  editionIds: readonly (string | null | undefined)[];
  percentile?: number | null;
  body: Record<string, unknown>;
  auto?: boolean;
  enabled?: boolean;
}

/** Shared lifecycle prevents stale account/exam responses from painting or caching. */
export function useAiSummary({ kind, simuladoIds, editionIds, percentile = null, body, auto = true, enabled = true }: SummaryOptions) {
  const context = useAiEditionContext(editionIds, percentile);
  const payload = {
    ...body,
    ...(kind !== 'comparative' ? { simuladoId: simuladoIds[0] } : {}),
    // Unknown historical cuts must not become an approval target in the AI prompt.
    cutoffContext: context.editionContext?.cutoffReference ? context.cutoffContext : null,
    ...(context.editionContext ? { editionContext: context.editionContext } : {}),
  };
  const cacheKey = buildSummaryCacheKey(kind, context.userId, simuladoIds, {
    payload, editionIds, referenceContext: context.cutoffContext, percentile,
  });
  const ready = enabled && context.canGenerate && !!cacheKey;
  const [state, setState] = useState<{ key: string | null; markdown: string | null; generatedAt: number | null; error: string | null; loading: boolean }>(
    () => ({ key: cacheKey, markdown: null, generatedAt: null, error: null, loading: false }),
  );
  const lifecycle = useRef({ key: cacheKey, sequence: 0, pending: false, tried: null as string | null, mounted: true });
  if (lifecycle.current.key !== cacheKey) {
    lifecycle.current = { ...lifecycle.current, key: cacheKey, sequence: lifecycle.current.sequence + 1, pending: false, tried: null };
  }
  const cached = ready ? readCachedSummary(cacheKey) : null;
  const visible = ready && state.key === cacheKey ? state : null;
  const markdown = visible?.markdown ?? cached?.markdown ?? null;
  const generatedAt = visible?.generatedAt ?? cached?.generatedAt ?? null;

  useEffect(() => { clearOtherSummaryCaches(context.userId); }, [context.userId]);

  useEffect(() => {
    lifecycle.current.mounted = true;
    return () => {
      lifecycle.current.mounted = false;
      lifecycle.current.sequence++;
      lifecycle.current.pending = false;
      lifecycle.current.tried = null;
    };
  }, []);

  const generate = async () => {
    if (!ready || lifecycle.current.pending) return;
    const sequence = ++lifecycle.current.sequence;
    lifecycle.current.pending = true;
    lifecycle.current.tried = cacheKey;
    const current = () => lifecycle.current.mounted && lifecycle.current.key === cacheKey && lifecycle.current.sequence === sequence;
    setState({ key: cacheKey, markdown, generatedAt, error: null, loading: true });
    try {
      const { data, error } = await supabase.functions.invoke(`gemini-${kind}-summary`, { body: payload });
      if (!current()) return;
      if (error) throw error;
      if (typeof data?.markdown !== 'string' || !data.markdown.trim()) throw new Error('Resposta vazia da IA');
      writeCachedSummary(cacheKey, data.markdown);
      setState({ key: cacheKey, markdown: data.markdown, generatedAt: Date.now(), error: null, loading: false });
    } catch (error) {
      if (!current()) return;
      logger.error('[useAiSummary] Generation failed:', error);
      setState({ key: cacheKey, markdown, generatedAt, error: error instanceof Error ? error.message : 'Tente novamente em instantes.', loading: false });
    } finally {
      if (current()) lifecycle.current.pending = false;
    }
  };

  useEffect(() => {
    if (!auto || !ready || lifecycle.current.tried === cacheKey || cached?.markdown) return;
    void generate();
    // The complete signed payload, including loaded cutoff context, owns this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, ready, auto]);

  return { markdown, generatedAt, error: visible?.error ?? null,
    loading: context.loading || (visible?.loading ?? false), generate, canGenerate: ready, cacheKey };
}
