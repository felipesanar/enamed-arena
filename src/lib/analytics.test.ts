import { describe, it, expect, vi, beforeEach } from 'vitest';
import { trackEvent } from './analytics';

// ---------------------------------------------------------------------------
// Contrato de tipos (Fase 2, passo 1) — verificado por `npm run typecheck`,
// não em runtime. Esta função NUNCA é chamada; existe só para o compilador.
// Amarra nome do evento → payload: eventos com contrato exigem os campos
// obrigatórios; eventos sem contrato continuam com payload solto (compat).
// ---------------------------------------------------------------------------
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _eventPayloadTypeContracts() {
  // Evento COM contrato: campos obrigatórios aceitos.
  trackEvent('caderno_triage_viewed', { attempt_id: 'a', simulado_id: 's', candidate_count: 3 });

  // Evento COM contrato + prop de contexto extra: permitido no passo 1 (payload aberto).
  trackEvent('caderno_triage_viewed', { attempt_id: 'a', simulado_id: 's', candidate_count: 3, route: '/x' });

  // @ts-expect-error campo obrigatório `candidate_count` ausente
  trackEvent('caderno_triage_viewed', { attempt_id: 'a', simulado_id: 's' });

  // @ts-expect-error tipo errado em `candidate_count` (deve ser number)
  trackEvent('caderno_triage_viewed', { attempt_id: 'a', simulado_id: 's', candidate_count: 'tres' });

  // Evento SEM contrato: payload solto continua aceito (retrocompatível).
  trackEvent('lead_captured', { source: 'landing_hero_primary' });
  trackEvent('simulado_started', { simulado_id: 's', attempt_id: 'a', mode: 'online' });
}

// We need isolated module state per test. Use a factory approach:
// Each test re-imports the module via dynamic import after resetting modules.
describe('analytics', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('injects super-properties into every event', async () => {
    const { trackEvent, registerAnalyticsHandler, setSuperProperties } = await import('./analytics');
    const handler = vi.fn();
    registerAnalyticsHandler(handler);
    setSuperProperties({ session_id: 'abc', platform: 'web' });
    trackEvent('lead_captured', { source: 'landing_hero_primary' });
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'lead_captured',
        payload: expect.objectContaining({ session_id: 'abc', platform: 'web', source: 'landing_hero_primary' }),
      })
    );
  });

  it('accepts all new event names without throwing', async () => {
    const { trackEvent } = await import('./analytics');
    expect(() => trackEvent('error_boundary_triggered', {
      error_message: 'e', component_stack: 's', route: '/'
    })).not.toThrow();
    expect(() => trackEvent('offline_answers_submitted', {
      attempt_id: 'a', simulado_id: 's', answers_count: 10, is_within_window: true
    })).not.toThrow();
    expect(() => trackEvent('offline_printing_consent_viewed', { simulado_id: 's' })).not.toThrow();
    expect(() => trackEvent('offline_printing_started', { simulado_id: 's' })).not.toThrow();
    expect(() => trackEvent('offline_printing_completed_early', { simulado_id: 's' })).not.toThrow();
    expect(() => trackEvent('offline_printing_expired', { simulado_id: 's' })).not.toThrow();
  });
});
