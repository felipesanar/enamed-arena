import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useAdminAuth } from '@/admin/hooks/useAdminAuth';

const mockUseAuth = vi.fn();
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

const mockRpc = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: { log: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

const USER = { id: 'user-1', email: 'admin@sanar.com' };

describe('useAdminAuth', () => {
  beforeEach(() => {
    mockUseAuth.mockReset();
    mockRpc.mockReset();
  });

  it('acesso ok: expõe roles/capabilities, hasAccess true, isAdmin false, error false', async () => {
    mockUseAuth.mockReturnValue({ user: USER, loading: false });
    mockRpc.mockResolvedValue({
      data: [{ roles: ['support'], capabilities: ['users.view'] }],
      error: null,
    });

    const { result } = renderHook(() => useAdminAuth());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockRpc).toHaveBeenCalledWith('admin_get_access');
    expect(result.current.hasAccess).toBe(true);
    expect(result.current.isAdmin).toBe(false);
    expect(result.current.roles).toEqual(['support']);
    expect(result.current.capabilities).toEqual(['users.view']);
    expect(result.current.error).toBe(false);
  });

  it('sem roles: hasAccess false, error false', async () => {
    mockUseAuth.mockReturnValue({ user: USER, loading: false });
    mockRpc.mockResolvedValue({
      data: [{ roles: [], capabilities: [] }],
      error: null,
    });

    const { result } = renderHook(() => useAdminAuth());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.hasAccess).toBe(false);
    expect(result.current.error).toBe(false);
  });

  it('erro de RPC: error true; retry() re-dispara a rpc', async () => {
    mockUseAuth.mockReturnValue({ user: USER, loading: false });
    mockRpc.mockResolvedValue({ data: null, error: { message: 'boom' } });

    const { result } = renderHook(() => useAdminAuth());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.hasAccess).toBe(false);
    expect(result.current.error).toBe(true);
    expect(mockRpc).toHaveBeenCalledTimes(1);

    mockRpc.mockResolvedValue({
      data: [{ roles: ['admin'], capabilities: ['users.manage'] }],
      error: null,
    });

    act(() => {
      result.current.retry();
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockRpc).toHaveBeenCalledTimes(2);
    expect(result.current.error).toBe(false);
    expect(result.current.hasAccess).toBe(true);
    expect(result.current.isAdmin).toBe(true);
  });

  it('sem user: não chama rpc, hasAccess false, loading false', async () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false });

    const { result } = renderHook(() => useAdminAuth());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockRpc).not.toHaveBeenCalled();
    expect(result.current.hasAccess).toBe(false);
  });
});
