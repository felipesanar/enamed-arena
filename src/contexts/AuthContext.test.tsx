import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';
import { trackEvent } from '@/lib/analytics';

vi.mock('@/lib/analytics', () => ({ trackEvent: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      signInWithPassword: vi.fn().mockResolvedValue({ error: null }),
    },
    from: vi.fn(),
    functions: { invoke: vi.fn() },
  },
}));

describe('AuthContext', () => {
  beforeEach(() => vi.clearAllMocks());

  it('tracks auth_login_failed when signInWithPassword returns error', async () => {
    const { supabase } = await import('@/integrations/supabase/client');
    (supabase.auth.signInWithPassword as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      error: { message: 'Invalid login credentials', code: 'invalid_credentials' },
    });

    let signIn: ((e: string, p: string) => Promise<{ error: string | null }>) | null = null;
    const Spy = (): null => {
      const ctx = useAuth();
      signIn = ctx.signInWithPassword;
      return null;
    };
    render(<AuthProvider><Spy /></AuthProvider>);

    await act(async () => { await signIn?.('a@b.com', 'bad'); });

    expect(trackEvent).toHaveBeenCalledWith('auth_login_failed', {
      method: 'password',
      error_code: 'Invalid login credentials',
    });
  });
});
