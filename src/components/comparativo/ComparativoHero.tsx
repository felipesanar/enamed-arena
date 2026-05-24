import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Sparkles, Loader2, Activity, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';
import { ProfSanorAvatar } from './ProfSanorAvatar';
import { useCutoffContext } from '@/hooks/useCutoffContext';
import type { ComparativeEntryRich } from '@/hooks/useComparativeData';

interface Props {
  studentName: string;
  entries: ComparativeEntryRich[]; // sorted asc by sequenceNumber
  /** Total de simulados publicados na plataforma — usado pra contextualizar 'fez X de Y' */
  totalSimuladosPlatform?: number;
  /** Especialidade pretendida vinda do onboarding (opcional) */
  intendedSpecialty?: string | null;
}

/**
 * Chave de cache do markdown da análise IA. Indexa por (id do primeiro simulado,
 * id do último, contagem). Se o conjunto de simulados mudar, gera nova análise.
 * Se for igual, reaproveita — assim trocar de aba do navegador (que pode forçar
 * remount em situações extremas) NÃO faz nova chamada à IA.
 */
function buildCacheKey(entries: ComparativeEntryRich[]): string {
  if (entries.length === 0) return 'empty';
  const first = entries[0].simuladoId;
  const last = entries[entries.length - 1].simuladoId;
  return `sanor:v1:${entries.length}:${first}:${last}`;
}

function readCachedMarkdown(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeCachedMarkdown(key: string, md: string) {
  try {
    sessionStorage.setItem(key, md);
  } catch {
    // ignora quotaExceeded / privacy mode
  }
}

export function ComparativoHero({ studentName, entries, totalSimuladosPlatform, intendedSpecialty }: Props) {
  const { cutoffContext, loading: cutoffLoading } = useCutoffContext();
  const cacheKey = buildCacheKey(entries);
  // Inicializa o estado lendo do sessionStorage — se já houver análise cacheada
  // pra esse mesmo conjunto de simulados, nem chega a chamar a IA.
  const [loading, setLoading] = useState(false);
  const [markdown, setMarkdown] = useState<string | null>(() => readCachedMarkdown(cacheKey));
  // displayMarkdown é o que aparece na tela. Animamos via typewriter quando
  // markdown novo chega. Quando vem do cache (resposta antiga), mostramos
  // direto sem animação.
  const [displayMarkdown, setDisplayMarkdown] = useState<string | null>(() => readCachedMarkdown(cacheKey));
  const [loadingPhase, setLoadingPhase] = useState(0);
  const autoTriedRef = useRef(false);
  const typewriterTimerRef = useRef<number | null>(null);

  // ─── Typewriter: anima displayMarkdown até alcançar markdown ───
  useEffect(() => {
    // Limpa qualquer timer anterior
    if (typewriterTimerRef.current != null) {
      window.clearInterval(typewriterTimerRef.current);
      typewriterTimerRef.current = null;
    }
    if (!markdown) {
      setDisplayMarkdown(null);
      return;
    }
    // Se displayMarkdown JÁ é o markdown completo (caso de cache), pula animação
    if (displayMarkdown === markdown) return;
    // Se displayMarkdown ainda está vazio/null, começa do zero
    let cursor = displayMarkdown && markdown.startsWith(displayMarkdown) ? displayMarkdown.length : 0;
    setDisplayMarkdown(markdown.slice(0, cursor));
    typewriterTimerRef.current = window.setInterval(() => {
      cursor = Math.min(cursor + 4, markdown.length); // ~4 chars por tick
      setDisplayMarkdown(markdown.slice(0, cursor));
      if (cursor >= markdown.length) {
        if (typewriterTimerRef.current != null) {
          window.clearInterval(typewriterTimerRef.current);
          typewriterTimerRef.current = null;
        }
      }
    }, 24); // 24ms => ~167 chars/s, rápido mas perceptível
    return () => {
      if (typewriterTimerRef.current != null) {
        window.clearInterval(typewriterTimerRef.current);
        typewriterTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markdown]);

  // ─── Frases rotativas durante o loading ───
  const LOADING_PHRASES = [
    'lendo seus simulados…',
    'comparando as provas…',
    'olhando as especialidades…',
    'cruzando comportamento…',
    'sintetizando análise…',
  ];
  useEffect(() => {
    if (!loading) {
      setLoadingPhase(0);
      return;
    }
    setLoadingPhase(0);
    const id = window.setInterval(() => {
      setLoadingPhase(p => (p + 1) % LOADING_PHRASES.length);
    }, 1600);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const generate = async () => {
    setLoading(true);
    // Limpa display pra typewriter rodar do início quando a nova resposta chegar
    setDisplayMarkdown(null);
    setMarkdown(null);
    try {
      const { data, error } = await supabase.functions.invoke('gemini-comparative-summary', {
        body: {
          studentName,
          totalSimuladosPlatform,
          intendedSpecialty,
          cutoffContext,
          simulados: entries.map(e => ({
            title: e.title,
            sequenceNumber: e.sequenceNumber,
            percentageScore: e.percentageScore,
            totalCorrect: e.totalCorrect,
            totalQuestions: e.totalQuestions,
            durationSeconds: e.durationSeconds,
            tabExits: e.tabExits,
            fullscreenExits: e.fullscreenExits,
            markedForReview: e.markedForReview,
            highConfidenceTotal: e.highConfidenceTotal,
            highConfidenceCorrect: e.highConfidenceCorrect,
            completedAt: e.completedAt || null,
            byArea: Object.entries(e.areaScores).map(([area, score]) => ({ area, score })),
          })),
        },
      });
      if (error) throw error;
      if (!data?.markdown) throw new Error('Resposta vazia da IA');
      setMarkdown(data.markdown);
      writeCachedMarkdown(cacheKey, data.markdown);
    } catch (err) {
      logger.error('[ComparativoHero] AI summary error', err);
      toast({
        title: 'Não foi possível gerar a análise',
        description: err instanceof Error ? err.message : 'Tente novamente em instantes.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Auto-gera UMA VEZ por conjunto de simulados (cacheKey).
  // Aguarda o cutoffContext carregar pra IA usar a meta real na primeira chamada.
  // Pulamos se já temos markdown (cacheado do sessionStorage ou recém-gerado).
  useEffect(() => {
    if (autoTriedRef.current) return;
    if (cutoffLoading) return; // aguarda cutoff antes do primeiro disparo
    if (markdown) {
      autoTriedRef.current = true;
      return;
    }
    autoTriedRef.current = true;
    generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
    >
      {/* Mensagem do Prof. Sanor — layout de chat */}
      <div className="flex items-start gap-3 md:gap-4">
        {/* Avatar com indicador online */}
        <div className="relative shrink-0 hidden sm:block">
          <ProfSanorAvatar size={56} animated={loading} />
          <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-success border-2 border-background" aria-hidden />
        </div>

        {/* Bolha de chat */}
        <div className="flex-1 min-w-0">
          {/* Cabeçalho da bolha: nome + ação */}
          <div className="flex items-center justify-between gap-3 mb-1.5 flex-wrap">
            <div className="flex items-center gap-2">
              {/* Avatar compacto pra mobile */}
              <ProfSanorAvatar size={36} animated={loading} className="sm:hidden" />
              <div className="leading-tight">
                <p className="text-body font-semibold text-foreground">
                  Prof. Sanor
                </p>
                <p className="text-caption text-muted-foreground">
                  {loading ? LOADING_PHRASES[loadingPhase] : markdown ? 'seu mentor virtual' : 'pronto pra conversar'}
                </p>
              </div>
            </div>
            {/* Estado inicial / carregando: CTA mais explícito */}
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
            {/* Quando já há análise: botão bem sutil só com ícone (regenerar) */}
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

          {/* Bolha em si */}
          <motion.div
            initial={false}
            animate={{ opacity: 1 }}
            className="relative rounded-2xl rounded-tl-md border border-border bg-card px-4 md:px-5 py-3.5 md:py-4 shadow-sm"
          >
            {/* "Beak" da bolha apontando pro avatar */}
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
                  prose-strong:text-foreground
                  prose-strong:font-semibold"
              >
                <ReactMarkdown>{displayMarkdown}</ReactMarkdown>
                {/* Caret piscando enquanto o typewriter está digitando */}
                {markdown && displayMarkdown !== markdown && (
                  <span className="inline-block w-[2px] h-4 bg-primary/70 align-text-bottom -mb-0.5 animate-pulse" aria-hidden />
                )}

                {/* Assinatura — só quando terminou de digitar */}
                {markdown && displayMarkdown === markdown && (
                  <p className="mt-4 pt-3 border-t border-border/60 text-caption text-muted-foreground flex items-center gap-1.5">
                    <Sparkles className="h-3 w-3 text-primary/60" />
                    <span>Prof. Sanor — análise gerada agora</span>
                  </p>
                )}
              </motion.div>
            )}

            {!loading && !markdown && (
              <p className="text-body-sm text-muted-foreground flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                Oi, {studentName.split(' ')[0]}! Clique em <span className="font-semibold text-foreground">Pedir análise</span> que eu olho seus simulados com você.
              </p>
            )}
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
