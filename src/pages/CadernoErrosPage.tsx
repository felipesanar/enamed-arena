import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { trackEvent } from '@/lib/analytics';
import { motion, useReducedMotion } from 'framer-motion';
import { PageTransition } from '@/components/premium/PageTransition';
import { PageHeader } from '@/components/PageHeader';
import { PremiumCard } from '@/components/PremiumCard';
import { SectionHeader } from '@/components/SectionHeader';
import { EmptyState } from '@/components/EmptyState';
import { SkeletonCard } from '@/components/SkeletonCard';
import { ProGate } from '@/components/ProGate';
import { useUser } from '@/contexts/UserContext';
import { useAuth } from '@/contexts/AuthContext';
import { simuladosApi } from '@/services/simuladosApi';
import { SEGMENT_ACCESS } from '@/types';
import { cn } from '@/lib/utils';
import {
  BookOpen, Trash2, Stethoscope, Filter,
  StickyNote, ExternalLink, CheckSquare, Square,
  FileText, ChevronRight,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { getReasonLabel, type DbReason } from '@/lib/errorNotebookReasons';
import { parseThemeField } from '@/lib/resultHelpers';

interface NotebookEntry {
  id: string;
  questionId: string | null;
  simuladoId: string | null;
  simuladoTitle: string | null;
  area: string | null;
  theme: string | null;
  questionNumber: number | null;
  questionText: string | null;
  reason: string;
  learningNote: string | null;
  wasCorrect: boolean;
  addedAt: string;
  resolvedAt: string | null;
}

type ReasonFilter = 'all' | DbReason;
type ResolvedFilter = 'all' | 'pending' | 'resolved';

function NotebookEntryCard({
  entry,
  onRemove,
  onToggleResolved,
}: {
  entry: NotebookEntry;
  onRemove: (id: string) => void;
  onToggleResolved: (id: string, resolved: boolean) => void;
}) {
  const addedDate = new Date(entry.addedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
  const isResolved = !!entry.resolvedAt;

  return (
    <PremiumCard className={cn('p-4 md:p-5', isResolved && 'opacity-60')}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span className="text-body font-semibold text-foreground">Questão {entry.questionNumber || '?'}</span>
            {entry.area && <span className="text-caption px-2 py-0.5 rounded-md bg-muted text-muted-foreground">{entry.area}</span>}
            {entry.theme && <span className="text-caption px-2 py-0.5 rounded-md bg-muted text-muted-foreground">{entry.theme}</span>}
          </div>
          <p className="text-caption text-muted-foreground">{entry.simuladoTitle || 'Simulado'} · {addedDate}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button onClick={() => onRemove(entry.id)} className="h-8 w-8 rounded-lg hover:bg-destructive/10 flex items-center justify-center transition-colors group" title="Remover do caderno">
            <Trash2 className="h-3.5 w-3.5 text-muted-foreground group-hover:text-destructive transition-colors" />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <StickyNote className="h-3.5 w-3.5 text-primary" />
        <span className="text-body-sm text-primary font-semibold">{getReasonLabel(entry.reason)}</span>
      </div>

      {entry.learningNote && (
        <div className="rounded-xl bg-accent/50 border border-border/30 p-3 mb-3">
          <p className="text-body-sm text-foreground leading-relaxed">{entry.learningNote}</p>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 pt-2 border-t border-border/30">
        {/* Checkbox resolver */}
        <button
          onClick={() => onToggleResolved(entry.id, !isResolved)}
          className={cn(
            'inline-flex items-center gap-2 text-body-sm font-medium transition-colors',
            isResolved ? 'text-success' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {isResolved ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
          {isResolved ? 'Resolvido' : 'Resolver erro'}
        </button>

        {/* Link to full question + comment */}
        {entry.simuladoId && entry.questionNumber && (
          <Link
            to={`/simulados/${entry.simuladoId}/correcao?q=${entry.questionNumber}`}
            className="inline-flex items-center gap-1.5 text-caption text-primary hover:text-primary/80 font-medium transition-colors"
          >
            <ExternalLink className="h-3 w-3" />
            Ver questão e comentário completos
          </Link>
        )}
      </div>
    </PremiumCard>
  );
}

function CadernoContent({ userId }: { userId: string }) {
  const prefersReducedMotion = useReducedMotion();
  const { profile } = useUser();
  const [entries, setEntries] = useState<NotebookEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters — 3-level specialty drill-down
  const [specialtyFilter, setSpecialtyFilter] = useState<string | null>(null);
  const [subspecFilter, setSubspecFilter] = useState<string | null>(null);
  const [themeFilter, setThemeFilter] = useState<string | null>(null);
  const [reasonFilter, setReasonFilter] = useState<ReasonFilter>('all');
  const [simuladoFilter, setSimuladoFilter] = useState<string | null>(null);
  const [resolvedFilter, setResolvedFilter] = useState<ResolvedFilter>('all');

  const errosTracked = useRef(false);
  useEffect(() => {
    if (loading || errosTracked.current) return;
    errosTracked.current = true;
    trackEvent('caderno_erros_viewed', {
      total_errors: entries.length,
      segment: profile?.segment ?? 'guest',
    });
  }, [loading, entries.length, profile?.segment]);

  // Track all filter changes with post-filter result_count
  const prevFiltersRef = useRef<{ specialty: string | null; subspec: string | null; theme: string | null; reason: ReasonFilter; simulado: string | null; resolved: ResolvedFilter } | null>(null);
  useEffect(() => {
    if (loading) return;
    if (prevFiltersRef.current === null) {
      prevFiltersRef.current = { specialty: specialtyFilter, subspec: subspecFilter, theme: themeFilter, reason: reasonFilter, simulado: simuladoFilter, resolved: resolvedFilter };
      return;
    }
    const prev = prevFiltersRef.current;
    const filterType =
      prev.specialty !== specialtyFilter ? 'specialty' :
      prev.subspec !== subspecFilter ? 'subspecialty' :
      prev.theme !== themeFilter ? 'theme' :
      prev.reason !== reasonFilter ? 'reason' :
      prev.simulado !== simuladoFilter ? 'simulado' :
      prev.resolved !== resolvedFilter ? 'resolved' : null;
    if (filterType) {
      trackEvent('caderno_erros_filtered', {
        filter_type: filterType,
        result_count: filtered.length,
      });
      prevFiltersRef.current = { specialty: specialtyFilter, subspec: subspecFilter, theme: themeFilter, reason: reasonFilter, simulado: simuladoFilter, resolved: resolvedFilter };
    }
  }, [specialtyFilter, subspecFilter, themeFilter, reasonFilter, simuladoFilter, resolvedFilter, loading, entries.length]);

  const fetchEntries = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const data = await simuladosApi.getErrorNotebook(userId);
      setEntries(data.map((row: any) => ({
        id: row.id,
        questionId: row.question_id,
        simuladoId: row.simulado_id,
        simuladoTitle: row.simulado_title || null,
        area: row.area,
        theme: row.theme,
        questionNumber: row.question_number || null,
        questionText: row.question_text || null,
        reason: row.reason,
        learningNote: row.learning_text,
        wasCorrect: row.was_correct,
        addedAt: row.created_at,
        resolvedAt: row.resolved_at || null,
      })));
    } catch (err) {
      console.error('[CadernoErrosPage] Error loading:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  // Derived filter options — 3-level cascade
  const specialties = useMemo(() =>
    Array.from(new Set(entries.map(e => e.area).filter(Boolean) as string[])).sort(),
  [entries]);

  const subspecialties = useMemo(() => {
    if (!specialtyFilter) return [];
    return Array.from(new Set(
      entries
        .filter(e => e.area === specialtyFilter && e.theme)
        .map(e => parseThemeField(e.theme!).specialty)
        .filter(Boolean),
    )).sort();
  }, [entries, specialtyFilter]);

  const themes = useMemo(() => {
    if (!specialtyFilter || !subspecFilter) return [];
    return Array.from(new Set(
      entries
        .filter(e => e.area === specialtyFilter && e.theme && parseThemeField(e.theme).specialty === subspecFilter)
        .map(e => parseThemeField(e.theme!).subTopic)
        .filter(Boolean),
    )).sort();
  }, [entries, specialtyFilter, subspecFilter]);

  const simulados = useMemo(() => {
    const map = new Map<string, string>();
    entries.forEach(e => { if (e.simuladoId && e.simuladoTitle) map.set(e.simuladoId, e.simuladoTitle); });
    return Array.from(map.entries());
  }, [entries]);

  const filtered = useMemo(() => {
    let data = entries;
    if (specialtyFilter) data = data.filter(e => e.area === specialtyFilter);
    if (subspecFilter) data = data.filter(e => e.theme && parseThemeField(e.theme).specialty === subspecFilter);
    if (themeFilter) data = data.filter(e => e.theme && parseThemeField(e.theme).subTopic === themeFilter);
    if (reasonFilter !== 'all') data = data.filter(e => e.reason === reasonFilter);
    if (simuladoFilter) data = data.filter(e => e.simuladoId === simuladoFilter);
    if (resolvedFilter === 'pending') data = data.filter(e => !e.resolvedAt);
    if (resolvedFilter === 'resolved') data = data.filter(e => !!e.resolvedAt);
    return data.sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime());
  }, [entries, specialtyFilter, subspecFilter, themeFilter, reasonFilter, simuladoFilter, resolvedFilter]);

  const handleSpecialtyFilter = (val: string | null) => {
    setSpecialtyFilter(val);
    setSubspecFilter(null);
    setThemeFilter(null);
  };

  const handleSubspecFilter = (val: string | null) => {
    setSubspecFilter(val);
    setThemeFilter(null);
  };

  const handleRemove = async (id: string) => {
    try {
      await simuladosApi.deleteErrorNotebookEntry(id, userId);
      setEntries(prev => prev.filter(e => e.id !== id));
    } catch (err) {
      console.error('[CadernoErrosPage] Error removing:', err);
    }
  };

  const handleToggleResolved = async (id: string, resolved: boolean) => {
    try {
      await simuladosApi.toggleResolvedEntry(id, userId, resolved);
      setEntries(prev => prev.map(e => e.id === id ? { ...e, resolvedAt: resolved ? new Date().toISOString() : null } : e));
    } catch (err) {
      console.error('[CadernoErrosPage] Error toggling resolved:', err);
    }
  };

  if (loading) {
    return (
      <>
        <PageHeader title="Caderno de Erros" subtitle="Seu material de revisão para consolidar o que importa." badge="PRO: ENAMED Exclusivo" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">{[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}</div>
        <div className="space-y-3">{[...Array(3)].map((_, i) => <SkeletonCard key={i} />)}</div>
      </>
    );
  }

  if (entries.length === 0) {
    return (
      <>
        <PageHeader title="Caderno de Erros" subtitle="Seu material de revisão para consolidar o que importa." badge="PRO: ENAMED Exclusivo" />
        <EmptyState
          icon={BookOpen}
          title="Seu caderno está vazio"
          description="Durante a correção de um simulado, salve as questões que quiser revisar. Elas aparecerão aqui."
          action={<Link to="/simulados" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground text-body font-semibold hover:bg-wine-hover transition-colors">Ver simulados</Link>}
        />
      </>
    );
  }

  const pendingCount = entries.filter(e => !e.resolvedAt).length;
  const resolvedCount = entries.filter(e => !!e.resolvedAt).length;

  return (
    <>
      <PageHeader title="Caderno de Erros" subtitle="Seu material de revisão para consolidar o que importa." badge="PRO: ENAMED Exclusivo" />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
        <PremiumCard delay={0} className="p-4"><p className="text-heading-2 text-foreground tabular-nums">{entries.length}</p><p className="text-caption text-muted-foreground">Total de questões</p></PremiumCard>
        <PremiumCard delay={0.06} className="p-4"><p className="text-heading-2 text-warning tabular-nums">{pendingCount}</p><p className="text-caption text-muted-foreground">Pendentes</p></PremiumCard>
        <PremiumCard delay={0.12} className="p-4"><p className="text-heading-2 text-success tabular-nums">{resolvedCount}</p><p className="text-caption text-muted-foreground">Resolvidos</p></PremiumCard>
        <PremiumCard delay={0.18} className="p-4"><p className="text-heading-2 text-foreground tabular-nums">{specialties.length}</p><p className="text-caption text-muted-foreground">Especialidades</p></PremiumCard>
      </div>

      {/* Advanced Filters */}
      <PremiumCard className="p-4 md:p-5 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-body font-semibold text-foreground">Filtros</span>
        </div>

        <div className="space-y-4">
          {/* 3-level specialty filter */}
          <div>
            {/* Breadcrumb header */}
            <p className="text-caption text-muted-foreground mb-1.5 flex items-center gap-1 flex-wrap">
              <Stethoscope className="h-3.5 w-3.5 shrink-0" />
              <button onClick={() => handleSpecialtyFilter(null)} className={cn('transition-colors', !specialtyFilter ? 'text-foreground font-semibold' : 'hover:text-foreground')}>Especialidade</button>
              {specialtyFilter && (<><ChevronRight className="h-3 w-3 shrink-0" /><button onClick={() => handleSubspecFilter(null)} className={cn('transition-colors', !subspecFilter ? 'text-foreground font-semibold' : 'hover:text-foreground')}>{specialtyFilter}</button></>)}
              {subspecFilter && (<><ChevronRight className="h-3 w-3 shrink-0" /><span className="text-foreground font-semibold">{subspecFilter}</span></>)}
            </p>

            {/* Level 1: Especialidade */}
            {!specialtyFilter && (
              <div className="flex flex-wrap gap-1.5">
                {specialties.map(s => (
                  <button key={s} onClick={() => handleSpecialtyFilter(s)} className="px-3 py-1.5 rounded-lg text-caption font-medium transition-all bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary">{s}</button>
                ))}
              </div>
            )}

            {/* Level 2: Subespecialidade */}
            {specialtyFilter && !subspecFilter && subspecialties.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                <button onClick={() => handleSpecialtyFilter(null)} className="px-3 py-1.5 rounded-lg text-caption font-medium transition-all bg-primary/10 text-primary">← Todas</button>
                {subspecialties.map(s => (
                  <button key={s} onClick={() => handleSubspecFilter(s)} className="px-3 py-1.5 rounded-lg text-caption font-medium transition-all bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary">{s}</button>
                ))}
              </div>
            )}
            {specialtyFilter && !subspecFilter && subspecialties.length === 0 && (
              <div className="flex flex-wrap gap-1.5">
                <button onClick={() => handleSpecialtyFilter(null)} className="px-3 py-1.5 rounded-lg text-caption font-medium transition-all bg-primary/10 text-primary">← Todas</button>
              </div>
            )}

            {/* Level 3: Tema */}
            {subspecFilter && (
              <div className="flex flex-wrap gap-1.5">
                <button onClick={() => handleSubspecFilter(null)} className="px-3 py-1.5 rounded-lg text-caption font-medium transition-all bg-primary/10 text-primary">← {specialtyFilter}</button>
                {themes.map(t => (
                  <button key={t} onClick={() => setThemeFilter(prev => prev === t ? null : t)} className={cn('px-3 py-1.5 rounded-lg text-caption font-medium transition-all', themeFilter === t ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary')}>{t}</button>
                ))}
              </div>
            )}
          </div>

          {/* Reason filter */}
          <div>
            <p className="text-caption text-muted-foreground mb-1.5 flex items-center gap-1.5"><StickyNote className="h-3.5 w-3.5" /> Tipo de erro</p>
            <div className="flex flex-wrap gap-1.5">
              {([
                { key: 'all' as ReasonFilter, label: 'Todos' },
                { key: 'did_not_know' as ReasonFilter, label: 'Não sei' },
                { key: 'did_not_remember' as ReasonFilter, label: 'Não lembrei' },
                { key: 'did_not_understand' as ReasonFilter, label: 'Não entendi' },
                { key: 'guessed_correctly' as ReasonFilter, label: 'Acertei sem certeza' },
              ]).map(f => (
                <button key={f.key} onClick={() => setReasonFilter(f.key)} className={cn('px-3 py-1.5 rounded-lg text-caption font-medium transition-all', reasonFilter === f.key ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80')}>{f.label}</button>
              ))}
            </div>
          </div>

          {/* Simulado filter */}
          {simulados.length > 1 && (
            <div>
              <p className="text-caption text-muted-foreground mb-1.5 flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" /> Simulado</p>
              <div className="flex flex-wrap gap-1.5">
                <button onClick={() => setSimuladoFilter(null)} className={cn('px-3 py-1.5 rounded-lg text-caption font-medium transition-all', !simuladoFilter ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80')}>Todos</button>
                {simulados.map(([id, title]) => (
                  <button key={id} onClick={() => setSimuladoFilter(prev => prev === id ? null : id)} className={cn('px-3 py-1.5 rounded-lg text-caption font-medium transition-all', simuladoFilter === id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80')}>{title}</button>
                ))}
              </div>
            </div>
          )}

          {/* Resolved filter */}
          <div>
            <p className="text-caption text-muted-foreground mb-1.5 flex items-center gap-1.5"><CheckSquare className="h-3.5 w-3.5" /> Status</p>
            <div className="flex flex-wrap gap-1.5">
              {([
                { key: 'all' as ResolvedFilter, label: 'Todos' },
                { key: 'pending' as ResolvedFilter, label: `Pendentes (${pendingCount})` },
                { key: 'resolved' as ResolvedFilter, label: `Resolvidos (${resolvedCount})` },
              ]).map(f => (
                <button key={f.key} onClick={() => setResolvedFilter(f.key)} className={cn('px-3 py-1.5 rounded-lg text-caption font-medium transition-all', resolvedFilter === f.key ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80')}>{f.label}</button>
              ))}
            </div>
          </div>
        </div>
      </PremiumCard>

      {/* Entries list */}
      <SectionHeader
        title={themeFilter ? `Revisão · ${themeFilter}` : subspecFilter ? `Revisão · ${subspecFilter}` : specialtyFilter ? `Revisão · ${specialtyFilter}` : 'Suas questões para revisar'}
        action={<span className="text-body-sm text-muted-foreground">{filtered.length} {filtered.length === 1 ? 'questão' : 'questões'}</span>}
      />
      {filtered.length === 0 ? (
        <EmptyState
          icon={Filter}
          title="Nenhum resultado"
          description="Nenhuma questão corresponde aos filtros selecionados."
        />
      ) : (
        <div className="space-y-3 pb-8">
          {filtered.map((entry, i) => (
            <motion.div key={entry.id} initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: prefersReducedMotion ? 0 : 0.4, delay: prefersReducedMotion ? 0 : Math.min(i * 0.04, 0.3) }}>
              <NotebookEntryCard entry={entry} onRemove={handleRemove} onToggleResolved={handleToggleResolved} />
            </motion.div>
          ))}
        </div>
      )}
    </>
  );
}

export default function CadernoErrosPage() {
  const { profile } = useUser();
  const { user } = useAuth();
  const segment = profile?.segment ?? 'guest';
  const hasAccess = SEGMENT_ACCESS[segment].cadernoErros;

  return (
    <PageTransition>
      {!hasAccess ? (
        <>
          <PageHeader title="Caderno de Erros" subtitle="Seu material de revisão para consolidar o que importa." badge="PRO: ENAMED Exclusivo" />
          <ProGate
            icon={BookOpen}
            feature="Caderno de Erros"
            description="Salve questões com motivo e anotação de aprendizado. Organize sua revisão por área e tema para estudar de forma estratégica."
            requiredSegment="pro"
            currentSegment={segment}
            benefits={[
              "Salvar questões direto da correção com motivo (errou, sem certeza)",
              "Anotação de aprendizado por questão",
              "Filtrar e revisar por área, tema, tipo de erro e simulado",
            ]}
          />
        </>
      ) : (
        <CadernoContent userId={user?.id || ''} />
      )}
    </PageTransition>
  );
}
