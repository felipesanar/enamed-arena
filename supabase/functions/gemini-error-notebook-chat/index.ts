/**
 * Chat de dúvidas com o Prof. Sanor sobre uma questão específica do
 * caderno de erros. Stateless: o frontend mantém o histórico em memória
 * e manda no payload a cada turno. Sem persistência por enquanto.
 *
 * Limites pragmáticos:
 *   - máx 8 turnos no histórico (descartar mais antigos no cliente)
 *   - pergunta do usuário até ~600 caracteres
 *   - resposta da IA até ~250 palavras
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface OptionPayload {
  label: string;
  text: string;
  isCorrect?: boolean;
}

interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

interface RequestBody {
  studentName?: string;
  questionStem: string;
  options: OptionPayload[];
  correctLabel?: string | null;
  userLabel?: string | null;
  area?: string | null;
  theme?: string | null;
  reason?: string | null;
  learningNote?: string | null;
  aiReviewMd?: string | null;
  history: ChatTurn[];
  question: string;
}

function stripEmDashes(text: string): string {
  return text
    .replace(/\s+[—–]\s+/g, '. ')
    .replace(/[—–]/g, ',')
    .replace(/\.[ \t]+\./g, '.')
    .replace(/[ \t]{2,}/g, ' ');
}

/**
 * Defesa em profundidade contra elogios à pergunta que escapem do prompt.
 * Remove abertura tipo "Excelente pergunta. ..." preservando o restante.
 * Tolera variações ("Essa é uma excelente pergunta!", "Boa pergunta —",
 * "Ótima pergunta:", etc.) e pontuação subsequente.
 */
function stripOpeningCompliments(text: string): string {
  const patterns: RegExp[] = [
    // "Essa é uma (excelente|boa|ótima|interessante|pertinente) pergunta..."
    /^\s*(?:essa\s+(?:é|e)\s+(?:uma|a)?\s*)?(?:excelente|ótima|otima|boa|interessante|pertinente|muito\s+boa|grande)\s+pergunta[\s!.,:;…]+/i,
    // "Pergunta excelente/ótima/..."
    /^\s*pergunta\s+(?:excelente|ótima|otima|boa|interessante|pertinente)[\s!.,:;…]+/i,
    // Aberturas de meta-comentário
    /^\s*(?:claro|perfeito|com\s+certeza|certamente|sem\s+dúvida|sem\s+duvida|honestamente|na\s+verdade|vamos\s+lá|vamos\s+la|deixa\s+eu\s+(?:te\s+)?explicar)[\s!.,:;…]+/i,
    // Saudações
    /^\s*(?:olá|ola|oi|opa|e\s+aí|e\s+ai|fala)[\s!.,:;…]+/i,
  ];

  let out = text;
  // Aplica em loop pra cobrir empilhamento ("Olá! Excelente pergunta. ...").
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

  // Capitaliza primeira letra se ficou minúscula após a remoção.
  if (out.length > 0 && /^[a-záéíóúâêôãõç]/.test(out)) {
    out = out[0].toUpperCase() + out.slice(1);
  }

  return out;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'GEMINI_API_KEY não configurada' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = (await req.json()) as RequestBody;
    const {
      studentName = 'Aluno',
      questionStem,
      options = [],
      correctLabel,
      userLabel,
      area,
      theme,
      reason,
      learningNote,
      aiReviewMd,
      history = [],
      question,
    } = body;

    if (!questionStem || options.length === 0) {
      return new Response(JSON.stringify({ error: 'questionStem e options são obrigatórios' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!question || typeof question !== 'string' || question.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'question é obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const firstName = (studentName || 'Aluno').trim().split(/\s+/)[0];
    const trimmedQuestion = question.trim().slice(0, 600);
    const trimmedHistory = history.slice(-8);

    const optionsTxt = options
      .map((o) => {
        const tags: string[] = [];
        if (correctLabel && o.label === correctLabel) tags.push('GABARITO');
        if (userLabel && o.label === userLabel) tags.push('MARCADA');
        const suffix = tags.length ? ` [${tags.join(', ')}]` : '';
        return `(${o.label}) ${o.text}${suffix}`;
      })
      .join('\n');

    const contextLine = [area, theme].filter(Boolean).join(' > ') || 'área não informada';
    const noteLine = learningNote?.trim() ? `Anotação do aluno: "${learningNote.trim()}"` : '';
    const reviewLine = aiReviewMd?.trim()
      ? `Você já enviou esta análise prévia (resumida abaixo, NÃO repita):\n${aiReviewMd.trim()}`
      : '';
    const reasonLine = reason ? `Motivo de ter salvado: ${reason}` : '';
    const correctLine = correctLabel ? `Gabarito: (${correctLabel})` : '';
    const userLine = userLabel ? `${firstName} marcou: (${userLabel})` : `${firstName} não marcou.`;

    const systemPrompt = `# QUEM VOCÊ É

Você é o **Prof. Sanor**, mentor pessoal de ${firstName} pro ENAMED. Está num chat seguindo uma análise que você já entregou de uma questão do caderno de erros. ${firstName} quer tirar uma dúvida específica.

**Tom:** profissional, próximo, direto. Como R3 de Clínica explicando ao lado.

**Propósito:** responder com precisão a dúvida feita, ancorada na questão específica. Sem rodeios.

🚫 **TRAVESSÃO PROIBIDO (— ou –). Use ponto, vírgula, "que", "porque", "e".**

# CONTEXTO DA QUESTÃO

Área: ${contextLine}
${reasonLine}
${noteLine}

## Enunciado
${questionStem}

## Alternativas
${optionsTxt}

${correctLine}
${userLine}

${reviewLine}

# COMO RESPONDER

✅ Máximo **140 palavras**, parágrafo único ou bullets curtos.
✅ **Ancore nos dados específicos do caso** (cite PA, FC, idade, dose, achado de exame quando relevante). Resposta que serve pra qualquer paciente vale pouco.
✅ Cite alternativa por label (A, B…) quando for o caso.
✅ Use markdown leve (negrito em palavras-chave, no máximo 2 trechos).

# PROFUNDIDADE TÉCNICA

Quando ${firstName} pedir um **critério, conceito ou comparação clínica**, eleve o nível com referências canônicas, sempre que couberem ao caso:

- **Perfis clínico-hemodinâmicos** quando a pergunta for sobre IC/choque: Stevenson (A/B/C/L = quente-seco, quente-úmido, frio-úmido, frio-seco), Forrester quando aplicável.
- **Classes funcionais e de recomendação**: NYHA I-IV, Classe I/IIa/IIb/III da SBC/ESC/AHA quando justificar conduta.
- **Ensaios pivotais** quando a pergunta cobrar comparação entre drogas/condutas (ex.: PARADIGM-HF, PIONEER-HF, DAPA-HF, EMPEROR-Reduced, PARTNER, ISCHEMIA, etc.). Cite só o que for diretamente relevante, sem "decorar bula".
- **Doses-alvo vs doses subterapêuticas** quando a pergunta envolver titulação (ex.: losartana alvo 100mg/d; carvedilol alvo 25mg 2×; enalapril alvo 10-20mg 2×). Se o paciente está em subdose, **aponte explicitamente**.

Não force framework se a pergunta for direta de fato/condução. Profundidade vale quando agrega.

# BANIDO

🚫 **Elogiar a pergunta**. Nada de "excelente pergunta", "ótima pergunta", "boa pergunta", "interessante", "muito bom", "pertinente", "essa é uma ótima/excelente/boa pergunta". **Comece direto pela resposta.**
🚫 Saudações ("Olá", "Oi", "E aí", "Opa") e despedidas ("Espero ter ajudado", "Qualquer dúvida").
🚫 Meta-comentário ("vamos lá", "claro!", "perfeito", "honestamente", "na verdade", "deixa eu te explicar").
🚫 Clichês ("parabéns", "continue assim", "não desanime").
🚫 Burocratês ("o paciente apresenta", "observa-se", "trata-se de", "no que se refere a").
🚫 Gíria forçada ("Cara,", "Mano,", "Tipo assim").
🚫 Repetir a análise já enviada palavra por palavra (ela está no contexto pra você diferenciar; não regurgite).
🚫 Recusar resposta com "não sou médico de verdade" ou "consulte um especialista". **Você é o Prof. Sanor**. Quando não tiver certeza, diga "não tenho certeza sobre X, o que sei é Y".
🚫 Inventar dados clínicos não presentes no enunciado. Se a pergunta pede algo fora do caso, ancore no que tem.
🚫 **TRAVESSÃO** em qualquer lugar (— ou –). Use ponto, vírgula, "que", "porque", "e", parênteses.

# COMECE

Responda direto à dúvida de ${firstName} sem chamar o nome dele. **A primeira palavra é a resposta, não um adjetivo sobre a pergunta.**`;

    // Constrói o histórico para Gemini: system instruction + turns + nova pergunta.
    const geminiContents = [
      ...trimmedHistory.map((t) => ({
        role: t.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: t.content }],
      })),
      { role: 'user', parts: [{ text: trimmedQuestion }] },
    ];

    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: geminiContents,
          generationConfig: {
            temperature: 0.5,
            maxOutputTokens: 900,
            topP: 0.9,
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
      },
    );

    if (!r.ok) {
      const txt = await r.text();
      console.error('[gemini-error-notebook-chat] Gemini error', r.status, txt);
      return new Response(JSON.stringify({ error: `Gemini API erro ${r.status}`, detail: txt }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await r.json();
    const raw =
      data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? '';
    const reply = stripOpeningCompliments(stripEmDashes(raw)).trim();

    if (!reply) {
      return new Response(JSON.stringify({ error: 'Resposta vazia da IA' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ reply }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[gemini-error-notebook-chat] error', err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'unknown' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
