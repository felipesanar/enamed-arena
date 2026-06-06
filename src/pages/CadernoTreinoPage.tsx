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
 * Eventos analytics: `caderno_treino_started` (com área + qtd) ao clicar em Iniciar.
 *
 * Design: redesign premium conforme 07-design-language.md — caderno-root.
 */

import { useState, useEffect, useCallback, useMemo, useRef, type ComponentType } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Dumbbell,
  Zap,
  BookOpen,
  AlertCircle,
  ChevronLeft,
  Target,
  TrendingDown,
  CheckCircle2,
  Clock,
  CalendarClock,
} from 'lucide-react';

import { PageTransition, StaggerContainer, StaggerItem } from '@/components/premium/PageTransition';
import { ProGate } from '@/components/ProGate';
import { WeakAreaPicker } from '@/components/caderno/treino/WeakAreaPicker';
import { TreinoLauncher } from '@/components/caderno/treino/TreinoLauncher';
import {
  PageHeaderPremium,
  SectionHeader,
  CadernoEmptyState,
  CadernoSkeleton,
} from '@/components/caderno/ui';
import { useIsMobile } from '@/hooks/useIsMobile';

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

// ─── Estado de erro de carregamento ──────────────────────────────────────────

function LoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <CadernoEmptyState
      icon={<AlertCircle className="h-8 w-8 text-destructive" />}
      title="Não foi possível carregar o Caderno"
      description="Verifique sua conexão e tente novamente."
      action={
        <button
          type="button"
          onClick={onRetry}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-[var(--c-radius-control)] px-5 py-2.5',
            'text-[13px] font-bold text-white',
            'transition-all duration-[var(--c-duration-base)] hover:opacity-90',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-wine-500)]/50 focus-visible:ring-offset-2',
          )}
          style={{ background: 'linear-gradient(135deg, var(--c-wine-500,#B0294A), var(--c-wine-700,#7A1A32))' }}
        >
          Tentar novamente
        </button>
      }
      className="mx-auto max-w-xl"
    />
  );
}

// ─── Estado sem dados suficientes ─────────────────────────────────────────────

function InsufficientData() {
  return (
    <CadernoEmptyState
      icon={<Dumbbell className="h-8 w-8 text-[var(--c-wine-500)]" />}
      title="Dados insuficientes para o Treino"
      description="Você precisa de pelo menos 3 questões pendentes no caderno para gerar um treino focado. Complete alguns simulados e adicione seus erros ao caderno."
      action={
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            to="/simulados"
            className={cn(
              'inline-flex items-center gap-2 rounded-[var(--c-radius-control)] px-5 py-2.5',
              'text-[13px] font-bold text-white no-underline',
              'shadow-[var(--c-shadow-glow)]',
              'transition-all duration-[var(--c-duration-base)] hover:opacity-90',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-wine-500)]/50 focus-visible:ring-offset-2',
            )}
            style={{ background: 'linear-gradient(135deg, var(--c-wine-500,#B0294A), var(--c-wine-700,#7A1A32))' }}
          >
            <Zap className="h-4 w-4" aria-hidden />
            Ver simulados disponíveis
          </Link>
          <Link
            to="/caderno"
            className={cn(
              'inline-flex items-center gap-2 rounded-[var(--c-radius-control)] border border-[var(--c-border)] px-5 py-2.5',
              'text-[13px] font-semibold text-[var(--c-muted)] no-underline',
              'transition-all duration-[var(--c-duration-base)] hover:border-[var(--c-wine-500)]/30 hover:text-[var(--c-ink)]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-wine-500)]/50 focus-visible:ring-offset-2',
            )}
          >
            <BookOpen className="h-4 w-4" aria-hidden />
            Ver Caderno
          </Link>
        </div>
      }
      className="mx-auto max-w-xl"
    />
  );
}

// ─── Hero premium (desktop) ───────────────────────────────────────────────────

interface TreinoStat {
  label: string;
  value: number | string;
  color: string;
  icon: ComponentType<{ className?: string }>;
}

function TreinoHero({
  title,
  subtitle,
  stats,
  onBack,
}: {
  title: string;
  subtitle: string;
  stats: TreinoStat[];
  onBack: () => void;
}) {
  return (
    <div className="relative mb-6 overflow-hidden rounded-[var(--c-radius-card)] border border-[var(--c-border)] bg-[var(--c-surface)] p-6 shadow-[var(--c-shadow-sm)] lg:p-7">
      {/* Atmosfera */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full opacity-70 blur-[72px]"
        style={{ background: 'var(--c-gradient-glow)' }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--c-wine-500)]/30 to-transparent"
      />

      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        {/* Título */}
        <div className="min-w-0 max-w-xl">
          <button
            type="button"
            onClick={onBack}
            className="mb-3 inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--c-muted)] transition-colors hover:text-[var(--c-wine-500)] focus-visible:outline-none focus-visible:underline"
          >
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
            Voltar ao caderno
          </button>

          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--c-wine-500)]">
            <Target className="h-3.5 w-3.5" aria-hidden />
            Treino focado
          </p>
          <h1 className="mt-1.5 text-heading-1 font-extrabold tracking-[-0.02em] text-[var(--c-ink)]">
            {title}
          </h1>
          <p className="mt-2 text-body text-[var(--c-muted)]">{subtitle}</p>
        </div>

        {/* Stat tiles */}
        <div className="grid grid-cols-3 gap-2.5 lg:shrink-0">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.label}
                className="flex min-w-[92px] flex-col gap-1.5 rounded-[var(--c-radius-control)] border border-[var(--c-border)] bg-[var(--c-surface-2)]/70 px-3.5 py-3"
              >
                <Icon className="h-4 w-4" style={{ color: stat.color }} aria-hidden />
                <span
                  className="text-[26px] font-extrabold leading-none tabular-nums"
                  style={{ color: stat.color }}
                >
                  {stat.value}
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--c-muted)]">
                  {stat.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Explicação do ranking (preenche e educa a coluna esquerda) ───────────────

function RankingExplainer() {
  const criteria: { icon: ComponentType<{ className?: string }>; color: string; title: string; desc: string }[] = [
    {
      icon: Clock,
      color: '#f97316',
      title: 'Erros pendentes',
      desc: 'Quanto mais questões por dominar, maior a prioridade.',
    },
    {
      icon: TrendingDown,
      color: 'var(--c-destructive,#DC2626)',
      title: 'Lapsos de revisão (SRS)',
      desc: 'Temas que você errou de novo após revisar pesam mais.',
    },
    {
      icon: CalendarClock,
      color: 'var(--c-wine-500,#B0294A)',
      title: 'Erros recentes',
      desc: 'O que você errou nos últimos 30 dias sobe no ranking.',
    },
  ];

  return (
    <div className="rounded-[var(--c-radius-card)] border border-dashed border-[var(--c-border)] bg-[var(--c-surface)]/50 p-4">
      <p className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-[var(--c-muted)]">
        Como priorizamos suas áreas
      </p>
      <ul className="mt-3 flex flex-col gap-3">
        {criteria.map((c) => {
          const Icon = c.icon;
          return (
            <li key={c.title} className="flex items-start gap-2.5">
              <span
                className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-[8px] bg-[var(--c-surface-2)]"
                aria-hidden
              >
                <Icon className="h-3.5 w-3.5" style={{ color: c.color }} />
              </span>
              <div className="min-w-0">
                <p className="text-[12.5px] font-bold leading-tight text-[var(--c-ink)]">{c.title}</p>
                <p className="mt-0.5 text-[11.5px] leading-snug text-[var(--c-muted)]">{c.desc}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ─── Conteúdo principal ───────────────────────────────────────────────────────

function CadernoTreinoContent({ userId }: { userId: string }) {
  const isMobile = useIsMobile();
  const navigate = useNavigate();

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

  // analytics: registra visualização após carregar
  useEffect(() => {
    if (loading || tracked.current) return;
    tracked.current = true;
  }, [loading]);

  // ── Derivações ────────────────────────────────────────────────────────────

  const weakAreas = useMemo(() => rankWeakAreas(entries), [entries]);
  const sufficient = useMemo(() => hasSufficientDataForDrill(entries), [entries]);

  // Stats para o PageHeaderPremium
  const pendingCount = useMemo(() => entries.filter((e) => !(e as any).masteredAt).length, [entries]);
  const masteredCount = useMemo(() => entries.filter((e) => !!(e as any).masteredAt).length, [entries]);

  // ── Launcher callback ─────────────────────────────────────────────────────

  const handleLaunch = useCallback((area: RankedWeakArea, count: number, isTimed: boolean) => {
    trackEvent('caderno_treino_started', {
      area: area.area,
      theme: area.theme ?? undefined,
      count,
      timed: isTimed,
    } as any);
  }, []);

  const handleSelectArea = useCallback((area: RankedWeakArea) => {
    setSelectedArea(area);
    if (isMobile) return; // mobile: launcher fica abaixo no flow normal
    // Desktop: scroll suave até o launcher
    setTimeout(() => {
      document.getElementById('treino-launcher')?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }, 120);
  }, [isMobile]);

  // ── Estados de loading / erro / vazio ─────────────────────────────────────

  if (loading) {
    return (
      <div className="caderno-root">
        <CadernoSkeleton count={3} />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="caderno-root">
        <LoadError onRetry={fetchEntries} />
      </div>
    );
  }

  if (!sufficient) {
    return (
      <div className="caderno-root">
        <InsufficientData />
      </div>
    );
  }

  // ── Layout principal ──────────────────────────────────────────────────────

  // Desktop: dois painéis lado a lado (picker + launcher).
  // Mobile: coluna única, launcher aparece abaixo do picker.

  return (
    <div className="caderno-root">
      {/* Header — desktop: hero premium; mobile: MobileAppBar via PageHeaderPremium */}
      {isMobile ? (
        <PageHeaderPremium
          title="Treine seus pontos fracos"
          subtitle="Ranqueamento automático das suas áreas mais fracas pelo histórico de erros."
          onBack={() => navigate('/caderno')}
          stats={[
            { label: 'Pendentes', value: pendingCount, color: '#f97316' },
            { label: 'Áreas fracas', value: weakAreas.length, color: 'var(--c-wine-500,#B0294A)' },
            { label: 'Dominadas', value: masteredCount, color: '#16a34a' },
          ]}
          className="mb-6"
        />
      ) : (
        <TreinoHero
          title="Treine seus pontos fracos"
          subtitle="Ranqueamento automático das suas áreas mais fracas pelo histórico de erros."
          onBack={() => navigate('/caderno')}
          stats={[
            { label: 'Pendentes', value: pendingCount, color: '#f97316', icon: Clock },
            { label: 'Áreas fracas', value: weakAreas.length, color: 'var(--c-wine-500,#B0294A)', icon: TrendingDown },
            { label: 'Dominadas', value: masteredCount, color: '#16a34a', icon: CheckCircle2 },
          ]}
        />
      )}

      <StaggerContainer
        className={cn(
          'gap-6',
          // Desktop: dois painéis. Mobile: coluna única.
          'flex flex-col lg:grid lg:grid-cols-[1fr_400px] lg:items-start',
        )}
      >
        {/* ── Painel esquerdo: picker de área ─────────────────────────── */}
        <StaggerItem>
          <div className="flex flex-col gap-3">
            <SectionHeader
              title="Suas áreas mais fracas"
              count={weakAreas.length}
              description="Ranqueadas por erros pendentes, lapsos SRS e frequência recente. Escolha uma para treinar."
            />

            <WeakAreaPicker
              areas={weakAreas}
              selectedArea={selectedArea}
              onSelectArea={handleSelectArea}
            />

            {/* Dica quando nenhuma área selecionada */}
            {!selectedArea && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center text-[12px] text-[var(--c-muted)] pt-1"
              >
                Selecione uma área acima para configurar seu treino.
              </motion.p>
            )}
          </div>
        </StaggerItem>

        {/* ── Painel direito: launcher ─────────────────────────────────── */}
        <StaggerItem>
          {selectedArea ? (
            <div id="treino-launcher" className="lg:sticky lg:top-6">
              <TreinoLauncher
                area={selectedArea}
                timed={timed}
                onTimedChange={setTimed}
                onLaunch={handleLaunch}
              />
            </div>
          ) : (
            /* Placeholder desktop quando nenhuma área selecionada */
            <div className="hidden lg:flex flex-col items-center justify-center rounded-[var(--c-radius-card)] border border-dashed border-[var(--c-border)] bg-[var(--c-surface)] p-10 text-center min-h-[280px]">
              <div
                className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
                style={{ background: 'linear-gradient(135deg, var(--c-wine-500,#B0294A)/10, var(--c-wine-500,#B0294A)/5)' }}
                aria-hidden
              >
                <Dumbbell className="h-6 w-6 text-[var(--c-wine-500)]" />
              </div>
              <p className="text-[13px] font-semibold text-[var(--c-ink)]">
                Selecione uma área
              </p>
              <p className="mt-1 text-[12px] text-[var(--c-muted)] max-w-[180px]">
                As opções de treino aparecerão aqui.
              </p>
            </div>
          )}
        </StaggerItem>
      </StaggerContainer>
    </div>
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
