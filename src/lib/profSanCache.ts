/** Full canonical payload signature: no lossy score/first-last shortcut. */
export function buildSummaryCacheKey(kind: string, userId: string | null | undefined, ids: readonly string[], data: unknown): string | null {
  if (!userId || !ids.length || ids.some(id => !id)) return null;
  const canonical = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)]));
    return value;
  };
  return `sanor:v2:${encodeURIComponent(userId)}:${kind}:${JSON.stringify(canonical({ ids, data }))}`;
}

export interface CachedSummary {
  markdown: string;
  generatedAt: number | null;
}

export function clearOtherSummaryCaches(userId: string | null) {
  try {
    const prefix = userId ? `sanor:v2:${encodeURIComponent(userId)}:` : null;
    for (const key of Object.keys(sessionStorage)) {
      if (key.startsWith('sanor:') && (!prefix || !key.startsWith(prefix))) sessionStorage.removeItem(key);
    }
  } catch {
    /* Storage may be unavailable; never block the page. */
  }
}

export function readCachedSummary(key: string | null): CachedSummary | null {
  if (!key?.startsWith('sanor:v2:')) return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.version === 2 && typeof parsed.md === 'string' && typeof parsed.ts === 'number') {
      return { markdown: parsed.md, generatedAt: parsed.ts };
    }
    return null;
  } catch {
    return null;
  }
}

export function writeCachedSummary(key: string | null, markdown: string) {
  if (!key?.startsWith('sanor:v2:')) return;
  try {
    sessionStorage.setItem(key, JSON.stringify({ version: 2, md: markdown, ts: Date.now() }));
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
