import type { SimuladoConfig } from '@/types';

export function formatSimuladoLabel(sim: Pick<SimuladoConfig, 'editionCode' | 'sequenceNumber'>): string {
  return `${sim.editionCode ? `${sim.editionCode} · ` : ''}Simulado ${sim.sequenceNumber}`;
}
