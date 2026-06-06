/**
 * CadernoTreinoPage — Treino do Meu Caderno (Inovação I10, Fase 3).
 *
 * Rota: /caderno/treino  (gate PRO, sem novas tabelas ou RPCs).
 *
 * Fluxo:
 *   1. Carrega entradas via getErrorNotebook (já disponível).
 *   2. Rankeia áreas/temas mais fracos (lib/weakAreas.ts — função pura).
 *   3. Aluno escolhe uma área e a quantidade de questões.
 *   4. CTAs lançam:
 *      a) Sessão de recall existente: /caderno/revisao?mode=drill&area=<área>[&theme=<tema>]
 *         → useActiveRecallSession consumirá `mode=drill` em evolução futura;
 *           atualmente CadernoRevisaoV2Page ignora params extras de forma segura.
 *      b) Questões novas do banco: /simulados?area=<área>[&theme=<tema>]
 *
 * NOTA: A versão "mini-simulado cronometrado próprio" é evolução futura (I10).
 * Esta página é o LANÇADOR inteligente descrito na spec §13.
 *
 * Eventos analytics: `caderno_treino_started` (com área + qtd) ao clicar em Iniciar.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Dumbbell, ArrowLeft, Zap, BookOpen } from 'lucide-react';

import { PageTransition, StaggerContainer, StaggerItem } from '@/components/premium/PageTransition';
import { ProGate } from '@/components/ProGate';
import { CadernoSkeleton } from '@/components/caderno/CadernoSkeleton';
import { TabBar } from '@/components/caderno/TabBar';
import { WeakAreaPicker } from '@/components/caderno/treino/WeakAreaPicker';
import { TreinoLauncher } from '@/components/caderno/treino/TreinoLauncher';

import { useAuth } from '@/contexts/AuthContext';
import { useUser } from '@/contexts/UserContext';
import { SEGMENT_ACCESS } from '@/types';
import { simuladosApi } from '@/services/simuladosApi';
import { logger } from '@/lib/logger';
import { toast } from '@/hooks/use-toast';
import { trackEvent } from '@/lib/analytics';
import { cn } from '@/lib/utils';
import {
  rankWeakAreas,
  hasSufficientDataForDrill,
  type WeakAreaEntry,
  type RankedWeakArea,
} from '@/lib/weakAreas';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function rowToWeakAreaEntry(row: any): WeakAreaEntry {
  return {
    id: row.id,
    area: row.area ?? null,
    theme: row.theme ?? null,
    reason: row.reason ?? 'did_not_know',
    addedAt: row.created_at,
    masteredAt: (row.mastered_at as string | null) ?? null,
    srsLapses: (row.srs_lapses as number | null) ?? null,
    srsReps: (row.srs_reps as number | null) ?? null,
    srsDueAt: (row.srs_due_at as string | null) ?? null,
  };
}

// ─── CadernoTreinoContent ─────────────────────────────────────────────────────

function CadernoTreinoContent({ userId }: { userId: string }) {
  const [entries, setEntries] = useState<WeakAreaEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [selectedArea, setSelectedArea] = useState<RankedWeakArea | null>(null);
  const [timed, setTimed] = useState(false);

  const tracked = useRef(false);

  // ── Carrega entradas ──────────────────────────────────────────────────────

  const fetchEntries = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setLoadError(false);
    try {
      const data = await simuladosApi.getErrorNotebook(userId);
      setEntries(data.map(rowToWeakAreaEntry));
    } catch (err) {
      logger.error('[CadernoTreinoPage] Error loading entries:', err);
      setLoadError(true);
      toast({
        title: 'Não foi possível carregar o Caderno',
        description: 'Verifique sua conexão e tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  // Analytics: visualização
  useEffect(() => {
    if (loading || tracked.current) return;
    tracked.current = true;
    trackEvent('caderno_erros_viewed', {
      source: 'treino',
      total_errors: entries.length,
    });
  }, [loading, entries.length]);

  // ── Derivações ────────────────────────────────────────────────────────────

  const weakAreas = useMemo(() => rankWeakAreas(entries), [entries]);
  const sufficient = useMemo(() => hasSufficientDataForDrill(entries), [entries]);

  // ── Launcher callback ─────────────────────────────────────────────────────

  const handleLaunch = useCallback((area: RankedWeakArea, count: number, isTimed: boolean) => {
    trackEvent('caderno_treino_started', {
      area: area.area,
      theme: area.theme ?? undefined,
      count,
      timed: isTimed,
    } as any);
  }, []);

  // ── Estados ───────────────────────────────────────────────────────────────

  if (loading) return <CadernoSkeleton />;

  if (loadError) {
    return (
      <div className="mx-auto max-w-xl rounded-3xl border-2 border-dashed border-destructive/25 bg-destructive/[0.04] p-10 text-center">
        <p className="text-body text-foreground font-semibold">Não foi possível carregar o Caderno</p>
        <p className="mt-1 text-body-sm text-muted-foreground">Verifique sua conexão e tente novamente.</p>
        <button
          type="button"
          onClick={fetchEntries}
          className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground transition hover:bg-wine-hover"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  // Sem dados suficientes → CTA para resolver simulados
  if (!sufficient) {
    return (
      <div className="mx-auto max-w-xl rounded-3xl border-2 border-dashed border-primary/25 bg-primary/[0.04] p-10 text-center">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent">
          <Dumbbell className="h-7 w-7 text-primary" aria-hidden />
        </div>
        <h3 className="text-heading-2 text-foreground">Dados insuficientes para o Treino</h3>
        <p className="mx-auto mt-2 max-w-md text-body leading-relaxed text-muted-foreground">
          Você precisa de pelo menos <strong className="text-foreground">3 questões pendentes</strong> no
          caderno para gerar um treino focado. Complete alguns simulados e adicione seus erros ao caderno.
        </p>
        <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            to="/simulados"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-body-sm font-semibold text-primary-foreground shadow-[0_4px_14px_-4px_hsl(345_65%_30%/0.4)] transition-all duration-200 hover:bg-wine-hover no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <Zap className="h-4 w-4" aria-hidden />
            Ver simulados disponíveis
          </Link>
          <Link
            to="/caderno"
            className="inline-flex items-center gap-2 rounded-xl border border-border px-5 py-2.5 text-body-sm font-semibold text-muted-foreground no-underline transition-all duration-200 hover:border-primary/30 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <BookOpen className="h-4 w-4" aria-hidden />
            Ver Caderno
          </Link>
        </div>
      </div>
    );
  }

  // ── Layout principal ──────────────────────────────────────────────────────

  return (
    <StaggerContainer className="space-y-6 md:space-y-7">
      {/* Hero do Treino */}
      <StaggerItem>
        <div
          className={cn(
            'relative overflow-hidden rounded-[22px]',
            'bg-[radial-gradient(ellipse_140%_90%_at_0%_0%,hsl(345_65%_22%)_0%,hsl(225_25%_10%)_60%,hsl(222_28%_8%)_100%)]',
            'border border-white/[0.06] p-7',
          )}
        >
          {/* Atmospheric layers */}
          <div aria-hidden className="pointer-events-none absolute -left-14 -top-14 h-56 w-56 rounded-full bg-primary/20 blur-[72px]" />
          <div aria-hidden className="pointer-events-none absolute -right-10 -bottom-10 h-44 w-44 rounded-full bg-primary/10 blur-[48px]" />
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.1] to-transparent" />

          <div className="relative z-10">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <span className="inline-block rounded-full border border-primary/30 bg-primary/20 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-primary mb-2">
                  PRO
                </span>
                <h2 className="text-[22px] font-extrabold leading-tight tracking-[-0.03em] text-white md:text-[26px] flex items-center gap-2">
                  <Dumbbell className="h-6 w-6 text-primary" aria-hidden />
                  Treino do Meu Caderno
                </h2>
                <p className="mt-1 text-[12px] text-white/50">
                  Treine focado nas suas áreas mais fracas — identificadas pelo seu histórico de erros.
                </p>
              </div>
            </div>

            {/* Stats rápidos */}
            <div className="grid grid-cols-3 gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
              <div className="text-center">
                <div className="text-[22px] font-extrabold leading-none tracking-[-0.04em] tabular-nums text-orange-300">
                  {entries.filter((e) => !(e as any).masteredAt).length}
                </div>
                <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-white/45">
                  Pendentes
                </div>
              </div>
              <div className="text-center">
                <div className="text-[22px] font-extrabold leading-none tracking-[-0.04em] tabular-nums text-white">
                  {weakAreas.length}
                </div>
                <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-white/45">
                  Áreas fracas
                </div>
              </div>
              <div className="text-center">
                <div className="text-[22px] font-extrabold leading-none tracking-[-0.04em] tabular-nums text-emerald-300">
                  {entries.filter((e) => (e as any).masteredAt).length}
                </div>
                <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-white/45">
                  Dominadas
                </div>
              </div>
            </div>
          </div>
        </div>
      </StaggerItem>

      {/* Picker de área */}
      <StaggerItem>
        <div className="space-y-3">
          <div>
            <h3 className="text-[15px] font-bold text-foreground">
              Suas áreas mais fracas
            </h3>
            <p className="text-caption text-muted-foreground mt-0.5">
              Ranqueadas por erros pendentes, lapsos SRS e frequência recente. Escolha uma para treinar.
            </p>
          </div>
          <WeakAreaPicker
            areas={weakAreas}
            selectedArea={selectedArea}
            onSelectArea={(area) => {
              setSelectedArea(area);
              // Scroll suave até o launcher após seleção
              setTimeout(() => {
                document.getElementById('treino-launcher')?.scrollIntoView({
                  behavior: 'smooth',
                  block: 'nearest',
                });
              }, 100);
            }}
          />
        </div>
      </StaggerItem>

      {/* Launcher — aparece ao selecionar uma área */}
      {selectedArea && (
        <StaggerItem>
          <motion.div
            id="treino-launcher"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
          >
            <TreinoLauncher
              area={selectedArea}
              timed={timed}
              onTimedChange={setTimed}
              onLaunch={handleLaunch}
            />
          </motion.div>
        </StaggerItem>
      )}

      {/* Dica quando nenhuma área selecionada */}
      {!selectedArea && (
        <StaggerItem>
          <p className="text-center text-caption text-muted-foreground">
            Selecione uma área acima para ver as opções de treino.
          </p>
        </StaggerItem>
      )}
    </StaggerContainer>
  );
}

// ─── Page export ───────────────────────────────────────────────────────────────

export default function CadernoTreinoPage() {
  const { profile } = useUser();
  const { user } = useAuth();
  const segment = profile?.segment ?? 'guest';
  const hasAccess = SEGMENT_ACCESS[segment].cadernoErros;

  return (
    <PageTransition>
      {/* Navegação back + TabBar */}
      <div className="mb-4">
        <Link
          to="/caderno"
          className="inline-flex items-center gap-1.5 text-caption font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:underline"
          aria-label="Voltar ao Caderno"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Caderno
        </Link>
      </div>

      <TabBar />

      {!hasAccess ? (
        <ProGate
          icon={Dumbbell}
          feature="Treino do Meu Caderno"
          description="Treine focado nas suas áreas mais fracas, identificadas pelo seu histórico de erros no caderno."
          requiredSegment="pro"
          currentSegment={segment}
          benefits={[
            'Identificação automática das suas áreas mais fracas',
            'Treino focado com filtro por área e quantidade',
            'Integrado ao seu caderno de erros e sessão de recall',
          ]}
        />
      ) : (
        <CadernoTreinoContent userId={user?.id ?? ''} />
      )}
    </PageTransition>
  );
}
