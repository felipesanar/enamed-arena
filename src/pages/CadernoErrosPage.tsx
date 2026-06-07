import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  BookOpen,
  Zap,
  ChevronDown,
  Play,
} from 'lucide-react';

import { trackEvent } from '@/lib/analytics';
import { logger } from '@/lib/logger';
import { toast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';

import { PageTransition, StaggerContainer, StaggerItem } from '@/components/premium/PageTransition';
import { PageHeader } from '@/components/PageHeader';
import { ProGate } from '@/components/ProGate';
import { EmptyState } from '@/components/EmptyState';

import { useUser } from '@/contexts/UserContext';
import { useAuth } from '@/contexts/AuthContext';
import { simuladosApi } from '@/services/simuladosApi';
import { SEGMENT_ACCESS } from '@/types';
import { type DbReason } from '@/lib/errorNotebookReasons';
import { ProfSanorAvatar } from '@/components/comparativo/ProfSanorAvatar';

import {
  type NotebookEntry,
  type TypeFilter,
  calcStreak,
  pluralize,
} from '@/components/caderno/helpers';
import { HeroStatusCard } from '@/components/caderno/HeroStatusCard';
import { FilterBar } from '@/components/caderno/FilterBarLegacy';
import { QueueRow } from '@/components/caderno/QueueRow';
import { ZeroPendingCard } from '@/components/caderno/ZeroPendingCard';
import { CadernoSkeleton } from '@/components/caderno/CadernoSkeleton';
import { getReasonMeta } from '@/lib/errorNotebookReasons';

/* ──────────────────────────────────────────────────────────────────────────
 * CadernoContent
 * ────────────────────────────────────────────────────────────────────────── */

function CadernoContent({ userId }: { userId: string }) {
  const prefersReducedMotion = useReducedMotion();
  const { profile } = useUser();
  const [entries, setEntries] = useState<NotebookEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [specFilter, setSpecFilter] = useState<string | null>(null);
  const [showResolved, setShowResolved] = useState(false);

  const errosTracked = useRef(false);

  const fetchEntries = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setLoadError(false);
    try {
      const data = await simuladosApi.getErrorNotebook(userId);
      setEntries(
        data.map((row) => ({
          id: row.id,
          questionId: row.question_id,
          simuladoId: row.simulado_id,
          simuladoTitle: row.simulado_title || null,
          area: row.area,
          theme: row.theme,
          questionNumber: row.question_number || null,
          reason: row.reason,
          learningNote: row.learning_text,
          wasCorrect: row.was_correct,
          addedAt: row.created_at,
          resolvedAt: row.resolved_at || null,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          nextReviewAt: ((row as any).next_review_at as string | null) || null,
        })),
      );
    } catch (err) {
      logger.error('[CadernoErrosPage] Error loading:', err);
      setLoadError(true);
      toast({
        title: 'Não foi possível carregar o caderno',
        description: 'Verifique sua conexão e tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const specialties = useMemo(
    () => Array.from(new Set(entries.map((e) => e.area).filter(Boolean) as string[])).sort(),
    [entries],
  );

  const filtered = useMemo(() => {
    let data = entries;
    if (typeFilter !== 'all') data = data.filter((e) => e.reason === typeFilter);
    if (specFilter) data = data.filter((e) => e.area === specFilter);
    return [...data].sort(
      (a, b) => new Date(a.addedAt).getTime() - new Date(b.addedAt).getTime(),
    );
  }, [entries, typeFilter, specFilter]);

  // Snoozed = next_review_at no futuro. Saem da fila ativa mas continuam
  // visíveis numa seção própria pra evitar surpresa do tipo "sumiu".
  const now = Date.now();
  const isSnoozed = (e: NotebookEntry) =>
    !!e.nextReviewAt && new Date(e.nextReviewAt).getTime() > now;

  const pending = useMemo(
    () => filtered.filter((e) => !e.resolvedAt && !isSnoozed(e)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filtered],
  );
  const snoozed = useMemo(
    () => filtered.filter((e) => !e.resolvedAt && isSnoozed(e)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filtered],
  );
  const resolved = useMemo(() => filtered.filter((e) => !!e.resolvedAt), [filtered]);
  const streak = useMemo(() => calcStreak(entries), [entries]);

  const totalPending = entries.filter((e) => !e.resolvedAt && !isSnoozed(e)).length;
  const totalResolved = entries.filter((e) => !!e.resolvedAt).length;
  const totalSnoozed = entries.filter((e) => !e.resolvedAt && isSnoozed(e)).length;
  const allResolved = entries.length > 0 && totalPending === 0 && totalSnoozed === 0;

  const typeOptions = useMemo(
    () => Array.from(new Set(entries.map((e) => e.reason as DbReason))),
    [entries],
  );

  // Analytics
  useEffect(() => {
    if (loading || errosTracked.current) return;
    errosTracked.current = true;
    trackEvent('caderno_erros_viewed', {
      total_errors: entries.length,
      segment: profile?.segment ?? 'guest',
    });
  }, [loading, entries.length, profile?.segment]);

  const prevFiltersRef = useRef<{ type: TypeFilter; spec: string | null } | null>(null);
  useEffect(() => {
    if (loading) return;
    if (!prevFiltersRef.current) {
      prevFiltersRef.current = { type: typeFilter, spec: specFilter };
      return;
    }
    const prev = prevFiltersRef.current;
    const ft =
      prev.type !== typeFilter
        ? 'reason'
        : prev.spec !== specFilter
          ? 'specialty'
          : null;
    if (ft) {
      trackEvent('caderno_erros_filtered', {
        filter_type: ft,
        result_count: filtered.length,
      });
      prevFiltersRef.current = { type: typeFilter, spec: specFilter };
    }
  }, [typeFilter, specFilter, loading, filtered.length]);

  const handleRemove = async (id: string) => {
    const previousEntries = entries;
    const target = entries.find((e) => e.id === id);
    if (!target) return;

    setEntries((prev) => prev.filter((e) => e.id !== id));

    let undone = false;
    const t = toast({
      title: 'Item removido do caderno',
      description: `Q${target.questionNumber ?? '?'} · ${target.area ?? '—'}`,
      duration: 5000,
      action: (
        <ToastAction
          altText="Desfazer remoção"
          onClick={() => {
            undone = true;
            setEntries(previousEntries);
            t.dismiss();
          }}
        >
          Desfazer
        </ToastAction>
      ),
    });

    setTimeout(async () => {
      if (undone) return;
      try {
        await simuladosApi.deleteErrorNotebookEntry(id, userId);
      } catch (err) {
        logger.error('[CadernoErrosPage] Error removing:', err);
        setEntries(previousEntries);
        toast({
          title: 'Não foi possível remover',
          description: 'Tente novamente em instantes.',
          variant: 'destructive',
        });
      }
    }, 5000);
  };

  const handleToggleResolved = async (id: string, resolvedNow: boolean) => {
    const previousEntries = entries;
    setEntries((prev) =>
      prev.map((e) =>
        e.id === id
          ? { ...e, resolvedAt: resolvedNow ? new Date().toISOString() : null }
          : e,
      ),
    );
    try {
      await simuladosApi.toggleResolvedEntry(id, userId, resolvedNow);
      toast({ title: resolvedNow ? 'Marcado como resolvido' : 'Reaberto' });
    } catch (err) {
      logger.error('[CadernoErrosPage] Error toggling:', err);
      setEntries(previousEntries);
      toast({
        title: 'Não foi possível atualizar',
        description: 'Tente novamente em instantes.',
        variant: 'destructive',
      });
    }
  };

  /* ── Loading ── */
  if (loading) {
    return <CadernoSkeleton />;
  }

  /* ── Load error ── */
  if (loadError && entries.length === 0) {
    return (
      <EmptyState
        variant="error"
        title="Não foi possível carregar o Caderno"
        description="Houve um problema de conexão com o servidor. Verifique sua internet e tente novamente."
        onRetry={fetchEntries}
      />
    );
  }

  /* ── Empty (never added anything) ── */
  if (entries.length === 0) {
    return (
      <div className="mx-auto max-w-xl rounded-3xl border-2 border-dashed border-primary/25 bg-primary/[0.04] p-10 text-center">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent">
          <BookOpen className="h-7 w-7 text-primary" aria-hidden />
        </div>
        <h3 className="text-heading-2 text-foreground">Seu Caderno está vazio</h3>
        <p className="mx-auto mt-2 max-w-md text-body text-muted-foreground leading-relaxed">
          Na correção do simulado, toque em <strong className="font-semibold text-foreground">"Salvar no Caderno"</strong>{' '}
          para adicionar questões que quer dominar.
        </p>
        <Link
          to="/simulados"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-body-sm font-semibold text-primary-foreground shadow-[0_4px_14px_-4px_hsl(345_65%_30%/0.4)] transition-all duration-200 hover:bg-wine-hover hover:shadow-[0_6px_18px_-4px_hsl(345_65%_30%/0.5)] no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.99]"
        >
          <Zap className="h-4 w-4" aria-hidden />
          Ver simulados disponíveis
        </Link>
      </div>
    );
  }

  /* ── Main layout ── */
  return (
    <StaggerContainer className="space-y-5 md:space-y-6">
      {/* Hero status */}
      <StaggerItem>
        <HeroStatusCard
          pending={totalPending}
          resolved={totalResolved}
          total={entries.length}
          specialties={specialties.length}
          streak={streak}
          prefersReducedMotion={!!prefersReducedMotion}
        />
      </StaggerItem>

      {/* Filters */}
      <StaggerItem>
        <FilterBar
          entries={entries}
          typeOptions={typeOptions}
          specialties={specialties}
          typeFilter={typeFilter}
          specFilter={specFilter}
          onTypeChange={setTypeFilter}
          onSpecChange={setSpecFilter}
        />
      </StaggerItem>

      {/* Body */}
      {allResolved && (
        <StaggerItem>
          <ZeroPendingCard
            resolvedCount={totalResolved}
            streak={streak}
            onShowResolved={() => setShowResolved(true)}
          />
        </StaggerItem>
      )}

      {!allResolved && filtered.length === 0 && (
        <StaggerItem>
          <div className="rounded-2xl border border-dashed border-border bg-card/50 px-6 py-12 text-center">
            <p className="text-body-sm text-muted-foreground">
              Nenhuma questão corresponde aos filtros selecionados.
            </p>
            <button
              type="button"
              onClick={() => {
                setTypeFilter('all');
                setSpecFilter(null);
              }}
              className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-semibold text-primary hover:text-wine-hover focus-visible:outline-none focus-visible:underline"
            >
              Limpar filtros
            </button>
          </div>
        </StaggerItem>
      )}

      {!allResolved && totalPending > 0 && (
        <StaggerItem>
          <Link
            to="/caderno-erros/revisao"
            onClick={() =>
              trackEvent('caderno_revisao_cta_clicked', {
                source: 'caderno_hero',
                pending: totalPending,
              })
            }
            className="group relative flex items-center justify-between gap-4 overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/[0.06] via-primary/[0.04] to-transparent px-5 py-4 no-underline transition-all duration-200 hover:border-primary/40 hover:shadow-[0_8px_24px_-12px_hsl(345_65%_30%/0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative shrink-0">
                <div className="rounded-full bg-primary/[0.04] border-2 border-background shadow-sm overflow-hidden">
                  <ProfSanorAvatar size={44} />
                </div>
                <span
                  className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-success border-2 border-background"
                  aria-hidden
                />
              </div>
              <div className="min-w-0">
                <p className="text-body font-bold text-foreground">
                  Modo revisão com Prof. San
                </p>
                <p className="text-caption text-muted-foreground">
                  Revise as {totalPending} {pluralize(totalPending, 'pendente', 'pendentes')} uma a uma com análise da IA.
                </p>
              </div>
            </div>
            <div className="hidden sm:flex shrink-0 items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground shadow-[0_4px_14px_-4px_hsl(345_65%_30%/0.4)] transition-transform group-hover:scale-[1.02]">
              <Play className="h-3.5 w-3.5 fill-current" aria-hidden />
              Iniciar
            </div>
          </Link>
        </StaggerItem>
      )}

      {!allResolved && pending.length > 0 && (
        <StaggerItem>
          <div>
            <div className="mb-2.5 flex items-center justify-between">
              <span className="text-overline font-bold uppercase tracking-wider text-muted-foreground">
                Pendentes
              </span>
              <span className="text-caption text-muted-foreground">
                {pending.length} {pluralize(pending.length, 'questão', 'questões')}
              </span>
            </div>
            <motion.div
              className="flex flex-col gap-2"
              initial="hidden"
              animate="visible"
              variants={{
                visible: {
                  transition: { staggerChildren: prefersReducedMotion ? 0 : 0.04 },
                },
                hidden: {},
              }}
            >
              {pending.map((entry) => (
                <motion.div
                  key={entry.id}
                  variants={{
                    hidden: prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 6 },
                    visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
                  }}
                >
                  <QueueRow
                    entry={entry}
                    onRemove={handleRemove}
                    onToggleResolved={handleToggleResolved}
                  />
                </motion.div>
              ))}
            </motion.div>
          </div>
        </StaggerItem>
      )}

      {/* Snoozed section — questões agendadas pra revisar mais tarde */}
      {snoozed.length > 0 && (
        <StaggerItem>
          <div>
            <div className="mb-2.5 flex items-center justify-between">
              <span className="text-overline font-bold uppercase tracking-wider text-muted-foreground">
                Agendadas para revisar
              </span>
              <span className="text-caption text-muted-foreground">
                {snoozed.length} {pluralize(snoozed.length, 'agendada', 'agendadas')}
              </span>
            </div>
            <div className="flex flex-col gap-2">
              {snoozed.map((entry) => {
                const meta = getReasonMeta(entry.reason);
                const daysUntil = entry.nextReviewAt
                  ? Math.max(
                      1,
                      Math.ceil(
                        (new Date(entry.nextReviewAt).getTime() - Date.now()) /
                          (1000 * 60 * 60 * 24),
                      ),
                    )
                  : 0;
                return (
                  <div
                    key={entry.id}
                    className="flex items-stretch gap-3 rounded-xl border border-border bg-muted/30 px-3 py-2.5 opacity-80"
                  >
                    <div
                      aria-hidden
                      className="w-[3px] shrink-0 self-stretch rounded-full"
                      style={{ background: meta.colorBase }}
                    />
                    <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
                      <div className="truncate text-[13px] font-semibold text-foreground">
                        Q{entry.questionNumber ?? '?'} · {entry.area ?? '—'}
                        {entry.theme ? ` — ${entry.theme}` : ''}
                      </div>
                      <div className="truncate text-[11px] text-muted-foreground">
                        Volta em {daysUntil} {pluralize(daysUntil, 'dia', 'dias')}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </StaggerItem>
      )}

      {/* Resolved section — collapsible */}
      {resolved.length > 0 && (
        <StaggerItem>
          <div>
            {!showResolved ? (
              <button
                type="button"
                onClick={() => setShowResolved(true)}
                className="inline-flex items-center gap-1.5 text-caption font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:underline"
              >
                Ver {resolved.length} {pluralize(resolved.length, 'questão resolvida', 'questões resolvidas')}
                <ChevronDown className="h-3.5 w-3.5" aria-hidden />
              </button>
            ) : (
              <AnimatePresence>
                <motion.div
                  initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="mb-2.5 flex items-center justify-between">
                    <span className="text-overline font-bold uppercase tracking-wider text-muted-foreground">
                      Resolvidas
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowResolved(false)}
                      className="text-caption text-muted-foreground transition-colors hover:text-foreground"
                    >
                      Ocultar
                    </button>
                  </div>
                  <div className="flex flex-col gap-2">
                    {resolved.map((entry) => (
                      <QueueRow
                        key={entry.id}
                        entry={entry}
                        onRemove={handleRemove}
                        onToggleResolved={handleToggleResolved}
                      />
                    ))}
                  </div>
                </motion.div>
              </AnimatePresence>
            )}
          </div>
        </StaggerItem>
      )}
    </StaggerContainer>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Page export
 * ────────────────────────────────────────────────────────────────────────── */

export default function CadernoErrosPage() {
  const { profile } = useUser();
  const { user } = useAuth();
  const segment = profile?.segment ?? 'guest';
  const hasAccess = SEGMENT_ACCESS[segment].cadernoErros;

  return (
    <PageTransition>
      <PageHeader
        title="Caderno de Erros"
        subtitle="Sua ferramenta de revisão ativa para dominar o que importa."
        badge="PRO: ENAMED Exclusivo"
      />

      {!hasAccess ? (
        <ProGate
          icon={BookOpen}
          feature="Caderno de Erros"
          description="Salve questões com motivo e anotação de aprendizado. Organize sua revisão por área e tipo de erro para estudar de forma estratégica."
          requiredSegment="pro"
          currentSegment={segment}
          benefits={[
            'Salvar questões direto da correção com motivo (errou, sem certeza)',
            'Anotação de aprendizado por questão',
            'Filtrar e revisar por área, tipo de erro e especialidade',
          ]}
        />
      ) : (
        <CadernoContent userId={user?.id || ''} />
      )}
    </PageTransition>
  );
}
