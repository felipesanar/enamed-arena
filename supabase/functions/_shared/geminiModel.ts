import { editionPrompt, record, resolveAiEditionContext, SummaryError, type EditionClient, type ValidatedEditionContext } from './aiEditionContext.ts';

export function resolveGeminiModel(configured?: string): string {
  const model = configured ?? 'gemini-2.5-flash';
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(model)) throw new SummaryError(500, 'Modelo de IA inválido.');
  return model;
}
export function geminiUrl(model: string, apiKey: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(resolveGeminiModel(model))}:generateContent?key=${encodeURIComponent(apiKey)}`;
}
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
export interface Dependencies {
  env(key: string): string | undefined;
  createClient(url: string, key: string, options: {
    global: { headers: { Authorization: string } };
    auth: { persistSession: false; autoRefreshToken: false };
  }): EditionClient;
  fetch?: typeof fetch;
  wait?: (ms: number) => Promise<void>;
}
export function createSummaryHandler(
  buildPrompt: (body: Record<string, unknown>, context: ValidatedEditionContext | null) => string,
  deps: Dependencies,
  maxOutputTokens = 1200,
) {
  return async (req: Request): Promise<Response> => {
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
      status, headers: { ...cors, 'Content-Type': 'application/json' },
    });
    if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
    if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);
    try {
      const authorization = req.headers.get('Authorization');
      const token = authorization?.match(/^Bearer ([^\s]+)$/i)?.[1];
      if (!token) return json({ error: 'Não autenticado.' }, 401);
      const url = deps.env('SUPABASE_URL');
      const publicKey = deps.env('SUPABASE_ANON_KEY');
      if (!url || !publicKey) throw new SummaryError(500, 'Serviço indisponível.');
      const client = deps.createClient(url, publicKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false, autoRefreshToken: false },
      });
      // getUser verifies the JWT with Auth; decoding or presence alone is insufficient.
      let userId: string;
      try {
        const { data, error } = await client.auth.getUser(token);
        if (error || !data.user?.id) return json({ error: 'Não autenticado.' }, 401);
        userId = data.user.id;
      } catch { return json({ error: 'Não autenticado.' }, 401); }
      let body: Record<string, unknown> | null;
      try {
        const text = await req.text();
        if (text.length > 131072) return json({ error: 'Payload muito grande.' }, 413);
        body = record(JSON.parse(text));
      } catch { return json({ error: 'JSON inválido.' }, 400); }
      if (!body) throw new SummaryError(400, 'Payload inválido.');
      const context = await resolveAiEditionContext(client, userId, body);
      const prompt = `${editionPrompt(context)}\n\n${buildPrompt(body, context)}`;
      const apiKey = deps.env('GEMINI_API_KEY');
      if (!apiKey) throw new SummaryError(500, 'Serviço de IA indisponível.');
      const model = resolveGeminiModel(deps.env('GEMINI_MODEL'));
      let response: Response | undefined;
      try {
        for (let attempt = 0; attempt < 2; attempt++) {
          response = await (deps.fetch ?? fetch)(geminiUrl(model, apiKey), {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ role: 'user', parts: [{ text: prompt }] }],
              generationConfig: {
                temperature: 0.6, maxOutputTokens, topP: 0.92,
                // The historical Flash override is not supported by every configured model.
                ...(model === 'gemini-2.5-flash' ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
              },
            }),
          });
          if (response.ok || (response.status !== 429 && response.status < 500) || attempt === 1) break;
          await (deps.wait ?? (ms => new Promise(resolve => setTimeout(resolve, ms))))(1200);
        }
        if (!response?.ok) return json({ error: 'Serviço de IA temporariamente indisponível.' }, 502);
        const data = await response.json();
        const parts = data?.candidates?.[0]?.content?.parts;
        if (!Array.isArray(parts)) return json({ error: 'Resposta de IA inválida.' }, 502);
        const raw = parts.map((part: unknown) => {
          const text = record(part)?.text;
          return typeof text === 'string' ? text : '';
        }).join('');
        if (!raw.trim()) return json({ error: 'Resposta de IA vazia.' }, 502);
        const markdown = raw.replace(/\s+[\u2014\u2013]\s+/g, '. ').replace(/[\u2014\u2013]/g, ',')
          .replace(/\.[ \t]+\./g, '.').replace(/[ \t]{2,}/g, ' ');
        return json({ markdown });
      } catch { return json({ error: 'Serviço de IA temporariamente indisponível.' }, 502); }
    } catch (error) {
      // Never return/log JWTs, upstream error bodies, student metrics or arbitrary exceptions.
      return json({ error: error instanceof SummaryError ? error.message : 'Serviço indisponível.' },
        error instanceof SummaryError ? error.status : 500);
    }
  };
}
