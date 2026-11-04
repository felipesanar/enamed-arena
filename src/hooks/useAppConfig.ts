import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

// Only this not-yet-generated table and its required read chain are asserted.
const client = supabase as unknown as {
  from(table: 'app_config'): {
    select(columns: 'value'): {
      eq(column: 'key', value: string): {
        maybeSingle(): PromiseLike<{ data: { value: unknown } | null; error: unknown }>;
      };
    };
  };
};

/** Fail-closed UI flag, not a substitute for server authorization. */
export function useAppConfig(key: 'editions_ui'): boolean {
  const { user, loading } = useAuth();
  const query = useQuery({
    queryKey: ['app-config', user?.id ?? null, key],
    enabled: !!user && !loading,
    retry: false,
    queryFn: async () => {
      try {
        const { data, error } = await client.from('app_config').select('value').eq('key', key).maybeSingle();
        if (error) throw error;
        return data?.value === true;
      } catch (error) {
        logger.error('[useAppConfig] Config read failed:', error);
        throw error;
      }
    },
  });
  // Keep confirmed UI stable during background refresh; a final error is not success.
  return !!user && !loading && query.isSuccess && query.data === true;
}
