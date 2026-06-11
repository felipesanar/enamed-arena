/**
 * Cache de análises do Prof. San em sessionStorage, com timestamp de geração.
 * Formato novo: JSON `{ md, ts }`. Entradas legadas (string crua) seguem válidas.
 */

export interface CachedSummary {
  markdown: string;
  generatedAt: number | null;
}

export function readCachedSummary(key: string): CachedSummary | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.md === 'string') {
        return { markdown: parsed.md, generatedAt: typeof parsed.ts === 'number' ? parsed.ts : null };
      }
    } catch {
      /* entrada legada: string crua de markdown */
    }
    return { markdown: raw, generatedAt: null };
  } catch {
    return null;
  }
}

export function writeCachedSummary(key: string, markdown: string) {
  try {
    sessionStorage.setItem(key, JSON.stringify({ md: markdown, ts: Date.now() }));
  } catch {
    /* quotaExceeded etc */
  }
}

/** "análise gerada agora" / "análise gerada há 12 min" / "análise gerada às 14:30" */
export function formatGeneratedAt(generatedAt: number | null): string {
  if (!generatedAt) return 'análise gerada nesta sessão';
  const diffMin = Math.floor((Date.now() - generatedAt) / 60000);
  if (diffMin < 1) return 'análise gerada agora';
  if (diffMin < 60) return `análise gerada há ${diffMin} min`;
  const d = new Date(generatedAt);
  return `análise gerada às ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}
