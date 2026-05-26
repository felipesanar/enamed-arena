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

  // 1. Primeira pergunta — histórico vazio
  const { status, body } = await callFunction('gemini-error-notebook-chat', {
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
  if (wordCount > 180) {
    fail(`reply excedeu 180 palavras (${wordCount}) — prompt promete máx 120`);
  } else {
    pass(`reply dentro do limite (${wordCount} palavras)`);
  }

  // 2. Segundo turno — passa o histórico
  const { status: s2, body: b2 } = await callFunction('gemini-error-notebook-chat', {
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

  // 3. Payload inválido — sem question
  const { status: s3, body: b3 } = await callFunction('gemini-error-notebook-chat', {
    ...samplePayload,
    history: [],
    question: '',
  });
  if (s3 === 400) {
    pass(`pergunta vazia retorna 400 (${(b3 as { error?: string })?.error ?? ''})`);
  } else {
    fail(`pergunta vazia deveria retornar 400, retornou ${s3}`, b3);
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
