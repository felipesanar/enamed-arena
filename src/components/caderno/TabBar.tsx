/**
 * TabBar — barra de abas do Caderno de Erros v2 (redesign premium).
 *
 * Desktop: segmented control com pílula ativa animada (framer-motion layoutId),
 *          ícones por seção e feedback visual claro da aba ativa.
 * Mobile:  SegmentedTabs scrollável (via useIsMobile), também com ícones.
 */

import type { ComponentType } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { RotateCcw, Heart, NotebookPen, Layers, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/useIsMobile';
import { SegmentedTabs, type SegmentedTabItem } from '@/components/caderno/ui';

interface Tab {
  label: string;
  to: string;
  icon: ComponentType<{ className?: string }>;
  exact?: boolean;
}

const TABS: Tab[] = [
  { label: 'Revisar',    to: '/caderno',            icon: RotateCcw, exact: true },
  { label: 'Favoritos',  to: '/caderno/favoritos',  icon: Heart },
  { label: 'Anotações',  to: '/caderno/anotacoes',  icon: NotebookPen },
  { label: 'Flashcards', to: '/caderno/flashcards', icon: Layers },
  { label: 'Diagnóstico', to: '/caderno/insights',   icon: Sparkles },
];

const SEGMENTED_ITEMS: SegmentedTabItem[] = TABS.map((t) => {
  const Icon = t.icon;
  return {
    value: t.to,
    label: t.label,
    icon: <Icon className="h-3.5 w-3.5" />,
  };
});

/**
 * Deriva a aba ativa a partir do pathname atual. Retorna '' quando a rota não
 * é uma das abas (ex.: /caderno/treino, /caderno/reta-final — acessadas por CTA),
 * para que NENHUMA aba fique destacada indevidamente.
 */
function useActiveTo(pathname: string): string {
  return (
    TABS.find((t) => (t.exact ? pathname === t.to : pathname.startsWith(t.to)))?.to ?? ''
  );
}

export function TabBar() {
  const isMobile = useIsMobile();
  const location = useLocation();
  const navigate = useNavigate();
  const activeTo = useActiveTo(location.pathname);

  if (isMobile) {
    return (
      <div className="sticky top-14 z-20 -mx-4 border-b border-[var(--c-border)] bg-[color-mix(in_srgb,var(--c-surface)_85%,transparent)] px-4 py-2 backdrop-blur-[var(--c-glass-blur)]">
        <SegmentedTabs
          items={SEGMENTED_ITEMS}
          value={activeTo}
          onValueChange={(val) => navigate(val)}
          scrollable
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'sticky top-0 z-20 mb-6 -mt-1',
        // Fundo transparente: deixa o fundo da página (dashboard-page-bg, com tint
        // wine) aparecer. O backdrop-blur mantém o mascaramento do conteúdo que
        // rola por baixo da pílula sticky — sem o retângulo preto do --c-bg.
        'bg-transparent',
        'pb-4 pt-2 backdrop-blur-[var(--c-glass-blur)]',
      )}
    >
      <nav
        role="tablist"
        aria-label="Seções do Caderno"
        className={cn(
          'inline-flex max-w-full items-center gap-1.5 overflow-x-auto scrollbar-none',
          '[scrollbar-width:none] [-ms-overflow-style:none]',
          'rounded-full border border-[var(--c-border)] p-1.5',
          'bg-transparent',
          'shadow-[0_2px_6px_-2px_rgba(24,10,16,0.08),0_16px_32px_-20px_rgba(24,10,16,0.28),inset_0_1px_0_rgba(255,255,255,0.5)]',
          'dark:shadow-[0_2px_6px_-2px_rgba(0,0,0,0.4),0_16px_32px_-20px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.06)]',
        )}
      >
        {TABS.map((tab) => {
          const active = activeTo === tab.to;
          const Icon = tab.icon;
          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.exact}
              role="tab"
              aria-selected={active}
              className={cn(
                'group relative inline-flex shrink-0 items-center gap-2 rounded-full px-[17px] py-2.5',
                'text-[13.5px] font-semibold tracking-[-0.01em] whitespace-nowrap',
                'transition-[color,transform] duration-200 ease-out',
                'outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-wine-400)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--c-bg)]',
                active
                  ? 'text-white'
                  : 'text-[var(--c-muted)] hover:text-[var(--c-ink)] hover:-translate-y-px active:translate-y-0',
              )}
            >
              {active && (
                <motion.span
                  layoutId="cadernoTabActive"
                  aria-hidden="true"
                  className={cn(
                    'absolute inset-0 rounded-full',
                    'bg-[linear-gradient(135deg,var(--c-wine-500)_0%,var(--c-wine-700)_100%)]',
                    'shadow-[0_8px_18px_-7px_rgba(176,41,74,0.6),inset_0_1px_0_rgba(255,255,255,0.25),inset_0_-1px_0_rgba(0,0,0,0.12)]',
                  )}
                  transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                />
              )}
              {/* brilho/realce no hover (apenas inativos) */}
              {!active && (
                <span
                  aria-hidden
                  className="absolute inset-0 rounded-full bg-[var(--c-wine-50)] opacity-0 transition-opacity duration-200 group-hover:opacity-100 dark:bg-white/[0.05]"
                />
              )}
              <Icon
                className={cn(
                  'relative z-10 h-4 w-4 shrink-0 transition-colors duration-200',
                  active
                    ? 'text-white'
                    : 'text-[var(--c-muted-2)] group-hover:text-[var(--c-wine-500)]',
                )}
              />
              <span className="relative z-10">{tab.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
