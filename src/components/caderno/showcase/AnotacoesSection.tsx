/**
 * AnotacoesSection — showcase com mock data para QA visual da aba Anotações.
 *
 * Rota dev-only: /sandbox/caderno-v3 (conforme spec §8).
 * Renderiza todos os estados (loading / empty / pronto) com toggle
 * de estado e de viewport (desktop / mobile). Não usa auth nem APIs reais.
 *
 * USO:
 *   import { AnotacoesSection } from '@/components/caderno/showcase/AnotacoesSection';
 *   // Adicione <AnotacoesSection /> na rota /sandbox/caderno-v3
 */

import { useState, useCallback } from 'react';
import { Plus, PenLine, Loader2, NotebookPen } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

import { NoteList } from '@/components/caderno/anotacoes/NoteList';
import { NoteEditor } from '@/components/caderno/anotacoes/NoteEditor';
import { NotesEmptyState } from '@/components/caderno/anotacoes/NotesEmptyState';
import {
  CadernoCard,
  MobileAppBar,
  BottomActionBar,
  SectionHeader,
  SkeletonLine,
} from '@/components/caderno/ui';

import type { UserNote } from '@/types/caderno';

// ─── Mock data ───────────────────────────────────────────────────────────────

const NOW = Date.now();
const ago = (ms: number) => new Date(NOW - ms).toISOString();

const MOCK_NOTES: UserNote[] = [
  {
    id: 'note-1',
    user_id: 'mock-user',
    title: 'Cardiologia — IC descompensada',
    body_md:
      '## Critérios de Framingham\n\nMaiores: DPN, crepitações, cardiomegalia...\n\n## Tratamento\n\n- **Furosemida** IV na descompensação\n- _Dobutamina_ se baixo débito',
    created_at: ago(7 * 24 * 60 * 60 * 1000),
    updated_at: ago(1 * 60 * 60 * 1000),
  },
  {
    id: 'note-2',
    user_id: 'mock-user',
    title: 'Pneumologia — TEP',
    body_md:
      '## Escore de Wells\n\n| Critério | Pontos |\n|---|---|\n| Sinal de DVT | 3 |\n| Alt. diagnóstico < TEP | 3 |\n\n## Tratamento\nAnticoagulação imediata com heparina...',
    created_at: ago(5 * 24 * 60 * 60 * 1000),
    updated_at: ago(3 * 60 * 60 * 1000),
  },
  {
    id: 'note-3',
    user_id: 'mock-user',
    title: 'Infectologia — meningite bacteriana',
    body_md: 'Tríade clássica: **febre, rigidez de nuca, fotofobia**.\n\n- Punção lombar antes se sem contraindicação\n- Iniciar antibiótico empiricamente se atraso na PL',
    created_at: ago(3 * 24 * 60 * 60 * 1000),
    updated_at: ago(30 * 60 * 1000),
  },
  {
    id: 'note-4',
    user_id: 'mock-user',
    title: '',
    body_md: 'Rascunho sem título — lembrar de nomear depois.',
    created_at: ago(1 * 24 * 60 * 60 * 1000),
    updated_at: ago(10 * 60 * 1000),
  },
];

// ─── Tipos ───────────────────────────────────────────────────────────────────

type ShowcaseState = 'ready' | 'loading' | 'empty';
type ShowcaseViewport = 'desktop' | 'mobile';

const STATE_LABELS: Record<ShowcaseState, string> = {
  ready: 'Pronto',
  loading: 'Carregando',
  empty: 'Vazio',
};

// ─── ToggleChip ───────────────────────────────────────────────────────────────

function ToggleChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center rounded-full px-3.5 py-1.5 text-[12px] font-semibold',
        'border transition-all duration-150',
        active
          ? 'border-[var(--c-wine-500)]/40 bg-[var(--c-wine-500)]/10 text-[var(--c-wine-600)] dark:text-[var(--c-wine-400)]'
          : 'border-[var(--c-border)] bg-[var(--c-surface-2)] text-[var(--c-muted)] hover:text-[var(--c-ink)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-wine-500)]/40',
      )}
    >
      {children}
    </button>
  );
}

// ─── Mock loading skeleton ────────────────────────────────────────────────────

function MockSkeleton({ mobile }: { mobile: boolean }) {
  if (mobile) {
    return (
      <div
        className="flex flex-col gap-2 px-4 pt-3"
        aria-busy="true"
        aria-label="Carregando anotações"
      >
        {[1, 2, 3].map((i) => (
          <SkeletonLine key={i} className="h-[72px] rounded-[var(--c-radius-control)]" />
        ))}
      </div>
    );
  }
  return (
    <div
      className="flex h-[480px] gap-5"
      aria-busy="true"
      aria-label="Carregando anotações"
    >
      <div className="flex w-64 shrink-0 flex-col gap-2">
        <SkeletonLine className="h-9 rounded-[var(--c-radius-control)]" />
        {[1, 2, 3, 4].map((i) => (
          <SkeletonLine key={i} className="h-[72px] rounded-[var(--c-radius-control)]" />
        ))}
      </div>
      <div className="flex flex-1 flex-col gap-3">
        <SkeletonLine className="h-10 w-2/5 rounded-md" />
        <SkeletonLine className="h-[420px] rounded-[var(--c-radius-card)]" />
      </div>
    </div>
  );
}

// ─── Mock desktop master-detail ───────────────────────────────────────────────

function MockDesktopLayout({
  notes,
  selectedId,
  onSelect,
}: {
  notes: UserNote[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const selectedNote = notes.find((n) => n.id === selectedId) ?? notes[0];

  return (
    <div className="flex min-h-[520px] gap-5 lg:gap-6">
      {/* Sidebar */}
      <aside className="flex w-64 shrink-0 flex-col gap-3 xl:w-72">
        {/* New note button */}
        <button
          type="button"
          className={cn(
            'flex w-full items-center justify-center gap-2',
            'rounded-[var(--c-radius-control)] border border-[var(--c-wine-500)]/25',
            'bg-gradient-to-r from-[var(--c-wine-500)]/[0.08] to-[var(--c-wine-700)]/[0.08]',
            'px-4 py-2.5 text-[13px] font-semibold text-[var(--c-wine-600)] dark:text-[var(--c-wine-400)]',
            'transition-all duration-150 hover:border-[var(--c-wine-500)]/40 hover:bg-[var(--c-wine-500)]/[0.12]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-wine-500)]/40',
          )}
        >
          <Plus className="h-4 w-4" aria-hidden />
          Nova anotação
        </button>

        <p className="select-none px-0.5 text-[11px] font-semibold text-[var(--c-muted-2)]">
          {notes.length} anotações
        </p>

        <NoteList
          notes={notes}
          selectedId={selectedId}
          onSelect={(note) => onSelect(note.id)}
          onDelete={() => {}}
        />
      </aside>

      {/* Editor */}
      <main className="flex min-h-[520px] flex-1 flex-col">
        <AnimatePresence mode="wait">
          <motion.div
            key={selectedNote.id}
            className="flex h-full flex-1 flex-col"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            <NoteEditor
              note={selectedNote}
              onSaved={() => {}}
            />
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

// ─── Mock mobile layout ────────────────────────────────────────────────────────

function MockMobileLayout({ notes }: { notes: UserNote[] }) {
  const [mobileEditorOpen, setMobileEditorOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedNote = notes.find((n) => n.id === selectedId) ?? null;

  return (
    <div className="relative w-full max-w-sm overflow-hidden rounded-[var(--c-radius-card)] border border-[var(--c-border)] bg-[var(--c-bg)]" style={{ minHeight: 580 }}>
      <AnimatePresence mode="wait">
        {!mobileEditorOpen && (
          <motion.div
            key="list"
            className="flex flex-col"
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="px-4 pb-[88px] pt-3">
              <SectionHeader
                title="Anotações"
                count={notes.length}
                className="pb-3"
              />
              <NoteList
                notes={notes}
                selectedId={selectedId}
                onSelect={(note) => {
                  setSelectedId(note.id);
                  setMobileEditorOpen(true);
                }}
                onDelete={() => {}}
              />
            </div>

            <BottomActionBar className="absolute">
              <button
                type="button"
                className={cn(
                  'flex flex-1 items-center justify-center gap-2',
                  'rounded-[var(--c-radius-control)]',
                  'bg-gradient-to-r from-[var(--c-wine-500)] to-[var(--c-wine-700)]',
                  'py-3 text-[14px] font-bold text-white',
                  'shadow-[var(--c-shadow-glow)]',
                  'transition-all duration-150 hover:brightness-110 active:scale-[0.98]',
                )}
              >
                <PenLine className="h-4 w-4" aria-hidden />
                Nova anotação
              </button>
            </BottomActionBar>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {mobileEditorOpen && selectedNote && (
          <motion.div
            key="editor"
            className="absolute inset-0 z-10 flex flex-col bg-[var(--c-bg)]"
            initial={{ opacity: 0, x: 32 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 32 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          >
            <MobileAppBar
              title={selectedNote.title || 'Nova anotação'}
              onBack={() => setMobileEditorOpen(false)}
              action={
                <button
                  type="button"
                  className={cn(
                    'flex h-9 items-center gap-1.5 rounded-[var(--c-radius-control)]',
                    'bg-gradient-to-r from-[var(--c-wine-500)] to-[var(--c-wine-700)]',
                    'px-3 text-[12px] font-semibold text-white',
                  )}
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden />
                  Nova
                </button>
              }
            />
            <div className="flex-1 overflow-y-auto px-4 py-4">
              <NoteEditor note={selectedNote} onSaved={() => {}} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── AnotacoesSection ─────────────────────────────────────────────────────────

export function AnotacoesSection() {
  const [state, setState] = useState<ShowcaseState>('ready');
  const [viewport, setViewport] = useState<ShowcaseViewport>('desktop');
  const [selectedId, setSelectedId] = useState<string>(MOCK_NOTES[0].id);

  const handleSelect = useCallback((id: string) => setSelectedId(id), []);

  const isMobileView = viewport === 'mobile';

  return (
    <section className="caderno-root space-y-8">
      {/* ── Controls ── */}
      <CadernoCard className="flex flex-wrap items-center gap-3 px-4 py-3">
        <span className="mr-1 text-[11px] font-bold uppercase tracking-wider text-[var(--c-muted)]">
          Estado
        </span>
        {(Object.keys(STATE_LABELS) as ShowcaseState[]).map((s) => (
          <ToggleChip key={s} active={state === s} onClick={() => setState(s)}>
            {STATE_LABELS[s]}
          </ToggleChip>
        ))}

        <div className="ml-auto flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--c-muted)]">
            Viewport
          </span>
          <ToggleChip active={viewport === 'desktop'} onClick={() => setViewport('desktop')}>
            Desktop
          </ToggleChip>
          <ToggleChip active={viewport === 'mobile'} onClick={() => setViewport('mobile')}>
            Mobile
          </ToggleChip>
        </div>
      </CadernoCard>

      {/* ── Loading ── */}
      {state === 'loading' && <MockSkeleton mobile={isMobileView} />}

      {/* ── Empty ── */}
      {state === 'empty' && (
        <div className={cn(isMobileView ? 'px-4 py-8' : '')}>
          <NotesEmptyState onCreateNote={() => {}} />
        </div>
      )}

      {/* ── Ready ── */}
      {state === 'ready' && (
        <>
          {isMobileView ? (
            <div className="flex justify-center">
              <MockMobileLayout notes={MOCK_NOTES} />
            </div>
          ) : (
            <MockDesktopLayout
              notes={MOCK_NOTES}
              selectedId={selectedId}
              onSelect={handleSelect}
            />
          )}
        </>
      )}

      {/* ── Note: mock editor auto-save is no-op ── */}
      <p className="text-[11px] text-[var(--c-muted-2)] text-center select-none">
        Showcase — autosave desabilitado no mock. Edições não persistem.
      </p>
    </section>
  );
}
