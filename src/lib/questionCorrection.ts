/** An unavailable key is unknown, never a wrong answer. Explanations are optional. */
export function hasKnownAnswerKey(question: {
  correctOptionId?: string | null;
  options: ReadonlyArray<{ id: string }>;
  explanationUnavailable?: boolean;
} | null | undefined): boolean {
  return !!question?.correctOptionId && question.options.some(option => option.id === question.correctOptionId);
}
