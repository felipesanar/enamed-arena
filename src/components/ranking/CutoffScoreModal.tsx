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
  userInstitution?: string;   // first institution from onboarding
  currentUserScore?: number;  // user's score % for pass/fail badge (same unit as cutoff_score_general)
}

function scoreTint(score: number): 'high' | 'mid' | 'low' {
  if (score >= 80) return 'high';
  if (score >= 74) return 'mid';
  return 'low';
}

export function CutoffScoreModal({
  open,
  onClose,
  userSpecialty,
  userInstitution,
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

  // User's own cutoff row — pinned at top, derived without an extra query
  const userRow = useMemo(() => {
    if (!userSpecialty || !userInstitution) return null;
    return (
      rows.find(
        r =>
          r.specialty_name.toLowerCase() === userSpecialty.toLowerCase() &&
          r.institution_name.toLowerCase().includes(userInstitution.toLowerCase().trim()),
      ) ?? null
    );
  }, [rows, userSpecialty, userInstitution]);

  // Hero card state
  const heroState: 'no_data' | 'no_score' | 'pass' | 'fail' =
    !userRow
      ? 'no_data'
      : currentUserScore == null
      ? 'no_score'
      : currentUserScore >= userRow.cutoff_score_general
      ? 'pass'
      : 'fail';

  // Normalize for accent-insensitive search
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[-–—]/g, '-');

  // Filtered rows — excludes the pinned userRow
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

    // Exclude the pinned user row from the scrollable list
    if (userRow) {
      filtered = filtered.filter(
        r =>
          !(
            r.institution_name === userRow.institution_name &&
            r.specialty_name === userRow.specialty_name
          ),
      );
    }

    return filtered;
  }, [rows, search, specialtyFilter, userRow]);

  const normalizedSpecialty = userSpecialty?.toLowerCase() ?? '';
  const resultCount = filteredRows.length + (userRow ? 1 : 0);

  if (!open) return null;

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0"
            style={{ backdropFilter: 'blur(6px)', background: 'rgba(0,0,0,0.5)' }}
            onClick={onClose}
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 34, mass: 0.9 }}
            role="dialog"
            aria-modal="true"
            aria-label="Notas de Corte ENAMED"
            className="relative w-full max-w-lg h-full flex flex-col overflow-hidden"
            style={{
              background: 'linear-gradient(180deg, #1e0a14 0%, #140810 100%)',
              borderLeft: '1px solid rgba(255,150,170,0.1)',
            }}
          >
            {/* ── Header ──────────────────────────────────────── */}
            <div className="shrink-0 px-5 pt-5 pb-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-[10px] uppercase tracking-[1.5px] font-bold mb-1"
                    style={{ color: 'rgba(255,180,200,0.4)' }}>
                    ENAMED 2026
                  </p>
                  <h2 className="text-lg font-bold text-white">Notas de Corte</h2>
                </div>
                <button
                  ref={closeBtnRef}
                  type="button"
                  onClick={onClose}
                  aria-label="Fechar"
                  className="h-9 w-9 rounded-xl flex items-center justify-center transition-all duration-200 hover:scale-105"
                  style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)' }}
                >
                  <X className="h-4.5 w-4.5" />
                </button>
              </div>

              {/* ── Search ──────────────────────────────────────── */}
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'rgba(255,255,255,0.3)' }} />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar instituição ou especialidade..."
                  className="w-full h-10 pl-10 pr-4 rounded-xl text-[13px] text-white placeholder:text-white/25 outline-none transition-all duration-200 focus:ring-1"
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(255,150,170,0.3)';
                    e.currentTarget.style.boxShadow = '0 0 0 2px rgba(255,150,170,0.08)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                />
              </div>

              {/* ── Filter toggle + specialty pills ─────────────── */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setShowFilters(f => !f)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium transition-all duration-200"
                  style={{
                    background: showFilters ? 'rgba(255,150,170,0.15)' : 'rgba(255,255,255,0.06)',
                    border: `1px solid ${showFilters ? 'rgba(255,150,170,0.25)' : 'rgba(255,255,255,0.08)'}`,
                    color: showFilters ? '#ffb0c8' : 'rgba(255,255,255,0.5)',
                  }}
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  Filtrar
                  <ChevronDown className={cn('h-3 w-3 transition-transform duration-200', showFilters && 'rotate-180')} />
                </button>

                {/* Counter badge */}
                <span className="text-[11px] tabular-nums" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  {resultCount} {resultCount === 1 ? 'resultado' : 'resultados'}
                </span>
              </div>

              {/* ── Specialty filter pills ──────────────────────── */}
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
                        className="px-3 py-1.5 rounded-full text-[11px] font-medium transition-all duration-200"
                        style={{
                          background: specialtyFilter === 'all' ? 'rgba(255,150,170,0.2)' : 'rgba(255,255,255,0.04)',
                          border: `1px solid ${specialtyFilter === 'all' ? 'rgba(255,150,170,0.35)' : 'rgba(255,255,255,0.06)'}`,
                          color: specialtyFilter === 'all' ? '#ffd0e0' : 'rgba(255,255,255,0.4)',
                        }}
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
                            className="px-3 py-1.5 rounded-full text-[11px] font-medium transition-all duration-200"
                            style={{
                              background: isActive
                                ? 'rgba(255,150,170,0.2)'
                                : isMine
                                ? 'rgba(74,222,128,0.08)'
                                : 'rgba(255,255,255,0.04)',
                              border: `1px solid ${
                                isActive
                                  ? 'rgba(255,150,170,0.35)'
                                  : isMine
                                  ? 'rgba(74,222,128,0.2)'
                                  : 'rgba(255,255,255,0.06)'
                              }`,
                              color: isActive
                                ? '#ffd0e0'
                                : isMine
                                ? '#86efac'
                                : 'rgba(255,255,255,0.4)',
                            }}
                          >
                            {spec}
                            {isMine && ' ★'}
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* ── Divider ─────────────────────────────────────── */}
            <div className="shrink-0 h-px mx-5" style={{ background: 'rgba(255,255,255,0.06)' }} />

            {/* ── Table header (sticky) ───────────────────────── */}
            <div
              className="shrink-0 grid px-5 py-2.5"
              style={{
                gridTemplateColumns: '1fr 140px 70px 60px',
                background: 'rgba(20,8,16,0.95)',
              }}
            >
              {['Instituição', 'Especialidade', 'Geral', 'Cotas'].map((h, i) => (
                <span
                  key={h}
                  className={cn(
                    'text-[10px] uppercase tracking-[1.2px] font-bold',
                    i >= 2 && 'text-right',
                  )}
                  style={{ color: 'rgba(255,255,255,0.25)' }}
                >
                  {h}
                </span>
              ))}
            </div>

            {/* ── Content ─────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto">
              {isLoading && (
                <div className="flex items-center justify-center py-16">
                  <div className="h-6 w-6 rounded-full border-2 border-white/10 border-t-white/40 animate-spin" />
                </div>
              )}
              {!isLoading && filteredRows.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 gap-2">
                  <Search className="h-8 w-8" style={{ color: 'rgba(255,255,255,0.12)' }} />
                  <p className="text-[13px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    Nenhum resultado encontrado.
                  </p>
                  {search && (
                    <button
                      type="button"
                      onClick={() => { setSearch(''); setSpecialtyFilter('all'); }}
                      className="text-[12px] underline underline-offset-2 transition-colors"
                      style={{ color: 'rgba(255,180,200,0.5)' }}
                    >
                      Limpar filtros
                    </button>
                  )}
                </div>
              )}
              {!isLoading && filteredRows.length > 0 && (
                <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                  {filteredRows.map((row) => {
                    const isMine = row.specialty_name.toLowerCase() === normalizedSpecialty;
                    return (
                      <div
                        key={`${row.institution_name}-${row.specialty_name}`}
                        className="grid px-5 py-3 items-center transition-colors duration-150 hover:bg-white/[0.03]"
                        style={{
                          gridTemplateColumns: '1fr 140px 70px 60px',
                          background: isMine ? 'rgba(122,26,50,0.15)' : undefined,
                          borderBottom: '1px solid rgba(255,255,255,0.04)',
                        }}
                      >
                        <span
                          className="text-[12.5px] pr-3 leading-snug"
                          style={{ color: isMine ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.55)' }}
                        >
                          {row.institution_name}
                        </span>
                        <span
                          className="text-[12px] font-semibold"
                          style={{ color: isMine ? '#ffb8cc' : 'rgba(255,255,255,0.45)' }}
                        >
                          {row.specialty_name}
                        </span>
                        <span
                          className={cn('text-[13px] text-right font-bold tabular-nums', isMine && 'text-white')}
                          style={!isMine ? { color: 'rgba(255,255,255,0.7)' } : undefined}
                        >
                          {row.cutoff_score_general}%
                        </span>
                        <span
                          className="text-[12px] text-right tabular-nums"
                          style={{ color: 'rgba(255,255,255,0.35)' }}
                        >
                          {row.cutoff_score_quota != null ? `${row.cutoff_score_quota}%` : '—'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── Footer ──────────────────────────────────────── */}
            <div className="shrink-0 px-5 py-3" style={{ background: 'rgba(20,8,16,0.9)', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <p className="text-[10px] text-center" style={{ color: 'rgba(255,255,255,0.2)' }}>
                Dados referentes ao último processo seletivo ENAMED disponível.
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
