import { describe, it, expect, vi, beforeEach } from 'vitest';

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
  });
});
