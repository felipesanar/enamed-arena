import type { QuestionImportRow, QuestionImportResult } from '../../../src/types/question-import.ts';

type Image = { data: string; mime: string };
export type Images = Record<number, Partial<Record<'enunciado' | 'enunciado2' | 'comentario', Image>>>;
type Urls = Record<number, { enunciado_url?: string; enunciado2_url?: string; comentario_url?: string }>;

export function canonicalRows(input: Record<string, unknown>[], urls: Urls = {}): QuestionImportRow[] {
  return input.map(q => {
    const number = Number(q.question_number ?? q.numero);
    const mapped = urls[number] ?? {};
    if ('question_number' in q || 'options' in q) {
      // Keep malformed canonical values intact for SQL's row-level validation.
      return { ...q,
        ...(mapped.enunciado_url ? { image_url: mapped.enunciado_url } : {}),
        ...(mapped.enunciado2_url ? { image_url_2: mapped.enunciado2_url } : {}),
        ...(mapped.comentario_url ? { explanation_image_url: mapped.comentario_url } : {}),
      } as unknown as QuestionImportRow;
    }
    const options = Array.isArray(q.options) ? q.options.map(o => ({ ...o })) : Object.keys(q)
      .filter(key => /^alternativa_[a-z]$/.test(key)).sort().map(key => {
        const label = key.slice(-1).toUpperCase();
        return { label, text: String(q[key] ?? ''), is_correct: String(q.correta ?? '').trim().toUpperCase() === label };
      });
    return {
      question_number: number, text: String(q.text ?? q.texto ?? ''), area: String(q.area ?? ''),
      area_id: q.area_id as string | null, theme: String(q.theme ?? q.tema ?? ''),
      difficulty: (q.difficulty ?? q.dificuldade ?? 'medium') as string,
      explanation: (q.explanation ?? q.explicacao ?? null) as string | null,
      image_url: mapped.enunciado_url || q.image_url as string || null,
      image_url_2: mapped.enunciado2_url || q.image_url_2 as string || null,
      explanation_image_url: mapped.comentario_url || q.explanation_image_url as string || null,
      options,
    };
  });
}

interface Dependencies {
  validate(rows: QuestionImportRow[]): Promise<QuestionImportResult>;
  commit(rows: QuestionImportRow[]): Promise<QuestionImportResult>;
  upload(number: number, slot: string, image: Image): Promise<{ path: string; url: string }>;
  remove(paths: string[]): Promise<unknown>;
}

export async function executeImport(rows: QuestionImportRow[], images: Images, deps: Dependencies): Promise<QuestionImportResult> {
  const validation = await deps.validate(rows);
  if (!validation.ok) return validation;
  const created: string[] = [];
  const prepared = rows.map(row => ({ ...row }));
  try {
    for (const row of prepared) {
      for (const [slot, field] of [['enunciado', 'image_url'], ['enunciado2', 'image_url_2'], ['comentario', 'explanation_image_url']] as const) {
        const image = images[row.question_number]?.[slot];
        if (!image) continue;
        const result = await deps.upload(row.question_number, slot, image);
        created.push(result.path);
        row[field] = result.url;
      }
    }
  } catch (error) {
    if (created.length) await deps.remove(created);
    throw error;
  }
  // A transport failure can mean COMMIT succeeded. Keep images for reconciliation.
  const result = await deps.commit(prepared);
  if (!result.ok && created.length) await deps.remove(created);
  return result;
}
