import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ErrorBoundary } from './ErrorBoundary';
import { configureErrorMonitoring, resetErrorMonitoring } from '@/lib/errorMonitoring';
vi.mock('@/lib/analytics', () => ({ trackEvent: vi.fn() }));
import { trackEvent } from '@/lib/analytics';
afterEach(() => { cleanup(); resetErrorMonitoring(); vi.restoreAllMocks(); });
it('retains recovery actions and reports only sanitized metadata, never raw analytics', () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const transport = vi.fn(); configureErrorMonitoring({ enabled: true, transport });
  function Broken(): never { throw Error('private answer email@example.com'); }
  render(<ErrorBoundary><Broken /></ErrorBoundary>);
  expect(screen.getByRole('button', { name: 'Recarregar página' })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Voltar ao início' })).toBeVisible();
  expect(screen.queryByText('private answer email@example.com')).not.toBeInTheDocument();
  expect(transport).toHaveBeenCalledOnce(); expect(JSON.stringify(transport.mock.calls)).not.toContain('private');
  expect(trackEvent).toHaveBeenCalledWith('error_boundary_triggered', { source: 'boundary', code: 'render_failure' });
  expect(JSON.stringify(vi.mocked(trackEvent).mock.calls)).not.toContain('private');
});
it('retains sanitized analytics with monitoring disabled and contains analytics failures', () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.mocked(trackEvent).mockImplementation(() => { throw Error('analytics'); });
  function Broken(): never { throw Error('sensitive'); }
  expect(() => render(<ErrorBoundary><Broken /></ErrorBoundary>)).not.toThrow();
  expect(screen.getByRole('button', { name: 'Recarregar página' })).toBeVisible();
  expect(trackEvent).toHaveBeenCalledWith('error_boundary_triggered', { source: 'boundary', code: 'render_failure' });
});
