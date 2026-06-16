import { describe, it, expect } from 'vitest';
import { computePercentile, computeClimb } from './ranking-percentile';

describe('computePercentile', () => {
  it('retorna top 1% para o primeiro de muitos', () => {
    expect(computePercentile(1, 318)).toBe(1);
  });
  it('clampa em 99 no pior caso', () => {
    expect(computePercentile(300, 300)).toBe(99);
  });
  it('arredonda pra cima', () => {
    expect(computePercentile(42, 318)).toBe(14); // ceil(13.2)
  });
  it('total 0 ou inválido vira 99 (sem divisão por zero)', () => {
    expect(computePercentile(1, 0)).toBe(99);
  });
});

describe('computeClimb', () => {
  it('estreia quando não há percentil anterior', () => {
    expect(computeClimb(null, 13)).toEqual({ kind: 'debut' });
  });
  it('subiu quando o percentil melhora (menor)', () => {
    expect(computeClimb(23, 13)).toEqual({ kind: 'delta', prevPercentil: 23, currPercentil: 13, delta: 10 });
  });
  it('caiu quando o percentil piora (maior)', () => {
    expect(computeClimb(13, 23)).toEqual({ kind: 'delta', prevPercentil: 13, currPercentil: 23, delta: -10 });
  });
  it('manteve quando igual', () => {
    expect(computeClimb(13, 13)).toEqual({ kind: 'delta', prevPercentil: 13, currPercentil: 13, delta: 0 });
  });
});
