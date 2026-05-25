import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Sparkles, Loader2, RefreshCw, Trophy } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';
import { ProfSanorAvatar } from '@/components/comparativo/ProfSanorAvatar';
import { useCutoffContext } from '@/hooks/useCutoffContext';
import type { RankingParticipant, RankingStats } from '@/services/rankingApi';

interface Props {
  studentName: string;
  simuladoId?: string | null;
  simuladoTitle?: string;
  currentUser?: RankingParticipant;
  stats: RankingStats;
  userSpecialty?: string;
  userInstitutions?: string[];
  compact?: boolean;
}

function buildCacheKey(simuladoId: string | null | undefined, score: number, position: number): string {
  if (!simuladoId) return 'sanor:rank:none';
  return `sanor:rank:v1:${simuladoId}:${score}:${position}`;
}
const readCache = (k: string) => { try { return sessionStorage.getItem(k); } catch { return null; } };
const writeCache = (k: string, v: string) => { try { sessionStorage.setItem(k, v); } catch { /* */ } };

const LOADING_PHRASES = [
  'lendo o ranking…',
  'comparando com o corte…',
  'mirando suas instituições…',
  'sintetizando…',
];

/**
 * Prof. San na tela de Ranking — analisa a posição do aluno
 * focando em chance de aprovação nas instituições-alvo.
 */
export function ProfSanorRanking({
  studentName,
  simuladoId,
  simuladoTitle,
  currentUser,
  stats,
  userSpecialty,
  userInstitutions,
  compact = false,
}: Props) {
  const { cutoffContext, loading: cutoffLoading } = useCutoffContext();

  const cacheKey = buildCacheKey(
    simuladoId,
    currentUser?.score ?? 0,
    currentUser?.position ?? 0,
  );

  const [loading, setLoading] = useState(false);
  const [markdown, setMarkdown] = useState<string | null>(() => readCache(cacheKey));
  const [displayMarkdown, setDisplayMarkdown] = useState<string | null>(() => readCache(cacheKey));
  const [loadingPhase, setLoadingPhase] = useState(0);
  const autoTriedRef = useRef(false);
  const typewriterTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const cached = readCache(cacheKey);
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
    if (!markdown) { setDisplayMarkdown(null); return; }
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

  useEffect(() => {
    if (!loading) { setLoadingPhase(0); return; }
    setLoadingPhase(0);
    const id = window.setInterval(() => {
      setLoadingPhase(p => (p + 1) % LOADING_PHRASES.length);
    }, 1600);
    return () => window.clearInterval(id);
  }, [loading]);

  const generate = async () => {
    if (!currentUser) return;
    setLoading(true);
    setDisplayMarkdown(null);
    setMarkdown(null);
    try {
      const { data, error } = await supabase.functions.invoke('gemini-ranking-summary', {
        body: {
          studentName,
          simuladoTitle,
          userScore: currentUser.score,
          userPosition: currentUser.position,
          totalCandidates: stats.totalCandidatos,
          averageScore: stats.notaMedia,
          top10Cutoff: stats.notaCorte,
          specialty: userSpecialty || null,
          institutions: userInstitutions ?? [],
          cutoffContext,
        },
      });
      if (error) throw error;
      if (!data?.markdown) throw new Error('Resposta vazia da IA');
      setMarkdown(data.markdown);
      writeCache(cacheKey, data.markdown);
    } catch (err) {
      logger.error('[ProfSanorRanking] AI summary error', err);
      toast({
        title: 'Não foi possível gerar a análise',
        description: err instanceof Error ? err.message : 'Tente novamente em instantes.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Auto-gera uma vez por cacheKey
  useEffect(() => {
    if (autoTriedRef.current) return;
    if (cutoffLoading) return;
    if (!currentUser) return;
    if (markdown) { autoTriedRef.current = true; return; }
    autoTriedRef.current = true;
    generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, cutoffLoading, currentUser]);

  if (!currentUser) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
    >
      <div className="w-full">
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
                {loading ? LOADING_PHRASES[loadingPhase] : markdown ? 'analisou sua posição' : 'pronto pra olhar o ranking'}
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

        <div className="relative group/bubble">
          <span
            aria-hidden
            className="hidden sm:block absolute -top-1.5 left-7 h-3.5 w-3.5 bg-card border-l border-t border-border/60 rotate-45 z-0"
          />
          <motion.div
            initial={false}
            animate={{ opacity: 1 }}
            className="relative z-10 rounded-2xl border border-border/60 bg-card px-5 md:px-6 py-4 md:py-5 shadow-[0_10px_40px_-15px_hsl(var(--primary)/0.18)] group-hover/bubble:shadow-[0_15px_50px_-10px_hsl(var(--primary)/0.22)] transition-shadow"
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
                    <span>Prof. San — análise gerada agora</span>
                  </p>
                )}
              </motion.div>
            )}

            {!loading && !markdown && (
              <div className="flex gap-4 items-start">
                <div className="mt-0.5 shrink-0 h-9 w-9 rounded-xl bg-primary/[0.06] flex items-center justify-center">
                  <Trophy className="h-4 w-4 text-primary/70" />
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
                  pra eu olhar sua posição com você e mirar suas instituições.
                </p>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}