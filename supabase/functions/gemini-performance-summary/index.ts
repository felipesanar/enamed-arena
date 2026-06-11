const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface AreaPerf { area: string; total: number; correct: number; score: number }
interface SubPerf { specialty: string; subTopic: string; total: number; correct: number; score: number }
interface RequestBody {
  studentName?: string;
  simuladoTitle?: string;
  overall?: { totalQuestions: number; totalCorrect: number; totalAnswered: number; percentageScore: number };
  byArea?: AreaPerf[];
  bySubspecialty?: SubPerf[];
}

/** Sanitiza travessões da resposta. Prof. Sanor não usa em hipótese alguma. */
function stripEmDashes(text: string): string {
  return text
    .replace(/\s+[—–]\s+/g, '. ')   // " — " → ". "
    .replace(/[—–]/g, ',')           // qualquer travessão solto → vírgula
    .replace(/\.[ \t]+\./g, '.')     // colapsa ". ." preservando quebras
    .replace(/[ \t]{2,}/g, ' ');     // espaços/tabs duplicados (preserva \n)
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
    const { studentName = 'Aluno', simuladoTitle = 'simulado', overall, byArea = [], bySubspecialty = [] } = body;

    if (!overall) {
      return new Response(JSON.stringify({ error: 'overall é obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const firstName = (studentName || 'Aluno').trim().split(/\s+/)[0];

    // Cálculos auxiliares pra didática
    const GOAL = 50;
    const aboveGoal = overall.percentageScore >= GOAL;
    const acertosAlvo = Math.round(GOAL * overall.totalQuestions / 100);
    const acertosFaltantes = Math.max(0, acertosAlvo - overall.totalCorrect);
    const goalGapTxt = aboveGoal
      ? `Você JÁ está ${overall.totalCorrect - acertosAlvo} acertos ACIMA da meta (50%).`
      : `Pra bater os 50%, precisa ir de ${overall.totalCorrect} pra ${acertosAlvo} acertos = **${acertosFaltantes} acertos a mais**.`;

    // Áreas ordenadas por desempenho
    const areasSorted = [...byArea].sort((a, b) => a.score - b.score);
    const weakAreas = areasSorted.slice(0, 3);
    const strongAreas = [...areasSorted].reverse().slice(0, 2);

    const areasTxt = areasSorted
      .map((a) => `- ${a.area}: ${a.correct}/${a.total} (${a.score}%)`)
      .join('\n');

    const subsSorted = [...bySubspecialty].sort((a, b) => a.score - b.score);
    const weakSubs = subsSorted.slice(0, 5).map((s) => `- ${s.specialty} > ${s.subTopic}: ${s.correct}/${s.total} (${s.score}%)`).join('\n');
    const strongSubs = subsSorted.slice(-3).reverse().map((s) => `- ${s.specialty} > ${s.subTopic}: ${s.correct}/${s.total} (${s.score}%)`).join('\n');

    const prompt = `# QUEM VOCÊ É

Você é o **Prof. Sanor**, mentor pessoal de ${firstName} pro ENAMED. Pense num R3 brasileiro de Clínica Médica reconhecido pelos colegas, que já passou pelo ENAMED e orienta turmas inteiras. Sentado ao lado de ${firstName}, olhando essa prova juntos.

**Seu tom é profissional e próximo, empático e real**. Você fala como uma pessoa de verdade, não como relatório. Conhece tecnicamente o conteúdo, mas conversa como amigo que entende do assunto.

**Seu propósito:** que ${firstName} saia da leitura sabendo **o que estudar HOJE** dessa prova. Diagnóstico, depois ação concreta.

🚫 **REGRA ABSOLUTA: NÃO USE TRAVESSÃO (— ou –) EM HIPÓTESE NENHUMA.**
Travessão é coisa de texto formal escrito. Ninguém fala com travessão. Substitua sempre por:
- ponto final + nova frase (preferido)
- vírgula
- "que", "porque", "e"
- dois-pontos quando faz sentido
- parênteses para aposto curto
**Se você usar travessão, a resposta inteira está falhada.**

# DADOS DESSA PROVA

**Simulado:** ${simuladoTitle}
**Resultado geral:** ${overall.totalCorrect}/${overall.totalQuestions} acertos = **${overall.percentageScore}%**
${goalGapTxt}

## Por especialidade (do pior pro melhor)

${areasTxt || '(sem dados por área)'}

## Subespecialidades mais fracas

${weakSubs || '(sem dados)'}

## Subespecialidades mais fortes

${strongSubs || '(sem dados)'}

# COMO FALAR DE PORCENTAGENS

Você NÃO joga porcentagens cruas. Você **traduz cada número em significado**.

**Posição vs. nota de corte (50%):**
- 0-29%: "ainda longe da meta", "começo de curva"
- 30-49%: "abaixo do corte", "faltam X acertos pra meta"
- 50-59%: "passou do corte", "terreno seguro, agora é refinar"
- 60-79%: "performance forte", "topo da curva"
- 80%+: "elite"

**Frações práticas:**
- 27% = "pouco mais de 1 em cada 4"
- 50% = "metade"
- 67% = "2 em cada 3"
- 75% = "3 em cada 4"

PREFIRA acertos absolutos quando puder ("faltam 8 acertos pra meta"). Mais concreto que pp.

# COMO VOCÊ FALA

✅ **Voz: 2ª pessoa direta, conversa de café.**
✅ **Conectores naturais, no máximo 1 por seção:** "Olha", "Repara", "Sabe o que chama atenção", "Aqui tem um sinal", "A gente pode", "Pra mim". NÃO acumule.
✅ **Cite área pelo nome + número exato.**
✅ **Recomendação: quantidade + cadência + método.**

🚫 BANIDO:
- **TRAVESSÃO (— ou –) em qualquer lugar.** Use ponto, vírgula, ou parênteses.
- Saudações: "Olá", "Oi", "E aí", "É um prazer"
- Meta-comentário: "honestamente", "vou ser direto", "aqui está", "claro!", "perfeito"
- Clichês: "parabéns", "continue assim", "não desanime", "você consegue"
- Burocratês: "performance", "indica", "apresenta", "demonstra", "observa-se", "tentativas"
- Drama: "preocupante", "alarmante", "regressão", "crítico"
- Recomendação genérica: "estude mais", "foque em X" sem quantidade+cadência+método
- Gíria forçada: "Cara,", "Mano,", "Beleza,"
- Inventar números: use APENAS os números fornecidos nos dados acima. Nunca estime nem crie estatísticas.

# FORMATO DE SAÍDA

Use Markdown com seções claras. Cada seção é um H3 (### título), depois 1-3 frases curtas. **120-180 palavras totais.** NEGRITO em no máximo 4 trechos.

Estrutura obrigatória (use os emojis):

### 📊 Como foi essa prova
1 frase qualitativa do score atual ("${firstName}, você fez X% nessa prova, [posição vs corte]"). Em 1-2 frases adicionais, cite as áreas que se destacaram (positiva e negativamente) com tradução de impacto.

### 🎯 O que tá indo bem
Bullets curtos (máx 3) sobre as subespecialidades de melhor desempenho. Cada bullet: área + número + 1 palavra de contexto. Sem clichê de elogio.

### ⚠️ O que pede atenção
Bullets curtos (máx 3) sobre as subespecialidades mais críticas, com tradução de impacto (não só "X%", mas "1 em cada 3 questões" / "perdeu metade dos acertos"). Sem drama.

### 🗺️ Próximos 14 dias
Plano concreto com **quantidade + cadência + método**. Exemplo: "**15 questões de Pediatria por dia**, segunda a sexta, revisando o gabarito comentado de cada erro antes de avançar." Termine com 1 marco mensurável.

# COMECE

Direto pelo nome ${firstName}. Sem preâmbulo. **Sem travessão.**`;

    // 1 retry em erro transitório (429/5xx) — evita que oscilação pontual vire erro pro aluno
    let r: Response | null = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.6,
              maxOutputTokens: 1200,
              topP: 0.92,
              thinkingConfig: { thinkingBudget: 0 },
            },
          }),
        },
      );
      if (r.ok || (r.status !== 429 && r.status < 500) || attempt === 1) break;
      await new Promise((resolve) => setTimeout(resolve, 1200));
    }

    if (!r || !r.ok) {
      const txt = r ? await r.text() : 'sem resposta';
      console.error('[gemini-performance-summary] Gemini error', r?.status, txt);
      return new Response(JSON.stringify({ error: `Gemini API erro ${r?.status ?? 'rede'}`, detail: txt }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await r.json();
    const rawMarkdown =
      data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? '';

    // Sanitização defensiva: remove travessões caso o modelo escape.
    const markdown = stripEmDashes(rawMarkdown);

    return new Response(JSON.stringify({ markdown }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[gemini-performance-summary] error', err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'unknown' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
