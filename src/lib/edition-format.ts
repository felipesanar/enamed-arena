import type { ExamFormat } from '@/types/edition';

export function validateExamFormat(input: unknown): { valid: true; value: ExamFormat } | { valid: false; reason: string } {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { valid: false, reason: 'Expected format object' };
  const data = input as Record<string, unknown>;
  for (const field of ['questions', 'options', 'duration_minutes']) {
    if (typeof data[field] !== 'number' || !Number.isSafeInteger(data[field]) || (data[field] as number) <= 0) {
      return { valid: false, reason: `Invalid ${field}` };
    }
  }
  if (data.scoring !== 'tri' && data.scoring !== 'raw') return { valid: false, reason: 'Invalid scoring' };
  if (data.proficient_min !== undefined && (typeof data.proficient_min !== 'number'
    || !Number.isFinite(data.proficient_min) || data.proficient_min < 0)) {
    return { valid: false, reason: 'Invalid proficient_min' };
  }
  return { valid: true, value: {
    questions: data.questions as number, options: data.options as number,
    duration_minutes: data.duration_minutes as number, scoring: data.scoring,
    ...(data.proficient_min !== undefined ? { proficient_min: data.proficient_min as number } : {}),
  } };
}
