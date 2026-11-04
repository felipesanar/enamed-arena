import { describe, expect, it } from 'vitest';
import { validateExamFormat } from '@/lib/edition-format';

describe('validateExamFormat', () => {
  const format = { questions: 100, options: 5, duration_minutes: 300, scoring: 'tri', proficient_min: 60 };
  it('valida wire snake_case sem fabricar TRI ou defaults', () => {
    expect(validateExamFormat(format)).toEqual({ valid: true, value: format });
    expect(validateExamFormat({ ...format, scoring: 'raw' }).valid).toBe(true);
    expect(validateExamFormat({ questions: 1, options: 1, duration_minutes: 1, scoring: 'raw' })).toEqual({ valid: true, value: { questions: 1, options: 1, duration_minutes: 1, scoring: 'raw' } });
  });
  it.each([null, [], {}, 'tri', { ...format, questions: 0 }, { ...format, questions: 1.5 },
    { ...format, options: -1 }, { ...format, duration_minutes: Infinity }, { ...format, duration_minutes: '300' },
    { ...format, scoring: 'fake' }, { ...format, proficient_min: NaN }, { ...format, proficient_min: -1 }])('rejeita formato invalido %#', (value) => {
    expect(validateExamFormat(value)).toMatchObject({ valid: false });
  });
});
