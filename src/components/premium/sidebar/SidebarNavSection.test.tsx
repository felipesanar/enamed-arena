import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SidebarNavSection } from '@/components/premium/sidebar/SidebarNavSection';
const mocks = vi.hoisted(() => ({ enabled: false }));
vi.mock('@/hooks/useAppConfig', () => ({ useAppConfig: () => mocks.enabled }));
vi.mock('@/components/premium/NavItem', () => ({ NavItem: ({ to, label }: { to: string; label: string }) => <a href={to}>{label}</a> }));
afterEach(cleanup);
describe('calendar sidebar link', () => {
  it('is absent when editions are disabled', () => { mocks.enabled = false; render(<MemoryRouter><SidebarNavSection /></MemoryRouter>); expect(screen.queryByRole('link', { name: 'Calendário' })).toBeNull(); });
  it('is available for students when enabled', () => { mocks.enabled = true; render(<MemoryRouter><SidebarNavSection /></MemoryRouter>); expect(screen.getByRole('link', { name: 'Calendário' })).toHaveAttribute('href', '/calendario'); });
});
