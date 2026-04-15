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
  const hasActiveFilters = specialtyFilter !== 'all' || search.trim() !== '';

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
            className="absolute inset-0"
            style={{ backdropFilter: 'blur(6px)', background: 'rgba(0,0,0,0.5)' }}
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
            className="relative w-full max-w-lg h-full flex flex-col overflow-hidden"
            style={{
              background: '#100910',
              borderLeft: '1px solid rgba(255,255,255,0.07)',
            }}
          >

            {/* ── Header ──────────────────────────────────────────────── */}
            <div className="shrink-0 px-5 pt-5 pb-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p
                    className="text-[9px] uppercase tracking-[2.5px] font-bold mb-1"
                    style={{ color: 'rgba(255,255,255,0.25)' }}
                  >
                    ENAMED 2026
                  </p>
                  <h2 className="text-[17px] font-extrabold tracking-tight text-white">
                    Notas de Corte
                  </h2>
                </div>
                <button
                  ref={closeBtnRef}
                  type="button"
                  onClick={onClose}
                  aria-label="Fechar"
                  className="h-8 w-8 rounded-[9px] flex items-center justify-center transition-all duration-200"
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.09)',
                    color: 'rgba(255,255,255,0.5)',
                  }}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* ── Hero card (only when userRow was found) ────────────── */}
              {heroState !== 'no_data' && userRow && (
                <div
                  className="mb-3 rounded-[13px] relative overflow-hidden"
                  style={{
                    padding: '13px 15px 12px',
                    ...(heroState === 'fail'
                      ? {
                          background:
                            'linear-gradient(135deg, rgba(239,68,68,0.10) 0%, rgba(220,38,38,0.05) 100%)',
                          border: '1px solid rgba(239,68,68,0.20)',
                          boxShadow:
                            '0 8px 24px -6px rgba(239,68,68,0.08), inset 0 1px 0 rgba(255,255,255,0.04)',
                        }
                      : {
                          background:
                            'linear-gradient(135deg, rgba(99,179,237,0.12) 0%, rgba(139,92,246,0.06) 100%)',
                          border: '1px solid rgba(99,179,237,0.22)',
                          boxShadow:
                            '0 8px 24px -6px rgba(99,179,237,0.1), inset 0 1px 0 rgba(255,255,255,0.05)',
                        }),
                  }}
                  aria-label="Sua nota de corte"
                >
                  {/* Orb glow */}
                  <div
                    className="absolute -top-10 -right-10 w-24 h-24 rounded-full pointer-events-none"
                    style={{
                      background:
                        heroState === 'fail'
                          ? 'radial-gradient(circle, rgba(248,113,113,0.1) 0%, transparent 70%)'
                          : 'radial-gradient(circle, rgba(125,211,252,0.1) 0%, transparent 70%)',
                    }}
                    aria-hidden
                  />

                  {/* Label + pass/fail badge */}
                  <div className="relative z-10 flex items-start justify-between mb-2">
                    <p
                      className="text-[8.5px] uppercase tracking-[2px]"
                      style={{ color: 'rgba(255,255,255,0.25)' }}
                    >
                      Sua nota de corte
                    </p>
                    {heroState === 'pass' && (
                      <span
                        className="text-[8px] font-bold tracking-[0.5px] uppercase"
                        style={{ color: 'rgba(125,211,252,0.7)' }}
                      >
                        PASSARIA ✓
                      </span>
                    )}
                    {heroState === 'fail' && (
                      <span
                        className="text-[8px] font-bold tracking-[0.5px] uppercase"
                        style={{ color: 'rgba(248,113,113,0.7)' }}
                      >
                        NÃO PASSARIA ✗
                      </span>
                    )}
                  </div>

                  {/* Score numbers */}
                  <div className="relative z-10 flex items-end gap-4 mb-2">
                    <div className="flex flex-col">
                      <span
                        className="font-black leading-none"
                        style={{
                          fontSize: '2.25rem',
                          letterSpacing: '-1.5px',
                          color: heroState === 'fail' ? '#f87171' : '#7dd3fc',
                        }}
                      >
                        {userRow.cutoff_score_general}
                      </span>
                      <span
                        className="text-[8.5px] uppercase tracking-[1.2px] mt-[3px]"
                        style={{ color: 'rgba(255,255,255,0.4)' }}
                      >
                        Geral
                      </span>
                    </div>
                    {userRow.cutoff_score_quota != null && (
                      <>
                        <div
                          className="w-px mb-[5px]"
                          style={{ height: '28px', background: 'rgba(255,255,255,0.1)' }}
                        />
                        <div className="flex flex-col">
                          <span
                            className="font-bold leading-none"
                            style={{ fontSize: '1.4rem', color: 'rgba(255,255,255,0.65)' }}
                          >
                            {userRow.cutoff_score_quota}
                          </span>
                          <span
                            className="text-[8.5px] uppercase tracking-[1.2px] mt-[3px]"
                            style={{ color: 'rgba(255,255,255,0.4)' }}
                          >
                            Cotas
                          </span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Institution + specialty pill */}
                  <div className="relative z-10 flex items-center gap-2 flex-wrap">
                    <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.45)' }}>
                      {userRow.institution_name}
                    </span>
                    <span style={{ color: 'rgba(255,255,255,0.15)' }}>·</span>
                    <span
                      className="inline-flex px-[9px] py-[2px] rounded-full text-[8px] font-bold uppercase tracking-[0.3px]"
                      style={{
                        background: 'rgba(122,26,50,0.85)',
                        border: '1px solid rgba(255,150,170,0.25)',
                        color: 'white',
                      }}
                    >
                      {userRow.specialty_name}
                    </span>
                  </div>
                </div>
              )}

              {/* ── Search ────────────────────────────────────────────── */}
              <div className="relative mb-[9px]">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4"
                  style={{ color: 'rgba(255,255,255,0.25)' }}
                />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar instituição ou especialidade..."
                  aria-label="Buscar instituição ou especialidade"
                  className="w-full h-9 pl-9 pr-4 rounded-[10px] text-[12.5px] text-white outline-none transition-all duration-200"
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.09)',
                  }}
                  onFocus={e => {
                    e.currentTarget.style.borderColor = 'rgba(255,150,170,0.3)';
                    e.currentTarget.style.boxShadow = '0 0 0 2px rgba(255,150,170,0.08)';
                  }}
                  onBlur={e => {
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                />
              </div>

              {/* ── Filter toggle ──────────────────────────────────────── */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setShowFilters(f => !f)}
                  className="relative inline-flex items-center gap-1.5 px-3 py-[5px] rounded-full text-[12px] font-medium transition-all duration-200"
                  style={
                    showFilters || hasActiveFilters
                      ? {
                          background: 'rgba(122,26,50,0.85)',
                          border: '1px solid rgba(255,150,170,0.25)',
                          color: 'white',
                        }
                      : {
                          background: 'rgba(255,255,255,0.06)',
                          border: '1px solid rgba(255,255,255,0.09)',
                          color: 'rgba(255,255,255,0.5)',
                        }
                  }
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  Filtrar
                  {hasActiveFilters && !showFilters && (
                    <span
                      className="absolute -top-[3px] -right-[3px] h-[8px] w-[8px] rounded-full"
                      style={{ background: '#ffcbd8', boxShadow: '0 0 4px rgba(255,203,216,0.5)' }}
                    />
                  )}
                  <ChevronDown
                    className={cn(
                      'h-3 w-3 transition-transform duration-200',
                      showFilters && 'rotate-180',
                    )}
                  />
                </button>
                <span
                  className="text-[10.5px] tabular-nums"
                  style={{ color: hasActiveFilters ? 'rgba(255,203,216,0.7)' : 'rgba(255,255,255,0.25)' }}
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
                    className="text-[10.5px] underline underline-offset-2 transition-colors"
                    style={{ color: 'rgba(255,150,170,0.5)' }}
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
                        className="px-3 py-[5px] rounded-full text-[11px] font-medium transition-all duration-200"
                        style={
                          specialtyFilter === 'all'
                            ? {
                                background: 'rgba(122,26,50,0.85)',
                                border: '1px solid rgba(255,150,170,0.25)',
                                color: 'white',
                              }
                            : {
                                background: 'rgba(255,255,255,0.06)',
                                border: '1px solid rgba(255,255,255,0.09)',
                                color: 'rgba(255,255,255,0.5)',
                              }
                        }
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
                            className="px-3 py-[5px] rounded-full text-[11px] font-medium transition-all duration-200"
                            style={
                              isActive
                                ? {
                                    background: 'rgba(122,26,50,0.85)',
                                    border: '1px solid rgba(255,150,170,0.25)',
                                    color: 'white',
                                  }
                                : {
                                    background: 'rgba(255,255,255,0.06)',
                                    border: '1px solid rgba(255,255,255,0.09)',
                                    color: isMine
                                      ? 'rgba(255,255,255,0.7)'
                                      : 'rgba(255,255,255,0.5)',
                                  }
                            }
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
            <div className="shrink-0 h-px" style={{ background: 'rgba(255,255,255,0.07)' }} />

            {/* ── Table column header (sticky) ───────────────────────────── */}
            <div
              className="shrink-0 grid px-5 py-2"
              style={{
                gridTemplateColumns: '1fr 88px 56px 52px',
                background: 'rgba(255,255,255,0.03)',
                borderBottom: '1px solid rgba(255,255,255,0.07)',
              }}
            >
              {(['Instituição', 'Especialidade', 'Geral', 'Cotas'] as const).map((h, i) => (
                <span
                  key={h}
                  className={cn(
                    'text-[8.5px] uppercase tracking-[1.3px] font-bold',
                    i >= 2 && 'text-right',
                  )}
                  style={{ color: 'rgba(255,255,255,0.25)' }}
                >
                  {h}
                </span>
              ))}
            </div>

            {/* ── Scrollable body ────────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto">
              {isLoading && (
                <div className="flex items-center justify-center py-16">
                  <div className="h-6 w-6 rounded-full border-2 border-white/10 border-t-white/40 animate-spin" />
                </div>
              )}

              {!isLoading && filteredRows.length === 0 && !userRow && (
                <div className="flex flex-col items-center justify-center py-16 gap-2">
                  <Search className="h-8 w-8" style={{ color: 'rgba(255,255,255,0.12)' }} />
                  <p className="text-[13px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    Nenhum resultado encontrado.
                  </p>
                  {search && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearch('');
                        setSpecialtyFilter('all');
                      }}
                      className="text-[12px] underline underline-offset-2 transition-colors"
                      style={{ color: 'rgba(255,150,170,0.5)' }}
                    >
                      Limpar filtros
                    </button>
                  )}
                </div>
              )}

              {!isLoading && (filteredRows.length > 0 || userRow) && (
                <div>
                  {/* ── Pinned user row ──────────────────────────────────── */}
                  {userRow && (
                    <>
                      <div
                        className="flex items-center px-5 py-[5px]"
                        style={{
                          background: 'rgba(255,255,255,0.02)',
                          borderBottom: '1px solid rgba(255,255,255,0.04)',
                        }}
                      >
                        <span
                          className="text-[8px] uppercase tracking-[1.5px] font-semibold"
                          style={{ color: 'rgba(255,255,255,0.2)' }}
                        >
                          Sua instituição
                        </span>
                        <div
                          className="flex-1 ml-2"
                          style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
                        />
                      </div>

                      <div
                        className="grid px-5 py-[9px] items-center"
                        style={{
                          gridTemplateColumns: '1fr 88px 56px 52px',
                          background: 'rgba(122,26,50,0.28)',
                          borderBottom: '1px solid rgba(255,255,255,0.05)',
                        }}
                      >
                        <span
                          className="text-[11px] pr-2 leading-snug"
                          style={{ color: 'rgba(255,255,255,0.85)' }}
                        >
                          {userRow.institution_name}
                        </span>
                        <span>
                          <span
                            className="inline-block text-[7.5px] font-bold uppercase tracking-[0.4px] px-[7px] py-[2px] rounded-full"
                            style={{
                              background: 'rgba(122,26,50,0.6)',
                              border: '1px solid rgba(255,150,170,0.2)',
                              color: '#ffcbd8',
                            }}
                          >
                            {userRow.specialty_name.length > 10
                              ? `${userRow.specialty_name.slice(0, 10)}…`
                              : userRow.specialty_name}
                          </span>
                        </span>
                        <span
                          className="text-[12px] font-bold text-right tabular-nums"
                          style={{ color: '#ffcbd8' }}
                        >
                          {userRow.cutoff_score_general}%
                        </span>
                        <span
                          className="text-[10.5px] text-right tabular-nums"
                          style={{ color: 'rgba(255,255,255,0.3)' }}
                        >
                          {userRow.cutoff_score_quota != null
                            ? `${userRow.cutoff_score_quota}`
                            : '—'}
                        </span>
                      </div>
                    </>
                  )}

                  {/* ── Section separator: "Outras instituições" ─────────── */}
                  {filteredRows.length > 0 && (
                    <div
                      className="flex items-center px-5 py-[5px]"
                      style={{
                        background: 'rgba(255,255,255,0.02)',
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                      }}
                    >
                      <span
                        className="text-[8px] uppercase tracking-[1.5px] font-semibold"
                        style={{ color: 'rgba(255,255,255,0.2)' }}
                      >
                        {userRow ? 'Outras instituições' : 'Instituições'}
                      </span>
                      <div
                        className="flex-1 ml-2"
                        style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
                      />
                    </div>
                  )}

                  {/* ── Other rows ───────────────────────────────────────── */}
                  {filteredRows.map(row => {
                    const tint = scoreTint(row.cutoff_score_general);
                    const scoreColor =
                      tint === 'high'
                        ? 'rgba(125,211,252,0.85)'
                        : tint === 'low'
                        ? 'rgba(248,113,113,0.75)'
                        : 'rgba(255,255,255,0.65)';

                    return (
                      <div
                        key={`${row.institution_name}-${row.specialty_name}`}
                        className="grid px-5 py-[9px] items-center transition-colors duration-150 hover:bg-white/[0.025]"
                        style={{
                          gridTemplateColumns: '1fr 88px 56px 52px',
                          borderBottom: '1px solid rgba(255,255,255,0.05)',
                        }}
                      >
                        <span
                          className="text-[11px] pr-2 leading-snug"
                          style={{ color: 'rgba(255,255,255,0.7)' }}
                        >
                          {row.institution_name}
                        </span>
                        <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.45)' }}>
                          {row.specialty_name}
                        </span>
                        <span
                          className="text-[12px] font-bold text-right tabular-nums"
                          style={{ color: scoreColor }}
                        >
                          {row.cutoff_score_general}
                        </span>
                        <span
                          className="text-[10.5px] text-right tabular-nums"
                          style={{ color: 'rgba(255,255,255,0.3)' }}
                        >
                          {row.cutoff_score_quota != null ? `${row.cutoff_score_quota}` : '—'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── Footer ────────────────────────────────────────────────── */}
            <div
              className="shrink-0 px-5 py-3 text-center"
              style={{
                background: 'rgba(255,255,255,0.02)',
                borderTop: '1px solid rgba(255,255,255,0.07)',
              }}
            >
              <p className="text-[9.5px]" style={{ color: 'rgba(255,255,255,0.18)' }}>
                Dados referentes ao último processo seletivo ENAMED disponível.
              </p>
            </div>

          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
