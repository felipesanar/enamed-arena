import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';
import { EditionsUiGate } from '@/admin/components/EditionsUiGate';

const mocks = vi.hoisted(() => ({
  read: vi.fn(), capability: vi.fn(), child: vi.fn(),
  auth: { user: { id: 'admin-1' } as { id: string } | null, loading: false },
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => mocks.auth }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  from: () => ({ select: () => ({ eq: () => ({ maybeSingle: mocks.read }) }) }),
} }));
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn() } }));
vi.mock('@/admin/components/AdminCapabilityGate', () => ({
  AdminCapabilityGate: ({ children, capability }: { children: ReactNode; capability: string }) => {
    mocks.capability(capability);
    return <>{children}</>;
  },
}));

function Child() { mocks.child(); return <p>Conteúdo de edições</p>; }
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/admin/edicoes']}><Routes>
    <Route path="/admin/edicoes" element={<EditionsUiGate><Child /></EditionsUiGate>} />
    <Route path="/admin/simulados" element={<p>Destino administrativo</p>} />
  </Routes></MemoryRouter></QueryClientProvider>);
}

beforeEach(() => { vi.clearAllMocks(); mocks.auth.user = { id: 'admin-1' }; mocks.auth.loading = false; });
afterEach(cleanup);

describe('EditionsUiGate direct links', () => {
  it('waits for a deferred enabled flag without redirecting or mounting privileged content', async () => {
    let resolve: (value: { data: { value: boolean }; error: null }) => void;
    mocks.read.mockReturnValue(new Promise(settle => { resolve = settle; }));
    mount();
    expect(screen.getByRole('status')).toHaveTextContent('Carregando');
    expect(screen.queryByText('Destino administrativo')).not.toBeInTheDocument();
    expect(mocks.capability).not.toHaveBeenCalled();
    expect(mocks.child).not.toHaveBeenCalled();
    await act(async () => { resolve({ data: { value: true }, error: null }); });
    expect(await screen.findByText('Conteúdo de edições')).toBeInTheDocument();
    expect(screen.queryByText('Destino administrativo')).not.toBeInTheDocument();
    expect(mocks.capability).toHaveBeenCalledWith('content.manage');
  });

  it.each(['disabled', 'error'] as const)('redirects only after the pending flag settles: %s', async outcome => {
    let resolve: (value: { data: { value: boolean } | null; error: Error | null }) => void;
    mocks.read.mockReturnValue(new Promise(settle => { resolve = settle; }));
    mount();
    expect(screen.getByRole('status')).toHaveTextContent('Carregando');
    expect(screen.queryByText('Destino administrativo')).not.toBeInTheDocument();
    await act(async () => { resolve({ data: outcome === 'disabled' ? { value: false } : null,
      error: outcome === 'error' ? new Error('config unavailable') : null }); });
    expect(await screen.findByText('Destino administrativo')).toBeInTheDocument();
    expect(mocks.capability).not.toHaveBeenCalled();
    expect(mocks.child).not.toHaveBeenCalled();
  });
});
