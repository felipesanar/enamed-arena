import { describe, it, expect } from 'vitest';
import { orderImagesForStitch, stitchImagesVertical } from './stitchImages';
import type { ExtractedImage } from './xlsxImageExtractor';

describe('orderImagesForStitch', () => {
  it('ordena por rowOff crescente', () => {
    const result = orderImagesForStitch([
      { rowOff: 2000, order: 0 },
      { rowOff: 100, order: 1 },
    ]);
    expect(result[0].rowOff).toBe(100);
    expect(result[1].rowOff).toBe(2000);
  });

  it('empate de rowOff desempata por order crescente', () => {
    const result = orderImagesForStitch([
      { rowOff: 100, order: 2 },
      { rowOff: 100, order: 0 },
      { rowOff: 100, order: 1 },
    ]);
    expect(result.map((r) => r.order)).toEqual([0, 1, 2]);
  });

  it('não muta o array original', () => {
    const input = [
      { rowOff: 2000, order: 0 },
      { rowOff: 100, order: 1 },
    ];
    const copy = [...input];
    orderImagesForStitch(input);
    expect(input).toEqual(copy);
  });
});

describe('stitchImagesVertical', () => {
  const imgA: ExtractedImage = { base64: 'AAAA', mimeType: 'image/png' };
  const imgB: ExtractedImage = { base64: 'BBBB', mimeType: 'image/png' };

  it('com 1 imagem retorna a mesma referência', async () => {
    const result = await stitchImagesVertical([imgA]);
    expect(result).toBe(imgA);
  });

  it('com 2+ imagens em jsdom (sem canvas real) retorna a PRIMEIRA (topo), não a última', async () => {
    const result = await stitchImagesVertical([imgA, imgB]);
    expect(result).toBe(imgA);
    expect(result).not.toBe(imgB);
    expect(result.base64).toBe('AAAA');
  });

  it('com 3 imagens em jsdom retorna a primeira da lista recebida', async () => {
    const imgC: ExtractedImage = { base64: 'CCCC', mimeType: 'image/png' };
    const result = await stitchImagesVertical([imgB, imgA, imgC]);
    expect(result).toBe(imgB);
  });
});
