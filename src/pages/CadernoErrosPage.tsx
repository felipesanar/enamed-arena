import { useState, useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AppLayout } from '@/components/AppLayout';
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
  BookOpen, Trash2, Stethoscope,
  ChevronDown, ChevronUp, StickyNote,
} from 'lucide-react';
import { Link } from 'react-router-dom';

// Map DB enum to display labels
const REASON_LABELS: Record<string, string> = {
  did_not_know: 'Não sei o conteúdo',
  did_not_remember: 'Não lembrei na hora',
  did_not_understand: 'Não entendi a questão',
  guessed_correctly: 'Acertei sem certeza',
};

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
}

function NotebookEntryCard({ entry, onRemove }: { entry: NotebookEntry; onRemove: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const addedDate = new Date(entry.addedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <PremiumCard className="p-4 md:p-5">
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
          <span className={cn('text-caption font-bold px-2 py-0.5 rounded-md', entry.wasCorrect ? 'bg-warning/10 text-warning' : 'bg-destructive/10 text-destructive')}>
            {entry.wasCorrect ? 'Sem certeza' : 'Errou'}
          </span>
          <button onClick={() => onRemove(entry.id)} className="h-8 w-8 rounded-lg hover:bg-destructive/10 flex items-center justify-center transition-colors group" title="Remover do caderno">
            <Trash2 className="h-3.5 w-3.5 text-muted-foreground group-hover:text-destructive transition-colors" />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <StickyNote className="h-3.5 w-3.5 text-primary" />
        <span className="text-body-sm text-primary font-semibold">{REASON_LABELS[entry.reason] || entry.reason}</span>
      </div>

      {entry.learningNote && (
        <div className="rounded-xl bg-accent/50 border border-border/30 p-3 mb-3">
          <p className="text-body-sm text-foreground leading-relaxed">{entry.learningNote}</p>
        </div>
      )}

      {entry.questionText && (
        <>
          <button onClick={() => setExpanded(v => !v)} className="inline-flex items-center gap-1.5 text-caption text-muted-foreground hover:text-foreground transition-colors font-medium">
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {expanded ? 'Ocultar enunciado' : 'Ver enunciado'}
          </button>
          <AnimatePresence>
            {expanded && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                <p className="text-body-sm text-muted-foreground mt-2 leading-relaxed border-t border-border/30 pt-3">{entry.questionText}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </PremiumCard>
  );
}

export default function CadernoErrosPage() {
  const { profile } = useUser();
  const { user } = useAuth();
  const segment = profile?.segment ?? 'guest';
  const hasAccess = SEGMENT_ACCESS[segment].cadernoErros;

  if (!hasAccess) {
    return (
      <AppLayout>
        <PageHeader title="Caderno de Erros" subtitle="Salve questões importantes e revise de forma inteligente." badge="PRO: ENAMED Exclusivo" />
        <ProGate icon={BookOpen} feature="Caderno de Erros" description="Salve questões com motivo e anotação de aprendizado. Organize sua revisão por área e tema para estudar de forma estratégica. Recurso exclusivo PRO: ENAMED." requiredSegment="pro" currentSegment={segment} />
      </AppLayout>
    );
  }

  return <CadernoContent userId={user?.id || ''} />;
}

function CadernoContent({ userId }: { userId: string }) {
  const [entries, setEntries] = useState<NotebookEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [areaFilter, setAreaFilter] = useState<string | null>(null);

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
      })));
      console.log('[CadernoErrosPage] Loaded', data.length, 'entries from Supabase');
    } catch (err) {
      console.error('[CadernoErrosPage] Error loading:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const areas = useMemo(() => {
    const set = new Set(entries.map(e => e.area).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [entries]);

  const filtered = useMemo(() => {
    let data = entries;
    if (areaFilter) data = data.filter(e => e.area === areaFilter);
    return data.sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime());
  }, [entries, areaFilter]);

  const handleRemove = async (id: string) => {
    try {
      await simuladosApi.deleteErrorNotebookEntry(id, userId);
      setEntries(prev => prev.filter(e => e.id !== id));
      console.log('[CadernoErrosPage] Removed entry:', id);
    } catch (err) {
      console.error('[CadernoErrosPage] Error removing:', err);
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <PageHeader title="Caderno de Erros" subtitle="Salve questões importantes e revise de forma inteligente." badge="PRO: ENAMED Exclusivo" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">{[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}</div>
        <div className="space-y-3">{[...Array(3)].map((_, i) => <SkeletonCard key={i} />)}</div>
      </AppLayout>
    );
  }

  if (entries.length === 0) {
    return (
      <AppLayout>
        <PageHeader title="Caderno de Erros" subtitle="Salve questões importantes e revise de forma inteligente." badge="PRO: ENAMED Exclusivo" />
        <EmptyState
          icon={BookOpen}
          title="Seu caderno está vazio"
          description="Adicione questões ao Caderno de Erros durante a correção de qualquer simulado."
          action={<Link to="/simulados" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground text-body font-semibold hover:bg-wine-hover transition-colors">Ver simulados</Link>}
        />
      </AppLayout>
    );
  }

  const groupedByArea = useMemo(() => {
    const map = new Map<string, number>();
    entries.forEach(e => { if (e.area) map.set(e.area, (map.get(e.area) || 0) + 1); });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [entries]);

  return (
    <AppLayout>
      <PageHeader title="Caderno de Erros" subtitle="Salve questões importantes e revise de forma inteligente." badge="PRO: ENAMED Exclusivo" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
        <PremiumCard delay={0} className="p-4"><p className="text-heading-2 text-foreground">{entries.length}</p><p className="text-caption text-muted-foreground">Total salvas</p></PremiumCard>
        <PremiumCard delay={0.06} className="p-4"><p className="text-heading-2 text-destructive">{entries.filter(e => !e.wasCorrect).length}</p><p className="text-caption text-muted-foreground">Questões erradas</p></PremiumCard>
        <PremiumCard delay={0.12} className="p-4"><p className="text-heading-2 text-warning">{entries.filter(e => e.wasCorrect).length}</p><p className="text-caption text-muted-foreground">Sem certeza</p></PremiumCard>
        <PremiumCard delay={0.18} className="p-4"><p className="text-heading-2 text-foreground">{areas.length}</p><p className="text-caption text-muted-foreground">Áreas cobertas</p></PremiumCard>
      </div>

      <PremiumCard className="p-4 md:p-5 mb-6">
        <div className="flex items-center gap-2 mb-3"><Stethoscope className="h-4 w-4 text-muted-foreground" /><span className="text-body font-semibold text-foreground">Filtrar por Área</span></div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setAreaFilter(null)} className={cn('px-3 py-1.5 rounded-lg text-caption font-medium transition-all', !areaFilter ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80')}>Todas ({entries.length})</button>
          {groupedByArea.map(([area, count]) => (
            <button key={area} onClick={() => setAreaFilter(prev => prev === area ? null : area)} className={cn('px-3 py-1.5 rounded-lg text-caption font-medium transition-all', areaFilter === area ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80')}>{area} ({count})</button>
          ))}
        </div>
      </PremiumCard>

      <SectionHeader title={areaFilter || 'Todas as questões'} action={<span className="text-body-sm text-muted-foreground">{filtered.length} {filtered.length === 1 ? 'questão' : 'questões'}</span>} />
      <div className="space-y-3 pb-8">
        {filtered.map((entry, i) => (
          <motion.div key={entry.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
            <NotebookEntryCard entry={entry} onRemove={handleRemove} />
          </motion.div>
        ))}
      </div>
    </AppLayout>
  );
}
