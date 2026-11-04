/**
 * CadernoPage — casca premium do Caderno de Erros v2 (redesign visual).
 *
 * Rota: /caderno  (gate PRO + feature flag caderno_v2_enabled).
 * Aba ativa: Revisar.
 *
 * Layout:
 *  Desktop — PageHeaderPremium (stats + gradiente CTA), TabBar sticky,
 *             faixa de FilterChips, lista em coluna max-w-[1120px] centralizada,
 *             QueueSections com SectionHeader, BulkActionBar pill flutuante.
 *  Mobile  — MobileAppBar (via PageHeaderPremium), SegmentedTabs, cards 1 col
 *             confortáveis, BottomActionBar em seleção, swipe no card.
 *
 * Preservado integralmente: hooks/queries, handlers, busca, analytics, gate PRO,
 * CadernoExportMenu, CTAs Reta Final/Treino, ZeroPendingState.
 */

import '@/components/caderno/ui/caderno-theme.css';

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  BookOpen,
  Zap,
  ChevronDown,
  CheckSquare,
} from 'lucide-react';

import { trackEvent } from '@/lib/analytics';
import { logger } from '@/lib/logger';
import { toast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { cn } from '@/lib/utils';

import { PageTransition } from '@/components/premium/PageTransition';
import { ProGate } from '@/components/ProGate';
import { EmptyState } from '@/components/EmptyState';

import { useUser } from '@/contexts/UserContext';
import { useAuth } from '@/contexts/AuthContext';
import { SEGMENT_ACCESS } from '@/types';
import { type DbReason } from '@/lib/errorNotebookReasons';
import { simuladosApi } from '@/services/simuladosApi';
import { useAppConfig } from '@/hooks/useAppConfig';
import { useNotebookEditionFilter } from '@/hooks/useNotebookEditionFilter';
import { useNotebookPage } from '@/hooks/useNotebookPage';
import { NotebookEditionSelector, notebookControlClass } from '@/components/caderno/NotebookEditionSelector';
import { NotebookPagination } from '@/components/caderno/NotebookPagination';
import { DB_REASON_META } from '@/lib/errorNotebookReasons';
import type { NotebookFilters } from '@/types/notebook-pagination';
import { notebookEditionLink } from '@/lib/notebookEditionLinks';

import { CadernoHero } from '@/components/caderno/CadernoHero';
import { CadernoModeCards } from '@/components/caderno/CadernoModeCards';
import { useExamEditions } from '@/hooks/useExamEditions';
import { getDaysUntil } from '@/lib/editions';
import { FilterBar, type CausaFilter } from '@/components/caderno/FilterBar';
import { CadernoExportMenu } from '@/components/caderno/CadernoExportMenu';
import { ZeroPendingState } from '@/components/caderno/ZeroPendingState';
import { BulkActionBar } from '@/components/caderno/BulkActionBar';
import {
  NotebookEntryCard,
  type NotebookEntry,
} from '@/components/caderno/NotebookEntryCard';

import {
  SectionHeader,
  CadernoEmptyState,
  CadernoSkeleton,
} from '@/components/caderno/ui';

/* ── Helpers ── */

function calcStreak(entries: NotebookEntry[]): number {
  const dates = new Set(
    entries
      .filter((e) => e.resolvedAt)
      .map((e) => new Date(e.resolvedAt!).toISOString().split('T')[0]),
  );
  if (!dates.size) return 0;
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    if (dates.has(d.toISOString().split('T')[0])) streak++;
    else break;
  }
  return streak;
}

function pluralize(n: number, s: string, p: string) {
  return n === 1 ? s : p;
}

function classifyEntry(entry: NotebookEntry, now: number) {
  const masteredAt = (entry as any).masteredAt ?? (entry as any).mastered_at ?? entry.resolvedAt;
  if (masteredAt) return 'dominadas' as const;

  const srsDueAt = (entry as any).srsDueAt ?? (entry as any).srs_due_at ?? entry.nextReviewAt;
  const srsReps: number = (entry as any).srsReps ?? (entry as any).srs_reps ?? 0;
  const srsInterval: number = (entry as any).srsInterval ?? (entry as any).srs_interval ?? 0;

  if (!srsDueAt || new Date(srsDueAt).getTime() <= now) return 'devidas' as const;
  if (srsReps >= 1 && srsInterval <= 14) return 'emAprendizado' as const;
  return 'agendadas' as const;
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/* ── CadernoContent ── */

function CadernoContent({ userId }: { userId: string }) {
  const { nextEdition } = useExamEditions();
  const prefersReducedMotion = useReducedMotion();
  const { profile } = useUser();

  const [entries, setEntries] = useState<NotebookEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [typeFilter, setTypeFilter] = useState<CausaFilter>('all');
  const [specFilter, setSpecFilter] = useState<string | null>(null);
  const [searchRaw, setSearchRaw] = useState('');
  const searchDebounced = useDebounce(searchRaw, 300);
  const [showDominadas, setShowDominadas] = useState(false);

  // Seleção em lote — `isSelectMode` é um estado EXPLÍCITO (não derivado de
  // selectedIds.size), senão os cards nunca ficariam selecionáveis com zero
  // itens marcados e seria impossível iniciar uma seleção.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [isSelectMode, setIsSelectMode] = useState(false);

  const tracked = useRef(false);

  const fetchEntries = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setLoadError(false);
    try {
      const data = await simuladosApi.getErrorNotebook(userId);
      setEntries(
        data.map((row: any) => ({
          id: row.id,
          questionId: row.question_id ?? null,
          simuladoId: row.simulado_id ?? null,
          simuladoTitle: row.simulado_title ?? null,
          area: row.area ?? null,
          theme: row.theme ?? null,
          questionNumber: row.question_number ?? null,
          reason: row.reason,
          learningNote: row.learning_text ?? null,
          wasCorrect: row.was_correct ?? false,
          addedAt: row.created_at,
          resolvedAt: row.resolved_at ?? null,
          nextReviewAt: (row.next_review_at as string | null) ?? null,
          srsReps: (row.srs_reps as number | null) ?? null,
          srsDueAt: (row.srs_due_at as string | null) ?? null,
          srsInterval: (row.srs_interval as number | null) ?? null,
          masteredAt: (row.mastered_at as string | null) ?? null,
          questionText: (row.question_text as string | null) ?? null,
        })),
      );
    } catch (err) {
      logger.error('[CadernoPage] Error loading entries:', err);
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

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  useEffect(() => {
    if (loading || tracked.current) return;
    tracked.current = true;
    trackEvent('caderno_erros_viewed', {
      total_errors: entries.length,
      segment: profile?.segment ?? 'guest',
      shell_version: 'v2',
    });
  }, [loading, entries.length, profile?.segment]);

  const filterTrackRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (loading) return;
    if (filterTrackRef.current) clearTimeout(filterTrackRef.current);
    filterTrackRef.current = setTimeout(() => {
      trackEvent('caderno_erros_filtered', {
        type_filter: typeFilter,
        spec_filter: specFilter ?? 'all',
        has_search: searchDebounced.trim().length > 0,
      });
    }, 600);
    return () => { if (filterTrackRef.current) clearTimeout(filterTrackRef.current); };
  }, [typeFilter, specFilter, searchDebounced, loading]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isSelectMode) {
        setSelectedIds(new Set());
        setIsSelectMode(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isSelectMode]);

  const specialties = useMemo(
    () => Array.from(new Set(entries.map((e) => e.area).filter(Boolean) as string[])).sort(),
    [entries],
  );

  const typeOptions = useMemo(
    () => Array.from(new Set(entries.map((e) => e.reason as DbReason))),
    [entries],
  );

  const typeCounts = useMemo(() => {
    const counts: Partial<Record<DbReason, number>> = {};
    for (const e of entries) {
      const r = e.reason as DbReason;
      counts[r] = (counts[r] ?? 0) + 1;
    }
    return counts;
  }, [entries]);

  const filtered = useMemo(() => {
    let data = entries;
    if (typeFilter !== 'all') data = data.filter((e) => e.reason === typeFilter);
    if (specFilter) data = data.filter((e) => e.area === specFilter);
    if (searchDebounced.trim()) {
      const q = searchDebounced.toLowerCase();
      data = data.filter(
        (e) =>
          e.area?.toLowerCase().includes(q) ||
          e.theme?.toLowerCase().includes(q) ||
          e.simuladoTitle?.toLowerCase().includes(q) ||
          String(e.questionNumber).includes(q) ||
          e.questionText?.toLowerCase().includes(q) ||
          e.learningNote?.toLowerCase().includes(q),
      );
    }
    return data;
  }, [entries, typeFilter, specFilter, searchDebounced]);

  const buckets = useMemo(() => {
    const now = Date.now();
    const devidas: NotebookEntry[] = [];
    const emAprendizado: NotebookEntry[] = [];
    const agendadas: NotebookEntry[] = [];
    const dominadas: NotebookEntry[] = [];
    for (const e of filtered) {
      const bucket = classifyEntry(e, now);
      if (bucket === 'devidas') devidas.push(e);
      else if (bucket === 'emAprendizado') emAprendizado.push(e);
      else if (bucket === 'agendadas') agendadas.push(e);
      else dominadas.push(e);
    }
    return { devidas, emAprendizado, agendadas, dominadas };
  }, [filtered]);

  const totalPending =
    buckets.devidas.length + buckets.emAprendizado.length + buckets.agendadas.length;
  const totalResolved = buckets.dominadas.length;
  const allResolved = entries.length > 0 && totalPending === 0;
  const streak = useMemo(() => calcStreak(entries), [entries]);

  const nextDueAt = useMemo(() => {
    const nowMs = Date.now();
    const scheduled = entries
      .map((e) => (e as any).srsDueAt ?? (e as any).srs_due_at ?? e.nextReviewAt)
      .filter((d): d is string => !!d && new Date(d).getTime() > nowMs)
      .sort();
    return scheduled[0] ?? null;
  }, [entries]);

  /* ── Ações individuais ── */

  const handleRemove = useCallback((id: string) => {
    const removedEntry = entries.find((e) => e.id === id);
    if (!removedEntry) return;

    setEntries((es) => es.filter((e) => e.id !== id));

    let undone = false;
    const t = toast({
      title: 'Item removido do caderno',
      description: removedEntry.area
        ? `${removedEntry.area}${removedEntry.theme ? ` › ${removedEntry.theme}` : ''}`
        : 'Questão removida',
      duration: 5000,
      action: (
        <ToastAction
          altText="Desfazer remoção"
          onClick={() => {
            undone = true;
            setEntries((es) => {
              if (es.find((e) => e.id === id)) return es;
              return [...es, removedEntry];
            });
            t.dismiss();
          }}
        >
          Desfazer
        </ToastAction>
      ),
    });

    const timer = setTimeout(async () => {
      if (undone) return;
      try {
        await simuladosApi.deleteErrorNotebookEntry(id, userId);
        trackEvent('caderno_entry_deleted', { entry_id: id });
      } catch (err) {
        logger.error('[CadernoPage] Error removing entry:', err);
        setEntries((es) => {
          if (es.find((e) => e.id === id)) return es;
          return [...es, removedEntry];
        });
        toast({
          title: 'Não foi possível remover',
          description: 'Tente novamente em instantes.',
          variant: 'destructive',
        });
      }
    }, 5000);

    return () => clearTimeout(timer);
  }, [entries, userId]);

  const handleToggleMastered = async (id: string, mastered: boolean) => {
    const prev = entries;
    setEntries((es) =>
      es.map((e) =>
        e.id === id ? { ...e, resolvedAt: mastered ? new Date().toISOString() : null } : e,
      ),
    );
    try {
      await simuladosApi.toggleResolvedEntry(id, userId, mastered);
      trackEvent('caderno_entry_resolved', { entry_id: id, mastered });
    } catch (err) {
      logger.error('[CadernoPage] Error toggling mastered:', err);
      setEntries(prev);
      toast({
        title: 'Não foi possível atualizar',
        description: 'Tente novamente em instantes.',
        variant: 'destructive',
      });
    }
  };

  const handleSnooze = async (id: string, days: number) => {
    const prev = entries;
    const newDueAt = new Date(Date.now() + days * 86_400_000).toISOString();
    setEntries((es) =>
      es.map((e) =>
        e.id === id ? { ...e, srsDueAt: newDueAt, nextReviewAt: newDueAt } : e,
      ),
    );
    try {
      await simuladosApi.snoozeErrorNotebookEntry(id, days);
      trackEvent('caderno_entry_snoozed', { entry_id: id, days_snoozed: days });
    } catch (err) {
      logger.error('[CadernoPage] Error snoozing entry:', err);
      setEntries(prev);
      toast({
        title: 'Não foi possível adiar',
        description: 'Tente novamente em instantes.',
        variant: 'destructive',
      });
    }
  };

  /* ── Seleção em lote ── */

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else {
        if (next.size === 0) {
          trackEvent('caderno_bulk_select_started', { first_entry_id: id });
        }
        next.add(id);
      }
      return next;
    });
  }, []);

  const cancelSelection = useCallback(() => {
    setSelectedIds(new Set());
    setIsSelectMode(false);
  }, []);

  const handleBulkResolve = useCallback(async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    setBulkBusy(true);
    const prev = entries;
    const now = new Date().toISOString();
    setEntries((es) =>
      es.map((e) => (ids.includes(e.id) ? { ...e, resolvedAt: now } : e)),
    );
    cancelSelection();
    try {
      await Promise.all(ids.map((id) => simuladosApi.toggleResolvedEntry(id, userId, true)));
      toast({ title: `${ids.length} ${pluralize(ids.length, 'questão marcada', 'questões marcadas')} como dominada${ids.length > 1 ? 's' : ''}` });
      trackEvent('caderno_bulk_resolved', { count: ids.length });
    } catch (err) {
      logger.error('[CadernoPage] Bulk resolve error:', err);
      setEntries(prev);
      toast({ title: 'Não foi possível atualizar', variant: 'destructive' });
    } finally {
      setBulkBusy(false);
    }
  }, [selectedIds, entries, userId, cancelSelection]);

  const handleBulkSnooze = useCallback(async (days: number) => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    setBulkBusy(true);
    const prev = entries;
    const newDueAt = new Date(Date.now() + days * 86_400_000).toISOString();
    setEntries((es) =>
      es.map((e) =>
        ids.includes(e.id) ? { ...e, srsDueAt: newDueAt, nextReviewAt: newDueAt } : e,
      ),
    );
    cancelSelection();
    try {
      await Promise.all(ids.map((id) => simuladosApi.snoozeErrorNotebookEntry(id, days)));
      toast({ title: `${ids.length} ${pluralize(ids.length, 'questão adiada', 'questões adiadas')} por ${days} ${pluralize(days, 'dia', 'dias')}` });
      trackEvent('caderno_bulk_snoozed', { count: ids.length, days_snoozed: days });
    } catch (err) {
      logger.error('[CadernoPage] Bulk snooze error:', err);
      setEntries(prev);
      toast({ title: 'Não foi possível adiar', variant: 'destructive' });
    } finally {
      setBulkBusy(false);
    }
  }, [selectedIds, entries, cancelSelection]);

  const handleBulkDelete = useCallback(async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    const removedEntries = entries.filter((e) => ids.includes(e.id));
    setEntries((es) => es.filter((e) => !ids.includes(e.id)));
    cancelSelection();

    let undone = false;
    const t = toast({
      title: `${ids.length} ${pluralize(ids.length, 'questão removida', 'questões removidas')} do caderno`,
      duration: 5000,
      action: (
        <ToastAction
          altText="Desfazer remoção"
          onClick={() => {
            undone = true;
            setEntries((es) => {
              const existingIds = new Set(es.map((e) => e.id));
              const toRestore = removedEntries.filter((e) => !existingIds.has(e.id));
              return toRestore.length ? [...es, ...toRestore] : es;
            });
            t.dismiss();
          }}
        >
          Desfazer
        </ToastAction>
      ),
    });

    await new Promise<void>((resolve) => setTimeout(resolve, 5000));
    if (undone) return;

    setBulkBusy(true);
    try {
      await Promise.all(ids.map((id) => simuladosApi.deleteErrorNotebookEntry(id, userId)));
      trackEvent('caderno_bulk_deleted', { count: ids.length });
    } catch (err) {
      logger.error('[CadernoPage] Bulk delete error:', err);
      setEntries((es) => {
        const existingIds = new Set(es.map((e) => e.id));
        const toRestore = removedEntries.filter((e) => !existingIds.has(e.id));
        return toRestore.length ? [...es, ...toRestore] : es;
      });
      toast({ title: 'Não foi possível remover', variant: 'destructive' });
    } finally {
      setBulkBusy(false);
    }
  }, [selectedIds, entries, userId, cancelSelection]);

  const hasActiveFilters =
    typeFilter !== 'all' || !!specFilter || searchRaw.trim().length > 0;

  const clearFilters = () => {
    setTypeFilter('all');
    setSpecFilter(null);
    setSearchRaw('');
  };

  /* ── CTA — Sessão de Revisão ── */

  const daysLeft = getDaysUntil(nextEdition?.exam_date ?? null, new Date());
  const isENAMEDNear = daysLeft !== null && daysLeft >= 0 && daysLeft <= 45;

  /* ── Loading state ── */

  if (loading) {
    return (
      <div className="caderno-root">
        <CadernoSkeleton count={5} />
      </div>
    );
  }

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

  /* ── Empty state (zero entries ever) ── */

  if (entries.length === 0) {
    return (
      <div className="caderno-root">
        <CadernoEmptyState
          className="mx-auto max-w-xl"
          icon={<BookOpen className="h-8 w-8 text-[var(--c-muted)]" />}
          title="Seu caderno ainda está vazio"
          description={'Na correção do simulado, toque em "Salvar no Caderno" para guardar as questões que você quer dominar.'}
          action={
            <Link
              to="/simulados"
              className={cn(
                'inline-flex items-center gap-2 rounded-[var(--c-radius-control)] px-5 py-2.5 text-[13px] font-bold text-white no-underline',
                'bg-[var(--c-gradient-brand)] bg-gradient-to-br from-[var(--c-wine-500)] to-[var(--c-wine-700)]',
                'shadow-[var(--c-shadow-glow)] transition-all duration-[var(--c-duration-base)]',
                'hover:shadow-[0_8px_32px_-8px_rgba(176,41,74,.55)] hover:-translate-y-0.5',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--c-wine-500)_50%,transparent)]',
              )}
              aria-label="Ver simulados disponíveis"
            >
              <Zap className="h-4 w-4" aria-hidden />
              Ver simulados disponíveis
            </Link>
          }
        />
      </div>
    );
  }

  /* ── Main layout ── */

  return (
    <div className="caderno-root">
      <div className="space-y-5 pb-10">

        {/* ── Hero premium (dark wine) — status ── */}
        <CadernoHero
          total={entries.length}
          dominadas={totalResolved}
          pending={totalPending}
          devidasHoje={buckets.devidas.length}
          specialties={specialties.length}
          streak={streak}
          daysLeft={daysLeft}
          editionLabel={nextEdition?.label}
          isEnamedNear={isENAMEDNear}
          prefersReducedMotion={!!prefersReducedMotion}
        />

        {/* ── Modos de estudo — ação ── */}
        <CadernoModeCards
          devidasHoje={buckets.devidas.length}
          daysLeft={daysLeft}
          editionLabel={nextEdition?.label}
          isEnamedNear={isENAMEDNear}
          hasPending={!allResolved && totalPending > 0}
          revisaoTo={
            !allResolved && totalPending > 0 ? '/caderno/revisao?mode=due' : '/caderno/revisao'
          }
          treinoTo="/caderno/treino"
          retaFinalTo="/caderno/reta-final"
          prefersReducedMotion={!!prefersReducedMotion}
          onSelect={(mode) => {
            if (mode === 'revisao')
              trackEvent('caderno_revisao_cta_clicked', { source: 'caderno_v2_modes', pending: totalPending });
            else if (mode === 'treino')
              trackEvent('caderno_treino_cta_clicked', { source: 'caderno_v2_modes' });
            else
              trackEvent('caderno_reta_final_cta_clicked', { source: 'caderno_v2_modes', days_left: daysLeft });
          }}
        />

        {/* ── Painel de controles — busca + ações + filtros ── */}
        <FilterBar
          typeOptions={typeOptions}
          specialties={specialties}
          totalCount={filtered.length}
          typeFilter={typeFilter}
          specFilter={specFilter}
          search={searchRaw}
          typeCounts={typeCounts}
          onTypeChange={setTypeFilter}
          onSpecChange={setSpecFilter}
          onSearchChange={setSearchRaw}
          hasActiveFilters={hasActiveFilters}
          onClearFilters={clearFilters}
          actions={
            <>
              <CadernoExportMenu
                userId={userId}
                entryCount={entries.length}
                variant="outline"
                size="sm"
                className="h-[42px] rounded-[var(--c-radius-control)] px-4"
              />
              {entries.length > 0 && (
                <button
                  type="button"
                  aria-pressed={isSelectMode}
                  aria-label={isSelectMode ? 'Cancelar seleção' : 'Selecionar para ações em lote'}
                  onClick={() => { if (isSelectMode) cancelSelection(); else setIsSelectMode(true); }}
                  title={isSelectMode ? 'Cancelar seleção (Esc)' : 'Selecionar questões'}
                  className={cn(
                    'inline-flex h-[42px] shrink-0 items-center justify-center gap-1.5 rounded-[var(--c-radius-control)] border px-4 text-[13px] font-semibold transition-all duration-[var(--c-duration-fast)]',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--c-wine-500)_50%,transparent)]',
                    isSelectMode
                      ? 'border-[var(--c-wine-400)] bg-[var(--c-wine-50)] text-[var(--c-wine-700)] dark:bg-[color-mix(in_srgb,var(--c-wine-900)_30%,transparent)] dark:text-[var(--c-wine-300)]'
                      : 'border-[var(--c-border)] bg-[var(--c-surface)] text-[var(--c-muted)] hover:border-[var(--c-wine-300)] hover:text-[var(--c-ink)]',
                  )}
                >
                  <CheckSquare className="h-4 w-4" aria-hidden />
                  <span>{isSelectMode ? 'Selecionando' : 'Selecionar'}</span>
                  {isSelectMode && (
                    <span className="ml-0.5 rounded-full bg-[var(--c-wine-500)] px-1.5 py-0.5 text-[10px] font-bold text-white tabular-nums">
                      {selectedIds.size}
                    </span>
                  )}
                </button>
              )}
            </>
          }
        />

        {/* ── Zero pendentes (celebratório) ── */}
        {allResolved && (
          <ZeroPendingState
            resolvedCount={totalResolved}
            streak={streak}
            nextDueAt={nextDueAt}
            onShowResolved={() => setShowDominadas(true)}
          />
        )}

        {/* ── Filtro sem resultado ── */}
        {!allResolved && filtered.length === 0 && (
          <CadernoEmptyState
            title="Nenhuma questão encontrada"
            description="Nenhuma questão corresponde aos filtros selecionados."
            action={
              <button
                type="button"
                onClick={clearFilters}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-[var(--c-radius-control)] border border-[var(--c-border)] bg-[var(--c-surface)] px-4 py-2 text-[12px] font-semibold text-[var(--c-muted)]',
                  'transition-colors duration-[var(--c-duration-fast)] hover:border-[var(--c-wine-300)] hover:text-[var(--c-ink)]',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--c-wine-500)_50%,transparent)]',
                )}
              >
                Limpar filtros
              </button>
            }
          />
        )}

        {/* ── Devidas hoje ── */}
        {buckets.devidas.length > 0 && (
          <QueueSection
            label="Devidas hoje"
            count={buckets.devidas.length}
            entries={buckets.devidas}
            prefersReducedMotion={!!prefersReducedMotion}
            onRemove={handleRemove}
            onToggleMastered={handleToggleMastered}
            onSnooze={handleSnooze}
            selectable={isSelectMode}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
          />
        )}

        {/* ── Em aprendizado ── */}
        {buckets.emAprendizado.length > 0 && (
          <QueueSection
            label="Em aprendizado"
            count={buckets.emAprendizado.length}
            entries={buckets.emAprendizado}
            prefersReducedMotion={!!prefersReducedMotion}
            onRemove={handleRemove}
            onToggleMastered={handleToggleMastered}
            onSnooze={handleSnooze}
            selectable={isSelectMode}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
          />
        )}

        {/* ── Agendadas ── */}
        {buckets.agendadas.length > 0 && (
          <QueueSection
            label="Agendadas"
            count={buckets.agendadas.length}
            entries={buckets.agendadas}
            prefersReducedMotion={!!prefersReducedMotion}
            onRemove={handleRemove}
            onToggleMastered={handleToggleMastered}
            onSnooze={handleSnooze}
            selectable={isSelectMode}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
          />
        )}

        {/* ── Dominadas (colapsável) ── */}
        {buckets.dominadas.length > 0 && (
          <div>
            {!showDominadas ? (
              <button
                type="button"
                onClick={() => setShowDominadas(true)}
                className={cn(
                  'inline-flex items-center gap-1.5 text-[12px] font-semibold text-[var(--c-muted)]',
                  'transition-colors duration-[var(--c-duration-fast)] hover:text-[var(--c-ink)]',
                  'focus-visible:outline-none focus-visible:underline',
                )}
              >
                <ChevronDown className="h-3.5 w-3.5" aria-hidden />
                Ver {buckets.dominadas.length}{' '}
                {pluralize(buckets.dominadas.length, 'dominada', 'dominadas')}
              </button>
            ) : (
              <AnimatePresence>
                <motion.div
                  initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <QueueSection
                    label={`Dominadas`}
                    count={buckets.dominadas.length}
                    entries={buckets.dominadas}
                    prefersReducedMotion={!!prefersReducedMotion}
                    onRemove={handleRemove}
                    onToggleMastered={handleToggleMastered}
                    onSnooze={handleSnooze}
                    variant="compact"
                    onHide={() => setShowDominadas(false)}
                    selectable={isSelectMode}
                    selectedIds={selectedIds}
                    onToggleSelect={handleToggleSelect}
                  />
                </motion.div>
              </AnimatePresence>
            )}
          </div>
        )}
      </div>

      {/* BulkActionBar */}
      <BulkActionBar
        count={selectedIds.size}
        onCancel={cancelSelection}
        onMarkResolved={handleBulkResolve}
        onSnooze={handleBulkSnooze}
        onDelete={handleBulkDelete}
        busy={bulkBusy}
      />
    </div>
  );
}

/* ── QueueSection ── */

interface QueueSectionProps {
  label: string;
  count: number;
  entries: NotebookEntry[];
  prefersReducedMotion: boolean;
  variant?: 'queue' | 'compact';
  onRemove: (id: string) => void;
  onToggleMastered: (id: string, mastered: boolean) => void;
  onSnooze: (id: string, days: number) => void;
  onHide?: () => void;
  selectable?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
}

function QueueSection({
  label,
  count,
  entries,
  prefersReducedMotion,
  variant = 'queue',
  onRemove,
  onToggleMastered,
  onSnooze,
  onHide,
  selectable = false,
  selectedIds = new Set(),
  onToggleSelect,
}: QueueSectionProps) {
  return (
    <div className="space-y-3">
      <SectionHeader
        title={label}
        count={count}
        action={
          onHide ? (
            <button
              type="button"
              onClick={onHide}
              className="text-[12px] font-semibold text-[var(--c-muted)] transition-colors hover:text-[var(--c-ink)] focus-visible:outline-none focus-visible:underline"
            >
              Ocultar
            </button>
          ) : undefined
        }
      />
      <motion.div
        className="flex flex-col gap-2"
        initial="hidden"
        animate="visible"
        variants={{
          visible: {
            transition: { staggerChildren: prefersReducedMotion ? 0 : 0.035 },
          },
          hidden: {},
        }}
      >
        {entries.map((entry) => (
          <motion.div
            key={entry.id}
            variants={{
              hidden: prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 8 },
              visible: {
                opacity: 1,
                y: 0,
                transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] },
              },
            }}
          >
            <NotebookEntryCard
              entry={entry}
              variant={variant}
              onRemove={onRemove}
              onToggleMastered={onToggleMastered}
              onSnooze={onSnooze}
              selectable={selectable}
              selected={selectedIds.has(entry.id)}
              onToggleSelect={onToggleSelect}
            />
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}

/* ── Page export ── */

export function NotebookEditionContent({ userId }: { userId: string }) {
  const prefersReducedMotion = useReducedMotion();
  const edition = useNotebookEditionFilter(true);
  const [filters, setFilters] = useState<NotebookFilters>({ state: 'all', search: null });
  const [search, setSearch] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setFilters(prev => ({ ...prev, search: search || null })), 300);
    return () => clearTimeout(timer);
  }, [search]);
  const [paging, setPaging] = useState({ scope: '', offset: 0 });
  const scope = JSON.stringify([userId, edition.editionId, filters]);
  const offset = paging.scope === scope ? paging.offset : 0;
  const effective = { ...filters, editionId: edition.editionId };
  const { page, scopeCounts, invalidate } = useNotebookPage(effective, offset, edition.ready);
  const [selection, setSelection] = useState<{ scope: string; ids: Set<string> }>({ scope: '', ids: new Set() });
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const titleRef = useRef<HTMLHeadingElement>(null);
  const selected = selection.scope === `${scope}:${offset}` ? selection.ids : new Set<string>();
  const rows = page.data?.items ?? [];
  useEffect(() => { setHidden(new Set()); }, [scope]);
  useEffect(() => {
    if (page.data && offset > 0 && offset >= page.data.total) setPaging({ scope, offset: Math.max(0, Math.ceil(page.data.total / 50) * 50 - 50) });
  }, [page.data, offset, scope]);
  const changePage = (next: number) => { setPaging({ scope, offset: next }); setSelection({ scope: '', ids: new Set() }); titleRef.current?.focus(); };
  async function mutate(ids: string[], action: 'resolve' | 'snooze' | 'delete', value?: number | boolean) {
    if (busyRef.current || !ids.length || ids.some(id => !rows.some(row => row.id === id))) return;
    busyRef.current = true; setBusy(true);
    try {
      if (action === 'delete') {
        let undone = false;
        setHidden(new Set(ids));
        const notification = toast({ title: 'Item removido do caderno', duration: 5000,
          action: <ToastAction altText="Desfazer remoção" onClick={() => { undone = true; setHidden(new Set()); notification.dismiss(); }}>Desfazer</ToastAction> });
        await new Promise(resolve => setTimeout(resolve, 5000));
        if (undone) return;
      }
      const outcomes = await Promise.allSettled(ids.map(id => action === 'delete' ? simuladosApi.deleteErrorNotebookEntry(id, userId)
        : action === 'resolve' ? simuladosApi.toggleResolvedEntry(id, userId, value !== false) : simuladosApi.snoozeErrorNotebookEntry(id, Number(value))));
      await invalidate();
      if (outcomes.some(r => r.status === 'rejected')) throw new Error('Some notebook updates failed');
      setSelection({ scope: '', ids: new Set() });
    } catch {
      toast({ title: 'Não foi possível atualizar', description: 'Tente novamente. As contagens foram consultadas no servidor.', variant: 'destructive' });
    } finally { setHidden(new Set()); busyRef.current = false; setBusy(false); }
  }
  const label = (id: string, text: string, child: React.ReactNode) => <div><label htmlFor={id} className="mb-1.5 block text-sm font-semibold">{text}</label>{child}</div>;
  const update = (key: keyof NotebookFilters, value: string) => setFilters(prev => ({ ...prev, [key]: value || null }));
  return <div className="caderno-root mx-auto max-w-[1120px] space-y-6 text-[var(--c-ink)]">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs text-[var(--c-muted)]">Meu aprendizado / Caderno • PRO</p><h1 className="text-3xl font-bold">Caderno de erros</h1><p className="mt-2 text-sm text-[var(--c-muted)]">Cada edição passa. O que você aprendeu continua aqui.</p></div>
      <CadernoExportMenu userId={userId} disabled={!edition.ready || page.isPending || page.isError || !page.data?.total} notebookFilters={effective} editionLabel={edition.label} editionsEnabled />
    </header>
    <NotebookEditionSelector filter={edition} />
    {edition.ready && <>
      {scopeCounts.data && <section aria-label="Totais da edição, antes dos filtros" className="min-w-0 max-w-full rounded-[20px] border border-[var(--c-border)] bg-[var(--c-surface)] p-5"><p className="mb-3 min-w-0 max-w-full [overflow-wrap:anywhere] text-sm text-[var(--c-muted)]">{edition.label} • antes dos filtros</p><dl className="grid grid-cols-3 gap-3">{[['Total', scopeCounts.data.total], ['Dominadas', scopeCounts.data.mastered], ['Devidas agora', scopeCounts.data.due]].map(([name, value]) => <div key={name}><dt className="text-xs text-[var(--c-muted)]">{name}</dt><dd className="text-2xl font-bold">{value}</dd></div>)}</dl></section>}
      <CadernoModeCards devidasHoje={scopeCounts.data?.due ?? 0} daysLeft={null} isEnamedNear={false} prefersReducedMotion={!!prefersReducedMotion}
        hasPending={!!scopeCounts.data && scopeCounts.data.total > scopeCounts.data.mastered}
        revisaoTo={notebookEditionLink('/caderno/revisao?mode=due', edition.editionId, true)}
        treinoTo={notebookEditionLink('/caderno/treino', edition.editionId, true)} retaFinalTo="/caderno/reta-final" />
      <section aria-label="Filtrar entradas" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {label('notebook-reason', 'Causa do erro', <select id="notebook-reason" className={notebookControlClass} value={filters.reason ?? ''} onChange={e => update('reason', e.target.value)}><option value="">Todas as causas</option>{Object.entries(DB_REASON_META).map(([id, meta]) => <option key={id} value={id}>{meta.label}</option>)}</select>)}
        {label('notebook-area', 'Área', <select id="notebook-area" className={notebookControlClass} value={filters.area ?? ''} onChange={e => update('area', e.target.value)}><option value="">Todas as áreas</option>{(scopeCounts.data?.by_area ?? []).filter(a => a.area).map(a => <option key={a.area}>{a.area}</option>)}</select>)}
        {label('notebook-search', 'Buscar no caderno', <input id="notebook-search" type="search" maxLength={200} className={notebookControlClass} value={search} onChange={e => setSearch(e.target.value)} placeholder="Tema, questão ou anotação" />)}
        {label('notebook-state', 'Domínio', <select id="notebook-state" className={notebookControlClass} value={filters.state ?? 'all'} onChange={e => update('state', e.target.value)}><option value="all">Todas as entradas</option><option value="pending">Pendentes</option><option value="mastered">Dominadas</option></select>)}
      </section>
      <div className="flex flex-wrap justify-between gap-2 text-sm"><p className="text-[var(--c-muted)]">Filtros aplicados à lista, contagens e exportação.</p><button onClick={() => { setFilters({ state: 'all', search: null }); setSearch(''); }} className="min-h-11 underline">Limpar filtros</button></div>
      <h2 ref={titleRef} tabIndex={-1} className="text-xl font-semibold outline-none">Seu histórico de aprendizado</h2>
      {page.isPending && <p role="status">Carregando seu caderno…</p>}
      {page.isError && <div role="alert"><p>Não foi possível carregar o caderno</p><button className="min-h-11 underline" onClick={() => page.refetch()}>Tentar novamente</button></div>}
      {page.isSuccess && <>
        <p role="status" className="text-sm text-[var(--c-muted)]">Com os filtros: {page.data.counts.total} entradas • {page.data.counts.mastered} dominadas • {page.data.counts.due} devidas agora</p>
        {!page.data.total && <p>{scopeCounts.data?.total === 0 ? 'Seu caderno começa com o próximo aprendizado.' : 'Nenhuma entrada com esses filtros.'}</p>}
        {!!page.data.total && <div className="flex flex-wrap items-center gap-3 text-sm"><span>Seleção somente nesta página: {selected.size} de {rows.length}</span><button disabled={busy} className="min-h-11 underline" onClick={() => setSelection({ scope: `${scope}:${offset}`, ids: new Set(rows.map(r => r.id)) })}>Selecionar página</button><button disabled={busy || !selected.size} className="min-h-11 underline" onClick={() => mutate([...selected], 'resolve')}>Dominar selecionadas</button><button disabled={busy || !selected.size} className="min-h-11 underline" onClick={() => mutate([...selected], 'snooze', 1)}>Adiar selecionadas</button><button disabled={busy || !selected.size} className="min-h-11 underline" onClick={() => mutate([...selected], 'delete')}>Remover selecionadas</button></div>}
        <div className={busy ? 'pointer-events-none space-y-3' : 'space-y-3'} aria-busy={busy}>
          {rows.filter(row => !hidden.has(row.id)).map(row => <NotebookEntryCard key={row.id}
            entry={{ id: row.id, simuladoId: row.simulado_id, questionId: row.question_id,
              questionNumber: row.question_number, area: row.area, theme: row.theme, reason: row.reason,
              learningNote: row.learning_text, wasCorrect: row.was_correct, addedAt: row.created_at,
              nextReviewAt: row.next_review_at, simuladoTitle: row.simulado_title, questionText: row.question_text,
               resolvedAt: row.resolved_at ?? row.mastered_at, srsDueAt: row.srs_due_at,
               srsReps: row.srs_reps, srsInterval: row.srs_interval, masteredAt: row.mastered_at,
               lastReviewOutcome: row.last_review_outcome, srsLapses: row.srs_lapses,
              editionId: row.edition_id ?? null, editionCode: row.edition_code, editionLabel: row.edition_label }}
            selected={selected.has(row.id)} selectable
            onToggleSelect={id => setSelection(() => {
              const ids = new Set(selected); if (ids.has(id)) ids.delete(id); else ids.add(id);
              return { scope: `${scope}:${offset}`, ids };
            })}
            onRemove={id => mutate([id], 'delete')}
            onToggleMastered={(id, value) => mutate([id], 'resolve', value)}
            onSnooze={(id, days) => mutate([id], 'snooze', days)}
            reviewHref={notebookEditionLink(`/caderno/revisao?entry=${encodeURIComponent(row.id)}`, edition.editionId, true)} />)}
        </div>
        <NotebookPagination offset={offset} total={page.data.total} busy={page.isFetching || busy} onPage={changePage} />
      </>}
    </>}
  </div>;
}

export default function CadernoPage() {
  const { profile } = useUser();
  const { user } = useAuth();
  const segment = profile?.segment ?? 'guest';
  const hasAccess = SEGMENT_ACCESS[segment].cadernoErros;
  const editionsEnabled = useAppConfig('editions_ui');

  return (
    <PageTransition>
      {!hasAccess ? (
        <ProGate
          icon={BookOpen}
          feature="Caderno de Erros"
          description="Salve as questões que você errou, anote o que aprendeu e organize por área e tipo de erro. Assim você revisa só o que precisa."
          requiredSegment="pro"
          currentSegment={segment}
          benefits={[
            'Salvar questões direto da correção com motivo (errou, sem certeza)',
            'Anotação de aprendizado por questão',
            'Filtrar e revisar por área, tipo de erro e especialidade',
          ]}
        />
      ) : (
        editionsEnabled ? <NotebookEditionContent key={user?.id} userId={user?.id ?? ''} /> : <CadernoContent userId={user?.id ?? ''} />
      )}
    </PageTransition>
  );
}
