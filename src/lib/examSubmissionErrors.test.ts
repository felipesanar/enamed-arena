import { expect, it } from 'vitest';
import { examSubmissionErrorMessage } from '@/lib/examSubmissionErrors';
it.each([
  [{ message: 'Cannot submit: 90 question(s) unanswered' }, 'faltam questões'],
  [{ code: 'PGRST301' }, 'sessão expirou'],
  [new Error('SESSION_EXPIRED'), 'sessão expirou'],
  [{ message: 'Failed to fetch' }, 'conexão'],
  [new TypeError('NetworkError'), 'conexão'],
  [{ message: 'unexpected' }, 'confirmar a finalização'],
])('maps structured errors safely: %j', (error, text) => {
  expect(examSubmissionErrorMessage(error)).toContain(text);
});
