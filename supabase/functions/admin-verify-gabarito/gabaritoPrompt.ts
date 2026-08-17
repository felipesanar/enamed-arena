// Helpers puros da 2ª opinião por IA sobre o gabarito (ver
// docs/superpowers/specs/2026-08-17-blindagem-gabarito-design.md, Componente 4).
//
// Separado de propósito do prompt de imagem em admin-verify-questions/verifyHelpers.ts
// (recalibrado no v6) — não deve ser tocado por esta função.

export interface GQOption { label: string; text: string }

export interface GQInput {
  question_number: number;
  enunciado_text: string;
  comentario_text: string;
  alternativas: GQOption[];
  gabarito: string;
}

export interface GFinding {
  question_number: number;
  source: 'ai';
  check_type: 'key_semantic_mismatch';
  proposed_label: string;
  severity: 'error' | 'warning';
  evidence: string;
}

const ALLOWED_CHECKS = new Set(['key_semantic_mismatch']);
const VALID_LABELS = new Set(['A', 'B', 'C', 'D']);

export const SYSTEM_PROMPT = `Você é um revisor criterioso de um banco de questões médicas. Analise UMA questão por vez.

Você recebe o ENUNCIADO, as ALTERNATIVAS, o GABARITO (a letra marcada como correta no banco) e o COMENTÁRIO (a explicação da resposta, pode conter HTML). Julgue UMA ÚNICA COISA: o raciocínio do COMENTÁRIO fecha, de forma clara, numa alternativa DIFERENTE da que está marcada como GABARITO?

REGRAS OBRIGATÓRIAS (evitam falsos positivos):
1. NÃO opine sobre o mérito clínico da questão, nem sobre qual alternativa "deveria" ser a certa segundo a medicina. Sua tarefa é só verificar coerência interna entre o texto do comentário e a letra do gabarito — não julgar se o gabarito está clinicamente correto.
2. NÃO reporte quando o comentário é vago, incompleto, genérico ou simplesmente não menciona explicitamente o gabarito. Ausência de confirmação NÃO é contradição. Só reporte quando o comentário claramente fecha em outra letra.
3. Falso positivo é pior do que deixar passar um caso real. Na dúvida, NÃO reporte.
4. "proposed_label" é OBRIGATÓRIO em todo achado: é a letra em que o raciocínio do comentário fecha. Se você não consegue apontar uma letra clara e específica, NÃO existe achado — não reporte.
5. Severidade: use "error" quando o comentário AFIRMA EXPLICITAMENTE que outra alternativa é a correta (ex.: "a alternativa correta é a X", "resposta: X"). Use "warning" quando é uma inferência a partir do raciocínio do comentário, sem uma afirmação literal.
6. O único check_type permitido é "key_semantic_mismatch".
7. Se o comentário é coerente com o gabarito, ou se não há uma letra alternativa clara, retorne findings vazio.

SAÍDA:
- "evidence" = trecho curto e literal do comentário que sustenta o achado.
- Reporte no máximo um achado por questão.
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
          proposed_label: { type: 'STRING' },
          severity: { type: 'STRING' },
          evidence: { type: 'STRING' },
        },
        required: ['question_number', 'check_type', 'proposed_label', 'severity', 'evidence'],
      },
    },
  },
  required: ['findings'],
};

export function buildContents(q: GQInput): unknown[] {
  const alternativas = q.alternativas?.length
    ? `ALTERNATIVAS:\n${q.alternativas.map((a) => `${a.label}) ${a.text}`).join('\n')}\n`
    : '';
  return [
    { text: SYSTEM_PROMPT },
    {
      text: `\n--- Q${q.question_number}\nENUNCIADO: ${q.enunciado_text}\n` +
        alternativas +
        `GABARITO: ${q.gabarito}\n` +
        `COMENTARIO: ${q.comentario_text}\n`,
    },
  ];
}

export function parseFindings(rawJson: string): GFinding[] {
  try {
    const parsed = JSON.parse(rawJson);
    const arr = Array.isArray(parsed?.findings) ? parsed.findings : [];
    return arr
      .filter((f: { check_type?: string }) => ALLOWED_CHECKS.has(f?.check_type ?? ''))
      .map((f: Record<string, unknown>) => ({
        question_number: Number(f.question_number) || 0,
        source: 'ai' as const,
        check_type: 'key_semantic_mismatch' as const,
        proposed_label: String(f.proposed_label ?? '').trim().toUpperCase(),
        severity: f.severity === 'error' ? 'error' : 'warning',
        evidence: String(f.evidence ?? ''),
      }));
  } catch {
    return [];
  }
}

/**
 * Filtro determinístico que segura o falso positivo depois da IA. Descarta o
 * achado quando:
 * - `proposed_label` não é uma letra A–D;
 * - `proposed_label` normalizado é igual ao `gabarito` normalizado (achado que
 *   se autocontradiz — a IA "propôs" a própria letra do gabarito);
 * - `proposed_label` não corresponde ao label de nenhuma alternativa da questão.
 */
export function filterAiFindings(findings: GFinding[], q: GQInput): GFinding[] {
  const gabaritoNormalized = (q.gabarito ?? '').trim().toUpperCase();
  const validOptionLabels = new Set((q.alternativas ?? []).map((a) => a.label.trim().toUpperCase()));

  return findings.filter((f) => {
    const label = (f.proposed_label ?? '').trim().toUpperCase();
    if (!VALID_LABELS.has(label)) return false;
    if (label === gabaritoNormalized) return false;
    if (!validOptionLabels.has(label)) return false;
    return true;
  });
}
