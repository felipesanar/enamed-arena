/**
 * CadernoPage — casca unificada do Caderno de Erros v2 (Fase 1).
 *
 * Rota: /caderno  (gate PRO + feature flag caderno_v2_enabled).
 * Aba ativa: Revisar. Demais abas (Favoritos/Anotações/Flashcards/Insights)
 * renderizadas como disabled + badge "Em breve" na TabBar.
 *
 * Buckets de fila (Fase 1 — degrada para campos legados se SRS ainda não migrado):
 *   Devidas hoje    srs_due_at <= now  (ou next_review_at <= now, ou null)
 *   Em aprendizado  srs_reps >= 1 && srs_due_at > now && srs_interval <= 14d
 *   Agendadas       srs_due_at > now  && srs_interval > 14d (ou next_review_at > now)
 *   Dominadas       mastered_at IS NOT NULL (ou resolved_at)
 *
 * EPIC-5 (Wave 2):
 *   - Busca textual com debounce (300ms), combinando com filtros ativos.
 *   - Filtros combináveis (Causa + Área + Busca), estado ativo sempre visível.
 *   - Seleção em lote com BulkActionBar flutuante (marcar, adiar, excluir).
 *   - Quick actions no card: onSnooze integrado ao NotebookEntryCard.
 */

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { BookOpen, Zap, Play, ChevronDown, CheckSquare, Swords, Target, Clock } from 'lucide-react';

import { trackEvent } from '@/lib/analytics';
import { logger } from '@/lib/logger';
import { toast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { cn } from '@/lib/utils';

import { PageTransition, StaggerContainer, StaggerItem } from '@/components/premium/PageTransition';
import { ProGate } from '@/components/ProGate';
import { EmptyState } from '@/components/EmptyState';
import { ProfSanorAvatar } from '@/components/comparativo/ProfSanorAvatar';

import { useUser } from '@/contexts/UserContext';
import { useAuth } from '@/contexts/AuthContext';
import { SEGMENT_ACCESS } from '@/types';
import { type DbReason } from '@/lib/errorNotebookReasons';
import { simuladosApi } from '@/services/simuladosApi';

import { TabBar } from '@/components/caderno/TabBar';
import { PageHero, ENAMED_DATE } from '@/components/caderno/PageHero';
import { FilterBar, type CausaFilter } from '@/components/caderno/FilterBar';
import { CadernoExportMenu } from '@/components/caderno/CadernoExportMenu';
import { CadernoSkeleton } from '@/components/caderno/CadernoSkeleton';
import { ZeroPendingState } from '@/components/caderno/ZeroPendingState';
import { BulkActionBar } from '@/components/caderno/BulkActionBar';
import {
  NotebookEntryCard,
  type NotebookEntry,
} from '@/components/caderno/NotebookEntryCard';

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

/** Classifica uma entrada nos buckets SRS, degradando para campos legados se necessário. */
function classifyEntry(entry: NotebookEntry, now: number) {
  // Use mastered_at (SRS) ou resolved_at (legado)
  const masteredAt = (entry as any).masteredAt ?? (entry as any).mastered_at ?? entry.resolvedAt;
  if (masteredAt) return 'dominadas' as const;

  // Use srs_due_at (SRS) ou next_review_at (legado)
  const srsDueAt = (entry as any).srsDueAt ?? (entry as any).srs_due_at ?? entry.nextReviewAt;
  const srsReps: number = (entry as any).srsReps ?? (entry as any).srs_reps ?? 0;
  const srsInterval: number = (entry as any).srsInterval ?? (entry as any).srs_interval ?? 0;

  if (!srsDueAt || new Date(srsDueAt).getTime() <= now) return 'devidas' as const;
  if (srsReps >= 1 && srsInterval <= 14) return 'emAprendizado' as const;
  return 'agendadas' as const;
}

/** Debounce hook simples para search */
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
  // raw value (instant) — shown in FilterBar input
  const [searchRaw, setSearchRaw] = useState('');
  // debounced value — used in useMemo for filtering
  const searchDebounced = useDebounce(searchRaw, 300);
  const [showDominadas, setShowDominadas] = useState(false);

  // ── Seleção em lote ──
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
          // SRS (may be absent until migration)
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

  // Analytics
  useEffect(() => {
    if (loading || tracked.current) return;
    tracked.current = true;
    trackEvent('caderno_erros_viewed', {
      total_errors: entries.length,
      segment: profile?.segment ?? 'guest',
      shell_version: 'v2',
    });
  }, [loading, entries.length, profile?.segment]);

  // Track filter changes (debounced search included)
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

  // Esc cancela seleção
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isSelectMode) {
        setSelectedIds(new Set());
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

  // Próxima data devida (para ZeroPendingState)
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

    // Optimistic remove
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
              // Only re-insert if not already present
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

    // If undo is clicked while timer is still pending, cancel it
    // (the closure above handles undone=true before the timer fires)
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
        e.id === id
          ? { ...e, srsDueAt: newDueAt, nextReviewAt: newDueAt }
          : e,
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
    // Capture only the entries being removed (for targeted rollback)
    const removedEntries = entries.filter((e) => ids.includes(e.id));
    // Optimistic — remove from UI immediately, show undo toast
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
            // Restore only the removed entries into current state
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
      // Restore only removed entries into current state
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

  const clearFilters = () => {
    setTypeFilter('all');
    setSpecFilter(null);
    setSearchRaw('');
  };

  /* ── States ── */

  if (loading) return <CadernoSkeleton />;

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

  if (entries.length === 0) {
    return (
      <div className="mx-auto max-w-xl rounded-3xl border-2 border-dashed border-primary/25 bg-primary/[0.04] p-10 text-center">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent">
          <BookOpen className="h-7 w-7 text-primary" aria-hidden />
        </div>
        <h3 className="text-heading-2 text-foreground">Seu Caderno está vazio</h3>
        <p className="mx-auto mt-2 max-w-md text-body leading-relaxed text-muted-foreground">
          Na correção do simulado, toque em{' '}
          <strong className="font-semibold text-foreground">"Salvar no Caderno"</strong> para
          adicionar questões que quer dominar.
        </p>
        <Link
          to="/simulados"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-body-sm font-semibold text-primary-foreground shadow-[0_4px_14px_-4px_hsl(345_65%_30%/0.4)] transition-all duration-200 hover:bg-wine-hover no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.99]"
        >
          <Zap className="h-4 w-4" aria-hidden />
          Ver simulados disponíveis
        </Link>
      </div>
    );
  }

  /* ── Main layout ── */
  return (
    <>
      <StaggerContainer className="space-y-5 md:space-y-6">
        {/* Hero */}
        <StaggerItem>
          <PageHero
            pendingCount={totalPending}
            resolvedCount={totalResolved}
            totalCount={entries.length}
            specialtyCount={specialties.length}
            streak={streak}
          />
        </StaggerItem>

        {/* CTAs — Treino + Reta Final */}
        <StaggerItem>
          <div className="flex flex-wrap items-center gap-2">
            {/* CTA Treino — discreto, sempre visível */}
            <Link
              to="/caderno/treino"
              onClick={() => trackEvent('caderno_treino_cta_clicked', { source: 'caderno_v2_header' })}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5',
                'text-[12px] font-semibold text-muted-foreground no-underline',
                'transition-all duration-150 hover:border-primary/30 hover:text-foreground',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              )}
              aria-label="Treinar pontos fracos"
            >
              <Target className="h-3.5 w-3.5 shrink-0" aria-hidden />
              Treinar pontos fracos
            </Link>

            {/* CTA Reta Final — destaque quando ≤ 45 dias */}
            {(() => {
              const daysLeft = Math.ceil((ENAMED_DATE.getTime() - Date.now()) / 86_400_000);
              const isNear = daysLeft > 0 && daysLeft <= 45;
              return daysLeft > 0 ? (
                <Link
                  to="/caderno/reta-final"
                  onClick={() => trackEvent('caderno_reta_final_cta_clicked', { source: 'caderno_v2_header', days_left: daysLeft })}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 no-underline',
                    'text-[12px] font-semibold transition-all duration-150',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                    isNear
                      ? 'border-primary/40 bg-primary/10 text-primary hover:bg-primary/15 shadow-[0_2px_10px_-4px_hsl(345_65%_30%/0.35)]'
                      : 'border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground',
                  )}
                  aria-label={`Reta Final ENAMED — ${daysLeft} ${daysLeft === 1 ? 'dia restante' : 'dias restantes'}`}
                >
                  <Swords className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  Reta Final ENAMED
                  {isNear && (
                    <span
                      className="ml-0.5 inline-flex items-center gap-0.5 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground tabular-nums"
                      aria-label={`${daysLeft} dias restantes`}
                    >
                      <Clock className="h-2.5 w-2.5" aria-hidden />
                      {daysLeft}d
                    </span>
                  )}
                </Link>
              ) : null;
            })()}
          </div>
        </StaggerItem>

        {/* Filters */}
        <StaggerItem>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
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
              />
            </div>
            {/* Ações do header: exportar + selecionar */}
            <div className="mt-0.5 flex shrink-0 items-center gap-2">
              {/* Export menu — desabilita automaticamente se vazio */}
              <CadernoExportMenu
                entries={entries as any}
                variant="outline"
                size="sm"
              />
              {/* Botão modo de seleção em lote */}
              {entries.length > 0 && (
                <button
                  type="button"
                  aria-pressed={isSelectMode}
                  aria-label={isSelectMode ? 'Cancelar seleção' : 'Selecionar para ações em lote'}
                  onClick={() => isSelectMode ? cancelSelection() : undefined}
                  title={isSelectMode ? 'Cancelar seleção (Esc)' : 'Selecionar questões'}
                  className={cn(
                    'inline-flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-2 text-[12px] font-semibold transition-all duration-150',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                    isSelectMode
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground',
                  )}
                >
                  <CheckSquare className="h-3.5 w-3.5" aria-hidden />
                  <span className="hidden sm:inline">{isSelectMode ? 'Selecionando' : 'Selecionar'}</span>
                  {isSelectMode && (
                    <span className="ml-0.5 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground tabular-nums">
                      {selectedIds.size}
                    </span>
                  )}
                </button>
              )}
            </div>
          </div>
        </StaggerItem>

        {/* CTA sessão de revisão */}
        {!allResolved && totalPending > 0 && (
          <StaggerItem>
            <Link
              to="/caderno/revisao"
              onClick={() =>
                trackEvent('caderno_revisao_cta_clicked', {
                  source: 'caderno_v2_hero',
                  pending: totalPending,
                })
              }
              className="group relative flex items-center justify-between gap-4 overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/[0.06] via-primary/[0.04] to-transparent px-5 py-4 no-underline transition-all duration-200 hover:border-primary/40 hover:shadow-[0_8px_24px_-12px_hsl(345_65%_30%/0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="relative shrink-0">
                  <div className="overflow-hidden rounded-full border-2 border-background bg-primary/[0.04] shadow-sm">
                    <ProfSanorAvatar size={44} />
                  </div>
                  <span
                    className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-background bg-success"
                    aria-hidden
                  />
                </div>
                <div className="min-w-0">
                  <p className="text-body font-bold text-foreground">Modo revisão com Prof. San</p>
                  <p className="text-caption text-muted-foreground">
                    Revise {totalPending}{' '}
                    {pluralize(totalPending, 'questão pendente', 'questões pendentes')} com análise de IA.
                  </p>
                </div>
              </div>
              <div className="hidden shrink-0 items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground shadow-[0_4px_14px_-4px_hsl(345_65%_30%/0.4)] transition-transform group-hover:scale-[1.02] sm:flex">
                <Play className="h-3.5 w-3.5 fill-current" aria-hidden />
                Iniciar sessão
              </div>
            </Link>
          </StaggerItem>
        )}

        {/* Zero pendentes */}
        {allResolved && (
          <StaggerItem>
            <ZeroPendingState
              resolvedCount={totalResolved}
              streak={streak}
              nextDueAt={nextDueAt}
              onShowResolved={() => setShowDominadas(true)}
            />
          </StaggerItem>
        )}

        {/* Filtro sem resultado */}
        {!allResolved && filtered.length === 0 && (
          <StaggerItem>
            <div className="rounded-2xl border border-dashed border-border bg-card/50 px-6 py-12 text-center">
              <p className="text-body-sm text-muted-foreground">
                Nenhuma questão corresponde aos filtros selecionados.
              </p>
              <button
                type="button"
                onClick={clearFilters}
                className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-semibold text-primary hover:text-wine-hover focus-visible:outline-none focus-visible:underline"
              >
                Limpar filtros
              </button>
            </div>
          </StaggerItem>
        )}

        {/* ── Devidas hoje ── */}
        {buckets.devidas.length > 0 && (
          <StaggerItem>
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
          </StaggerItem>
        )}

        {/* ── Em aprendizado ── */}
        {buckets.emAprendizado.length > 0 && (
          <StaggerItem>
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
          </StaggerItem>
        )}

        {/* ── Agendadas ── */}
        {buckets.agendadas.length > 0 && (
          <StaggerItem>
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
          </StaggerItem>
        )}

        {/* ── Dominadas (colapsável) ── */}
        {buckets.dominadas.length > 0 && (
          <StaggerItem>
            {!showDominadas ? (
              <button
                type="button"
                onClick={() => setShowDominadas(true)}
                className="inline-flex items-center gap-1.5 text-caption font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:underline"
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
                    label={`Dominadas (${buckets.dominadas.length})`}
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
          </StaggerItem>
        )}
      </StaggerContainer>

      {/* BulkActionBar flutuante */}
      <BulkActionBar
        count={selectedIds.size}
        onCancel={cancelSelection}
        onMarkResolved={handleBulkResolve}
        onSnooze={handleBulkSnooze}
        onDelete={handleBulkDelete}
        busy={bulkBusy}
      />
    </>
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
    <div>
      <div className="mb-2.5 flex items-center justify-between">
        <span className="text-overline font-bold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <div className="flex items-center gap-3">
          <span className="text-caption text-muted-foreground">
            {count} {pluralize(count, 'questão', 'questões')}
          </span>
          {onHide && (
            <button
              type="button"
              onClick={onHide}
              className="text-caption text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:underline"
            >
              Ocultar
            </button>
          )}
        </div>
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
        {entries.map((entry) => (
          <motion.div
            key={entry.id}
            variants={{
              hidden: prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 6 },
              visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
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
      {/* TabBar fica antes do gate para ser sempre visível */}
      <TabBar />

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
        <CadernoContent userId={user?.id ?? ''} />
      )}
    </PageTransition>
  );
}
