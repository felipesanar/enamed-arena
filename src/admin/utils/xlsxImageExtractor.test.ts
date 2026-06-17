import { describe, it, expect } from 'vitest';
import { slotForColumn, slotForHeader } from './xlsxImageExtractor';

describe('slotForHeader', () => {
  it('reconhece imagem do enunciado', () => {
    expect(slotForHeader('Imagem do Enunciado')).toBe('enunciado');
  });
  it('reconhece imagem 2 do enunciado e não confunde com enunciado', () => {
    expect(slotForHeader('Imagem 2 do Enunciado')).toBe('enunciado2');
    expect(slotForHeader('Imagem 2')).toBe('enunciado2');
  });
  it('reconhece imagem do comentário com acento', () => {
    expect(slotForHeader('Imagem do Comentário')).toBe('comentario');
  });
  it('retorna null pra header desconhecido', () => {
    expect(slotForHeader('Enunciado')).toBeNull();
  });
});

describe('slotForColumn (estrito, sem ±1)', () => {
  const cols = { enunciadoCol: 5, enunciado2Col: 6, comentarioCol: 11 };
  it('mapeia cada coluna ao seu slot', () => {
    expect(slotForColumn(5, cols)).toBe('enunciado');
    expect(slotForColumn(6, cols)).toBe('enunciado2');
    expect(slotForColumn(11, cols)).toBe('comentario');
  });
  it('NÃO vaza coluna vizinha pro slot errado', () => {
    expect(slotForColumn(7, cols)).toBeNull();
    expect(slotForColumn(4, cols)).toBeNull();
  });
});
