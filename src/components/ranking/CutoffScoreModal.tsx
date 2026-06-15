import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, SlidersHorizontal, ChevronDown } from 'lucide-react';
import { fetchAllCutoffScores } from '@/services/rankingApi';
import { cn } from '@/lib/utils';

interface CutoffScoreModalProps {
  open: boolean;
  onClose: () => void;
  userSpecialty?: string;
  /** Canonical institution names from onboarding, in profile order */
  userInstitutions?: string[];
  currentUserScore?: number; // user's score % for pass/fail badge (same unit as cutoff_score_general)
}

function scoreTint(score: number): 'high' | 'mid' | 'low' {
  if (score >= 80) return 'high';
  if (score >= 74) return 'mid';
  return 'low';
}

const GRID_COLS = '1fr 88px 64px 52px';

export function CutoffScoreModal({
  open,
  onClose,
  userSpecialty,
  userInstitutions,
  currentUserScore,
}: CutoffScoreModalProps) {
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const [search, setSearch] = useState('');
  const [specialtyFilter, setSpecialtyFilter] = useState<string>(userSpecialty ?? 'all');
  const [showFilters, setShowFilters] = useState(false);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['all-cutoff-scores'],
    queryFn: fetchAllCutoffScores,
    staleTime: Infinity,
    enabled: open,
  });

  // Reset / initialize filters on open/close — auto-selects user's specialty on open
  useEffect(() => {
    if (open) {
      setSpecialtyFilter(userSpecialty ?? 'all');
      closeBtnRef.current?.focus();
    } else {
      setSearch('');
      setSpecialtyFilter('all');
      setShowFilters(false);
    }
  }, [open, userSpecialty]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

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
        <div className="fixed inset-0 z-50 flex justify-end">

          {/* ── Backdrop ──────────────────────────────────────────────── */}
          <motion.div
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
            className="relative w-full max-w-lg h-full flex flex-col overflow-hidden bg-card border-l border-border"
          >

            {/* ── Header ──────────────────────────────────────────────── */}
            <div className="shrink-0 px-5 pt-5 pb-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-[9px] uppercase tracking-[2.5px] font-bold mb-1 text-muted-foreground/70">
                    ENAMED 2026
                  </p>
                  <h2 className="text-[17px] font-extrabold tracking-tight text-foreground">
                    Notas de Corte
                  </h2>
                </div>
                <button
                  ref={closeBtnRef}
                  type="button"
                  onClick={onClose}
                  aria-label="Fechar"
                  className="h-8 w-8 rounded-[9px] flex items-center justify-center transition-all duration-200 bg-muted border border-border text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

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
            </div>

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
              {isLoading && (
                <div className="flex items-center justify-center py-16">
                  <div className="h-6 w-6 rounded-full border-2 animate-spin border-border border-t-foreground/40" />
                </div>
              )}

              {!isLoading && filteredRows.length === 0 && !hasUserRows && (
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

              {!isLoading && (filteredRows.length > 0 || hasUserRows) && (
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
                        const passes =
                          currentUserScore != null
                            ? currentUserScore >= r.cutoff_score_general
                            : null;
                        return (
                          <div
                            key={`${r.institution_name}-${r.specialty_name}-${r.practice_scenario}`}
                            className="grid px-5 py-[9px] items-center bg-primary/10 border-b border-border"
                            style={{ gridTemplateColumns: GRID_COLS }}
                          >
                            <span className="text-[11px] pr-2 leading-snug text-foreground">
                              {r.institution_name}
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
                              {passes != null && (
                                <span
                                  aria-label={passes ? 'acima do corte' : 'abaixo do corte'}
                                  className={cn(
                                    'text-[10px] font-bold',
                                    passes ? 'text-success' : 'text-destructive',
                                  )}
                                >
                                  {passes ? '✓' : '✗'}
                                </span>
                              )}
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
                Dados referentes ao último processo seletivo ENAMED disponível.
              </p>
            </div>

          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
