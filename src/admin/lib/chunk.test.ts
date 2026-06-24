import { describe, it, expect } from 'vitest';
import { chunk } from './chunk';

describe('chunk', () => {
  it('divide em lotes do tamanho dado', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
  it('lista vazia → vazio', () => {
    expect(chunk([], 3)).toEqual([]);
  });
  it('tamanho maior que a lista retorna um único lote', () => {
    expect(chunk([1, 2], 5)).toEqual([[1, 2]]);
  });
});
