import { describe, it, expect } from 'vitest';
import { targetDimensions } from './downscaleImage';

describe('targetDimensions', () => {
  it('não amplia imagens menores que o máximo', () => {
    expect(targetDimensions(800, 600, 1024)).toEqual({ w: 800, h: 600 });
  });
  it('reduz mantendo proporção pela maior dimensão', () => {
    expect(targetDimensions(2048, 1024, 1024)).toEqual({ w: 1024, h: 512 });
  });
  it('reduz quando a altura é a maior', () => {
    expect(targetDimensions(1000, 2000, 1000)).toEqual({ w: 500, h: 1000 });
  });
  it('mantém dimensões quando a maior é exatamente o máximo', () => {
    expect(targetDimensions(1024, 512, 1024)).toEqual({ w: 1024, h: 512 });
  });
});
