/**
 * Ferramentas de verificação QA — injetadas em window.__ea.* apenas em DEV.
 * Uso no console do browser:
 *
 *   window.__ea.events()       → array de eventos capturados nesta sessão
 *   window.__ea.validate(name, payload) → valida payload contra schema Zod
 *   window.__ea.recent(limit)  → últimos N eventos gravados no Supabase
 *   window.__ea.clear()        → limpa o buffer de eventos da sessão
 */

import { supabase } from '@/integrations/supabase/client';
import { validateEventPayload } from '@/lib/analytics';
import { logger } from '@/lib/logger';

export type DevEvent = {
  name: string;
  event_id: string;
  payload: Record<string, unknown>;
  timestamp: string;
};

const _buffer: DevEvent[] = [];

export function pushToDevBuffer(event: DevEvent) {
  _buffer.push(event);
}

export function mountDevTools() {
  const api = {
    events: () => [..._buffer],

    clear: () => {
      _buffer.length = 0;
      logger.log('[ea] buffer limpo');
    },

    validate: (name: string, payload: Record<string, unknown>) => {
      const result = validateEventPayload(name, payload);
      if (result.ok) {
        logger.log(`[ea] ✓ "${name}" payload válido`);
      } else {
        logger.warn(`[ea] ✗ "${name}" payload inválido:`, result.issues);
      }
      return result;
    },

    recent: async (limit = 20) => {
      const { data, error } = await supabase
        .from('analytics_events')
        .select('event_name, event_id, payload, client_timestamp, route, created_at')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) {
        logger.error('[ea] erro ao buscar eventos recentes:', error);
        return [];
      }
      logger.log(`[ea] ${data?.length ?? 0} eventos recentes:`, data);
      return data ?? [];
    },
  };

  (window as unknown as Record<string, unknown>).__ea = api;
  logger.log(
    '[analytics] DEV tools → window.__ea.events() | .validate(name, payload) | .recent() | .clear()',
  );
}
