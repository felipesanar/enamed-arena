import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Sparkles, Loader2, RefreshCw, BarChart3, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { ProfSanorAvatar } from '@/components/comparativo/ProfSanorAvatar';
import { useCutoffContext } from '@/hooks/useCutoffContext';
import { useTypewriter } from '@/hooks/useTypewriter';
import { readCachedSummary, writeCachedSummary, formatGeneratedAt } from '@/lib/profSanCache';
import type { PerformanceBreakdown } from '@/lib/resultHelpers';

interface Props {
  studentName: string;
  simuladoId?: string;
  simuladoTitle?: string;
  breakdown: PerformanceBreakdown;
}

/**
 * Chave de cache da análise IA do simulado — indexa por id do simulado
 * + assinatura compacta dos dados (score+totais). Se o conteúdo subjacente
 * mudar (reprocessing), a key invalida e a IA gera de novo.
 */
function buildCacheKey(simuladoId: string | undefined, breakdown: PerformanceBreakdown): string {
  if (!simuladoId) return 'sanor:perf:none';
  const sig = `${breakdown.overall.percentageScore}-${breakdown.overall.totalCorrect}-${breakdown.overall.totalQuestions}`;
  return `sanor:perf:v1:${simuladoId}:${sig}`;
}

const LOADING_PHRASES = [
  'lendo a prova…',
  'olhando por especialidade…',
  'cruzando com seus erros…',
  'sintetizando…',
];

/**
 * Variante Prof. Sanor para a tela de Desempenho (1 simulado).
 * Avatar + bolha de chat + typewriter, igual ao componente do Comparativo,
 * mas conectado ao endpoint `gemini-performance-summary` que olha 1 simulado.
 */
export function ProfSanorPerformance({ studentName, simuladoId, simuladoTitle, breakdown }: Props) {
  const { cutoffContext, loading: cutoffLoading } = useCutoffContext();
  const cacheKey = buildCacheKey(simuladoId, breakdown);
  const initialCache = readCachedSummary(cacheKey);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [markdown, setMarkdown] = useState<string | null>(initialCache?.markdown ?? null);
  const [generatedAt, setGeneratedAt] = useState<number | null>(initialCache?.generatedAt ?? null);
  const { display: displayMarkdown, write, skip } = useTypewriter(initialCache?.markdown ?? null);
  const [loadingPhase, setLoadingPhase] = useState(0);
  const autoTriedRef = useRef(false);

  // Se o cacheKey mudar (trocou de simulado), reseta tudo.
  useEffect(() => {
    const cached = readCachedSummary(cacheKey);
    setMarkdown(cached?.markdown ?? null);
    setGeneratedAt(cached?.generatedAt ?? null);
    write(cached?.markdown ?? null, { animate: false });
    setError(null);
    autoTriedRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey]);

  // Frases rotativas de loading
  useEffect(() => {
    if (!loading) { setLoadingPhase(0); return; }
    setLoadingPhase(0);
    const id = window.setInterval(() => {
      setLoadingPhase(p => (p + 1) % LOADING_PHRASES.length);
    }, 1600);
    return () => window.clearInterval(id);
  }, [loading]);

  const generate = async () => {
    setLoading(true);
    setError(null);
    setMarkdown(null);
    write(null);
    try {
      const { data, error } = await supabase.functions.invoke('gemini-performance-summary', {
        body: {
          studentName,
          simuladoTitle,
          cutoffContext,
          overall: {
            totalQuestions: breakdown.overall.totalQuestions,
            totalCorrect: breakdown.overall.totalCorrect,
            totalAnswered: breakdown.overall.totalAnswered,
            percentageScore: breakdown.overall.percentageScore,
          },
          byArea: breakdown.byArea.map((a) => ({
            area: a.area, total: a.questions, correct: a.correct, score: a.score,
          })),
          bySubspecialty: breakdown.bySubspecialty.map((s) => ({
            specialty: s.specialty, subTopic: s.subspecialty, total: s.questions, correct: s.correct, score: s.score,
          })),
        },
      });
      if (error) throw error;
      if (!data?.markdown) throw new Error('Resposta vazia da IA');
      setMarkdown(data.markdown);
      setGeneratedAt(Date.now());
      write(data.markdown);
      writeCachedSummary(cacheKey, data.markdown);
    } catch (err) {
      logger.error('[ProfSanorPerformance] AI summary error', err);
      setError(err instanceof Error ? err.message : 'Tente novamente em instantes.');
    } finally {
      setLoading(false);
    }
  };

  // Auto-gera UMA vez por cacheKey (não dispara em troca de aba).
  // Aguarda cutoff carregar pra primeira geração usar a meta real.
  useEffect(() => {
    if (autoTriedRef.current) return;
    if (cutoffLoading) return;
    if (markdown) { autoTriedRef.current = true; return; }
    autoTriedRef.current = true;
    generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, cutoffLoading]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
    >
      <div className="w-full">
        {/* Header Row — avatar + identidade + CTA */}
        <div className="flex items-center justify-between gap-3 mb-3 md:mb-4 px-1 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              <div className="rounded-full bg-primary/[0.04] border-2 border-background shadow-sm overflow-hidden">
                <ProfSanorAvatar size={56} animated={loading} />
              </div>
              <span
                className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full bg-success border-2 border-background shadow-sm animate-pulse"
                aria-hidden
              />
            </div>
            <div className="leading-tight">
              <p className="text-heading-3 font-bold text-primary tracking-tight">Prof. San</p>
              <p className="text-caption text-muted-foreground tracking-wide">
                {loading ? LOADING_PHRASES[loadingPhase] : markdown ? 'analisou seu desempenho' : 'pronto pra conversar'}
              </p>
            </div>
          </div>

          {(loading || !markdown) && (
            <Button
              onClick={generate}
              disabled={loading}
              size="sm"
              variant="ghost"
              className="group shrink-0 rounded-xl px-3 md:px-4 py-2 text-primary font-semibold hover:bg-primary/5 active:scale-95 transition-all"
            >
              {loading ? (
                <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Pensando…</>
              ) : (
                <><Sparkles className="h-4 w-4 mr-1.5 transition-transform group-hover:rotate-12" />Pedir análise</>
              )}
            </Button>
          )}
          {markdown && !loading && (
            <button
              type="button"
              onClick={generate}
              aria-label="Pedir nova análise"
              title="Pedir nova análise"
              className="shrink-0 h-9 w-9 rounded-xl flex items-center justify-center text-muted-foreground/70 hover:text-primary hover:bg-primary/5 transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Bolha de chat */}
        <div className="relative group/bubble">
          {/* Ponta da bolha */}
          <span
            aria-hidden
            className="hidden sm:block absolute -top-1.5 left-7 h-3.5 w-3.5 bg-card border-l border-t border-border/60 rotate-45 z-0"
          />
          <motion.div
            initial={false}
            animate={{ opacity: 1 }}
            onClick={markdown && displayMarkdown !== markdown ? skip : undefined}
            title={markdown && displayMarkdown !== markdown ? 'Clique para mostrar tudo' : undefined}
            className={`relative z-10 rounded-2xl border border-border/60 bg-card px-5 md:px-6 py-4 md:py-5 shadow-[0_10px_40px_-15px_hsl(var(--primary)/0.18)] group-hover/bubble:shadow-[0_15px_50px_-10px_hsl(var(--primary)/0.22)] transition-shadow${markdown && displayMarkdown !== markdown ? ' cursor-pointer' : ''}`}
          >

            {loading && !markdown && (
              <div className="space-y-2.5 py-1">
                <div className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="h-2 w-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '120ms' }} />
                  <span className="h-2 w-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '240ms' }} />
                </div>
                <div className="space-y-2 animate-pulse opacity-60">
                  <div className="h-3 rounded bg-muted w-[92%]" />
                  <div className="h-3 rounded bg-muted w-[88%]" />
                  <div className="h-3 rounded bg-muted w-[60%]" />
                </div>
              </div>
            )}

            {displayMarkdown && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
                className="prose prose-sm max-w-none
                  text-foreground
                  prose-p:my-0
                  prose-p:text-body
                  prose-p:leading-relaxed
                  prose-p:text-foreground
                  prose-p:first:mt-0
                  prose-p:mt-3
                  prose-headings:text-foreground
                  prose-headings:font-semibold
                  prose-h3:text-[15px]
                  prose-h3:mt-4
                  prose-h3:mb-2
                  prose-li:text-body
                  prose-li:text-foreground
                  prose-strong:text-foreground
                  prose-strong:font-semibold"
              >
                <ReactMarkdown>{displayMarkdown}</ReactMarkdown>
                {markdown && displayMarkdown !== markdown && (
                  <span className="inline-block w-[2px] h-4 bg-primary/70 align-text-bottom -mb-0.5 animate-pulse" aria-hidden />
                )}

                {markdown && displayMarkdown === markdown && (
                  <p className="mt-4 pt-3 border-t border-border/60 text-caption text-muted-foreground flex items-center gap-1.5">
                    <Sparkles className="h-3 w-3 text-primary/60" />
                    <span>Prof. San — {formatGeneratedAt(generatedAt)}</span>
                  </p>
                )}
              </motion.div>
            )}

            {!loading && !markdown && error && (
              <div className="flex gap-3 items-start" role="alert">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
                <div className="space-y-2">
                  <p className="text-body-sm text-foreground/80">
                    Não consegui gerar a análise agora. {error}
                  </p>
                  <Button onClick={generate} size="sm" variant="outline" className="rounded-lg">
                    <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                    Tentar novamente
                  </Button>
                </div>
              </div>
            )}

            {!loading && !markdown && !error && (
              <div className="flex gap-4 items-start">
                <div className="mt-0.5 shrink-0 h-9 w-9 rounded-xl bg-primary/[0.06] flex items-center justify-center">
                  <BarChart3 className="h-4 w-4 text-primary/70" />
                </div>
                <p className="text-[15px] leading-relaxed text-foreground/80">
                  Oi, {studentName.split(' ')[0]}! Clique em{' '}
                  <button
                    type="button"
                    onClick={generate}
                    className="font-bold text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary transition-all cursor-pointer"
                  >
                    Pedir análise
                  </button>{' '}
                  que eu olho seus simulados com você.
                </p>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
