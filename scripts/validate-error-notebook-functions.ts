#!/usr/bin/env -S deno run --allow-net --allow-env
/**
 * Validação rápida das edge functions do caderno de erros.
 *
 * Como usar:
 *   1. Em um terminal:
 *      supabase functions serve --env-file ./supabase/.env
 *      (precisa de GEMINI_API_KEY no .env)
 *
 *   2. Em outro terminal:
 *      deno run --allow-net --allow-env scripts/validate-error-notebook-functions.ts
 *
 *   Variáveis opcionais:
 *      SUPABASE_FUNCTIONS_URL  default http://localhost:54321/functions/v1
 *      SUPABASE_ANON_KEY       default a chave anon do supabase local
 *      ONLY=review|chat        roda só uma das funções
 *
 * Não faz nenhuma escrita no banco — só dispara as edge functions e
 * valida o formato da resposta contra o contrato esperado.
 */

const FUNCTIONS_URL =
  Deno.env.get('SUPABASE_FUNCTIONS_URL') ?? 'http://localhost:54321/functions/v1';
const ANON_KEY =
  Deno.env.get('SUPABASE_ANON_KEY') ??
  // chave anon padrão do supabase local (segura de commitar; só vale localhost)
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const ONLY = Deno.env.get('ONLY')?.toLowerCase();

const C = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

let failures = 0;

function pass(msg: string) {
  console.log(`${C.green}✓${C.reset} ${msg}`);
}
function fail(msg: string, detail?: unknown) {
  failures++;
  console.log(`${C.red}✗${C.reset} ${msg}`);
  if (detail !== undefined) {
    console.log(`  ${C.yellow}${typeof detail === 'string' ? detail : JSON.stringify(detail, null, 2)}${C.reset}`);
  }
}
function section(title: string) {
  console.log(`\n${C.bold}${C.cyan}── ${title} ──${C.reset}`);
}

async function callFunction(name: string, body: unknown): Promise<{
  status: number;
  body: unknown;
}> {
  const r = await fetch(`${FUNCTIONS_URL}/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ANON_KEY}`,
      apikey: ANON_KEY,
    },
    body: JSON.stringify(body),
  });
  let parsed: unknown;
  try {
    parsed = await r.json();
  } catch {
    parsed = null;
  }
  return { status: r.status, body: parsed };
}

/** Payload realista — PrEP/PEP em Infectologia. */
const samplePayload = {
  studentName: 'Felipe',
  questionNumber: 42,
  questionStem:
    'Paciente masculino, 28 anos, relata relação sexual desprotegida há 18 horas com parceiro de sorologia desconhecida. Sem uso prévio de antirretrovirais. Qual a conduta mais apropriada?',
  options: [
    { label: 'A', text: 'Iniciar PrEP com tenofovir + entricitabina diariamente.', isCorrect: false },
    { label: 'B', text: 'Iniciar PEP com tenofovir + entricitabina + dolutegravir por 28 dias.', isCorrect: true },
    { label: 'C', text: 'Aguardar 30 dias e testar HIV antes de qualquer conduta.', isCorrect: false },
    { label: 'D', text: 'Iniciar TARV completa indefinidamente.', isCorrect: false },
  ],
  correctLabel: 'B',
  userLabel: 'A',
  area: 'Clínica Médica',
  theme: 'Infecção pelo vírus HIV',
  reason: 'errei',
  learningNote: 'Confundi PrEP com PEP — janela temporal me confundiu.',
  explanation:
    'PEP é indicada em exposição de risco nas últimas 72h; PrEP é profilaxia contínua em situação de exposição recorrente.',
};

/* ──────────────────────────────────────────────────────────────────────────
 * gemini-error-notebook-review
 * ────────────────────────────────────────────────────────────────────────── */

async function testReview() {
  section('gemini-error-notebook-review');

  // 1. Payload válido completo
  const { status, body } = await callFunction('gemini-error-notebook-review', samplePayload);
  if (status !== 200) {
    fail(`HTTP 200 esperado, recebi ${status}`, body);
    return;
  }
  pass('HTTP 200');

  const b = body as Record<string, unknown>;
  if (typeof b?.markdown !== 'string' || (b.markdown as string).trim().length < 20) {
    fail('Campo "markdown" deve ser string não-trivial', body);
  } else {
    pass(`markdown presente (${(b.markdown as string).length} chars)`);
  }

  // Markdown não deve conter travessões
  if (typeof b?.markdown === 'string' && /[—–]/.test(b.markdown as string)) {
    fail('markdown contém travessão (— ou –) — sanitização falhou');
  } else {
    pass('sem travessões no markdown');
  }

  // 2. practice — opcional mas se vier deve ter o shape certo
  if (b.practice === null || b.practice === undefined) {
    fail('practice ausente (a IA não extraiu sugestão de prática)');
  } else {
    const p = b.practice as Record<string, unknown>;
    if (typeof p.topic !== 'string' || (p.topic as string).trim().length === 0) {
      fail('practice.topic precisa ser string não-vazia', p);
    } else {
      pass(`practice.topic = "${p.topic}"`);
    }
    if (typeof p.suggestedCount !== 'number' || p.suggestedCount < 3 || p.suggestedCount > 10) {
      fail(`practice.suggestedCount fora do range [3,10]: ${p.suggestedCount}`);
    } else {
      pass(`practice.suggestedCount = ${p.suggestedCount}`);
    }
  }

  // 3. optionRationales — só com alternativas erradas (A, C, D)
  if (b.optionRationales === null || b.optionRationales === undefined) {
    fail('optionRationales ausente');
  } else {
    const rationales = b.optionRationales as Record<string, string>;
    const keys = Object.keys(rationales);
    const expectedKeys = ['A', 'C', 'D'];
    const wrongKeys = keys.filter((k) => !expectedKeys.includes(k));
    const missingKeys = expectedKeys.filter((k) => !keys.includes(k));

    if (wrongKeys.length > 0) {
      fail(`optionRationales contém chaves indevidas: ${wrongKeys.join(', ')}`);
    } else {
      pass('optionRationales só tem chaves de alternativas incorretas');
    }
    if (missingKeys.length > 0) {
      fail(`optionRationales não cobre todas as incorretas. Faltam: ${missingKeys.join(', ')}`);
    } else {
      pass(`optionRationales cobre A, C, D`);
    }
    if (keys.includes('B')) {
      fail('optionRationales não pode conter o gabarito B');
    }

    for (const [k, v] of Object.entries(rationales)) {
      if (typeof v !== 'string' || v.trim().length === 0) {
        fail(`optionRationales.${k} vazio ou não-string`, v);
      } else if (v.split(/\s+/).length > 30) {
        fail(`optionRationales.${k} muito longa (>30 palavras)`, v);
      }
      if (/[—–]/.test(v)) {
        fail(`optionRationales.${k} contém travessão`);
      }
    }
    pass('rationales são strings curtas e sem travessão');
  }

  // 4. Payload inválido — sem questionStem
  const { status: s2, body: b2 } = await callFunction('gemini-error-notebook-review', {
    ...samplePayload,
    questionStem: '',
  });
  if (s2 === 400) {
    pass(`payload inválido retorna 400 (${(b2 as { error?: string })?.error ?? ''})`);
  } else {
    fail(`payload inválido deveria retornar 400, retornou ${s2}`, b2);
  }
}

/* ──────────────────────────────────────────────────────────────────────────
 * gemini-error-notebook-chat
 * ────────────────────────────────────────────────────────────────────────── */

async function testChat() {
  section('gemini-error-notebook-chat');

  // Payload base — precisa de entryId real pra validar auth + rate limit.
  // Use a env CHAT_ENTRY_ID com o UUID de uma entrada do caderno do usuário
  // atualmente autenticado pelo SUPABASE_ANON_KEY (token sob Authorization).
  const entryId = Deno.env.get('CHAT_ENTRY_ID') ?? '00000000-0000-0000-0000-000000000000';
  if (entryId === '00000000-0000-0000-0000-000000000000') {
    console.log(
      `${C.yellow}⚠${C.reset}  CHAT_ENTRY_ID não setado — testes de auth/rate-limit vão falhar como esperado.`,
    );
  }

  const chatPayload = {
    entryId,
    studentName: samplePayload.studentName,
    questionStem: samplePayload.questionStem,
    options: samplePayload.options,
    correctLabel: samplePayload.correctLabel,
    userLabel: samplePayload.userLabel,
    area: samplePayload.area,
    theme: samplePayload.theme,
    reason: samplePayload.reason,
    learningNote: samplePayload.learningNote,
    aiReviewMd: null,
  };

  // 1. Primeira pergunta — histórico vazio
  const { status, body } = await callFunction('gemini-error-notebook-chat', {
    ...chatPayload,
    history: [],
    question: 'Qual a diferença prática entre PrEP e PEP nessa decisão?',
  });

  if (status !== 200) {
    fail(`HTTP 200 esperado, recebi ${status}`, body);
    return;
  }
  pass('HTTP 200 (turno 1)');

  const b = body as { reply?: string };
  if (typeof b.reply !== 'string' || b.reply.trim().length < 10) {
    fail('reply deve ser string não-trivial', body);
    return;
  }
  pass(`reply presente (${b.reply.length} chars)`);

  if (/[—–]/.test(b.reply)) {
    fail('reply contém travessão');
  } else {
    pass('sem travessões no reply');
  }

  const wordCount = b.reply.split(/\s+/).length;
  if (wordCount > 200) {
    fail(`reply excedeu 200 palavras (${wordCount}) — prompt promete máx 140`);
  } else {
    pass(`reply dentro do limite (${wordCount} palavras)`);
  }

  // Padrões banidos explicitamente pelo prompt
  const bannedOpenings = [
    /^essa\s+é\s+uma\s+(?:excelente|boa|ótima|interessante|pertinente)\s+pergunta/i,
    /^(?:excelente|boa|ótima|interessante|pertinente|muito\s+boa)\s+pergunta/i,
    /^pergunta\s+(?:excelente|boa|ótima|interessante)/i,
    /^(?:claro|perfeito|com\s+certeza|honestamente|na\s+verdade|vamos\s+lá)[\s!.,:]/i,
    /^(?:olá|ola|oi|opa|e\s+aí|e\s+ai)[\s!.,:]/i,
  ];
  const offending = bannedOpenings.find((re) => re.test(b.reply!.trim()));
  if (offending) {
    fail(`reply começa com padrão banido: "${b.reply!.slice(0, 60)}..."`);
  } else {
    pass('reply não começa com elogio/saudação banidos');
  }

  // Checagem dos campos de rate limit no response
  const meta = body as { remaining?: number; limit?: number; used?: number; offTopic?: boolean };
  if (typeof meta.remaining !== 'number' || typeof meta.limit !== 'number' || typeof meta.used !== 'number') {
    fail('faltam campos remaining/limit/used na resposta', body);
  } else {
    pass(`rate limit: ${meta.used}/${meta.limit} (restam ${meta.remaining})`);
    if (meta.offTopic === true) {
      fail('marcou pergunta clínica válida como offTopic');
    }
  }

  // 2. Segundo turno — passa o histórico
  const { status: s2, body: b2 } = await callFunction('gemini-error-notebook-chat', {
    ...chatPayload,
    history: [
      { role: 'user', content: 'Qual a diferença prática entre PrEP e PEP nessa decisão?' },
      { role: 'assistant', content: b.reply },
    ],
    question: 'E qual o esquema mais comum prescrito hoje?',
  });

  if (s2 !== 200) {
    fail(`segundo turno deveria retornar 200, retornou ${s2}`, b2);
  } else {
    const b2x = b2 as { reply?: string };
    if (typeof b2x.reply === 'string' && b2x.reply.trim().length > 10) {
      pass('segundo turno com histórico funciona');
    } else {
      fail('segundo turno não retornou reply válida', b2);
    }
  }

  // 3. Pergunta-conceito provocadora — força o cenário do bug original
  //    ("Por que X em vez de Y, que tem indicação Classe I?")
  //    O LLM tende a abrir com "Essa é uma excelente pergunta".
  const { status: s3b, body: b3b } = await callFunction('gemini-error-notebook-chat', {
    ...chatPayload,
    history: [],
    question: 'Por que aumentar a losartana em vez de iniciar sacubitril-valsartana, que tem indicação Classe I na ICFER?',
  });
  if (s3b === 200) {
    const r = (b3b as { reply?: string }).reply ?? '';
    const bannedOpenings = [
      /^essa\s+é\s+uma\s+(?:excelente|boa|ótima|interessante|pertinente)\s+pergunta/i,
      /^(?:excelente|boa|ótima|interessante|pertinente|muito\s+boa)\s+pergunta/i,
    ];
    if (bannedOpenings.some((re) => re.test(r.trim()))) {
      fail(`pergunta-conceito ainda escapa com elogio: "${r.slice(0, 80)}"`);
    } else {
      pass('pergunta-conceito sem abertura elogiosa');
    }
    // Verifica se elevou nível citando referência canônica
    const hasReference =
      /paradigm|pioneer|dapa|emperor|classe\s+i|classe\s+i{1,3}/i.test(r) ||
      /dose[\s-]?alvo|subdose|titula/i.test(r);
    if (hasReference) {
      pass('pergunta-conceito menciona referência canônica ou dose-alvo');
    } else {
      fail(`pergunta-conceito sem framework/ensaio/dose-alvo citado: "${r.slice(0, 120)}..."`);
    }
  } else {
    fail(`pergunta-conceito retornou ${s3b}`, b3b);
  }

  // 4. Off-topic — pergunta totalmente fora do escopo médico
  const { status: s4, body: b4 } = await callFunction('gemini-error-notebook-chat', {
    ...chatPayload,
    history: [],
    question: 'Me conta uma piada sobre médicos.',
  });
  if (s4 === 200) {
    const b4x = b4 as { offTopic?: boolean; reply?: string };
    if (b4x.offTopic === true) {
      pass('pergunta off-topic detectada (offTopic=true)');
      if (typeof b4x.reply === 'string' && /medic|chat|escopo|quest/i.test(b4x.reply)) {
        pass('reply de off-topic explica o escopo');
      } else {
        fail('reply de off-topic não menciona escopo', b4x.reply);
      }
    } else {
      fail('pergunta off-topic não foi marcada como offTopic', b4);
    }
  } else {
    fail(`off-topic retornou status ${s4}`, b4);
  }

  // 5. Off-topic mas com aparência médica — pedido de redação/produção
  const { status: s5, body: b5 } = await callFunction('gemini-error-notebook-chat', {
    ...chatPayload,
    history: [],
    question: 'Escreve pra mim uma redação de 300 palavras sobre a história da medicina.',
  });
  if (s5 === 200) {
    const b5x = b5 as { offTopic?: boolean };
    if (b5x.offTopic === true) {
      pass('pedido de redação tratado como off-topic');
    } else {
      fail('pedido de redação NÃO foi marcado como off-topic', b5);
    }
  }

  // 6. Payload inválido — sem question
  const { status: s6, body: b6 } = await callFunction('gemini-error-notebook-chat', {
    ...chatPayload,
    history: [],
    question: '',
  });
  if (s6 === 400) {
    pass(`pergunta vazia retorna 400 (${(b6 as { error?: string })?.error ?? ''})`);
  } else {
    fail(`pergunta vazia deveria retornar 400, retornou ${s6}`, b6);
  }

  // 7. Payload inválido — sem entryId
  const { status: s7, body: b7 } = await callFunction('gemini-error-notebook-chat', {
    ...chatPayload,
    entryId: '',
    history: [],
    question: 'pergunta qualquer',
  });
  if (s7 === 400) {
    pass(`entryId vazio retorna 400 (${(b7 as { error?: string })?.error ?? ''})`);
  } else {
    fail(`entryId vazio deveria retornar 400, retornou ${s7}`, b7);
  }
}

/* ──────────────────────────────────────────────────────────────────────────
 * Main
 * ────────────────────────────────────────────────────────────────────────── */

console.log(`${C.bold}Validação edge functions — caderno de erros${C.reset}`);
console.log(`Base URL: ${FUNCTIONS_URL}`);
if (ONLY) console.log(`ONLY=${ONLY}`);

if (!ONLY || ONLY === 'review') {
  try {
    await testReview();
  } catch (err) {
    fail('review crashou', err instanceof Error ? err.message : String(err));
  }
}

if (!ONLY || ONLY === 'chat') {
  try {
    await testChat();
  } catch (err) {
    fail('chat crashou', err instanceof Error ? err.message : String(err));
  }
}

console.log('');
if (failures === 0) {
  console.log(`${C.green}${C.bold}Tudo verde. ✓${C.reset}`);
  Deno.exit(0);
} else {
  console.log(`${C.red}${C.bold}${failures} falha(s).${C.reset}`);
  Deno.exit(1);
}
