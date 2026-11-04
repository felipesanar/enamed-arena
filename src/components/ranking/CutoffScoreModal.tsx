import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, SlidersHorizontal, ChevronDown } from 'lucide-react';
import { fetchAllCutoffScores } from '@/services/rankingApi';
import { cn } from '@/lib/utils';
import { useCutoffEditionFlag, useCutoffScope } from '@/hooks/useCutoffContext';
import { useAuth } from '@/contexts/AuthContext';
import { cutoffApi, type ReferencedCutoffScore } from '@/services/cutoffApi';
import type { SimuladoConfig } from '@/types';
import { CutoffHistorySection } from '@/components/ranking/CutoffHistorySection';

interface CutoffScoreModalProps {
  simulado?: Pick<SimuladoConfig, 'editionCode' | 'editionLabel'>;
  open: boolean;
  onClose: () => void;
  userSpecialty?: string;
  /** Canonical institution names from onboarding, in profile order */
  userInstitutions?: string[];
  currentUserScore?: number; // Accepted by existing callers; not compared across unverified scales.
}

function scoreTint(score: number): 'high' | 'mid' | 'low' {
  if (score >= 80) return 'high';
  if (score >= 74) return 'mid';
  return 'low';
}

const GRID_COLS = '1fr 88px 64px 52px';
const EMPTY_ROWS: ReferencedCutoffScore[] = [];

export function CutoffScoreModal({
  open,
  onClose,
  userSpecialty,
  userInstitutions,
}: CutoffScoreModalProps) {
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<'reference' | 'history'>('reference');
  const [historyRow, setHistoryRow] = useState('');
  const [search, setSearch] = useState('');
  const [specialtyFilter, setSpecialtyFilter] = useState<string>(userSpecialty ?? 'all');
  const [showFilters, setShowFilters] = useState(false);
  const flag = useCutoffEditionFlag();
  const editionsUi = flag.editionsUi;
  const { referenceEditionId } = useCutoffScope();
  const { user } = useAuth();
  const queryEnabled = open && flag.ready && (!editionsUi || !!referenceEditionId);

  const { data, isLoading } = useQuery({
    queryKey: ['all-cutoff-scores', user?.id ?? null, editionsUi ? referenceEditionId ?? null : 'legacy'],
    queryFn: () => editionsUi ? cutoffApi.getAllScores(referenceEditionId!) : fetchAllCutoffScores(),
    staleTime: Infinity,
    enabled: queryEnabled,
  });
  const rows = (queryEnabled ? data ?? EMPTY_ROWS : EMPTY_ROWS) as ReferencedCutoffScore[];
  const showHistory = editionsUi && view === 'history';
  const rowKey = (row: ReferencedCutoffScore) => JSON.stringify([row.institution_id, row.specialty_id, row.practice_scenario]);
  const historyOptions = [...new Map(rows.filter(row => !!row.institution_id && !!row.specialty_id).map(row => [rowKey(row),row])).values()];
  const selectedHistoryRow = historyOptions.find(row => rowKey(row) === historyRow);
  const historyReference = selectedHistoryRow ? { institutionId: selectedHistoryRow.institution_id,
    specialtyId: selectedHistoryRow.specialty_id!, practiceScenario: selectedHistoryRow.practice_scenario } : null;
  const labels = [...new Set(rows.map(row => row.reference_label).filter(Boolean))];
  const sources = [...new Set(rows.map(row => row.source).filter(Boolean))];
  const knownReference = rows.length > 0 && rows.every(row => row.reference_edition_id && row.reference_label?.trim() && row.source?.trim());
  const referenceLabel = knownReference && labels.length === 1 ? labels[0] : 'Referência indisponível';
  const sourceLabel = knownReference && sources.length === 1 ? `Fonte: ${sources[0]}` : knownReference ? 'Fontes diversas (por linha)' : 'Fonte indisponível';
  // The current cutoff contract supplies provenance, not a comparable score scale.
  const loading = queryEnabled && isLoading;

  // Reset / initialize filters on open/close — auto-selects user's specialty on open
  useEffect(() => {
    if (!open || !editionsUi) return;
    const trigger = document.activeElement as HTMLElement | null;
    return () => { if (trigger?.isConnected) trigger.focus(); };
  }, [open, editionsUi]);

  useEffect(() => {
    if (open) {
      setSpecialtyFilter(userSpecialty ?? 'all');
      closeBtnRef.current?.focus();
    } else {
      setSearch('');
      setSpecialtyFilter('all');
      setShowFilters(false);
      setView('reference');
      setHistoryRow('');
    }
  }, [open, userSpecialty]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (editionsUi && e.key === 'Tab') {
        const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),select:not([disabled]),a[href],[tabindex="0"]') ?? [])
          .filter(element => element.getClientRects().length > 0);
        const first = focusable[0], last = focusable[focusable.length-1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose, editionsUi]);

  // Extract unique specialties for filter pills
  const specialties = useMemo(() => {
    const set = new Set(rows.map(r => r.specialty_name));
    return Array.from(set).sort();
  }, [rows]);

  // User's target-institution rows — pinned at top, derived without an extra query.
  // Names are canonical (same catalog as enamed_cutoff_scores), so exact match is safe.
  const userRows = useMemo(() => {
    if (!userSpecialty || !userInstitutions?.length) return [];
    const targets = userInstitutions.map((n) => n.toLowerCase().trim());
    return rows.filter(
      (r) =>
        r.specialty_name.toLowerCase() === userSpecialty.toLowerCase() &&
        targets.includes(r.institution_name.toLowerCase().trim()),
    );
  }, [rows, userSpecialty, userInstitutions]);

  // Normalize for accent-insensitive search
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[-–—]/g, '-');

  // Filtered rows — excludes the pinned userRows
  const filteredRows = useMemo(() => {
    const normalizedSearch = normalize(search);
    let filtered = rows;

    if (specialtyFilter !== 'all') {
      filtered = filtered.filter(r => r.specialty_name === specialtyFilter);
    }

    if (normalizedSearch) {
      filtered = filtered.filter(
        r =>
          normalize(r.institution_name).includes(normalizedSearch) ||
          normalize(r.specialty_name).includes(normalizedSearch),
      );
    }

    // Exclude the pinned user rows from the scrollable list
    if (userRows.length > 0) {
      const pinned = new Set(
        userRows.map(r => `${r.institution_name}::${r.specialty_name}`),
      );
      filtered = filtered.filter(
        r => !pinned.has(`${r.institution_name}::${r.specialty_name}`),
      );
    }

    return filtered;
  }, [rows, search, specialtyFilter, userRows]);

  const normalizedSpecialty = userSpecialty?.toLowerCase() ?? '';
  const resultCount = filteredRows.length + userRows.length;
  const hasActiveFilters = specialtyFilter !== 'all' || search.trim() !== '';
  const hasUserRows = userRows.length > 0;

  return (
    <AnimatePresence>
      {open && (
        <div className={cn('fixed inset-0 z-50 flex justify-end', editionsUi && 'items-center px-4 md:px-0')}>

          {/* ── Backdrop ──────────────────────────────────────────────── */}
          <motion.div
            ref={dialogRef}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-[6px]"
            onClick={onClose}
          />

          {/* ── Drawer ────────────────────────────────────────────────── */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 34, mass: 0.9 }}
            role="dialog"
            aria-modal="true"
            aria-label="Notas de Corte ENAMED"
            className={cn('relative w-full max-w-lg flex flex-col overflow-hidden bg-card border-l border-border', editionsUi ? 'h-[90dvh] max-h-[90dvh] rounded-l-xl' : 'h-full')}
          >

            {/* ── Header ──────────────────────────────────────────────── */}
            <div className="shrink-0 px-5 pt-5 pb-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-[9px] uppercase tracking-[2.5px] font-bold mb-1 text-muted-foreground/70">
                    {referenceLabel}
                  </p>
                  <p className="text-caption text-muted-foreground">{sourceLabel}</p>
                  <h2 className="text-[17px] font-extrabold tracking-tight text-foreground">
                    Notas de Corte
                  </h2>
                </div>
                <button
                  ref={closeBtnRef}
                  type="button"
                  onClick={onClose}
                  aria-label="Fechar"
                  className="h-11 w-11 shrink-0 rounded-[9px] flex items-center justify-center transition-all duration-200 bg-muted border border-border text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {editionsUi && <div role="tablist" aria-label="Referência de corte" className="mb-4 flex gap-4 border-b border-border" onKeyDown={event => {
                if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
                event.preventDefault();
                const next = event.key === 'Home' ? 'reference' : event.key === 'End' ? 'history' : view === 'history' ? 'reference' : 'history';
                setView(next); dialogRef.current?.querySelector<HTMLButtonElement>(`#cutoff-${next}-tab`)?.focus();
              }}>{(['reference','history'] as const).map(tab => <button id={`cutoff-${tab}-tab`} key={tab} role="tab" type="button" aria-selected={view === tab} aria-controls={`cutoff-${tab}-panel`} tabIndex={view === tab ? 0 : -1} onClick={() => setView(tab)} className={cn('min-h-11 py-2 text-caption font-medium', view === tab ? 'border-b-2 border-primary text-foreground' : 'text-muted-foreground')}>{tab === 'reference' ? 'Referência selecionada' : 'Histórico da referência'}</button>)}</div>}
              {!showHistory && <>
              {/* ── Search ────────────────────────────────────────────── */}
              <div className="relative mb-[9px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar instituição ou especialidade..."
                  aria-label="Buscar instituição ou especialidade"
                  className="w-full h-9 pl-9 pr-4 rounded-[10px] text-[12.5px] outline-none transition-all duration-200 bg-muted border border-border text-foreground placeholder:text-muted-foreground/70 focus:border-primary/30 focus:ring-2 focus:ring-primary/10"
                />
              </div>

              {/* ── Filter toggle ──────────────────────────────────────── */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setShowFilters(f => !f)}
                  className={cn(
                    'relative inline-flex items-center gap-1.5 px-3 py-[5px] rounded-full text-[12px] font-medium transition-all duration-200 border',
                    showFilters || hasActiveFilters
                      ? 'bg-primary text-white border-primary'
                      : 'bg-muted text-muted-foreground border-border',
                  )}
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  Filtrar
                  {hasActiveFilters && !showFilters && (
                    <span className="absolute -top-[3px] -right-[3px] h-[8px] w-[8px] rounded-full bg-primary-foreground shadow-sm" />
                  )}
                  <ChevronDown
                    className={cn(
                      'h-3 w-3 transition-transform duration-200',
                      showFilters && 'rotate-180',
                    )}
                  />
                </button>
                {/* Active filter pill showing which specialty is selected */}
                {specialtyFilter !== 'all' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-[4px] rounded-full text-[10.5px] font-medium bg-primary/10 border border-primary/20 text-primary">
                    {specialtyFilter}
                    <button
                      type="button"
                      onClick={() => setSpecialtyFilter('all')}
                      className="ml-0.5 hover:opacity-80 transition-opacity"
                      aria-label={`Remover filtro ${specialtyFilter}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )}
                <span
                  className={cn(
                    'text-[10.5px] tabular-nums',
                    hasActiveFilters ? 'text-primary/70' : 'text-muted-foreground/70',
                  )}
                >
                  {resultCount} {resultCount === 1 ? 'resultado' : 'resultados'}
                </span>
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch('');
                      setSpecialtyFilter('all');
                    }}
                    className="text-[10.5px] underline underline-offset-2 transition-colors text-primary/60 hover:text-primary"
                  >
                    Limpar filtros
                  </button>
                )}
              </div>

              {/* ── Specialty filter pills ─────────────────────────────── */}
              <AnimatePresence initial={false}>
                {showFilters && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="flex flex-wrap gap-1.5 pt-3">
                      <button
                        type="button"
                        onClick={() => setSpecialtyFilter('all')}
                        className={cn(
                          'px-3 py-[5px] rounded-full text-[11px] font-medium transition-all duration-200 border',
                          specialtyFilter === 'all'
                            ? 'bg-primary text-white border-primary'
                            : 'bg-muted text-muted-foreground border-border',
                        )}
                      >
                        Todas
                      </button>
                      {specialties.map(spec => {
                        const isActive = specialtyFilter === spec;
                        const isMine = spec.toLowerCase() === normalizedSpecialty;
                        return (
                          <button
                            key={spec}
                            type="button"
                            onClick={() => setSpecialtyFilter(isActive ? 'all' : spec)}
                            className={cn(
                              'px-3 py-[5px] rounded-full text-[11px] font-medium transition-all duration-200 border',
                              isActive
                                ? 'bg-primary text-white border-primary'
                                : cn(
                                    'bg-muted border-border',
                                    isMine ? 'text-foreground' : 'text-muted-foreground',
                                  ),
                            )}
                          >
                            {spec}
                            {isMine && !isActive && ' ★'}
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              </>}
            </div>

            {showHistory ? <div id="cutoff-history-panel" role="tabpanel" aria-labelledby="cutoff-history-tab" className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">
              <label htmlFor="cutoff-history-row" className="mb-2 block text-caption font-semibold">Instituição e especialidade do histórico</label><select id="cutoff-history-row" value={historyRow} onChange={event => setHistoryRow(event.target.value)} className="min-h-11 w-full rounded-lg border border-input bg-background px-3 text-caption"><option value="">Selecione uma referência identificada</option>{historyOptions.map(row => <option key={rowKey(row)} value={rowKey(row)}>{row.institution_name} / {row.specialty_name}{row.practice_scenario ? ` / ${row.practice_scenario}` : ''}</option>)}</select>
              <CutoffHistorySection reference={historyReference} />
            </div> : <div id="cutoff-reference-panel" role={editionsUi ? 'tabpanel' : undefined} aria-labelledby={editionsUi ? 'cutoff-reference-tab' : undefined} className="flex min-h-0 flex-1 flex-col">
            {/* ── Divider ───────────────────────────────────────────────── */}
            <div className="shrink-0 h-px bg-border" />

            {/* ── Table column header (sticky) ───────────────────────────── */}
            <div
              className="shrink-0 grid px-5 py-2 bg-muted/50 border-b border-border"
              style={{ gridTemplateColumns: GRID_COLS }}
            >
              {(['Instituição', 'Especialidade', 'Geral', 'Cotas'] as const).map((h, i) => (
                <span
                  key={h}
                  className={cn(
                    'text-[8.5px] uppercase tracking-[1.3px] font-bold text-muted-foreground',
                    i >= 2 && 'text-right',
                  )}
                >
                  {h}
                </span>
              ))}
            </div>

            {/* ── Scrollable body ────────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto">
              {loading && (
                <div className="flex items-center justify-center py-16">
                  <div className="h-6 w-6 rounded-full border-2 animate-spin border-border border-t-foreground/40" />
                </div>
              )}

              {!loading && filteredRows.length === 0 && !hasUserRows && (
                <div className="flex flex-col items-center justify-center py-16 gap-2">
                  <Search className="h-8 w-8 text-muted-foreground/40" />
                  <p className="text-[13px] text-muted-foreground">
                    Nenhum resultado encontrado.
                  </p>
                  {search && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearch('');
                        setSpecialtyFilter('all');
                      }}
                      className="text-[12px] underline underline-offset-2 transition-colors text-primary/60 hover:text-primary"
                    >
                      Limpar filtros
                    </button>
                  )}
                </div>
              )}

              {!loading && (filteredRows.length > 0 || hasUserRows) && (
                <div>
                  {/* ── Pinned user rows ─────────────────────────────────── */}
                  {hasUserRows && (
                    <>
                      <div className="flex items-center px-5 py-[5px] bg-muted/30 border-b border-border/50">
                        <span className="text-[8px] uppercase tracking-[1.5px] font-semibold text-muted-foreground">
                          Suas instituições
                        </span>
                        <div className="flex-1 ml-2 border-t border-border/50" />
                      </div>

                      {userRows.map(r => {
                        return (
                          <div
                            key={`${r.institution_name}-${r.specialty_name}-${r.practice_scenario}`}
                            className="grid px-5 py-[9px] items-center bg-primary/10 border-b border-border"
                            style={{ gridTemplateColumns: GRID_COLS }}
                          >
                            <span className="text-[11px] pr-2 leading-snug text-foreground">
                              {r.institution_name}
                              <span className="block text-micro-label text-muted-foreground">{r.reference_label || 'Referência indisponível'} · {r.source || 'Fonte indisponível'}</span>
                            </span>
                            <span>
                              <span className="inline-block text-[7.5px] font-bold uppercase tracking-[0.4px] px-[7px] py-[2px] rounded-full bg-primary text-white">
                                {r.specialty_name.length > 10
                                  ? `${r.specialty_name.slice(0, 10)}…`
                                  : r.specialty_name}
                              </span>
                            </span>
                            <span className="flex items-center justify-end gap-1 text-[12px] font-bold tabular-nums text-primary">
                              {r.cutoff_score_general}
                            </span>
                            <span className="text-[10.5px] text-right tabular-nums text-muted-foreground">
                              {r.cutoff_score_quota != null
                                ? `${r.cutoff_score_quota}`
                                : '—'}
                            </span>
                          </div>
                        );
                      })}
                    </>
                  )}

                  {/* ── Section separator: "Outras instituições" ─────────── */}
                  {filteredRows.length > 0 && (
                    <div className="flex items-center px-5 py-[5px] bg-muted/30 border-b border-border/50">
                      <span className="text-[8px] uppercase tracking-[1.5px] font-semibold text-muted-foreground">
                        {hasUserRows ? 'Outras instituições' : 'Instituições'}
                      </span>
                      <div className="flex-1 ml-2 border-t border-border/50" />
                    </div>
                  )}

                  {/* ── Other rows ───────────────────────────────────────── */}
                  {filteredRows.map(row => {
                    const tint = scoreTint(row.cutoff_score_general);
                    return (
                      <div
                        key={`${row.institution_name}-${row.specialty_name}-${row.practice_scenario}`}
                        className="grid px-5 py-[9px] items-center transition-colors duration-150 border-b border-border hover:bg-muted/50"
                        style={{ gridTemplateColumns: GRID_COLS }}
                      >
                        <span className="text-[11px] pr-2 leading-snug text-foreground/70">
                          {row.institution_name}
                          <span className="block text-micro-label text-muted-foreground">{row.reference_label || 'Referência indisponível'} · {row.source || 'Fonte indisponível'}</span>
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {row.specialty_name}
                        </span>
                        <span
                          className={cn(
                            'text-[12px] font-bold text-right tabular-nums',
                            tint === 'high' && 'text-info',
                            tint === 'mid' && 'text-foreground/70',
                            tint === 'low' && 'text-destructive',
                          )}
                        >
                          {row.cutoff_score_general}
                        </span>
                        <span className="text-[10.5px] text-right tabular-nums text-muted-foreground/70">
                          {row.cutoff_score_quota != null ? `${row.cutoff_score_quota}` : '—'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── Footer ────────────────────────────────────────────────── */}
            <div className="shrink-0 px-5 py-3 text-center bg-muted/30 border-t border-border">
              <p className="text-[9.5px] text-muted-foreground/70">
                Referência e fonte conforme os dados disponíveis. Escalas podem diferir da nota do simulado; não indicam chance de aprovação.
              </p>
            </div>
            </div>}

          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
