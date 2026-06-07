import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type InsightType =
  | 'weak_area'
  | 'dominant_cause'
  | 'recurring_confusion'
  | 'overconfidence'
  | 'roi';

type InsightSeverity = 'critical' | 'attention' | 'positive' | 'info';

interface PatternInsight {
  id: string;
  type: InsightType;
  severity: InsightSeverity;
  title: string;
  body: string;
  metric?: string;
  comparison_table?: string;
  cta: { label: string; href: string } | null;
  data: Record<string, unknown>;
}

interface PatternInsightsResponse {
  insights: PatternInsight[];
  generated_at: string;
  has_sufficient_data: boolean;
  from_cache?: boolean;
  message?: string;
}

// Shape returned by the get_caderno_pattern_data RPC
interface CadernoPatternData {
  area_cause_dist: Array<{
    area: string;
    reason: string;
    cnt: number;
    mastered_cnt: number;
  }> | null;
  overconf: Array<{
    area: string;
    high_conf_wrong: number;
    high_conf_total: number;
  }> | null;
  roi_data: Array<{
    area: string;
    first_mastered_at: string;
    score_before: number | null;
    score_after: number | null;
  }> | null;
  recurring_confusion_candidates: Array<{
    area: string;
    theme: string;
    cnt: number;
  }> | null;
  question_samples: Array<{
    area: string;
    theme: string;
    question_text: string;
    reason: string;
  }> | null;
  total_entries: number;
  total_mastered: number;
}

// Shape of the caderno_pattern_insights_cache row
interface CacheRow {
  user_id: string;
  payload: PatternInsightsResponse;
  generated_at: string;
  entry_count: number;
}

// ---------------------------------------------------------------------------
// Sanitization helpers (same as gemini-error-notebook-review)
// ---------------------------------------------------------------------------

function stripEmDashes(text: string): string {
  return text
    .replace(/\s+[—–]\s+/g, '. ')
    .replace(/[—–]/g, ',')
    .replace(/\.[ \t]+\./g, '.')
    .replace(/[ \t]{2,}/g, ' ');
}

function stripOpeningCompliments(text: string): string {
  const patterns: RegExp[] = [
    /^\s*(?:essa\s+(?:é|e)\s+(?:uma|a)?\s*)?(?:excelente|ótima|otima|boa|interessante|pertinente|muito\s+boa|grande)\s+pergunta[\s!.,:;…]+/i,
    /^\s*pergunta\s+(?:excelente|ótima|otima|boa|interessante|pertinente)[\s!.,:;…]+/i,
    /^\s*(?:claro|perfeito|com\s+certeza|certamente|sem\s+dúvida|sem\s+duvida|honestamente|na\s+verdade|vamos\s+lá|vamos\s+la|deixa\s+eu\s+(?:te\s+)?explicar)[\s!.,:;…]+/i,
    /^\s*(?:olá|ola|oi|opa|e\s+aí|e\s+ai|fala)[\s!.,:;…]+/i,
  ];
  let out = text;
  for (let i = 0; i < 4; i++) {
    let changed = false;
    for (const re of patterns) {
      const next = out.replace(re, '');
      if (next !== out) {
        out = next;
        changed = true;
      }
    }
    if (!changed) break;
  }
  if (out.length > 0 && /^[a-záéíóúâêôãõç]/.test(out)) {
    out = out[0].toUpperCase() + out.slice(1);
  }
  return out;
}

function sanitizeString(s: string): string {
  return stripOpeningCompliments(stripEmDashes(s)).trim();
}

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

function buildInsightsPrompt(data: CadernoPatternData): string {
  // Serialize only what's needed — no PII (no student name, no identifiers)
  const areaCauseSummary = (data.area_cause_dist ?? [])
    .map((r) => `  - ${r.area} / ${r.reason}: ${r.cnt} entradas, ${r.mastered_cnt} dominadas`)
    .join('\n');

  const overconfSummary = (data.overconf ?? [])
    .filter((r) => r.high_conf_total > 0)
    .map((r) => `  - ${r.area}: ${r.high_conf_wrong} erros com alta confiança de ${r.high_conf_total} totais com alta confiança`)
    .join('\n');

  const roiSummary = (data.roi_data ?? [])
    .map((r) => {
      const before = r.score_before != null ? `${(r.score_before * 100).toFixed(0)}%` : 'n/d';
      const after = r.score_after != null ? `${(r.score_after * 100).toFixed(0)}%` : 'n/d';
      return `  - ${r.area}: acerto antes=${before}, depois=${after} (primeiro domínio: ${r.first_mastered_at})`;
    })
    .join('\n');

  const confusionCandidatesSummary = (data.recurring_confusion_candidates ?? [])
    .map((r) => `  - ${r.area} / ${r.theme}: ${r.cnt} ocorrências de confused_alternatives`)
    .join('\n');

  const questionSamplesSummary = (data.question_samples ?? [])
    .map((r) => `  - [${r.area} / ${r.theme}] ${r.question_text.slice(0, 200)}`)
    .join('\n');

  return `# QUEM VOCÊ É

Você é o **Prof. Sanor**, mentor do aluno para o ENAMED.
Agora você não está analisando uma questão — está lendo o caderno de erros completo
e fazendo um diagnóstico do padrão de estudo.

Tom: profissional, empático, direto. Fala como R3 que leu os dados e está dando
um feedback honesto num café, não como relatório de sistema.

🚫 REGRA ABSOLUTA: NÃO USE TRAVESSÃO (— ou –) EM HIPÓTESE NENHUMA.
🚫 Sem elogios ao aluno, sem saudações, sem meta-comentários, sem burocratês.
🚫 Use SOMENTE os dados reais fornecidos abaixo. NUNCA invente números, percentuais ou áreas.
🚫 Para o insight recurring_confusion: use APENAS as confusões presentes em "Candidatos a recurring_confusion" abaixo. NUNCA invente pares de condições não listados ali.

# DADOS DO CADERNO

Total de entradas: ${data.total_entries}
Total de questões dominadas: ${data.total_mastered}

## Distribuição por área e causa do erro
${areaCauseSummary || '  (sem dados)'}

## Overconfidence (alta confiança + erro)
${overconfSummary || '  (sem dados)'}

## ROI: desempenho antes e depois de dominar questões
${roiSummary || '  (sem dados)'}

## Candidatos a recurring_confusion (confused_alternatives >= 3 na mesma área+tema)
${confusionCandidatesSummary || '  (sem candidatos — NÃO gere insight recurring_confusion)'}

## Amostras de questões dos candidatos a confusão (textos reais para embasar comparison_table)
${questionSamplesSummary || '  (sem amostras)'}

# O QUE VOCÊ DEVE GERAR

Analise os dados acima e retorne um array de insights no JSON pedido.
Gere SOMENTE os tipos de insight para os quais há dados suficientes nos números acima.

## Tipos possíveis (gere apenas se os critérios abaixo forem atendidos):

**weak_area** — Gere quando uma área tem taxa de acerto < 40% OU razão erros/total >= 0,6,
  com mínimo de 5 entradas nessa área (some os cnt de todas as causas daquela área).
  O "metric" deve ser "X/Y" (dominadas/total).
  CTA href: "/caderno?area={area}".

**dominant_cause** — Gere quando em uma área com >= 5 entradas, uma causa representa > 50% das ocorrências.
  O "metric" deve ser "N%" (porcentagem daquela causa).
  CTA varia por causa:
    - did_not_know / did_not_remember → href "/caderno?area={area}"
    - reading_error → href "/caderno/revisao?reason=reading_error"
    - confused_alternatives → href "/caderno?reason=confused_alternatives&area={area}"
    - guessed_correctly → href "/caderno?area={area}"

**recurring_confusion** — Gere SOMENTE quando houver candidatos listados em "Candidatos a recurring_confusion" acima.
  Baseie o insight nos pares área+tema presentes nessa lista e nas amostras de questões fornecidas.
  Inclua "comparison_table" em markdown (ate 12 linhas) com diferencial clínico dos dois lados da confusão,
  usando os textos das amostras como referência — NUNCA invente condições específicas não presentes nos dados.
  CTA href: "/caderno?reason=confused_alternatives&area={area}".

**overconfidence** — Gere quando há >= 5 questões com high_conf_wrong OU taxa > 30% (high_conf_wrong / high_conf_total) em alguma área.
  O "metric" deve ser "N%" ou "N questões".
  CTA href: "/caderno?high_confidence=true&resolved=false".

**roi** — Gere quando há dados de ROI com score_before e score_after preenchidos.
  Calcule o delta em pp: (score_after - score_before) * 100.
  severity: "positive" se delta >= 5pp, "info" se -5pp <= delta < 5pp, "attention" se delta < -5pp.
  O "metric" deve ser "+Npp" ou "-Npp".
  CTA href: "/desempenho".

## Severidade para cada tipo:
- weak_area: "critical"
- dominant_cause: "attention"
- recurring_confusion: "critical" se >= 4 ocorrências, "attention" se 3
- overconfidence: "attention"
- roi: conforme delta calculado acima

## Regras de copy:
- 2 a 4 frases por body
- Mencione área e causa específicas quando disponíveis
- Sem travessão em lugar nenhum
- Sem chamar o aluno pelo nome no body (o UI já exibe o contexto)
- Markdown permitido no body (negrito em no máximo 2 trechos por insight)

## Se não houver dados suficientes para NENHUM insight:
Retorne array vazio.

# FORMATO DE SAÍDA

JSON com a chave "insights" contendo um array.
Cada item: { "id", "type", "severity", "title", "body", "metric"?, "comparison_table"?, "cta", "data" }.
- id: string slug único (ex: "weak-area-cardiologia", "dominant-cause-reading-error")
- type: exatamente um dos 5 valores canônicos
- severity: exatamente um dos 4 valores ("critical","attention","positive","info")
- title: 1 linha curta
- body: 2-4 frases, markdown permitido
- metric: string opcional de destaque (ex: "1/7", "+18pp", "62%")
- comparison_table: string markdown — APENAS em recurring_confusion
- cta: objeto {label, href} ou null
- data: objeto com os números brutos que geraram o insight (para rastreio)

Sem preâmbulo. Sem texto fora do JSON. Sem travessão.`;
}

// ---------------------------------------------------------------------------
// Gemini responseSchema
// ---------------------------------------------------------------------------

const GEMINI_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    insights: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          id: { type: 'STRING' },
          type: { type: 'STRING' },
          severity: { type: 'STRING' },
          title: { type: 'STRING' },
          body: { type: 'STRING' },
          metric: { type: 'STRING' },
          comparison_table: { type: 'STRING' },
          cta: {
            type: 'OBJECT',
            properties: {
              label: { type: 'STRING' },
              href: { type: 'STRING' },
            },
            required: ['label', 'href'],
          },
          data: { type: 'OBJECT' },
        },
        required: ['id', 'type', 'severity', 'title', 'body'],
      },
    },
  },
  required: ['insights'],
};

// ---------------------------------------------------------------------------
// Gemini call with 25s timeout (same pattern as classify-exam-errors)
// ---------------------------------------------------------------------------

async function generateInsightsFromGemini(
  data: CadernoPatternData,
  apiKey: string,
): Promise<PatternInsight[]> {
  const prompt = buildInsightsPrompt(data);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25_000);

  let r: Response;
  try {
    r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.55,
            maxOutputTokens: 3000,
            topP: 0.9,
            thinkingConfig: { thinkingBudget: 0 },
            responseMimeType: 'application/json',
            responseSchema: GEMINI_RESPONSE_SCHEMA,
          },
        }),
      },
    );
  } finally {
    clearTimeout(timeoutId);
  }

  if (!r.ok) {
    const txt = await r.text();
    console.error('[caderno-pattern-insights] Gemini error', r.status, txt.slice(0, 500));
    const err = new Error(`Gemini API error ${r.status}`);
    (err as Error & { status: number }).status = r.status;
    throw err;
  }

  const geminiData = await r.json();
  const rawJson =
    geminiData?.candidates?.[0]?.content?.parts
      ?.map((p: { text?: string }) => p.text ?? '')
      .join('') ?? '';

  let parsed: { insights?: unknown[] } = {};
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    const match = rawJson.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        parsed = JSON.parse(match[0]);
      } catch {
        console.error('[caderno-pattern-insights] JSON parse failed', rawJson.slice(0, 300));
      }
    }
  }

  const rawInsights = Array.isArray(parsed?.insights) ? parsed.insights : [];

  const VALID_TYPES = new Set<string>([
    'weak_area',
    'dominant_cause',
    'recurring_confusion',
    'overconfidence',
    'roi',
  ]);
  const VALID_SEVERITIES = new Set<string>(['critical', 'attention', 'positive', 'info']);

  const insights: PatternInsight[] = rawInsights
    .filter((item): item is Record<string, unknown> => item !== null && typeof item === 'object')
    .map((item) => {
      const insightType = VALID_TYPES.has(item.type as string)
        ? (item.type as InsightType)
        : 'weak_area';
      const severity = VALID_SEVERITIES.has(item.severity as string)
        ? (item.severity as InsightSeverity)
        : 'info';

      const ctaRaw = item.cta as { label?: string; href?: string } | null | undefined;
      const cta =
        ctaRaw && typeof ctaRaw.label === 'string' && typeof ctaRaw.href === 'string'
          ? { label: sanitizeString(ctaRaw.label), href: ctaRaw.href }
          : null;

      const dataRaw =
        item.data !== null && typeof item.data === 'object' && !Array.isArray(item.data)
          ? (item.data as Record<string, unknown>)
          : {};

      return {
        id: sanitizeString(String(item.id ?? insightType)).slice(0, 80),
        type: insightType,
        severity,
        title: sanitizeString(String(item.title ?? '')).slice(0, 120),
        body: sanitizeString(String(item.body ?? '')),
        ...(item.metric != null ? { metric: String(item.metric).slice(0, 20) } : {}),
        ...(insightType === 'recurring_confusion' && typeof item.comparison_table === 'string'
          ? { comparison_table: stripEmDashes(item.comparison_table) }
          : {}),
        cta,
        data: dataRaw,
      };
    })
    .filter((insight) => insight.id && insight.title && insight.body);

  return insights;
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // --- Env vars ---
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return new Response(JSON.stringify({ error: 'SUPABASE_URL / SUPABASE_ANON_KEY não configurados' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!GEMINI_API_KEY) {
      return new Response(JSON.stringify({ error: 'GEMINI_API_KEY não configurada' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // --- Auth: forward JWT so RLS sees the correct user ---
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Autenticação necessária' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // User-scoped client — all queries run as the authenticated user (RLS enforced)
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    // --- Parse optional body (body params are ignored for security — userId is always from JWT) ---
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      body = {};
    }
    // Intentionally unused: body may contain client hints in the future, but userId/studentFirstName
    // from the body are explicitly ignored to prevent IDOR / PII leakage.
    void body;

    // --- Resolve user identity (always from the authenticated JWT — never from the body) ---
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Token inválido ou expirado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = user.id;

    // --- Step 1: Fetch aggregated data via RPC ---
    const { data: patternData, error: rpcError } = await supabase.rpc('get_caderno_pattern_data', {
      p_user_id: userId,
    });

    if (rpcError) {
      console.error('[caderno-pattern-insights] RPC error', rpcError);
      return new Response(JSON.stringify({ error: 'Erro ao buscar dados do caderno' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = patternData as CadernoPatternData;
    const totalEntries = data?.total_entries ?? 0;

    // --- Step 2: Check for insufficient data (< 5 entries) ---
    if (totalEntries < 5) {
      const emptyResponse: PatternInsightsResponse = {
        insights: [],
        generated_at: new Date().toISOString(),
        has_sufficient_data: false,
        message: `Insights disponíveis a partir de 5 erros no caderno. Você tem ${totalEntries} ${totalEntries === 1 ? 'entrada' : 'entradas'} no momento.`,
      };
      return new Response(JSON.stringify(emptyResponse), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // --- Step 3: Check cache (24h TTL + entry_count invalidation) ---
    const { data: cacheRow, error: cacheReadError } = await supabase
      .from('caderno_pattern_insights_cache')
      .select('payload, generated_at, entry_count')
      .eq('user_id', userId)
      .maybeSingle();

    if (!cacheReadError && cacheRow) {
      const row = cacheRow as Pick<CacheRow, 'payload' | 'generated_at' | 'entry_count'>;
      const generatedAt = new Date(row.generated_at);
      const ageMs = Date.now() - generatedAt.getTime();
      const isWithin24h = ageMs < 24 * 60 * 60 * 1000;
      const entryCountMatches = row.entry_count === totalEntries;

      if (isWithin24h && entryCountMatches) {
        const cachedPayload = row.payload as PatternInsightsResponse;
        return new Response(
          JSON.stringify({ ...cachedPayload, from_cache: true }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        );
      }
    }

    // --- Step 4: Generate insights via Gemini ---
    let insights: PatternInsight[];
    try {
      insights = await generateInsightsFromGemini(data, GEMINI_API_KEY);
    } catch (geminiErr) {
      const status = (geminiErr as Error & { status?: number }).status;

      if (geminiErr instanceof Error && geminiErr.name === 'AbortError') {
        console.error('[caderno-pattern-insights] Gemini timeout (25s)');
        return new Response(
          JSON.stringify({ error: 'Timeout ao gerar insights. Tente novamente em instantes.' }),
          { status: 504, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      if (status === 429) {
        return new Response(
          JSON.stringify({ error: 'Limite de requisições atingido. Tente novamente em alguns minutos.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      console.error('[caderno-pattern-insights] Gemini error', geminiErr);
      return new Response(
        JSON.stringify({ error: 'Erro ao gerar insights. Os dados do caderno estão íntegros.' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const generatedAt = new Date().toISOString();
    const responsePayload: PatternInsightsResponse = {
      insights,
      generated_at: generatedAt,
      has_sufficient_data: true,
    };

    // --- Step 5: Persist to cache (upsert) ---
    const { error: cacheWriteError } = await supabase
      .from('caderno_pattern_insights_cache')
      .upsert(
        {
          user_id: userId,
          payload: responsePayload,
          generated_at: generatedAt,
          entry_count: totalEntries,
        },
        { onConflict: 'user_id' },
      );

    if (cacheWriteError) {
      // Non-fatal — log and continue
      console.error('[caderno-pattern-insights] cache write error', cacheWriteError);
    }

    return new Response(JSON.stringify(responsePayload), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[caderno-pattern-insights] unhandled error', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'unknown' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
