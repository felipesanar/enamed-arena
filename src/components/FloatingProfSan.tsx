import { useEffect, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, X } from 'lucide-react';
import { ProfSanorAvatar } from '@/components/comparativo/ProfSanorAvatar';
import { cn } from '@/lib/utils';

interface Props {
  children: ReactNode;
  storageKey: string;
  label?: string;
}

/**
 * Container flutuante para o Prof. San nas telas de Ranking e Desempenho.
 * Ancorado no canto inferior direito, colapsável para um FAB.
 *
 * Comportamento de abertura (por sessão do navegador, via sessionStorage):
 *   - Na primeira carga da página na sessão → abre automaticamente.
 *   - Se o usuário recolher, respeita essa escolha nas próximas cargas da
 *     mesma sessão.
 *   - Em uma nova sessão (sessionStorage limpo) → volta a abrir automaticamente.
 */
export function FloatingProfSan({ children, storageKey, label = 'Prof. San' }: Props) {
  const seenKey = `${storageKey}:session-seen`;
  const stateKey = `${storageKey}:session-state`;

  const [open, setOpen] = useState<boolean>(() => {
    try {
      // Primeira carga nesta sessão → abre automaticamente.
      if (sessionStorage.getItem(seenKey) === null) return true;
      // Cargas seguintes na mesma sessão → respeita a última escolha.
      return sessionStorage.getItem(stateKey) !== '0';
    } catch {
      return true;
    }
  });

  useEffect(() => {
    try {
      sessionStorage.setItem(seenKey, '1');
      sessionStorage.setItem(stateKey, open ? '1' : '0');
    } catch { /* ignore */ }
  }, [open, seenKey, stateKey]);

  return (
    <div
      className={cn(
        'fixed z-40 pointer-events-none',
        // Posição: no mobile sobe acima da bottom nav (~64px + safe-area).
        'bottom-24 right-4 md:bottom-6 md:right-6',
      )}
    >
      <AnimatePresence mode="wait" initial={false}>
        {open ? (
          <motion.div
            key="panel"
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className={cn(
              'pointer-events-auto',
              'w-[min(92vw,420px)]',
              'rounded-2xl border border-border/60 bg-card shadow-2xl',
              'flex flex-col',
              'max-h-[min(70vh,640px)]',
            )}
          >
            <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border/60 bg-card rounded-t-2xl">
              <div className="flex items-center gap-2 min-w-0">
                <ProfSanorAvatar size={28} />
                <span className="text-sm font-semibold text-foreground truncate">{label}</span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Recolher Prof. San"
                  title="Recolher"
                  className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Fechar Prof. San"
                  title="Fechar"
                  className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors md:hidden"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="overflow-y-auto p-3">
              {children}
            </div>
          </motion.div>
        ) : (
          <motion.button
            key="fab"
            type="button"
            onClick={() => setOpen(true)}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            aria-label="Abrir Prof. San"
            title="Abrir Prof. San"
            className={cn(
              'pointer-events-auto',
              'group relative h-14 w-14 rounded-full bg-card border border-border/60 shadow-xl',
              'flex items-center justify-center',
              'hover:shadow-2xl hover:scale-105 active:scale-95 transition-all',
            )}
          >
            <ProfSanorAvatar size={44} />
            <span
              className="absolute bottom-0.5 right-0.5 h-3 w-3 rounded-full bg-success border-2 border-card shadow-sm animate-pulse"
              aria-hidden
            />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
