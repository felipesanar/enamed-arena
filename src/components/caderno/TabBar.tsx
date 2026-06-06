/**
 * TabBar — barra de abas do Caderno de Erros v2.
 *
 * Abas Fase 2: todas ativas (Revisar, Favoritos, Anotações, Flashcards, Insights).
 * Cada aba usa NavLink com indicador de aba ativa e aria-current para a11y.
 * Rotas reservadas em App.tsx conforme contratos canônicos §6.
 */

import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface Tab {
  label: string;
  to: string;
  /** Se true, usa `end` no NavLink para que só o caminho exato ative a aba. */
  exact?: boolean;
}

const TABS: Tab[] = [
  { label: 'Revisar',     to: '/caderno',            exact: true },
  { label: 'Favoritos',   to: '/caderno/favoritos' },
  { label: 'Anotações',   to: '/caderno/anotacoes' },
  { label: 'Flashcards',  to: '/caderno/flashcards' },
  { label: 'Insights',    to: '/caderno/insights' },
];

export function TabBar() {
  return (
    <nav
      role="tablist"
      aria-label="Seções do Caderno"
      className="flex items-center gap-0.5 overflow-x-auto border-b border-border scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] mb-6"
    >
      {TABS.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.exact}
          role="tab"
          className={({ isActive }) =>
            cn(
              'relative shrink-0 px-4 py-2.5 text-[13px] font-semibold transition-colors duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-t-lg',
              isActive
                ? 'text-primary after:absolute after:bottom-0 after:inset-x-0 after:h-[2px] after:bg-primary after:rounded-t-full'
                : 'text-muted-foreground hover:text-foreground',
            )
          }
          aria-current={({ isActive }: { isActive: boolean }) => (isActive ? 'page' : undefined)}
        >
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}
