import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export interface AdminAccessData {
  roles: string[];
  capabilities: string[];
}

/**
 * Acesso admin do usuário corrente via RPC admin_get_access().
 * Entrada no /admin é permitida para qualquer role presente em user_roles.
 */
export function useAdminAuth() {
  const { user, loading: authLoading } = useAuth();
  const [access, setAccess] = useState<AdminAccessData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setAccess(null);
      setLoading(false);
      return;
    }

    supabase
      .rpc('admin_get_access')
      .then(({ data, error }) => {
        const row = Array.isArray(data) ? data[0] : data;
        if (error || !row) {
          setAccess(null);
        } else {
          setAccess({ roles: row.roles ?? [], capabilities: row.capabilities ?? [] });
        }
        setLoading(false);
      });
  }, [user, authLoading]);

  return {
    user,
    roles: access?.roles ?? [],
    capabilities: access?.capabilities ?? [],
    hasAccess: (access?.roles.length ?? 0) > 0,
    /** retrocompat: telas antigas que checavam isAdmin */
    isAdmin: (access?.roles ?? []).includes('admin'),
    loading: authLoading || loading,
  };
}
