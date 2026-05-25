const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface SimuladoEntry {
  title: string;
  sequenceNumber: number;
  percentageScore: number;
  totalCorrect: number;
  totalQuestions: number;
  durationSeconds: number | null;
  tabExits: number;
  fullscreenExits: number;
  markedForReview: number;
  highConfidenceTotal: number;
  highConfidenceCorrect: number;
  byArea: { area: string; score: number }[];
  /** ISO timestamp do término — usado pra calcular recência e cadência */
  completedAt?: string | null;
}

interface RequestBody {
  studentName?: string;
  simulados?: SimuladoEntry[];
  /** Quantos simulados existem na plataforma no total (pra contextualizar "fez X de Y") */
  totalSimuladosPlatform?: number;
  /** Especialidade pretendida pela residência (vinda do onboarding), se houver */
  intendedSpecialty?: string | null;
}

// ─── Tipos analíticos ───
type Scenario =
  | 'iniciante_baixo'      // 2-3 sims, score atual < 30%
  | 'iniciante_medio'      // 2-3 sims, score atual 30-49%
  | 'iniciante_alto'       // 2-3 sims, score atual >= 50%
  | 'em_crescimento'       // delta acumulado >= +5pp
  | 'em_queda'             // delta acumulado <= -5pp
  | 'plateau'              // stddev < 4 e |delta| <= 4
  | 'volatil'              // stddev > 10
  | 'acima_corte'          // último score >= 50
  | 'rumo_a_corte'         // último score 40-49 e trajetória positiva
  | 'bem_abaixo'           // último score < 30
  | 'dado_suspeito';       // tempo absurdo em pelo menos 1 simulado

type Tone =
  | 'energizar'            // bem_abaixo, em_queda — direção sem alarme
  | 'consolidar'           // acima_corte, em_crescimento — manter momentum
  | 'provocar'             // plateau — mudar estratégia
  | 'investigar'           // volatil, dado_suspeito — perguntas abertas
  | 'orientar'             // iniciantes — direção clara, primeira leitura
  | 'celebrar_pontual';    // momento de virada, sem clichê

function fmtDuration(s: number | null): string {
  if (s == null) return 'n/d';
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}min ${r}s`;
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
    const studentName = body.studentName ?? 'Aluno';
    const simulados = body.simulados ?? [];
    const totalSimuladosPlatform = body.totalSimuladosPlatform ?? null;
    const intendedSpecialty = body.intendedSpecialty ?? null;

    if (simulados.length < 2) {
      return new Response(JSON.stringify({ error: 'mínimo 2 simulados' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const sorted = [...simulados].sort((a, b) => a.sequenceNumber - b.sequenceNumber);
    const firstEntry = sorted[0];
    const lastEntry = sorted[sorted.length - 1];
    const scoreDelta = lastEntry.percentageScore - firstEntry.percentageScore;

    // ─── FEATURE ENGINEERING ───────────────────────────────────────────────
    const scores = sorted.map(s => s.percentageScore);
    const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    const bestScore = Math.max(...scores);
    const worstScore = Math.min(...scores);

    // Desvio padrão dos scores (estabilidade)
    const variance = scores.reduce((acc, s) => acc + Math.pow(s - avgScore, 2), 0) / scores.length;
    const stddev = Math.round(Math.sqrt(variance) * 10) / 10;

    // Maior gap consecutivo (queda ou alta entre 2 provas consecutivas)
    let maxConsecGain = 0, maxConsecLoss = 0;
    for (let i = 1; i < sorted.length; i++) {
      const d = sorted[i].percentageScore - sorted[i - 1].percentageScore;
      if (d > maxConsecGain) maxConsecGain = d;
      if (d < maxConsecLoss) maxConsecLoss = d;
    }

    // Recência e cadência (se temos completedAt)
    const completedDates = sorted.map(s => s.completedAt ? new Date(s.completedAt) : null).filter(Boolean) as Date[];
    const now = new Date();
    const daysSinceLast = completedDates.length > 0
      ? Math.floor((now.getTime() - completedDates[completedDates.length - 1].getTime()) / (24 * 60 * 60 * 1000))
      : null;
    let avgGapDays: number | null = null;
    if (completedDates.length >= 2) {
      const gaps: number[] = [];
      for (let i = 1; i < completedDates.length; i++) {
        gaps.push((completedDates[i].getTime() - completedDates[i - 1].getTime()) / (24 * 60 * 60 * 1000));
      }
      avgGapDays = Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length);
    }

    // Distância pra nota de corte (50%)
    const GOAL = 50;
    const distanceToGoal = GOAL - lastEntry.percentageScore;
    const aboveGoal = lastEntry.percentageScore >= GOAL;

    // Acertos absolutos pra meta (mais didático que "pp")
    // 1pp em 100 questões = 1 acerto. Em provas com qtd diferente, escala.
    const lastTotalQuestions = lastEntry.totalQuestions || 100;
    const acertosAlvo = Math.round(GOAL * lastTotalQuestions / 100);
    const acertosAtuais = lastEntry.totalCorrect;
    const acertosFaltantes = Math.max(0, acertosAlvo - acertosAtuais);

    // Como atingir a meta em linguagem prática
    const goalGapTxt = aboveGoal
      ? `Você JÁ está ${acertosAtuais - acertosAlvo} acertos ACIMA da meta (${acertosAtuais}/${lastTotalQuestions} > ${acertosAlvo}/${lastTotalQuestions}).`
      : `Pra bater os ${GOAL}%, você precisa ir de ${acertosAtuais} pra ${acertosAlvo} acertos em ${lastTotalQuestions} questões = **${acertosFaltantes} acertos a mais**.`;

    // ─── Dados por área: rankings de alta e queda explícitos ───
    interface AreaDelta {
      area: string; firstScore: number | null; lastScore: number | null; delta: number | null;
    }
    const allAreas = Array.from(new Set(sorted.flatMap(s => s.byArea.map(a => a.area))));
    const areaDeltas: AreaDelta[] = allAreas.map(area => {
      const fs = sorted[0].byArea.find(a => a.area === area)?.score ?? null;
      const ls = sorted[sorted.length - 1].byArea.find(a => a.area === area)?.score ?? null;
      return {
        area,
        firstScore: fs,
        lastScore: ls,
        delta: fs != null && ls != null ? ls - fs : null,
      };
    });
    const areasWithDelta = areaDeltas.filter((a): a is AreaDelta & { delta: number } => a.delta != null);
    const risingAreas = [...areasWithDelta].filter(a => a.delta > 0).sort((a, b) => b.delta - a.delta);
    const fallingAreas = [...areasWithDelta].filter(a => a.delta < 0).sort((a, b) => a.delta - b.delta);
    const stableAreas = areasWithDelta.filter(a => a.delta === 0);

    const areaDeltaTxt = areaDeltas.map(({ area, firstScore, lastScore, delta }) => {
      const f = firstScore != null ? `${firstScore}%` : '—';
      const l = lastScore != null ? `${lastScore}%` : '—';
      const d = delta != null ? `Δ ${delta >= 0 ? '+' : ''}${delta}pp` : 'Δ n/d';
      return `- ${area}: ${f} → ${l} (${d})`;
    }).join('\n');

    const summaryTxt = sorted.map(s => (
      `- ${s.title} (#${s.sequenceNumber}): ${s.percentageScore}% (${s.totalCorrect}/${s.totalQuestions}); ` +
      `tempo ${fmtDuration(s.durationSeconds)}; saídas de aba ${s.tabExits}, fullscreen ${s.fullscreenExits}; ` +
      `marcadas p/ rever ${s.markedForReview}; alta confiança ${s.highConfidenceCorrect}/${s.highConfidenceTotal} corretas`
    )).join('\n');

    // Highlights estruturados para o prompt
    const topRise = risingAreas[0] ?? null;
    const topFall = fallingAreas[0] ?? null;
    const highlightsTxt = [
      topRise ? `- 🟢 Maior alta: ${topRise.area} de ${topRise.firstScore}% → ${topRise.lastScore}% (+${topRise.delta}pp)` : null,
      topFall ? `- 🔴 Maior queda: ${topFall.area} de ${topFall.firstScore}% → ${topFall.lastScore}% (${topFall.delta}pp)` : null,
      stableAreas.length > 0 ? `- ⚪ Estáveis (delta 0): ${stableAreas.map(a => a.area).join(', ')}` : null,
      risingAreas.length > 1 ? `- Outras altas: ${risingAreas.slice(1).map(a => `${a.area} +${a.delta}pp`).join(', ')}` : null,
      fallingAreas.length > 1 ? `- Outras quedas: ${fallingAreas.slice(1).map(a => `${a.area} ${a.delta}pp`).join(', ')}` : null,
    ].filter(Boolean).join('\n');

    // Primeiro nome (vocativo natural na conversa)
    const firstName = (studentName || 'Aluno').trim().split(/\s+/)[0];

    // ─── Sinais comportamentais com contexto de referência ENAMED ───
    // Referência: prova real tem 100q em 4h (240min) = ~144s/questão.
    // Tempo "saudável": >= 120min (~72s/q). Abaixo de 30min com 100q respondidas: provável chute massivo ou teste de sistema.
    const lastDurationMin = lastEntry.durationSeconds != null ? Math.round(lastEntry.durationSeconds / 60) : null;
    const lastSecPerQ = lastEntry.durationSeconds && lastEntry.totalQuestions
      ? Math.round(lastEntry.durationSeconds / lastEntry.totalQuestions)
      : null;
    const totalExits = sorted.reduce((s, e) => s + e.tabExits + e.fullscreenExits, 0);
    const behaviorSignals: string[] = [];

    // Sinal forte: tempo absurdamente curto (< 30min em prova de 100q)
    if (lastDurationMin != null && lastDurationMin < 30 && lastEntry.totalQuestions >= 50) {
      behaviorSignals.push(
        `Tempo MUITO curto no último (${lastDurationMin}min para ${lastEntry.totalQuestions} questões = ~${lastSecPerQ}s/questão). ` +
        `Referência: ENAMED real tem 4h pra 100q (~144s/q). Hipóteses possíveis: chute massivo, abandono, teste rápido do sistema, ou prova de treino.`
      );
    } else if (lastSecPerQ != null && lastSecPerQ < 60) {
      behaviorSignals.push(`Ritmo acelerado no último: ~${lastSecPerQ}s/questão (referência saudável: 60-144s/q). Pode indicar leitura apressada ou alta confiança.`);
    }

    if (firstEntry.durationSeconds && lastEntry.durationSeconds) {
      const ratio = lastEntry.durationSeconds / firstEntry.durationSeconds;
      if (ratio < 0.5) {
        const fmin = Math.round(firstEntry.durationSeconds / 60);
        const lmin = Math.round(lastEntry.durationSeconds / 60);
        behaviorSignals.push(`Tempo despencou de ${fmin}min → ${lmin}min entre as provas (~${Math.round((1 - ratio) * 100)}% mais curto).`);
      }
    }
    if (totalExits >= 3) {
      behaviorSignals.push(`${totalExits} saídas de aba/fullscreen acumuladas — atenção competiu com a prova.`);
    }

    // Marcadas pra rever: sinal de insegurança no conteúdo
    const totalMarked = sorted.reduce((s, e) => s + e.markedForReview, 0);
    const lastMarked = lastEntry.markedForReview;
    const lastMarkedPct = lastEntry.totalQuestions > 0
      ? Math.round((lastMarked / lastEntry.totalQuestions) * 100)
      : 0;
    if (lastMarkedPct >= 20) {
      behaviorSignals.push(`Marcou ${lastMarked}/${lastEntry.totalQuestions} (${lastMarkedPct}%) pra rever no último — sinal de insegurança em vários conteúdos.`);
    } else if (totalMarked === 0 && sorted.length >= 2) {
      behaviorSignals.push(`Nenhuma questão marcada pra rever em ${sorted.length} provas — pode indicar excesso de certeza ou não-uso da ferramenta.`);
    }

    const behaviorTxt = behaviorSignals.length > 0
      ? behaviorSignals.map(s => `- ${s}`).join('\n')
      : '(nenhum sinal comportamental atípico)';

    // High-confidence quality (% acerto entre marcadas "alta confiança")
    const totalHC = sorted.reduce((s, e) => s + e.highConfidenceTotal, 0);
    const totalHCRight = sorted.reduce((s, e) => s + e.highConfidenceCorrect, 0);
    const hcAccuracyPct = totalHC > 0 ? Math.round((totalHCRight / totalHC) * 100) : null;
    const hcOverconfidence = hcAccuracyPct != null && hcAccuracyPct < 60 && totalHC >= 5;

    // ─── CLASSIFICAÇÃO DE CENÁRIO PRIMÁRIO ──────────────────────────────
    // O cenário primário define O TOM da resposta. Tags secundárias
    // (computadas abaixo) dão contexto adicional pra IA sem mudar o tom.
    let scenario: Scenario = 'iniciante_medio';
    const hasSuspectData = sorted.some(s =>
      s.durationSeconds != null && s.durationSeconds < 1800 && s.totalQuestions >= 50
    );

    if (sorted.length <= 3) {
      if (lastEntry.percentageScore < 30) scenario = 'iniciante_baixo';
      else if (lastEntry.percentageScore < 50) scenario = 'iniciante_medio';
      else scenario = 'iniciante_alto';
    } else {
      if (lastEntry.percentageScore < 30) scenario = 'bem_abaixo';
      else if (lastEntry.percentageScore >= 50) scenario = 'acima_corte';
      else if (lastEntry.percentageScore >= 40 && scoreDelta > 0) scenario = 'rumo_a_corte';
      else if (stddev > 10) scenario = 'volatil';
      else if (Math.abs(scoreDelta) <= 4 && stddev < 4) scenario = 'plateau';
      else if (scoreDelta >= 5) scenario = 'em_crescimento';
      else if (scoreDelta <= -5) scenario = 'em_queda';
      else scenario = 'iniciante_medio';
    }

    // ─── TAGS COMPOSTAS (sinais paralelos ao cenário primário) ───
    // O aluno pode ter VÁRIAS dessas. Ex: iniciante_baixo + dado_suspeito + recencia_longa.
    const tags: string[] = [];
    if (hasSuspectData) tags.push('dado_suspeito');
    if (daysSinceLast != null && daysSinceLast > 30) tags.push('recencia_longa');
    if (daysSinceLast != null && daysSinceLast > 60) tags.push('gap_longo');
    if (sorted.length === 2) tags.push('amostra_minima');
    if (hcOverconfidence) tags.push('confianca_desalinhada');

    // Outlier: 1 prova fora-da-curva (>= 12pp de distância da mediana das outras)
    if (sorted.length >= 3) {
      const sortedScoresAsc = [...scores].sort((a, b) => a - b);
      const median = sortedScoresAsc[Math.floor(sortedScoresAsc.length / 2)];
      const outliers = scores.filter(s => Math.abs(s - median) >= 12);
      if (outliers.length === 1) tags.push('outlier_unico');
    }

    // Composição da queda total (qual área puxou mais o tombo)
    // Soma dos deltas negativos = total "perdido". Cada área tem peso proporcional.
    let dropCompositionTxt = '';
    if (scoreDelta < -2 && fallingAreas.length > 0) {
      const totalNegative = fallingAreas.reduce((s, a) => s + a.delta, 0);
      if (totalNegative < 0) {
        const top3 = fallingAreas.slice(0, 3).map(a => {
          const share = Math.round((a.delta / totalNegative) * 100);
          return `${a.area} (${share}% do tombo)`;
        });
        dropCompositionTxt = `Composição da queda: ${top3.join(', ')}.`;
      }
    }

    // ─── TOM RECOMENDADO PELO CENÁRIO ─────────────────────────────────────
    const TONE_BY_SCENARIO: Record<Scenario, Tone> = {
      iniciante_baixo: 'orientar',
      iniciante_medio: 'orientar',
      iniciante_alto: 'consolidar',
      em_crescimento: 'consolidar',
      em_queda: 'energizar',
      plateau: 'provocar',
      volatil: 'investigar',
      acima_corte: 'consolidar',
      rumo_a_corte: 'energizar',
      bem_abaixo: 'energizar',
      dado_suspeito: 'investigar',
    };
    const tone = TONE_BY_SCENARIO[scenario];

    // Descrição humana do cenário (vai pro prompt como contexto)
    const SCENARIO_DESC: Record<Scenario, string> = {
      iniciante_baixo: 'Aluno em estágio inicial (poucas provas), score atual abaixo de 30%. Precisa de orientação clara e primeira direção, sem julgamento.',
      iniciante_medio: 'Aluno em estágio inicial (poucas provas), score atual entre 30-49%. Primeira leitura — foco em direção, não em tendência.',
      iniciante_alto: 'Aluno em estágio inicial, mas já largando acima da nota de corte (50%+). Reconhecer base sólida, mostrar como consolidar.',
      em_crescimento: 'Trajetória positiva consistente — delta acumulado de pelo menos +5pp. Manter momentum, ajustar fino.',
      em_queda: 'Trajetória negativa — score caiu pelo menos -5pp acumulado. Acolher sem alarme, identificar onde reverter.',
      plateau: 'Score estável em poucas variações — provavelmente platô. Provocar mudança de estratégia.',
      volatil: 'Scores muito inconsistentes (stddev > 10pp). Investigar o que muda entre provas.',
      acima_corte: 'Score atual já passou a nota de corte (50%+). Consolidação e refinamento — manter, não relaxar.',
      rumo_a_corte: 'Score atual entre 40-49% com tendência positiva — pertinho de bater a meta. Energia + recomendação cirúrgica.',
      bem_abaixo: 'Score atual abaixo de 30% com várias provas. Direção urgente sem desânimo — mostrar primeiro passo.',
      dado_suspeito: 'Pelo menos uma prova tem tempo absurdamente curto (< 30min para muitas questões). Tratar como sinal a investigar, não afirmar causa.',
    };

    // Diretivas de tom específicas (matriz tom × instrução)
    const TONE_DIRECTIVES: Record<Tone, string> = {
      orientar: `Aluno é iniciante. Postura: mentor calmo dando primeira direção. Use frases que ancoram ("primeiro passo é…", "antes de qualquer coisa…"). Evite tendência ("você está caindo") — chame de "leitura inicial".`,
      consolidar: `Aluno está bem. Postura: técnico ajustando o fino. Reconheça SEM clichê (proibido "parabéns") — algo tipo "tá num bom lugar" / "essa base é real". Foque em refino: onde apertar pra subir mais 5-10pp.`,
      energizar: `Aluno está em queda ou bem abaixo. Postura: amigo que acredita, não treinador motivacional. Linguagem de retorno ("vamos retomar", "vamos virar isso"). Recomendação CURTA e específica, não 5 ações.`,
      provocar: `Aluno em platô. Postura: mentor um pouco direto. Diga "tá num patamar" / "platô faz parte". Provoque com pergunta ("o que você tá fazendo hoje pra estudar que tá te mantendo aqui?"). Sugira mudar método, não só intensidade.`,
      investigar: `Score volátil OU dado suspeito. Postura: detetive curioso, não juiz. NÃO afirme causa — sempre traga 2-3 hipóteses neutras como pergunta. "Pode ter sido X, Y ou Z — qual ressoa?".`,
      celebrar_pontual: `Momento de virada. Postura: reconhecer o avanço sem inflar. 1 frase de celebração específica ("essa virada na GO é real") + retomar para o próximo passo.`,
    };

    // Distância pra meta em texto humano
    const goalTxt = aboveGoal
      ? `Você já está ${Math.abs(distanceToGoal)}pp ACIMA da nota de corte (${GOAL}%).`
      : `Faltam ${distanceToGoal}pp pra você bater a nota de corte (${GOAL}%).`;

    // Recência em texto humano
    let recencyTxt = '';
    if (daysSinceLast != null) {
      if (daysSinceLast > 60) recencyTxt = `Última prova foi há ${daysSinceLast} dias — bastante tempo sem prática consolidada.`;
      else if (daysSinceLast > 30) recencyTxt = `Última prova foi há ${daysSinceLast} dias.`;
      else if (daysSinceLast > 14) recencyTxt = `Última prova foi há ${daysSinceLast} dias.`;
      else recencyTxt = `Última prova foi há ${daysSinceLast} dia${daysSinceLast === 1 ? '' : 's'}.`;
    }

    // Linha de cadência
    let cadenceTxt = '';
    if (avgGapDays != null) {
      cadenceTxt = `Cadência média entre provas: ${avgGapDays} dia${avgGapDays === 1 ? '' : 's'}.`;
    }

    // Progresso na plataforma
    const platformProgressTxt = totalSimuladosPlatform != null
      ? `Já fez ${sorted.length} de ${totalSimuladosPlatform} simulados publicados.`
      : `Já fez ${sorted.length} simulados.`;

    // ─── Fatos consolidados (pra IA referenciar e NÃO inventar) ───
    // Ordenados por importância: o que a IA mais precisa pra montar a resposta vem PRIMEIRO.
    const factsTxt = [
      // Bloco 1: onde está agora
      `- Score atual: **${lastEntry.percentageScore}%** (${acertosAtuais} de ${lastTotalQuestions} acertos)`,
      `- ${goalGapTxt}`,
      // Bloco 2: trajetória
      `- Score primeiro simulado: ${firstEntry.percentageScore}%`,
      `- Variação total: **${scoreDelta >= 0 ? '+' : ''}${scoreDelta}pp** em ${sorted.length} provas`,
      `- Média entre provas: ${avgScore}%`,
      `- Melhor: ${bestScore}%, pior: ${worstScore}%`,
      `- Estabilidade: ${stddev}pp ${stddev > 10 ? '(volátil — scores oscilam muito)' : stddev < 4 ? '(estável)' : '(moderada)'}`,
      sorted.length > 2 ? `- Maior salto consecutivo: ${maxConsecGain >= 0 ? '+' : ''}${maxConsecGain}pp; maior queda consecutiva: ${maxConsecLoss}pp` : null,
      // Bloco 3: composição
      dropCompositionTxt ? `- ${dropCompositionTxt}` : null,
      // Bloco 4: contexto temporal e plataforma
      `- ${platformProgressTxt}`,
      recencyTxt ? `- ${recencyTxt}` : null,
      cadenceTxt ? `- ${cadenceTxt}` : null,
      // Bloco 5: sinais qualitativos
      hcAccuracyPct != null ? `- Alta confiança: ${hcAccuracyPct}% de acerto (${totalHCRight}/${totalHC})${hcOverconfidence ? ' — DESALINHAMENTO (sente seguro mas erra)' : ''}` : null,
      intendedSpecialty ? `- Especialidade pretendida: ${intendedSpecialty}` : null,
    ].filter(Boolean).join('\n');

    // Tags compostas em texto humano
    const tagsTxt = tags.length > 0
      ? `**Sinais paralelos:** ${tags.join(', ')}`
      : '';

    const prompt = `# QUEM VOCÊ É

Você é o **Prof. Sanor**, mentor pessoal de ${firstName} pro ENAMED. Pense num R3 brasileiro de Clínica Médica reconhecido pelos colegas, que já passou pelo ENAMED e orienta turmas inteiras. Sentado ao lado de ${firstName}, olhando o painel juntos.

**Seu tom é profissional e próximo, empático e real**. Você fala como uma pessoa de verdade, não como relatório. Conhece tecnicamente o conteúdo, mas conversa como amigo que entende do assunto.

**Seu propósito nesta análise:** que ${firstName} saia da leitura sabendo **o que estudar HOJE**, não só "como tô indo". Diagnóstico, depois ação concreta.

**Sua especialidade técnica:** traduzir números em significado. Você NUNCA joga porcentagens cruas. Explica o que aquele número quer dizer no contexto da prova real.

🚫 **REGRA ABSOLUTA: NÃO USE TRAVESSÃO (— ou –) EM HIPÓTESE NENHUMA.**
Travessão é coisa de texto formal escrito. Ninguém fala com travessão. Substitua sempre por:
- ponto final + nova frase (preferido)
- vírgula
- "que", "porque", "e"
- dois-pontos quando faz sentido
- parênteses para aposto curto
**Se você usar travessão, a resposta inteira está falhada. Releia antes de mandar.**

# CENÁRIO DETECTADO DE ${firstName.toUpperCase()}

**Cenário primário:** \`${scenario}\`
${SCENARIO_DESC[scenario]}

**Tom recomendado:** \`${tone}\`
${TONE_DIRECTIVES[tone]}

${tagsTxt}

# FATOS CONSOLIDADOS (USE estes números, não invente outros)

${factsTxt}

# DESEMPENHO POR PROVA (cronológico)

${summaryTxt}

# HIGHLIGHTS POR ÁREA

${highlightsTxt || '(sem highlights de área disponíveis)'}

## Tabela completa por área

${areaDeltaTxt || '(sem dados por área)'}

# SINAIS COMPORTAMENTAIS

${behaviorTxt}

# REFERÊNCIAS PRA CALIBRAR SUAS AFIRMAÇÕES

- Prova ENAMED oficial: **100 questões em 4 horas** (~144s/questão).
- Nota de corte histórica: **~50%** (varia por especialidade).
- Tempo < 30min com prova respondida: pode ser chute massivo, abandono, treino livre, ou teste de sistema. **Trate como pergunta**, nunca conclusão.
- Alta confiança com acerto < 60%: padrão de "ilusão de competência" — vale revisar onde se sente seguro.

# COMO FALAR DE PORCENTAGENS (regra de ouro)

Você NÃO joga porcentagens cruas. Você **traduz cada número em significado**. Sempre que citar um %, ancore em pelo menos UMA destas referências:

1. **Posição vs. nota de corte (50%):**
   - 0-29%: "ainda longe da meta", "tá no começo da curva", "muito espaço pra crescer"
   - 30-39%: "abaixo da nota de corte", "tem que tirar o dobro pra bater 50%"
   - 40-49%: "quase lá", "pertinho do corte", "faltam X acertos pra meta"
   - 50-59%: "passou da nota de corte", "tá no terreno seguro", "agora é refinar"
   - 60-69%: "bem acima do corte", "rota de prova boa"
   - 70-79%: "performance forte", "topo da curva"
   - 80%+: "elite", "muito acima da média"

   PREFERIR FALAR EM ACERTOS ABSOLUTOS quando puder ("faltam 23 acertos pra bater 50") — é mais concreto que pp.

2. **Tradução prática (frações):**
   - 27% = "pouco mais de 1 em cada 4 questões"
   - 33% = "mais ou menos 1 em cada 3"
   - 50% = "metade", "1 em cada 2"
   - 67% = "2 em cada 3"
   - 75% = "3 em cada 4"

3. **Variação de área:** quando uma área caiu/subiu, traduza o impacto:
   - "caiu de 41% pra 28%" → "perdeu quase um terço dos acertos que tinha"
   - "subiu de 20% pra 28%" → "8 pontos a mais, começo de movimento real"
   - "subiu de 80% pra 95%" → "consolidou, virou domínio"
   - "caiu de 75% pra 60%" → "perdeu o salto, mas ainda tá em terreno bom"
   - Quedas >= 10pp são significativas; ganhos >= 8pp também.

4. **Variação de score total:**
   - +5pp em score: "ganho concreto, vale comemorar baixo"
   - -5pp em score: "pequena oscilação, ainda tá no mesmo patamar"
   - >+10pp: "salto real"
   - >-10pp: "queda forte, vale entender"
   - Próximo de 0 com poucos simulados: "praticamente parado — é leitura inicial"

5. **Negrito:** use **NEGRITO** só nos 2-3 números mais importantes (o delta protagonista, o score atual em relação à meta, o número da recomendação). Não em todo número.

**Exemplos do que SIM e do que NÃO fazer (sem travessão, repare):**

❌ "Você foi de 31% para 27%, uma variação de -4pp no seu score."
✅ "Você tá rondando os **27%**. Ainda longe dos 50% da nota de corte. Esses -4pp do simulado anterior são pequena oscilação, não tendência real."

❌ "Pediatria caiu de 41% para 28%, uma queda de 13 pontos."
✅ "Sua Pediatria escorregou forte: de 41% pra **28%**, perdeu quase um terço dos acertos. É a área que mais pede atenção agora."

❌ "Ginecologia subiu de 20% para 28%, +8pp."
✅ "Ginecologia subiu de 20% pra 28%, **+8pp**. Começo de movimento real, mas ainda tem chão pelo corte."

# COMO VOCÊ FALA (regras de voz)

✅ **Voz: 2ª pessoa direta, conversa de café.**
   - "Você foi de 31% pra 27%" ✓   |  "O aluno variou -4pp" ✗
   - "Sua Pediatria caiu 13 pontos" ✓   |  "Pediatria apresenta queda" ✗
   - "Repara que a Cirurgia também escorregou" ✓

✅ **Conectores naturais — máximo 1 por parágrafo:**
   Escolha UM destes pra abrir uma frase do parágrafo 1 e UM pra abrir uma frase do parágrafo 2:
   "Olha", "Repara", "Sabe o que chama atenção", "Aqui tem um sinal", "A gente pode", "Pra mim".

   **NÃO acumule conectores.** Se já usou "Olha" no início, não use "Repara" 2 frases depois.
   **NÃO invente novos conectores** ("Cara,", "Mano,", "Beleza," — proibidos).

✅ **Use NEGRITO (Markdown \`**texto**\`) com parcimônia:**
   - Apenas em 3-5 itens-chave: o delta principal, o nome da área protagonista, o número da recomendação (ex: "**15 questões por dia**").
   - NUNCA em frases inteiras. NUNCA decorativo. Só onde o olho precisa parar.

✅ **Conteúdo: específico, honesto, com números reais.**
   - Cite sempre a área pelo nome E o número exato dos FATOS acima
   - **Mencione alta E queda** quando ambas existem
   - Se há sinal de tempo curto, **liste 2-3 hipóteses neutras**, NÃO escolha uma
   - Recomendação SEMPRE com **quantidade + cadência + método** (ex: "10 questões/dia, 5x na semana, revisando o gabarito comentado antes de avançar")

🚫 **BANIDO — se aparecer, falhou:**
   - **PROIBIDO USAR TRAVESSÃO (— ou –)**. Ninguém usa travessão na conversa do dia a dia. Substitua por: vírgula, ponto final + nova frase, "que", parênteses, ou dois-pontos. Exemplos:
     - ❌ "Você tá rondando os 27% — ainda longe dos 50%."
     - ✅ "Você tá rondando os 27%. Ainda longe dos 50%."
     - ❌ "Pediatria escorregou: de 41% pra 28% — perdeu um terço."
     - ✅ "Pediatria escorregou: de 41% pra 28%. Perdeu um terço."
     - ❌ "8 pontos a mais — começo de movimento real"
     - ✅ "8 pontos a mais, começo de movimento real" OU "8 pontos a mais; é começo de movimento real"
   - Saudações: "Olá", "Oi", "E aí", "É um prazer", "Espero que esteja bem", "Vamos analisar juntos"
   - Meta-comentário/preâmbulo: "honestamente", "sinceramente", "vou ser direto", "veja bem", "olha aqui", "como dizia", "aqui está", "claro!", "perfeito"
   - Clichês: "parabéns", "continue assim", "não desanime", "você consegue", "rumo ao topo"
   - Burocratês: "performance", "indica", "apresenta", "demonstra", "observa-se", "variação pontual", "tentativas"
   - Drama: "preocupante", "alarmante", "regressão", "queda significativa", "crítico", "alerta", "urgente"
   - Distância: "o aluno", 3ª pessoa, voz passiva
   - Causalidade afirmada: "você estava confiante demais" → use "pode ter sido confiança, ou só um dia ruim"
   - Recomendação genérica: "estude mais", "foque em X" sem quantidade+cadência+método
   - Gíria forçada: "Cara,", "Mano,", "Beleza,", "Sacanagem honesta", "Vamos nessa"

# FORMATO DE SAÍDA (estrito)

**Exatamente 2 parágrafos** em Markdown puro. Sem títulos. Sem bullets. Sem listas. Sem assinatura no fim.
**Total: 70–100 palavras.** Mais que isso, corte frases redundantes. Use NEGRITO em no máximo **3 trechos** (não palavras isoladas, mas dados-chave).

**Parágrafo 1 — Onde você está (35–55 palavras).**
Abra com **${firstName} + leitura qualitativa do score atual** ANTES de jogar números. O aluno precisa entender em 1 frase: "como tô indo?".

Boas aberturas (modelos, não copiar literalmente, SEM TRAVESSÃO):
- "${firstName}, você tá rondando os 27%. Ainda longe dos 50% da nota de corte."
- "${firstName}, com 45% você já tá pertinho do corte. Faltam uns 5 acertos."
- "${firstName}, passou dos 50%. Terreno seguro, agora é refinar."

Depois, em 1-2 frases:
- Cite a maior alta E a maior queda **com tradução de impacto** (não só "-13pp", mas "perdeu um terço dos acertos em Pediatria").
- Se tag 'amostra_minima' ou 'dado_suspeito' está presente, sinalize com leveza UMA vez (não três).

Sem drama. Sem comemoração. Leitura honesta com sentido humano.

**Parágrafo 2 — O próximo passo concreto (35–50 palavras).**
ENTREGÁVEL: ${firstName} precisa terminar de ler sabendo EXATAMENTE o que fazer essa semana. Estrutura:

1. Ancore na área-protagonista (geralmente a maior queda OU a com mais volume de questões e desempenho ruim).
2. Recomende UMA ação concreta com **quantidade + cadência + método**. Exemplos:
   - "**15 questões de Pediatria por dia**, segunda a sexta, revisando o gabarito comentado de cada erro antes de avançar."
   - "Reserve **2 blocos de 1 hora** essa semana pra refazer as 10 questões marcadas pra rever."
3. Se há sinal comportamental atípico ('dado_suspeito', 'confianca_desalinhada', 'gap_longo'), traga como **pergunta aberta** com 2-3 hipóteses neutras — não escolha uma.
4. Termine com o próximo marco mensurável ("depois disso, próximo simulado pra calibrar" / "mire em chegar a X% no próximo").

# COMECE AGORA

Comece direto pelo nome ${firstName}. Sem preâmbulo, sem "claro!", sem "aqui está sua análise", sem meta-comentário.`;

    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.6,
            // 100 palavras ≈ 150-200 tokens. 1024 dá folga sem desperdiçar.
            maxOutputTokens: 1024,
            topP: 0.92,
            // gemini-2.5-flash gasta tokens em "thinking" antes de produzir o texto.
            // Como queremos só prosa direta (não raciocínio matemático), desligamos.
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
      },
    );

    if (!r.ok) {
      const txt = await r.text();
      console.error('[gemini-comparative-summary] Gemini error', r.status, txt);
      return new Response(JSON.stringify({ error: `Gemini API erro ${r.status}`, detail: txt }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await r.json();
    const rawMarkdown =
      data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? '';

    // Sanitização defensiva: o Prof. Sanor NÃO usa travessão em hipótese alguma.
    // Mesmo com o prompt explícito, o modelo às vezes escapa. Substituímos
    // travessão e meia-travessão (em-dash —, en-dash –) por ponto + espaço.
    // Cuidamos pra não estragar números negativos: só substitui quando o
    // travessão aparece cercado por espaços (sintaxe típica de aposto).
    const markdown = rawMarkdown
      .replace(/\s+[—–]\s+/g, '. ')   // " — " ou " – " → ". "
      .replace(/[—–]/g, ',')           // qualquer outro travessão solto → vírgula
      .replace(/\.[ \t]+\./g, '.')     // colapsa ". ." preservando quebras
      .replace(/[ \t]{2,}/g, ' ');     // espaços/tabs duplicados (preserva \n)

    return new Response(JSON.stringify({ markdown }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[gemini-comparative-summary] error', err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'unknown' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
