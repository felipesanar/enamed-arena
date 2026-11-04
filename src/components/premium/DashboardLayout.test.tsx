import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { DashboardLayout } from './DashboardLayout';
vi.mock('@/components/premium/PremiumSidebar', () => ({ PremiumSidebar: () => <nav>Menu</nav>, PREMIUM_SIDEBAR_COLLAPSED_W: 80, PREMIUM_SIDEBAR_EXPANDED_W: 292 }));
vi.mock('@/components/premium/MobileBottomNav', () => ({ MobileBottomNav: () => null }));
vi.mock('@/components/premium/DashboardOutlet', () => ({ DashboardOutlet: () => <p>Conteúdo</p> }));
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => false }));
vi.mock('@/contexts/UserContext', () => ({ useUser: () => ({ profile: null }) }));
afterEach(cleanup);
it.each(['/simulados', '/simulados/fixture/prova'])('has a unique target on %s', (route) => {
  render(<MemoryRouter initialEntries={[route]}><DashboardLayout /></MemoryRouter>);
  expect(document.querySelectorAll('#main-content')).toHaveLength(1);
  fireEvent.click(screen.getByRole('link', { name: 'Pular para o conteúdo' }));
  expect(screen.getByRole('main')).toHaveFocus();
});
