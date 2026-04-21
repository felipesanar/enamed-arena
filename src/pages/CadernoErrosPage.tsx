import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { trackEvent } from '@/lib/analytics';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { PageTransition } from '@/components/premium/PageTransition';
import { PageHeader } from '@/components/PageHeader';
import { ProGate } from '@/components/ProGate';
import { SkeletonCard } from '@/components/SkeletonCard';
import { useUser } from '@/contexts/UserContext';
import { useAuth } from '@/contexts/AuthContext';
import { simuladosApi } from '@/services/simuladosApi';
import { SEGMENT_ACCESS } from '@/types';
import { Link } from 'react-router-dom';
import { BookOpen } from 'lucide-react';
import { getReasonMeta, type DbReason } from '@/lib/errorNotebookReasons';
import { logger } from '@/lib/logger';
import { toast } from '@/hooks/use-toast';

// ── Types ─────────────────────────────────────────────────────────────────────

interface NotebookEntry {
  id: string;
  questionId: string | null;
  simuladoId: string | null;
  simuladoTitle: string | null;
  area: string | null;
  theme: string | null;
  questionNumber: number | null;
  reason: string;
  learningNote: string | null;
  wasCorrect: boolean;
  addedAt: string;
  resolvedAt: string | null;
}

type TypeFilter = 'all' | DbReason;

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

function calcStreak(entries: NotebookEntry[]): number {
  const dates = new Set(
    entries.filter(e => e.resolvedAt).map(e => new Date(e.resolvedAt!).toISOString().split('T')[0]),
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

// ── Check button ──────────────────────────────────────────────────────────────

function CheckBtn({ done, onToggle, label }: { done: boolean; onToggle: () => void; label: string }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onToggle}
      aria-label={label}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 28, height: 28, borderRadius: 7,
        background: done || hovered ? '#dcfce7' : '#f1f3f6',
        border: `1.5px solid ${done || hovered ? '#a7f3d0' : '#e5e7eb'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', flexShrink: 0, transition: 'all .12s',
      }}
    >
      <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke={done || hovered ? '#10b981' : '#9ca3af'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </button>
  );
}

// ── Entry card (queue row) ────────────────────────────────────────────────────

function EntryRow({
  entry,
  onRemove,
  onToggleResolved,
}: {
  entry: NotebookEntry;
  onRemove: (id: string) => void;
  onToggleResolved: (id: string, resolved: boolean) => void;
}) {
  const meta = getReasonMeta(entry.reason);
  const resolved = !!entry.resolvedAt;
  const title = `Q${entry.questionNumber ?? '?'} · ${entry.area ?? '—'}${entry.theme ? ` — ${entry.theme}` : ''}`;

  return (
    <div style={{
      background: '#fff', border: '1.5px solid #e5e7eb', borderRadius: 11,
      padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12,
      opacity: resolved ? 0.45 : 1, minHeight: 44,
    }}>
      {/* Accent bar */}
      <div style={{ width: 3, height: resolved ? 32 : 48, borderRadius: 99, background: meta.colorBase, flexShrink: 0, alignSelf: 'stretch' }} />

      {/* Main */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 12.5, fontWeight: 700, color: resolved ? '#9ca3af' : '#111827',
          marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          textDecoration: resolved ? 'line-through' : 'none',
        }}>
          {title}
        </div>
        <div style={{ fontSize: 10.5, color: '#9ca3af' }}>
          {resolved && entry.resolvedAt
            ? `resolvida em ${fmtDate(entry.resolvedAt)}`
            : `${entry.simuladoTitle ?? 'Simulado'} · ${fmtDate(entry.addedAt)}`}
        </div>
        {!resolved && meta.strategy && (
          <div style={{
            fontSize: 11, fontWeight: 600, color: meta.colorText,
            marginTop: 5, lineHeight: 1.4,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            → {meta.strategy}
          </div>
        )}
      </div>

      {/* Type badge */}
      <span style={{
        fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
        background: meta.colorBg, color: meta.colorText, flexShrink: 0,
      }}>
        {meta.badge}
      </span>

      {/* Check button */}
      <CheckBtn
        done={resolved}
        onToggle={() => onToggleResolved(entry.id, !resolved)}
        label={`Marcar questão ${entry.questionNumber} como ${resolved ? 'pendente' : 'resolvida'}`}
      />

      {/* Delete */}
      <button
        onClick={() => onRemove(entry.id)}
        title="Remover do caderno"
        style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', borderRadius: 6, flexShrink: 0 }}
      >
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" />
        </svg>
      </button>
    </div>
  );
}

// ── Hero card (next to review) ────────────────────────────────────────────────

function HeroCard({
  entry,
  onRemove,
  onToggleResolved,
}: {
  entry: NotebookEntry;
  onRemove: (id: string) => void;
  onToggleResolved: (id: string, resolved: boolean) => void;
}) {
  const meta = getReasonMeta(entry.reason);
  // Dark variant tag colors for dark background
  const tagStyle = {
    background: `${meta.colorBase}26`,   // 15% opacity
    color: `${meta.colorBase}dd`,
    border: `1px solid ${meta.colorBase}33`,
  };

  return (
    <div style={{
      borderRadius: 14, background: '#0f0a0d', border: '1px solid rgba(255,255,255,.07)',
      padding: 18, position: 'relative', overflow: 'hidden',
    }}>
      {/* Left wine gradient accent */}
      <div style={{
        position: 'absolute', top: 0, left: 0, bottom: 0, width: 3,
        background: 'linear-gradient(180deg, #a03050 0%, #7c2d44 100%)',
        borderRadius: '14px 0 0 14px',
      }} />
      {/* Gradient overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(135deg, rgba(160,48,80,.12) 0%, transparent 60%)',
        pointerEvents: 'none',
      }} />

      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12, position: 'relative', zIndex: 1 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#f1f5f9', letterSpacing: '-.01em', marginBottom: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            Q{entry.questionNumber ?? '?'} · {entry.area ?? '—'}{entry.theme ? ` — ${entry.theme}` : ''}
          </div>
          <div style={{ fontSize: 11, color: '#475569' }}>
            {entry.simuladoTitle ?? 'Simulado'} · {fmtDate(entry.addedAt)}
          </div>
        </div>
        <span style={{ fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 99, display: 'inline-flex', alignItems: 'center', flexShrink: 0, ...tagStyle }}>
          {meta.badge}
        </span>
      </div>

      {/* Learning note */}
      {entry.learningNote && (
        <div style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 9, padding: '10px 13px', marginBottom: 14, position: 'relative', zIndex: 1 }}>
          <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase' as const, color: '#f9a8d4', marginBottom: 4 }}>
            Sua anotação
          </div>
          <div style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.6, fontStyle: 'italic' }}>
            {entry.learningNote}
          </div>
        </div>
      )}

      {/* Strategy hint (from reason) */}
      {meta.strategy && (
        <div style={{
          background: `${meta.colorBase}14`,
          border: `1px solid ${meta.colorBase}38`,
          borderRadius: 9,
          padding: '10px 13px',
          marginBottom: 14,
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          alignItems: 'flex-start',
          gap: 8,
        }}>
          <span aria-hidden style={{ color: `${meta.colorBase}cc`, fontWeight: 800, lineHeight: 1.4, fontSize: 12 }}>→</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase' as const, color: `${meta.colorBase}cc`, marginBottom: 3 }}>
              Como revisar
            </div>
            <div style={{ fontSize: 12, color: '#e2e8f0', lineHeight: 1.5, fontWeight: 600 }}>
              {meta.strategy}
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, position: 'relative', zIndex: 1 }}>
        <button
          onClick={() => onToggleResolved(entry.id, true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 16px', borderRadius: 8, background: '#a03050', color: '#fff',
            fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#7c2d44'; }}
          onMouseLeave={e => { e.currentTarget.style.background = '#a03050'; }}
        >
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Marcar como resolvida
        </button>

        {entry.simuladoId && entry.questionNumber && (
          <Link
            to={`/simulados/${entry.simuladoId}/correcao?q=${entry.questionNumber}`}
            style={{ fontSize: 11.5, color: '#64748b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}
          >
            <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
            </svg>
            Ver questão completa
          </Link>
        )}

        <button
          onClick={() => onRemove(entry.id)}
          title="Remover"
          style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', borderRadius: 6 }}
        >
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="rgba(255,255,255,.3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ── CadernoContent ────────────────────────────────────────────────────────────

function CadernoContent({ userId }: { userId: string }) {
  const prefersReducedMotion = useReducedMotion();
  const { profile } = useUser();
  const [entries, setEntries] = useState<NotebookEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [specFilter, setSpecFilter] = useState<string | null>(null);
  const [showResolved, setShowResolved] = useState(false);

  const errosTracked = useRef(false);

  const fetchEntries = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const data = await simuladosApi.getErrorNotebook(userId);
      setEntries(data.map((row) => ({
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
      })));
    } catch (err) {
      logger.error('[CadernoErrosPage] Error loading:', err);
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

  const specialties = useMemo(
    () => Array.from(new Set(entries.map(e => e.area).filter(Boolean) as string[])).sort(),
    [entries],
  );

  const filtered = useMemo(() => {
    let data = entries;
    if (typeFilter !== 'all') data = data.filter(e => e.reason === typeFilter);
    if (specFilter) data = data.filter(e => e.area === specFilter);
    return [...data].sort((a, b) => new Date(a.addedAt).getTime() - new Date(b.addedAt).getTime());
  }, [entries, typeFilter, specFilter]);

  const pending = useMemo(() => filtered.filter(e => !e.resolvedAt), [filtered]);
  const resolved = useMemo(() => filtered.filter(e => !!e.resolvedAt), [filtered]);
  const streak = useMemo(() => calcStreak(entries), [entries]);
  const heroEntry = pending[0] ?? null;

  const totalPending = entries.filter(e => !e.resolvedAt).length;
  const totalResolved = entries.filter(e => !!e.resolvedAt).length;
  const allResolved = entries.length > 0 && totalPending === 0;

  const typeOptions = useMemo(
    () => Array.from(new Set(entries.map(e => e.reason as DbReason))),
    [entries],
  );

  // Analytics
  useEffect(() => {
    if (loading || errosTracked.current) return;
    errosTracked.current = true;
    trackEvent('caderno_erros_viewed', { total_errors: entries.length, segment: profile?.segment ?? 'guest' });
  }, [loading, entries.length, profile?.segment]);

  const prevFiltersRef = useRef<{ type: TypeFilter; spec: string | null } | null>(null);
  useEffect(() => {
    if (loading) return;
    if (!prevFiltersRef.current) { prevFiltersRef.current = { type: typeFilter, spec: specFilter }; return; }
    const prev = prevFiltersRef.current;
    const ft = prev.type !== typeFilter ? 'reason' : prev.spec !== specFilter ? 'specialty' : null;
    if (ft) {
      trackEvent('caderno_erros_filtered', { filter_type: ft, result_count: filtered.length });
      prevFiltersRef.current = { type: typeFilter, spec: specFilter };
    }
  }, [typeFilter, specFilter, loading, filtered.length]);

  const handleRemove = async (id: string) => {
    const confirmed = window.confirm(
      'Tem certeza que deseja remover este item do caderno? Essa ação não pode ser desfeita.',
    );
    if (!confirmed) return;

    // Optimistic removal so UX is instant; rollback on failure.
    const previousEntries = entries;
    setEntries(prev => prev.filter(e => e.id !== id));
    try {
      await simuladosApi.deleteErrorNotebookEntry(id, userId);
      toast({ title: 'Item removido do caderno' });
    } catch (err) {
      logger.error('[CadernoErrosPage] Error removing:', err);
      setEntries(previousEntries);
      toast({
        title: 'Não foi possível remover',
        description: 'Tente novamente em instantes.',
        variant: 'destructive',
      });
    }
  };

  const handleToggleResolved = async (id: string, resolvedNow: boolean) => {
    const previousEntries = entries;
    // Optimistic update
    setEntries(prev => prev.map(e =>
      e.id === id ? { ...e, resolvedAt: resolvedNow ? new Date().toISOString() : null } : e,
    ));
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

  // ── Loading ──

  if (loading) {
    return (
      <div style={{ borderRadius: 18, overflow: 'hidden', border: '1px solid rgba(255,255,255,.04)', boxShadow: '0 4px 24px rgba(0,0,0,.15)' }}>
        <div style={{ height: 180, background: '#1a1018' }} className="animate-pulse" />
        <div style={{ background: '#f1f3f6', padding: '18px 20px' }}>
          <div className="space-y-3">{[...Array(3)].map((_, i) => <SkeletonCard key={i} />)}</div>
        </div>
      </div>
    );
  }

  // ── Empty ──

  if (entries.length === 0) {
    return (
      <div style={{ borderRadius: 18, overflow: 'hidden', boxShadow: '0 0 0 1px rgba(255,255,255,.04), 0 24px 64px rgba(0,0,0,.45)' }}>
        {/* Dark hero (minimal) */}
        <div style={{ background: '#1a1018', position: 'relative', overflow: 'hidden', padding: '22px 24px 22px' }}>
          <div style={{ position: 'absolute', top: -60, left: -40, width: 320, height: 320, background: 'radial-gradient(circle, rgba(160,48,80,.22) 0%, transparent 70%)', pointerEvents: 'none' }} />
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 9.5, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' as const, color: '#f9a8d4', background: 'rgba(160,48,80,.2)', border: '1px solid rgba(160,48,80,.35)', padding: '3px 10px', borderRadius: 99, marginBottom: 8 }}>
            PRO · ENAMED Exclusivo
          </div>
          <div style={{ fontSize: 26, fontWeight: 900, color: '#f8fafc', letterSpacing: '-.03em', lineHeight: 1.1, marginBottom: 3 }}>Caderno de Erros</div>
          <div style={{ fontSize: 12, color: '#64748b' }}>Revisão ativa</div>
        </div>
        {/* Empty body */}
        <div style={{ background: '#fff', padding: '36px 22px', textAlign: 'center' }}>
          <div style={{ width: 64, height: 64, borderRadius: 18, background: '#f1f3f6', border: '1.5px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="#6b7280" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
            </svg>
          </div>
          <div style={{ fontSize: 17, fontWeight: 800, color: '#111827', letterSpacing: '-.02em', marginBottom: 7 }}>Seu Caderno está vazio</div>
          <div style={{ fontSize: 12.5, color: '#6b7280', lineHeight: 1.7, maxWidth: 260, margin: '0 auto 22px' }}>
            Na correção do simulado, toque em <strong>"Salvar no Caderno"</strong> para adicionar questões que quer dominar.
          </div>
          <Link to="/simulados" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 20px', borderRadius: 10, background: '#7c2d44', color: '#fff', fontSize: 12.5, fontWeight: 700, textDecoration: 'none' }}>
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round">
              <rect x="3" y="3" width="18" height="18" rx="2" /><line x1="9" y1="12" x2="15" y2="12" /><line x1="12" y1="9" x2="12" y2="15" />
            </svg>
            Ver simulados disponíveis
          </Link>
        </div>
      </div>
    );
  }

  const progressPct = totalResolved / entries.length;

  return (
    <div style={{ borderRadius: 18, overflow: 'hidden', boxShadow: '0 0 0 1px rgba(255,255,255,.04), 0 24px 64px rgba(0,0,0,.3)' }}>

      {/* ── Dark hero zone ── */}
      <div style={{ background: '#1a1018', position: 'relative', overflow: 'hidden', padding: '22px 24px 0' }}>
        {/* Radial wine glow */}
        <div style={{ position: 'absolute', top: -60, left: -40, width: 320, height: 320, background: 'radial-gradient(circle, rgba(160,48,80,.22) 0%, transparent 70%)', pointerEvents: 'none' }} />

        {/* Top row: title + streak */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 20, position: 'relative', zIndex: 1 }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 9.5, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' as const, color: '#f9a8d4', background: 'rgba(160,48,80,.2)', border: '1px solid rgba(160,48,80,.35)', padding: '3px 10px', borderRadius: 99, marginBottom: 8 }}>
              PRO · ENAMED Exclusivo
            </div>
            <div style={{ fontSize: 26, fontWeight: 900, color: '#f8fafc', letterSpacing: '-.03em', lineHeight: 1.1, marginBottom: 3 }}>Caderno de Erros</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>
              {allResolved ? 'Tudo revisado' : `Revisão ativa · ${entries.length} questões`}
            </div>
          </div>
          {streak > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 10, padding: '9px 13px', flexShrink: 0 }}>
              <span style={{ fontSize: 18, lineHeight: 1 }}>🔥</span>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#fb923c', lineHeight: 1, letterSpacing: '-.02em' }}>{streak}</div>
                <div style={{ fontSize: 10, color: '#64748b' }}>dias revisando</div>
              </div>
            </div>
          )}
        </div>

        {/* Big stats row */}
        <div style={{ display: 'flex', gap: 0, borderTop: '1px solid rgba(255,255,255,.07)', position: 'relative', zIndex: 1 }}>
          {[
            { val: totalPending, label: 'Pendentes', color: '#fb923c' },
            { val: totalResolved, label: 'Resolvidas', color: '#10b981' },
            { val: entries.length, label: 'Total', color: '#e2e8f0' },
            { val: specialties.length, label: 'Especialid.', color: '#e2e8f0' },
          ].map((s, i, arr) => (
            <div key={s.label} style={{ flex: 1, padding: '16px 20px', borderRight: i < arr.length - 1 ? '1px solid rgba(255,255,255,.06)' : 'none' }}>
              <div style={{ fontSize: 30, fontWeight: 900, letterSpacing: '-.04em', lineHeight: 1, marginBottom: 3, fontVariantNumeric: 'tabular-nums' as const, color: s.color }}>
                {s.val}
              </div>
              <div style={{ fontSize: 10.5, color: '#475569', fontWeight: 500 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Progress band */}
        <div style={{ background: 'rgba(255,255,255,.04)', borderTop: '1px solid rgba(255,255,255,.05)', padding: '11px 24px', display: 'flex', alignItems: 'center', gap: 12, position: 'relative', zIndex: 1 }}>
          <span style={{ fontSize: 11, color: '#475569', whiteSpace: 'nowrap' }}>Progresso</span>
          <div style={{ flex: 1, height: 5, background: 'rgba(255,255,255,.08)', borderRadius: 99, overflow: 'hidden' }}>
            <motion.div
              style={{ height: '100%', borderRadius: 99, background: 'linear-gradient(90deg, #7c2d44 0%, #a03050 100%)' }}
              initial={{ width: 0 }}
              animate={{ width: `${progressPct * 100}%` }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.8, ease: 'easeOut', delay: 0.2 }}
            />
          </div>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: '#94a3b8', whiteSpace: 'nowrap' }}>{totalResolved} / {entries.length}</span>
        </div>
      </div>

      {/* ── Filter bar (type chips) ── */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '11px 20px', display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' as const }}>
        <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' as const, color: '#9ca3af', marginRight: 3 }}>Tipo</span>

        {/* All chip */}
        <button
          onClick={() => setTypeFilter('all')}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 11px',
            borderRadius: 99, fontSize: 11.5, fontWeight: 600, border: '1.5px solid',
            cursor: 'pointer', whiteSpace: 'nowrap' as const, transition: 'all .12s',
            ...(typeFilter === 'all'
              ? { borderColor: '#7c2d44', background: '#7c2d44', color: '#fff' }
              : { borderColor: '#e5e7eb', background: '#fff', color: '#6b7280' }),
          }}
        >
          Todos <span style={{ fontSize: 10, fontWeight: 700, opacity: .7 }}>{entries.length}</span>
        </button>

        {typeOptions.map(type => {
          const meta = getReasonMeta(type);
          const count = entries.filter(e => e.reason === type).length;
          const active = typeFilter === type;
          return (
            <button
              key={type}
              onClick={() => setTypeFilter(prev => prev === type ? 'all' : type)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 11px',
                borderRadius: 99, fontSize: 11.5, fontWeight: 600, border: '1.5px solid',
                cursor: 'pointer', whiteSpace: 'nowrap' as const, transition: 'all .12s',
                ...(active
                  ? { borderColor: meta.colorBorder, background: meta.colorBg, color: meta.colorText }
                  : { borderColor: '#e5e7eb', background: '#fff', color: '#6b7280' }),
              }}
            >
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: meta.colorBase, flexShrink: 0 }} />
              {meta.badge} <span style={{ fontSize: 10, fontWeight: 700, opacity: .7 }}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* ── Spec bar (specialty chips) ── */}
      {specialties.length > 1 && (
        <div style={{ background: '#fafafa', borderBottom: '1px solid #e5e7eb', padding: '8px 20px', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' as const }}>
          <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase' as const, color: '#9ca3af', marginRight: 4 }}>Área</span>
          <button
            onClick={() => setSpecFilter(null)}
            style={{ padding: '3px 10px', borderRadius: 6, fontSize: 11, border: '1px solid', cursor: 'pointer', transition: 'all .1s', ...(!specFilter ? { background: '#f1f3f6', borderColor: '#d1d5db', color: '#111827', fontWeight: 600 } : { background: '#fff', borderColor: '#e5e7eb', color: '#6b7280', fontWeight: 500 }) }}
          >
            Todas
          </button>
          {specialties.map(s => (
            <button
              key={s}
              onClick={() => setSpecFilter(prev => prev === s ? null : s)}
              style={{ padding: '3px 10px', borderRadius: 6, fontSize: 11, border: '1px solid', cursor: 'pointer', transition: 'all .1s', ...(specFilter === s ? { background: '#f1f3f6', borderColor: '#d1d5db', color: '#111827', fontWeight: 600 } : { background: '#fff', borderColor: '#e5e7eb', color: '#6b7280', fontWeight: 500 }) }}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* ── Page body ── */}
      <div style={{ background: '#f1f3f6', padding: '18px 20px 28px' }}>

        {/* Zero pending state */}
        {allResolved && (
          <>
            <div style={{ background: '#0f0a0d', borderRadius: 18, padding: '36px 22px', textAlign: 'center' }}>
              <div style={{ width: 68, height: 68, borderRadius: '50%', border: '2px solid rgba(16,185,129,.3)', background: 'rgba(16,185,129,.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
                <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div style={{ fontSize: 17, fontWeight: 900, color: '#f1f5f9', letterSpacing: '-.02em', marginBottom: 6 }}>Caderno zerado 🎯</div>
              <div style={{ fontSize: 12.5, color: '#475569', lineHeight: 1.7, maxWidth: 240, margin: '0 auto 20px' }}>
                Você revisou e resolveu todas as questões. Esse é o nível que separa aprovados de reprovados.
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 28, marginBottom: 22 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-.04em', color: '#10b981', lineHeight: 1, marginBottom: 3 }}>{totalResolved}</div>
                  <div style={{ fontSize: 10.5, color: '#475569' }}>resolvidas</div>
                </div>
                {streak > 0 && (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-.04em', color: '#fb923c', lineHeight: 1, marginBottom: 3 }}>🔥 {streak}</div>
                    <div style={{ fontSize: 10.5, color: '#475569' }}>dias de streak</div>
                  </div>
                )}
              </div>
              <button
                onClick={() => setShowResolved(true)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 9, background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)', color: '#94a3b8', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}
              >
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                </svg>
                Ver questões resolvidas
              </button>
            </div>
            <AnimatePresence>
              {showResolved && resolved.length > 0 && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} style={{ marginTop: 20 }}>
                  <ResolvedSection entries={resolved} onRemove={handleRemove} onToggleResolved={handleToggleResolved} prefersReducedMotion={!!prefersReducedMotion} />
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}

        {/* Normal state */}
        {!allResolved && filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '32px 16px', color: '#6b7280', fontSize: 12.5 }}>
            Nenhuma questão corresponde aos filtros selecionados.
          </div>
        )}

        {!allResolved && filtered.length > 0 && (
          <>
            {/* Hero card */}
            {heroEntry && (
              <div style={{ marginBottom: 22 }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' as const, color: '#9ca3af', marginBottom: 9, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                  </svg>
                  Próxima para revisar
                </div>
                <HeroCard entry={heroEntry} onRemove={handleRemove} onToggleResolved={handleToggleResolved} />
              </div>
            )}

            {/* Queue */}
            {pending.length > 1 && (
              <div style={{ marginBottom: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase' as const, color: '#9ca3af' }}>Na fila</span>
                  <span style={{ fontSize: 11, color: '#9ca3af' }}>{pending.length - 1} restantes</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 6 }}>
                  {pending.slice(1).map((entry, i) => (
                    <motion.div
                      key={entry.id}
                      initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: Math.min(i * 0.04, 0.3) }}
                    >
                      <EntryRow entry={entry} onRemove={handleRemove} onToggleResolved={handleToggleResolved} />
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Resolved toggle */}
            {resolved.length > 0 && (
              <div style={{ marginTop: 18 }}>
                {!showResolved ? (
                  <button
                    onClick={() => setShowResolved(true)}
                    style={{ fontSize: 11.5, color: '#9ca3af', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0' }}
                  >
                    Ver {resolved.length} questões resolvidas ↓
                  </button>
                ) : (
                  <ResolvedSection entries={resolved} onRemove={handleRemove} onToggleResolved={handleToggleResolved} prefersReducedMotion={!!prefersReducedMotion} />
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Resolved section ──────────────────────────────────────────────────────────

function ResolvedSection({ entries, onRemove, onToggleResolved, prefersReducedMotion }: {
  entries: NotebookEntry[];
  onRemove: (id: string) => void;
  onToggleResolved: (id: string, resolved: boolean) => void;
  prefersReducedMotion: boolean;
}) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase' as const, color: '#9ca3af' }}>Resolvidas</span>
        <span style={{ fontSize: 11, color: '#9ca3af' }}>{entries.length}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 6 }}>
        {entries.map((entry, i) => (
          <motion.div
            key={entry.id}
            initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: Math.min(i * 0.04, 0.3) }}
          >
            <EntryRow entry={entry} onRemove={onRemove} onToggleResolved={onToggleResolved} />
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ── Page export ───────────────────────────────────────────────────────────────

export default function CadernoErrosPage() {
  const { profile } = useUser();
  const { user } = useAuth();
  const segment = profile?.segment ?? 'guest';
  const hasAccess = SEGMENT_ACCESS[segment].cadernoErros;

  return (
    <PageTransition>
      {!hasAccess ? (
        <>
          <PageHeader
            title="Caderno de Erros"
            subtitle="Seu material de revisão para consolidar o que importa."
            badge="PRO: ENAMED Exclusivo"
          />
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
        </>
      ) : (
        <CadernoContent userId={user?.id || ''} />
      )}
    </PageTransition>
  );
}
