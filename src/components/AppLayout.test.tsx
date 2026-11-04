import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { AppLayout } from './AppLayout';
vi.mock('@/components/AppSidebar', () => ({ AppSidebar: () => <nav>Menu</nav> }));
vi.mock('@/components/CommandPalette', () => ({ CommandPalette: () => null }));
vi.mock('@/contexts/UserContext', () => ({ useUser: () => ({ profile: null, isOnboardingComplete: true }) }));
afterEach(cleanup);
it('provides one main target and moves skip focus', () => {
  render(<MemoryRouter><AppLayout>Conteúdo</AppLayout></MemoryRouter>);
  expect(document.querySelectorAll('#main-content')).toHaveLength(1);
  fireEvent.click(screen.getByRole('link', { name: 'Pular para o conteúdo' }));
  expect(screen.getByRole('main')).toHaveFocus();
});
