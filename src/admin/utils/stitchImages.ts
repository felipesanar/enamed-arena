/**
 * Costura vertical de imagens: quando 2+ imagens estão ancoradas na mesma
 * célula/slot/linha (ex.: duas tabelas empilhadas na coluna "Imagem do
 * enunciado"), o extrator não pode simplesmente sobrescrever uma com a
 * outra — precisa juntá-las numa única imagem, de cima para baixo.
 */
import type { ExtractedImage } from './xlsxImageExtractor';
import { logger } from '@/lib/logger';

// Ordena a lista para stitch: menor rowOff em cima; empate → ordem de documento (order).
export function orderImagesForStitch<T extends { rowOff: number; order: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => (a.rowOff - b.rowOff) || (a.order - b.order));
}

/**
 * Detecta se o ambiente tem um <canvas> 2D funcional. Em jsdom (Vitest),
 * `document`/`Image` existem mas `getContext('2d')` lança
 * "Not implemented" — por isso o probe precisa de try/catch, não apenas
 * checar `typeof document`/`typeof Image`. Sem isso, o loop de `Image.onload`
 * abaixo nunca resolveria em jsdom (onload/onerror não disparam), travando
 * a Promise indefinidamente.
 */
function hasUsableCanvas(): boolean {
  if (typeof document === 'undefined' || typeof Image === 'undefined') return false;
  try {
    const probe = document.createElement('canvas');
    return !!probe.getContext('2d');
  } catch {
    return false;
  }
}

// Costura verticalmente (cima->baixo) várias imagens numa só (PNG, fundo branco, centralizadas horizontalmente).
// 1 imagem: retorna ela mesma. Sem canvas (testes/SSR): fallback devolve a PRIMEIRA imagem e loga warning.
export async function stitchImagesVertical(images: ExtractedImage[], gap = 16): Promise<ExtractedImage> {
  if (images.length <= 1) return images[0];
  if (!hasUsableCanvas()) {
    logger.error('[stitchImagesVertical] canvas indisponível; usando só a 1ª imagem (topo)');
    return images[0];
  }
  try {
    const loaded = await Promise.all(images.map(im => new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = `data:${im.mimeType};base64,${im.base64}`;
    })));
    const W = Math.max(...loaded.map(i => i.naturalWidth));
    const H = loaded.reduce((s, i) => s + i.naturalHeight, 0) + gap * (loaded.length - 1);
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return images[0];
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
    let y = 0;
    for (const img of loaded) {
      const x = Math.round((W - img.naturalWidth) / 2);
      ctx.drawImage(img, x, y);
      y += img.naturalHeight + gap;
    }
    const dataUrl = canvas.toDataURL('image/png');
    const base64 = dataUrl.split(',')[1];
    if (!base64) return images[0];
    return { base64, mimeType: 'image/png' };
  } catch (e) {
    logger.error('[stitchImagesVertical] falha ao costurar; usando 1ª imagem:', e);
    return images[0];
  }
}
