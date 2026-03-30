import { describe, it, expect } from 'vitest';
import {
  deriveSimuladoStatus,
  canAccessSimulado,
  canViewResults,
  getSimuladoCTA,
} from './simulado-helpers';
import type { SimuladoConfig, SimuladoUserState } from '@/types';

const baseConfig: SimuladoConfig = {
  id: 's1',
  slug: 'sim-1',
  title: 'Simulado 1',
  sequenceNumber: 1,
  description: 'Desc',
  questionsCount: 10,
  estimatedDuration: '1h',
  estimatedDurationMinutes: 60,
  executionWindowStart: '2025-06-01T09:00:00Z',
  executionWindowEnd: '2025-06-01T14:00:00Z',
  resultsReleaseAt: '2025-06-02T12:00:00Z',
  themeTags: [],
};

describe('deriveSimuladoStatus', () => {
  it('returns upcoming when now is before window start', () => {
    const now = new Date('2025-05-31T12:00:00Z');
    expect(deriveSimuladoStatus(baseConfig, undefined, now)).toBe('upcoming');
  });

  it('returns available when now is inside window and user has not started', () => {
    const now = new Date('2025-06-01T10:00:00Z');
    expect(deriveSimuladoStatus(baseConfig, undefined, now)).toBe('available');
  });

  it('returns in_progress when user started and not finished, inside window', () => {
    const now = new Date('2025-06-01T10:00:00Z');
    const userState: SimuladoUserState = {
      simuladoId: 's1',
      started: true,
      startedAt: '2025-06-01T09:30:00Z',
      finished: false,
    };
    expect(deriveSimuladoStatus(baseConfig, userState, now)).toBe('in_progress');
  });

  it('returns available_late when now is after window end and user did not finish', () => {
    const now = new Date('2025-06-01T15:00:00Z');
    expect(deriveSimuladoStatus(baseConfig, undefined, now)).toBe('available_late');
  });

  it('returns closed_waiting when user finished but window still open and results not released', () => {
    const now = new Date('2025-06-01T12:00:00Z');
    const userState: SimuladoUserState = {
      simuladoId: 's1',
      started: true,
      finished: true,
      finishedAt: '2025-06-01T11:00:00Z',
      score: 75,
    };
    expect(deriveSimuladoStatus(baseConfig, userState, now)).toBe('closed_waiting');
  });

  it('returns completed when user finished and results date passed', () => {
    const now = new Date('2025-06-03T12:00:00Z');
    const userState: SimuladoUserState = {
      simuladoId: 's1',
      started: true,
      finished: true,
      finishedAt: '2025-06-01T13:00:00Z',
      score: 80,
    };
    expect(deriveSimuladoStatus(baseConfig, userState, now)).toBe('completed');
  });

  it('returns results_available when results date passed but user finished (edge)', () => {
    const now = new Date('2025-06-02T13:00:00Z');
    const userState: SimuladoUserState = {
      simuladoId: 's1',
      started: true,
      finished: true,
      finishedAt: '2025-06-01T13:00:00Z',
    };
    expect(deriveSimuladoStatus(baseConfig, userState, now)).toBe('completed');
  });
});

describe('canAccessSimulado', () => {
  it('returns true for available, available_late, and in_progress', () => {
    expect(canAccessSimulado('available')).toBe(true);
    expect(canAccessSimulado('available_late')).toBe(true);
    expect(canAccessSimulado('in_progress')).toBe(true);
  });

  it('returns false for upcoming, closed_waiting, results_available, completed', () => {
    expect(canAccessSimulado('upcoming')).toBe(false);
    expect(canAccessSimulado('closed_waiting')).toBe(false);
    expect(canAccessSimulado('results_available')).toBe(false);
    expect(canAccessSimulado('completed')).toBe(false);
  });
});

describe('canViewResults', () => {
  it('returns true for results_available and completed', () => {
    expect(canViewResults('results_available')).toBe(true);
    expect(canViewResults('completed')).toBe(true);
  });

  it('returns false for other statuses', () => {
    expect(canViewResults('upcoming')).toBe(false);
    expect(canViewResults('available')).toBe(false);
    expect(canViewResults('available_late')).toBe(false);
    expect(canViewResults('in_progress')).toBe(false);
    expect(canViewResults('closed_waiting')).toBe(false);
  });
});

describe('getSimuladoCTA', () => {
  it('returns correct CTA for each status', () => {
    expect(getSimuladoCTA('available')).toEqual({ label: 'Iniciar Simulado', variant: 'primary' });
    expect(getSimuladoCTA('in_progress')).toEqual({ label: 'Continuar Simulado', variant: 'primary' });
    expect(getSimuladoCTA('results_available').label).toBe('Ver Resultado');
    expect(getSimuladoCTA('completed').label).toBe('Ver Resultado');
    expect(getSimuladoCTA('closed_waiting')).toEqual({ label: 'Aguardando resultado', variant: 'disabled' });
    expect(getSimuladoCTA('upcoming')).toEqual({ label: 'Indisponível', variant: 'disabled' });
  });
});
