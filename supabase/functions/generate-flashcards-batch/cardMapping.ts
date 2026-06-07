/**
 * Lógica pura (sem Deno/URL imports) de mapeamento dos cards gerados pela IA.
 *
 * Isolada do `index.ts` (que usa `Deno.serve` e imports via esm.sh) para ser
 * testável com Vitest. O vínculo do card com a questão de origem (`sourceRef`)
 * NÃO pode depender de índice posicional ecoado pela IA: usamos um token de
 * referência estável (`questionRef`) atribuído pelo servidor e resolvido contra
 * um mapa conhecido, validando existência antes de atribuir.
 */

export interface SourceRef {
  entryId?: string;
  questionId?: string;
}

export interface GeneratedCard {
  front_md: string;
  back_md: string;
  sourceRef?: SourceRef;
}

/** Sanitizes em-dashes from any text. Prof. Sanor never uses them. */
export function stripEmDashes(text: string): string {
  return text
    .replace(/\s+[—–]\s+/g, '. ')
    .replace(/[—–]/g, ',')
    .replace(/\.[ \t]+\./g, '.')
    .replace(/[ \t]{2,}/g, ' ');
}

export function stripOpeningCompliments(text: string): string {
  const patterns: RegExp[] = [
    /^\s*(?:essa\s+(?:é|e)\s+(?:uma|a)?\s*)?(?:excelente|ótima|otima|boa|interessante|pertinente|muito\s+boa|grande)\s+(?:pergunta|questão|questao)[\s!.,:;…]+/i,
    /^\s*(?:claro|perfeito|com\s+certeza|certamente|sem\s+dúvida|sem\s+duvida|vamos\s+lá|vamos\s+la)[\s!.,:;…]+/i,
    /^\s*(?:olá|ola|oi|opa|e\s+aí|e\s+ai|fala)[\s!.,:;…]+/i,
  ];
  let out = text;
  for (let i = 0; i < 4; i++) {
    let changed = false;
    for (const re of patterns) {
      const next = out.replace(re, '');
      if (next !== out) { out = next; changed = true; }
    }
    if (!changed) break;
  }
  if (out.length > 0 && /^[a-záéíóúâêôãõç]/.test(out)) {
    out = out[0].toUpperCase() + out.slice(1);
  }
  return out;
}

export function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 1) + '…';
}

/** Token de referência estável para a i-ésima questão da lista filtrada do servidor. */
export function questionRef(i: number): string {
  return `q${i}`;
}

/** Mapa ref -> sourceRef, usado para resolver e validar o vínculo do card. */
export function buildRefMap(questions: { sourceRef?: SourceRef }[]): Map<string, SourceRef> {
  const map = new Map<string, SourceRef>();
  questions.forEach((q, i) => {
    if (q.sourceRef) map.set(questionRef(i), q.sourceRef);
  });
  return map;
}

export interface AiCard {
  ref?: string;
  front_md?: string;
  back_md?: string;
}

export interface LenientParseResult {
  cards: AiCard[];
  /** true quando o array veio truncado e os objetos foram recuperados um a um. */
  partial: boolean;
}

/**
 * Faz parse do array JSON da IA tolerando truncamento (ex.: Gemini batendo em
 * `MAX_TOKENS` no meio do array). Tenta o parse estrito primeiro; se falhar,
 * recupera todos os objetos `{...}` de topo já completos no texto truncado,
 * descartando o último objeto incompleto. Assim o lote não é perdido inteiro:
 * os cards já gerados são salvos e o chamador sinaliza "lote parcial".
 *
 * O scanner respeita strings e escapes para não se confundir com chaves (`{`,
 * `}`) ou aspas dentro do conteúdo dos cards.
 */
export function parseCardsLenient(rawJson: string): LenientParseResult {
  const text = (rawJson ?? '').trim();
  if (!text) return { cards: [], partial: false };

  try {
    const p = JSON.parse(text);
    return { cards: Array.isArray(p) ? p : [], partial: false };
  } catch {
    return { cards: recoverJsonObjects(text), partial: true };
  }
}

/** Extrai cada objeto `{...}` de topo balanceado, ignorando o que vier incompleto. */
function recoverJsonObjects(text: string): AiCard[] {
  const out: AiCard[] = [];
  let depth = 0;
  let start = -1;
  let inStr = false;
  let esc = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') { inStr = true; continue; }
    if (ch === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === '}') {
      if (depth > 0) {
        depth--;
        if (depth === 0 && start >= 0) {
          try {
            const obj = JSON.parse(text.slice(start, i + 1));
            if (obj && typeof obj === 'object') out.push(obj as AiCard);
          } catch {
            // objeto irrecuperável: ignora
          }
          start = -1;
        }
      }
    }
  }

  return out;
}

export interface MapResult {
  cards: GeneratedCard[];
  /** Quantos cards do modo `questions` ficaram sem vínculo (ref ausente/desconhecida). */
  unlinked: number;
  /** Refs que não casaram com nenhuma questão (para log/diagnóstico). */
  orphanRefs: string[];
}

/**
 * Converte os cards crus da IA em GeneratedCard, sanitizando texto e, no modo
 * `questions`, resolvendo o `sourceRef` pelo token `ref` contra `refMap`.
 *
 * Vínculo perdido (ref ausente ou desconhecida) NÃO derruba o card: ele é
 * mantido sem `sourceRef` e contabilizado em `unlinked`/`orphanRefs` para que o
 * chamador possa logar com clareza, em vez de falhar silenciosamente.
 */
export function mapParsedCards(
  parsed: AiCard[],
  mode: string,
  refMap: Map<string, SourceRef>,
): MapResult {
  const orphanRefs: string[] = [];
  let unlinked = 0;

  const cards = parsed
    .filter((c) => c.front_md && c.back_md)
    .map((c) => {
      const card: GeneratedCard = {
        front_md: truncate(stripOpeningCompliments(stripEmDashes(String(c.front_md).trim())), 500),
        back_md: truncate(stripEmDashes(String(c.back_md).trim()), 1200),
      };

      if (mode === 'questions') {
        const ref = typeof c.ref === 'string' ? c.ref.trim() : '';
        const src = ref ? refMap.get(ref) : undefined;
        if (src) {
          card.sourceRef = src;
        } else {
          unlinked++;
          orphanRefs.push(ref || '(missing)');
        }
      }

      return card;
    });

  return { cards, unlinked, orphanRefs };
}
