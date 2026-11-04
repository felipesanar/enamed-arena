import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { PreloadRecoveryNotice } from './PreloadRecoveryNotice';
import { installPreloadRecovery } from '@/lib/preloadRecovery';
afterEach(cleanup);
it('shows an accessible warning, never claims unsynced data is saved and reloads only on click', () => {
  const reload = vi.fn();
  history.replaceState(null, '', '/simulados/demo/prova');
  const dispose = installPreloadRecovery({ reload });
  render(<PreloadRecoveryNotice reload={reload} />);
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  fireEvent(window, new Event('vite:preloadError', { cancelable: true }));
  expect(screen.getByRole('alert')).toHaveTextContent('Alterações ainda não sincronizadas podem ser perdidas');
  expect(reload).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Recarregar e retomar' })); expect(reload).toHaveBeenCalledOnce();
  dispose();
});
