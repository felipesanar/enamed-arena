export interface QImage { slot: 'enunciado' | 'enunciado2' | 'comentario'; mime: string; base64: string; }
export interface QInput {
  question_number: number;
  enunciado_text: string;
  comentario_text?: string;
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

export const SYSTEM_PROMPT = `Você é um revisor de banco de questões médicas. Para cada questão recebo o texto e, quando existirem, as IMAGENS anexadas (slot "enunciado" = imagem principal, "enunciado2" = segunda imagem, "comentario" = imagem da explicação).

Detecte e reporte, por questão e por slot:
- missing_image: o TEXTO cita uma figura (ex.: "observe a radiografia", "o ECG mostra", "figuras A e B", "fundoscopia") mas NENHUMA imagem foi anexada naquele slot.
- orphan_image: existe imagem anexada num slot, mas o texto NÃO faz qualquer referência a figura.
- image_mismatch: a imagem existe e é citada, mas o conteúdo dela claramente NÃO corresponde ao texto (ex.: texto diz "radiografia de tórax" e a imagem é um eletrocardiograma).
- illegible_image: a imagem está ilegível, em branco, cortada ou corrompida.

Regras:
- severity "error" quando inequívoco; "warning" quando possível mas ambíguo.
- "evidence" = trecho curto do texto e/ou o que você viu na imagem.
- Reporte apenas problemas. Se estiver tudo certo, não gere achado para a questão.
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

export function buildContents(questions: QInput[]): unknown[] {
  const parts: unknown[] = [{ text: SYSTEM_PROMPT }];
  for (const q of questions) {
    const slots = q.images.map((i) => i.slot).join(', ') || 'nenhuma';
    parts.push({
      text: `\n--- Q${q.question_number} (imagens anexadas: ${slots})\nENUNCIADO: ${q.enunciado_text}\n` +
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
