import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { PremiumCard } from '@/components/PremiumCard';
import { SectionHeader } from '@/components/SectionHeader';
import { EmptyState } from '@/components/EmptyState';
import { ProGate } from '@/components/ProGate';
import { useUser } from '@/contexts/UserContext';
import { SEGMENT_ACCESS } from '@/types';
import { cn } from '@/lib/utils';
import {
  loadNotebook,
  removeFromNotebook,
  ERROR_REASON_LABELS,
  type ErrorNotebookEntry,
} from '@/lib/notebook-helpers';
import {
  BookOpen, Trash2, FileText, Stethoscope, Calendar,
  Filter, ChevronDown, ChevronUp, StickyNote, Sparkles,
} from 'lucide-react';

function NotebookEntryCard({
  entry,
  onRemove,
}: {
  entry: ErrorNotebookEntry;
  onRemove: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const addedDate = new Date(entry.addedAt).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  return (
    <PremiumCard className="p-4 md:p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span className="text-body font-semibold text-foreground">Questão {entry.questionNumber}</span>
            <span className="text-caption px-2 py-0.5 rounded-md bg-muted text-muted-foreground">{entry.area}</span>
            <span className="text-caption px-2 py-0.5 rounded-md bg-muted text-muted-foreground">{entry.theme}</span>
          </div>
          <p className="text-caption text-muted-foreground">
            {entry.simuladoTitle} · {addedDate}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={cn(
            'text-caption font-semibold px-2 py-0.5 rounded-md',
            entry.wasCorrect ? 'bg-warning/10 text-warning' : 'bg-destructive/10 text-destructive',
          )}>
            {entry.wasCorrect ? 'Sem certeza' : 'Errou'}
          </span>
          <button
            onClick={() => onRemove(entry.id)}
            className="h-8 w-8 rounded-lg hover:bg-destructive/10 flex items-center justify-center transition-colors group"
            title="Remover"
          >
            <Trash2 className="h-3.5 w-3.5 text-muted-foreground group-hover:text-destructive transition-colors" />
          </button>
        </div>
      </div>

      {/* Reason badge */}
      <div className="flex items-center gap-2 mb-3">
        <StickyNote className="h-3.5 w-3.5 text-primary" />
        <span className="text-body-sm text-primary font-medium">{ERROR_REASON_LABELS[entry.reason]}</span>
      </div>

      {/* Learning note */}
      {entry.learningNote && (
        <div className="rounded-xl bg-accent/50 border border-border/30 p-3 mb-3">
          <p className="text-body-sm text-foreground leading-relaxed">{entry.learningNote}</p>
        </div>
      )}

      {/* Expandable question text */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="inline-flex items-center gap-1.5 text-caption text-muted-foreground hover:text-foreground transition-colors"
      >
        {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        {expanded ? 'Ocultar enunciado' : 'Ver enunciado'}
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <p className="text-body-sm text-muted-foreground mt-2 leading-relaxed border-t border-border/30 pt-3">
              {entry.questionText}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </PremiumCard>
  );
}

export default function CadernoErrosPage() {
  const { profile } = useUser();
  const segment = profile?.segment ?? 'guest';
  const hasAccess = SEGMENT_ACCESS[segment].cadernoErros;

  console.log('[CadernoErrosPage] Rendering, segment:', segment, 'hasAccess:', hasAccess);

  if (!hasAccess) {
    return (
      <AppLayout>
        <PageHeader
          title="Caderno de Erros"
          subtitle="Revise e pratique as questões que você errou."
          badge="PRO: ENAMED Exclusivo"
        />
        <ProGate
          icon={BookOpen}
          feature="Caderno de Erros"
          description="Salve questões importantes com motivo e anotação de aprendizado. Organize sua revisão por área e tema. Recurso exclusivo para assinantes PRO: ENAMED."
          requiredSegment="pro"
          currentSegment={segment}
        />
      </AppLayout>
    );
  }

  return <CadernoContent />;
}

function CadernoContent() {
  const [entries, setEntries] = useState<ErrorNotebookEntry[]>(() => loadNotebook());
  const [areaFilter, setAreaFilter] = useState<string | null>(null);

  const areas = useMemo(() => {
    const set = new Set(entries.map(e => e.area));
    return Array.from(set).sort();
  }, [entries]);

  const filtered = useMemo(() => {
    let data = entries;
    if (areaFilter) data = data.filter(e => e.area === areaFilter);
    return data.sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime());
  }, [entries, areaFilter]);

  const handleRemove = (id: string) => {
    removeFromNotebook(id);
    setEntries(loadNotebook());
  };

  if (entries.length === 0) {
    return (
      <AppLayout>
        <PageHeader
          title="Caderno de Erros"
          subtitle="Revise e pratique as questões que você errou."
          badge="PRO: ENAMED Exclusivo"
        />
        <EmptyState
          icon={BookOpen}
          title="Caderno vazio"
          description="Adicione questões ao seu Caderno de Erros a partir da correção de qualquer simulado. É a forma mais inteligente de revisar."
        />
      </AppLayout>
    );
  }

  // Group by area for summary
  const groupedByArea = useMemo(() => {
    const map = new Map<string, number>();
    entries.forEach(e => map.set(e.area, (map.get(e.area) || 0) + 1));
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [entries]);

  return (
    <AppLayout>
      <PageHeader
        title="Caderno de Erros"
        subtitle="Revise e pratique as questões que você errou."
        badge="PRO: ENAMED Exclusivo"
      />

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <PremiumCard delay={0} className="p-4">
          <p className="text-heading-2 text-foreground">{entries.length}</p>
          <p className="text-caption text-muted-foreground">Total de questões</p>
        </PremiumCard>
        <PremiumCard delay={0.06} className="p-4">
          <p className="text-heading-2 text-foreground">{entries.filter(e => !e.wasCorrect).length}</p>
          <p className="text-caption text-muted-foreground">Questões erradas</p>
        </PremiumCard>
        <PremiumCard delay={0.12} className="p-4">
          <p className="text-heading-2 text-foreground">{entries.filter(e => e.wasCorrect).length}</p>
          <p className="text-caption text-muted-foreground">Sem certeza</p>
        </PremiumCard>
        <PremiumCard delay={0.18} className="p-4">
          <p className="text-heading-2 text-foreground">{areas.length}</p>
          <p className="text-caption text-muted-foreground">Áreas cobertas</p>
        </PremiumCard>
      </div>

      {/* Area breakdown */}
      <PremiumCard className="p-4 md:p-5 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Stethoscope className="h-4 w-4 text-muted-foreground" />
          <span className="text-body font-semibold text-foreground">Distribuição por Área</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setAreaFilter(null)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-caption font-medium transition-all',
              !areaFilter
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80',
            )}
          >
            Todas ({entries.length})
          </button>
          {groupedByArea.map(([area, count]) => (
            <button
              key={area}
              onClick={() => setAreaFilter(prev => prev === area ? null : area)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-caption font-medium transition-all',
                areaFilter === area
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80',
              )}
            >
              {area} ({count})
            </button>
          ))}
        </div>
      </PremiumCard>

      {/* Entries list */}
      <SectionHeader
        title={areaFilter ? `${areaFilter}` : 'Todas as questões'}
        action={
          <span className="text-body-sm text-muted-foreground">
            {filtered.length} {filtered.length === 1 ? 'questão' : 'questões'}
          </span>
        }
      />
      <div className="space-y-3 pb-8">
        {filtered.map((entry, i) => (
          <motion.div
            key={entry.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
          >
            <NotebookEntryCard entry={entry} onRemove={handleRemove} />
          </motion.div>
        ))}
      </div>
    </AppLayout>
  );
}
