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

import { CadernoHero } from '@/components/caderno/CadernoHero';
import { CadernoModeCards } from '@/components/caderno/CadernoModeCards';
import { ENAMED_DATE } from '@/components/caderno/PageHero';
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

  // Seleção em lote
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const isSelectMode = selectedIds.size > 0;

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
      if (e.key === 'Escape' && isSelectMode) setSelectedIds(new Set());
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

  const cancelSelection = useCallback(() => setSelectedIds(new Set()), []);

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

  const daysLeft = Math.ceil((ENAMED_DATE.getTime() - Date.now()) / 86_400_000);
  const isENAMEDNear = daysLeft > 0 && daysLeft <= 45;

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
          isEnamedNear={isENAMEDNear}
          prefersReducedMotion={!!prefersReducedMotion}
        />

        {/* ── Modos de estudo — ação ── */}
        <CadernoModeCards
          devidasHoje={buckets.devidas.length}
          daysLeft={daysLeft}
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
                entries={entries as any}
                variant="outline"
                size="sm"
                className="h-[42px] rounded-[var(--c-radius-control)] px-4"
              />
              {entries.length > 0 && (
                <button
                  type="button"
                  aria-pressed={isSelectMode}
                  aria-label={isSelectMode ? 'Cancelar seleção' : 'Selecionar para ações em lote'}
                  onClick={() => { if (isSelectMode) cancelSelection(); }}
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

export default function CadernoPage() {
  const { profile } = useUser();
  const { user } = useAuth();
  const segment = profile?.segment ?? 'guest';
  const hasAccess = SEGMENT_ACCESS[segment].cadernoErros;

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
        <CadernoContent userId={user?.id ?? ''} />
      )}
    </PageTransition>
  );
}
