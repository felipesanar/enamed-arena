export interface QImage { slot: 'enunciado' | 'enunciado2' | 'comentario'; mime: string; base64: string; }
export interface QOption { label: string; text: string }
export interface QInput {
  question_number: number;
  enunciado_text: string;
  comentario_text?: string;
  alternativas?: QOption[];
  gabarito?: string;
  images: QImage[];
}
export interface Finding {
  question_number: number;
  source: 'ai';
  check_type: string;
  slot?: string;
  severity: 'error' | 'warning';
  evidence: string;
}

const ALLOWED_CHECKS = new Set([
  'missing_image', 'orphan_image', 'image_mismatch', 'illegible_image',
]);

export const SYSTEM_PROMPT = `Você é um revisor criterioso de um banco de questões médicas. Analise UMA questão por vez.

Você recebe o CONTEXTO COMPLETO da questão — ENUNCIADO, ALTERNATIVAS, GABARITO e COMENTÁRIO (textos podem conter HTML) — e, quando existirem, as IMAGENS anexadas por slot ("enunciado" = imagem principal, "enunciado2" = segunda imagem do enunciado, "comentario" = imagem da explicação). Leia TODO o contexto antes de concluir.

Seu trabalho é encontrar APENAS problemas reais de imagem. Falsos positivos são piores que deixar passar. Na dúvida, NÃO reporte.

TIPOS DE PROBLEMA:
- missing_image: o texto MANDA EXPLICITAMENTE o leitor olhar uma imagem anexada — ex.: "observe a figura", "veja a imagem", "conforme a figura", "radiografia abaixo", "ECG a seguir", "cardiotocografia apresentada abaixo" — MAS nenhuma imagem foi anexada naquele slot.
- orphan_image: existe imagem anexada num slot, mas o texto não a introduz nem a menciona de forma alguma.
- image_mismatch: a imagem está anexada e o que ela mostra CONTRADIZ claramente o texto/caso (ex.: texto fala em "radiografia de tórax" e a imagem é um eletrocardiograma; ou caso de descolamento de placenta com uma imagem de exame de urina). Seja conservador: só reporte quando for inequívoco.
- illegible_image: a imagem anexada está em branco, cortada, borrada ou corrompida a ponto de não ser interpretável.

REGRAS OBRIGATÓRIAS (evitam falsos positivos):
1. DESCREVER um exame em texto NÃO é o mesmo que MANDAR olhar uma imagem. Frases como "a radiografia evidenciou infiltrado", "a tomografia mostra dilatação de alças", "o ECG demonstrou..." são LAUDOS autossuficientes — a questão funciona sem imagem. NÃO gere missing_image para esses casos.
2. NUNCA reporte porque a questão "poderia se beneficiar de uma imagem" ou "seria ilustrativa". Só conta o que o texto realmente pede.
3. Uma imagem introduzida por dois-pontos ou por um rótulo de exame ("Exames laboratoriais:", "ECG abaixo", "tabela normativa de pressão", "exame pupilar:", "lesões abaixo:") está CORRETAMENTE referenciada — isso NÃO é orphan_image.
4. Citar um exame como conduta a solicitar (ex.: "solicitar radiografia de ossos longos") NÃO é referência a uma figura a ser exibida. Não gere missing_image.
5. Um exame/figura citado APENAS nas ALTERNATIVAS (ex.: uma alternativa "Cardiotocografia." ou "Solicitar tomografia") é uma OPÇÃO DE RESPOSTA, não prova de que deva existir imagem. NÃO gere missing_image por causa das alternativas.
6. "abaixo", "a seguir", "as características abaixo", "qual das condutas abaixo", "os três casos a seguir" geralmente apontam para as ALTERNATIVAS ou para um texto — NÃO para uma imagem. Só considere direcionamento a imagem quando vier junto de um termo de figura/exame (ex.: "figura abaixo", "ECG a seguir", "observe a radiografia", "exames a seguir:").
7. Uma questão pode legitimamente precisar de MAIS DE UMA imagem (ex.: "Figura 1" e "Figura 2", "figuras A e B", tabela de exames + cultura, exames laboratoriais + paracentese, densitometria + radiografia). Se o texto referencia mais figuras/exames do que as imagens anexadas, gere missing_image para o slot faltante (use slot "enunciado2" para a segunda imagem do enunciado). Ter duas imagens numa questão é normal e NÃO é problema.
8. Se NÃO há imagem anexada E o texto não manda olhar nenhuma imagem, então está tudo certo — NÃO gere nenhum achado.
9. orphan_image só existe se houver de fato imagem anexada no slot. image_mismatch e illegible_image só existem se houver imagem anexada.
10. Use o GABARITO e o COMENTÁRIO para julgar coerência: a imagem deve bater com o caso e com a resposta correta. Isso ajuda principalmente em image_mismatch.

NOTA CLÍNICA: numa parada cardiorrespiratória, um ritmo ORGANIZADO no monitor (com QRS, parecendo sinusal) em paciente SEM pulso É a definição de AESP (atividade elétrica sem pulso). Isso é esperado — NÃO trate como image_mismatch.

SAÍDA:
- severity "error" quando inequívoco; "warning" quando plausível porém ambíguo.
- "evidence" = trecho curto do texto e/ou o que você viu na imagem que justifica o achado.
- Reporte apenas problemas. Se estiver tudo certo, retorne findings vazio.
- Retorne SOMENTE JSON no schema pedido.`;

export const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    findings: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          question_number: { type: 'INTEGER' },
          check_type: { type: 'STRING' },
          slot: { type: 'STRING' },
          severity: { type: 'STRING' },
          evidence: { type: 'STRING' },
        },
        required: ['question_number', 'check_type', 'severity', 'evidence'],
      },
    },
  },
  required: ['findings'],
};

// Termos de figura/exame (prefixos — robustos a acento, já que \w do JS não casa
// "â", "õ" etc.). A presença de um destes é necessária para falar em "imagem".
const FIGURE_NOUN = /(figura|imagem|fotografia|\bfoto\b|esquema|gr[áa]fico|quadro|tabela|radiografi|tomografi|resson|ultrassom|ultrassono|\busg\b|\becg\b|eletrocardiograma|ecocardiogr|cardiotocografi|endoscop|colonoscop|fundoscop|densitometr|les[õoã]|paracentese|cultura de urina)/i;

// Posicional que indica "veja o que está disposto aqui". Exclui o uso anatômico
// "abaixo do/da/de ..." (ex.: "irradiação abaixo do joelho", "abaixo do hímen").
const POSITIONAL = /(\babaixo\b(?!\s+d[oae]s?\b)|\ba\s+seguir\b|\bao\s+lado\b)/i;

// Verbos/expressões que, sozinhos, já mandam olhar uma figura.
// NÃO inclui verbos de laudo (mostra/demonstra/evidencia/revela): descrevem
// achados por extenso sem exigir imagem.
const LOOK_VERB = /(\bobserv\w+|\bveja\b|\bvide\b|\bnota[- ]se\b|conforme\s+(a\s+|o\s+)?(figura|imagem|fotografia|esquema|gr[áa]fico|quadro|tabela)|\bna\s+(figura|imagem)\b)/i;

// Indício mais amplo de que o texto introduz/menciona um exame ou figura.
// Usado para NÃO marcar orphan_image quando a imagem está contextualizada
// (tabela de exames, ECG, "resultados:", etc.).
const IMAGE_REFERENCE = /(exames?\b|laborator|resultados:|achado)/i;

// "Manda olhar uma imagem": um verbo de leitura, OU um termo de figura junto de
// um posicional ("ECG abaixo", "ressonância magnética abaixo", "lesões a seguir").
export function hasViewDirective(text: string | undefined | null): boolean {
  if (!text) return false;
  return LOOK_VERB.test(text) || (FIGURE_NOUN.test(text) && POSITIONAL.test(text));
}

// Referência (ampla) a uma imagem/exame — qualquer termo de figura, rótulo de
// exame ou direcionador. Usada para NÃO marcar orphan_image quando o texto
// claramente introduz a imagem anexada.
export function hasImageReference(text: string | undefined | null): boolean {
  return !!text && (hasViewDirective(text) || FIGURE_NOUN.test(text) || IMAGE_REFERENCE.test(text));
}

function ownerText(q: QInput, slot: string | undefined): string {
  return slot === 'comentario' ? (q.comentario_text ?? '') : (q.enunciado_text ?? '');
}

function slotHasImage(q: QInput, slot: string | undefined): boolean {
  const s = slot ?? 'enunciado';
  return q.images.some((i) => i.slot === s);
}

/**
 * Filtro determinístico que elimina os falsos positivos estruturais antes de
 * devolver os achados da IA. Trabalha por questão, cruzando o achado com a
 * presença real de imagem no slot e com a referência (ou não) no texto.
 */
export function filterFindings(findings: Finding[], q: QInput): Finding[] {
  return findings.filter((f) => {
    const slot = f.slot ?? 'enunciado';
    const hasImg = slotHasImage(q, slot);
    const text = ownerText(q, slot);

    switch (f.check_type) {
      case 'missing_image':
        // Só é "ausente" se o slot está vazio E o texto manda olhar uma imagem.
        // Descrição de laudo por extenso ou "poderia ter imagem" não conta.
        return !hasImg && hasViewDirective(text);
      case 'orphan_image':
        // Só é "órfã" se existe imagem de fato E o texto não a referencia.
        return hasImg && !hasImageReference(text);
      case 'image_mismatch':
      case 'illegible_image':
        // Só fazem sentido com imagem anexada.
        return hasImg;
      default:
        return true;
    }
  });
}

export function buildContents(questions: QInput[]): unknown[] {
  const parts: unknown[] = [{ text: SYSTEM_PROMPT }];
  for (const q of questions) {
    const slots = q.images.map((i) => i.slot).join(', ') || 'nenhuma';
    const alternativas = q.alternativas?.length
      ? `ALTERNATIVAS:\n${q.alternativas.map((a) => `${a.label}) ${a.text}`).join('\n')}\n`
      : '';
    const gabarito = q.gabarito ? `GABARITO: ${q.gabarito}\n` : '';
    parts.push({
      text: `\n--- Q${q.question_number} (imagens anexadas: ${slots})\nENUNCIADO: ${q.enunciado_text}\n` +
        alternativas + gabarito +
        (q.comentario_text ? `COMENTARIO: ${q.comentario_text}\n` : ''),
    });
    for (const img of q.images) {
      parts.push({ text: `[imagem do slot "${img.slot}" da Q${q.question_number}]` });
      parts.push({ inline_data: { mime_type: img.mime, data: img.base64 } });
    }
  }
  return parts;
}

export function parseFindings(rawJson: string): Finding[] {
  try {
    const parsed = JSON.parse(rawJson);
    const arr = Array.isArray(parsed?.findings) ? parsed.findings : [];
    return arr
      .filter((f: { check_type?: string }) => ALLOWED_CHECKS.has(f?.check_type ?? ''))
      .map((f: Record<string, unknown>) => ({
        question_number: Number(f.question_number) || 0,
        source: 'ai' as const,
        check_type: String(f.check_type),
        slot: f.slot ? String(f.slot) : undefined,
        severity: f.severity === 'warning' ? 'warning' : 'error',
        evidence: String(f.evidence ?? ''),
      }));
  } catch {
    return [];
  }
}
