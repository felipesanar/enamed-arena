import { logger } from '@/lib/logger';

export function targetDimensions(w: number, h: number, max: number): { w: number; h: number } {
  const longest = Math.max(w, h);
  if (longest <= max) return { w, h };
  const scale = max / longest;
  return { w: Math.round(w * scale), h: Math.round(h * scale) };
}

/**
 * Reduz a imagem para no máximo `max`px na maior dimensão e recodifica como JPEG.
 * Em ambiente sem canvas (ex.: testes) ou em erro, devolve a entrada original.
 */
export async function downscaleImage(
  base64: string,
  mime: string,
  max = 1024,
): Promise<{ base64: string; mime: string }> {
  try {
    if (typeof document === 'undefined' || typeof Image === 'undefined') {
      return { base64, mime };
    }
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = `data:${mime};base64,${base64}`;
    });
    const { w, h } = targetDimensions(img.naturalWidth, img.naturalHeight, max);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return { base64, mime };
    ctx.drawImage(img, 0, 0, w, h);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    return { base64: dataUrl.split(',')[1] ?? base64, mime: 'image/jpeg' };
  } catch (e) {
    logger.error('[downscaleImage] falha, usando original:', e);
    return { base64, mime };
  }
}
