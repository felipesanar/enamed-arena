const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface CutoffMatch {
  matched_institution: string;
  practice_scenario: string | null;
  specialty: string;
  cutoff_general: number | null;
  cutoff_quota: number | null;
}

interface RequestBody {
  studentName?: string;
  simuladoTitle?: string;
  userScore: number;            // 0-100
  userPosition: number;         // 1-based
  totalCandidates: number;
  averageScore: number;         // 0-100
  top10Cutoff: number;          // 0-100 (corte top 10% do simulado)
  specialty?: string | null;
  institutions?: string[] | null;
  cutoffContext?: {
    has_target_cutoff: boolean;
    matches: CutoffMatch[];
    stats?: { min?: number; max?: number; avg?: number; median?: number };
  } | null;
}

function stripEmDashes(text: string): string {
  return text
    .replace(/\s+[—–]\s+/g, '. ')
    .replace(/[—–]/g, ',')
    .replace(/\.[ \t]+\./g, '.')
    .replace(/[ \t]{2,}/g, ' ');
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
      simuladoTitle = 'simulado',
      userScore,
      userPosition,
      totalCandidates,
      averageScore,
      top10Cutoff,
      specialty,
      institutions = [],
      cutoffContext,
    } = body;

    const firstName = (studentName || 'Aluno').trim().split(/\s+/)[0];
    const percentile = totalCandidates > 0
      ? Math.round(((totalCandidates - userPosition + 1) / totalCandidates) * 100)
      : 0;
    const aheadOfAvg = Math.round(userScore - averageScore);
    const gapToTop10 = Math.round(top10Cutoff - userScore);

    // Bloco de corte alvo (instituição/especialidade do aluno)
    let cutoffBlock = '(O aluno ainda não definiu instituição/especialidade alvo no onboarding.)';
    let targetCutoffNumber: number | null = null;
    if (cutoffContext?.has_target_cutoff && cutoffContext.matches?.length) {
      const lines = cutoffContext.matches.slice(0, 6).map((m) => {
        const g = m.cutoff_general != null ? `Ampla ${m.cutoff_general}%` : 'Ampla —';
        const q = m.cutoff_quota != null ? `Cotas ${m.cutoff_quota}%` : '';
        return `- ${m.matched_institution}${m.practice_scenario ? ` (${m.practice_scenario})` : ''} → ${g}${q ? `, ${q}` : ''}`;
      });
      const allGeneral = cutoffContext.matches
        .map((m) => m.cutoff_general)
        .filter((v): v is number => typeof v === 'number');
      if (allGeneral.length) {
        targetCutoffNumber = Math.min(...allGeneral);
      }
      cutoffBlock = `Notas de corte (ampla concorrência) das instituições-alvo de ${firstName}:\n${lines.join('\n')}`;
    }

    let approvalLine = '';
    if (targetCutoffNumber != null) {
      const diff = Math.round(userScore - targetCutoffNumber);
      approvalLine = diff >= 0
        ? `Hoje ${firstName} está **${diff} pontos ACIMA** do corte mais baixo das instituições-alvo (${targetCutoffNumber}%).`
        : `Hoje ${firstName} está **${Math.abs(diff)} pontos ABAIXO** do corte mais baixo das instituições-alvo (${targetCutoffNumber}%).`;
    }

    const prompt = `# QUEM VOCÊ É

Você é o **Prof. Sanor**, mentor pessoal de ${firstName} pro ENAMED. Sentado ao lado dele olhando o ranking deste simulado juntos. Pense num R3 brasileiro reconhecido pelos colegas, que já passou pelo ENAMED.

Seu tom é profissional e próximo, empático e real. Você fala como pessoa, não como relatório. Seu propósito agora é **traduzir a posição no ranking em chance de aprovação** nas instituições-alvo do aluno e dizer o que fazer com isso.

🚫 **REGRA ABSOLUTA: NÃO USE TRAVESSÃO (— ou –).** Substitua por ponto, vírgula, "que", "porque", "e", dois-pontos ou parênteses.

# DADOS DESTE RANKING

**Simulado:** ${simuladoTitle}
**Posição de ${firstName}:** ${userPosition}º de ${totalCandidates} (top ${Math.max(1, 100 - percentile)}%, percentil ${percentile})
**Nota de ${firstName}:** ${userScore}%
**Média da turma:** ${averageScore}% (${firstName} está ${aheadOfAvg >= 0 ? `${aheadOfAvg} pp ACIMA` : `${Math.abs(aheadOfAvg)} pp ABAIXO`} da média)
**Corte top 10% deste simulado:** ${top10Cutoff}% (${gapToTop10 <= 0 ? 'JÁ está no top 10' : `faltam ${gapToTop10} pp pro top 10`})

**Especialidade alvo:** ${specialty || '(não definida)'}
**Instituições alvo:** ${institutions && institutions.length ? institutions.join(', ') : '(não definidas)'}

${cutoffBlock}

${approvalLine}

# COMO FALAR

- 2ª pessoa direta. Conversa de café.
- Traduza percentil em significado, não em número cru. Ex.: "top 20% significa que você passou de 4 em cada 5".
- Conecte SEMPRE a posição à **chance de aprovação nas instituições-alvo**. Esse é o ponto.
- Se o aluno está acima do corte das instituições-alvo: reforça o terreno seguro, mostra qual a próxima escalada (ampliar margem).
- Se está abaixo: diz quantos pontos faltam pro corte mais baixo, e dá um caminho concreto.
- Se não há instituições-alvo: instrui ${firstName} a completar o onboarding pra você poder mirar com precisão, e analisa só pelo top 10/média.

🚫 BANIDO:
- Travessão (— ou –)
- "Olá", "Oi", "E aí", "Parabéns", "Continue assim", "Não desanime"
- Burocratês: "performance", "demonstra", "apresenta", "observa-se"
- Drama: "preocupante", "alarmante", "crítico"
- Recomendação genérica sem quantidade+cadência

# FORMATO DE SAÍDA

Markdown. **100-160 palavras totais.** NEGRITO em no máximo 4 trechos.

Estrutura obrigatória (use os emojis):

### 🏁 Onde você está
1-2 frases. Posição + percentil traduzido + comparação com média. Chame ${firstName} pelo nome.

### 🎯 Chance de aprovação
1-3 frases conectando a nota atual com o corte das instituições-alvo (ou, se não houver, com o top 10 do simulado). Diga em pontos concretos quanto falta ou quanto sobra.

### 🗺️ Próximo passo
1-2 frases com ação concreta: revisar áreas fracas no Desempenho, subir X pontos até o próximo simulado, ou (se faltar onboarding) completar especialidade+instituições.

# COMECE

Direto pelo nome ${firstName}. Sem preâmbulo. Sem travessão.`;

    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.6,
            maxOutputTokens: 1000,
            topP: 0.92,
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
      },
    );

    if (!r.ok) {
      const txt = await r.text();
      console.error('[gemini-ranking-summary] Gemini error', r.status, txt);
      return new Response(JSON.stringify({ error: `Gemini API erro ${r.status}`, detail: txt }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await r.json();
    const rawMarkdown =
      data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? '';
    const markdown = stripEmDashes(rawMarkdown);

    return new Response(JSON.stringify({ markdown }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[gemini-ranking-summary] error', err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'unknown' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});