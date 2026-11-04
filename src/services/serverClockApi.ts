import { supabase } from '@/integrations/supabase/client';

export const serverClockApi = {
  async getServerTime(): Promise<number> {
    // The generated database types are updated by the schema rollout, not here.
    const { data, error } = await supabase.rpc('get_server_time' as never);
    if (error) throw error;
    const time = typeof data === 'string' ? Date.parse(data) : NaN;
    if (!Number.isFinite(time)) throw new Error('Invalid server timestamp');
    return time;
  },
};
