import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Sparkles, Loader2, Activity, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';
import { ProfSanorAvatar } from '@/components/comparativo/ProfSanorAvatar';
import { useCutoffContext } from '@/hooks/useCutoffContext';
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

function readCachedMarkdown(key: string): string | null {
  try { return sessionStorage.getItem(key); } catch { return null; }
}
function writeCachedMarkdown(key: string, md: string) {
  try { sessionStorage.setItem(key, md); } catch { /* quotaExceeded etc */ }
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
  const [loading, setLoading] = useState(false);
  const [markdown, setMarkdown] = useState<string | null>(() => readCachedMarkdown(cacheKey));
  const [displayMarkdown, setDisplayMarkdown] = useState<string | null>(() => readCachedMarkdown(cacheKey));
  const [loadingPhase, setLoadingPhase] = useState(0);
  const autoTriedRef = useRef(false);
  const typewriterTimerRef = useRef<number | null>(null);

  // Se o cacheKey mudar (trocou de simulado), reseta tudo.
  useEffect(() => {
    const cached = readCachedMarkdown(cacheKey);
    setMarkdown(cached);
    setDisplayMarkdown(cached);
    autoTriedRef.current = false;
  }, [cacheKey]);

  // Typewriter
  useEffect(() => {
    if (typewriterTimerRef.current != null) {
      window.clearInterval(typewriterTimerRef.current);
      typewriterTimerRef.current = null;
    }
    if (!markdown) {
      setDisplayMarkdown(null);
      return;
    }
    if (displayMarkdown === markdown) return;
    let cursor = displayMarkdown && markdown.startsWith(displayMarkdown) ? displayMarkdown.length : 0;
    setDisplayMarkdown(markdown.slice(0, cursor));
    typewriterTimerRef.current = window.setInterval(() => {
      cursor = Math.min(cursor + 4, markdown.length);
      setDisplayMarkdown(markdown.slice(0, cursor));
      if (cursor >= markdown.length) {
        if (typewriterTimerRef.current != null) {
          window.clearInterval(typewriterTimerRef.current);
          typewriterTimerRef.current = null;
        }
      }
    }, 24);
    return () => {
      if (typewriterTimerRef.current != null) {
        window.clearInterval(typewriterTimerRef.current);
        typewriterTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markdown]);

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
    setDisplayMarkdown(null);
    setMarkdown(null);
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
      writeCachedMarkdown(cacheKey, data.markdown);
    } catch (err) {
      logger.error('[ProfSanorPerformance] AI summary error', err);
      toast({
        title: 'Não foi possível gerar a análise',
        description: err instanceof Error ? err.message : 'Tente novamente em instantes.',
        variant: 'destructive',
      });
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
      <div className="flex items-start gap-3 md:gap-4">
        {/* Avatar */}
        <div className="relative shrink-0 hidden sm:block">
          <ProfSanorAvatar size={56} animated={loading} />
          <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-success border-2 border-background" aria-hidden />
        </div>

        {/* Bolha de chat */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3 mb-1.5 flex-wrap">
            <div className="flex items-center gap-2">
              <ProfSanorAvatar size={36} animated={loading} className="sm:hidden" />
              <div className="leading-tight">
                <p className="text-body font-semibold text-foreground">Prof. San</p>
                <p className="text-caption text-muted-foreground">
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
                className="shrink-0 text-muted-foreground hover:text-foreground"
              >
                {loading ? (
                  <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Pensando…</>
                ) : (
                  <><Sparkles className="h-3.5 w-3.5 mr-1.5" />Pedir análise</>
                )}
              </Button>
            )}
            {markdown && !loading && (
              <button
                type="button"
                onClick={generate}
                aria-label="Pedir nova análise"
                title="Pedir nova análise"
                className="shrink-0 h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground/60 hover:text-foreground hover:bg-muted/60 transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <motion.div
            initial={false}
            animate={{ opacity: 1 }}
            className="relative rounded-2xl rounded-tl-md border border-border bg-card px-4 md:px-5 py-3.5 md:py-4 shadow-sm"
          >
            <span
              aria-hidden
              className="hidden sm:block absolute top-3 -left-2 h-4 w-4 bg-card border-l border-b border-border rotate-45 origin-center"
              style={{ clipPath: 'polygon(0 0, 100% 100%, 0 100%)' }}
            />

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
                    <span>Prof. San — análise gerada agora</span>
                  </p>
                )}
              </motion.div>
            )}

            {!loading && !markdown && (
              <p className="text-body-sm text-muted-foreground flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                {studentName.split(' ')[0]}, posso analisar essa prova com você?
              </p>
            )}
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
