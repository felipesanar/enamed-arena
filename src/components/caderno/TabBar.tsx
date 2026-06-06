/**
 * TabBar — barra de abas do Caderno de Erros v2 (redesign premium).
 *
 * Desktop: tabs horizontais sticky com indicador wine gradiente.
 * Mobile: usa SegmentedTabs scrollável (via useIsMobile).
 */

import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/useIsMobile';
import { SegmentedTabs, type SegmentedTabItem } from '@/components/caderno/ui';

interface Tab {
  label: string;
  to: string;
  exact?: boolean;
}

const TABS: Tab[] = [
  { label: 'Revisar',    to: '/caderno',            exact: true },
  { label: 'Favoritos',  to: '/caderno/favoritos' },
  { label: 'Anotações',  to: '/caderno/anotacoes' },
  { label: 'Flashcards', to: '/caderno/flashcards' },
  { label: 'Insights',   to: '/caderno/insights' },
];

const SEGMENTED_ITEMS: SegmentedTabItem[] = TABS.map((t) => ({
  value: t.to,
  label: t.label,
}));

export function TabBar() {
  const isMobile = useIsMobile();
  const location = useLocation();
  const navigate = useNavigate();

  if (isMobile) {
    // Derive active tab from current pathname
    const activeValue =
      TABS.find((t) =>
        t.exact ? location.pathname === t.to : location.pathname.startsWith(t.to),
      )?.to ?? '/caderno';

    return (
      <div className="sticky top-14 z-20 border-b border-[var(--c-border)] bg-[var(--c-surface)] px-4 py-2">
        <SegmentedTabs
          items={SEGMENTED_ITEMS}
          value={activeValue}
          onValueChange={(val) => navigate(val)}
          scrollable
        />
      </div>
    );
  }

  return (
    <nav
      role="tablist"
      aria-label="Seções do Caderno"
      className={cn(
        'sticky top-0 z-20 flex items-end gap-0 overflow-x-auto scrollbar-none',
        '[scrollbar-width:none] [-ms-overflow-style:none]',
        'border-b border-[var(--c-border)] bg-[var(--c-surface)] mb-6',
        'backdrop-blur-[var(--c-glass-blur)]',
      )}
    >
      {TABS.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.exact}
          role="tab"
          className={({ isActive }) =>
            cn(
              'relative shrink-0 px-5 py-3 text-[13px] font-semibold transition-colors duration-[var(--c-duration-fast)]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-wine-500)]/50 focus-visible:ring-offset-2 rounded-t-lg',
              isActive
                ? 'text-[var(--c-wine-600)]'
                : 'text-[var(--c-muted)] hover:text-[var(--c-ink)]',
            )
          }
          aria-current={
            location.pathname === tab.to ||
            (!tab.exact && location.pathname.startsWith(tab.to))
              ? 'page'
              : undefined
          }
        >
          {({ isActive }) => (
            <>
              {tab.label}
              {isActive && (
                <span
                  aria-hidden="true"
                  className="absolute bottom-0 inset-x-3 h-[2.5px] rounded-t-full"
                  style={{ background: 'var(--c-gradient-brand)' }}
                />
              )}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
