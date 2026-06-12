import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

export interface AdminAccessData {
  roles: string[];
  capabilities: string[];
}

const EMPTY: string[] = [];

/**
 * Acesso admin do usuário corrente via RPC admin_get_access().
 * Entrada no /admin é permitida para qualquer role presente em user_roles.
 */
export function useAdminAuth() {
  const { user, loading: authLoading } = useAuth();
  const [access, setAccess] = useState<AdminAccessData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setAccess(null);
      setError(false);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(false);

    supabase
      .rpc('admin_get_access')
      .then(({ data, error: rpcError }) => {
        if (cancelled) return;
        const row = Array.isArray(data) ? data[0] : data;
        if (rpcError) {
          logger.error('[useAdminAuth] admin_get_access falhou:', rpcError);
          setAccess(null);
          setError(true);
        } else {
          setAccess({ roles: row?.roles ?? [], capabilities: row?.capabilities ?? [] });
        }
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [user, authLoading, retryKey]);

  const retry = useCallback(() => setRetryKey(k => k + 1), []);

  return {
    user,
    roles: access?.roles ?? EMPTY,
    capabilities: access?.capabilities ?? EMPTY,
    hasAccess: (access?.roles.length ?? 0) > 0,
    /** retrocompat: telas antigas que checavam isAdmin */
    isAdmin: (access?.roles ?? EMPTY).includes('admin'),
    /** erro de rede/RPC ao verificar acesso (≠ sem permissão) */
    error,
    retry,
    loading: authLoading || loading,
  };
}
