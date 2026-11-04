/** Supabase errors are plain objects, not necessarily Error instances. */
export function examSubmissionErrorMessage(error: unknown): string {
  const details = error && typeof error === 'object' ? error as { message?: string; code?: string; status?: number } : {};
  const message = details.message ?? String(error);
  if (/unanswered|quest.*(branco|pendente)/i.test(message)) {
    return 'Ainda faltam questões. Responda todas antes de finalizar manualmente; ao esgotar o tempo, as questões em branco contam como erradas.';
  }
  if (details.status === 401 || details.code === 'PGRST301' || /jwt|session_expired|not authenticated|sessão|session.*expired/i.test(message)) {
    return 'Sua sessão expirou. Entre novamente para consultar ou reenviar sua prova.';
  }
  if (/fetch|network|offline|conexão|internet|load failed/i.test(message)) {
    return 'Sem conexão com o servidor. Verifique sua conexão e tente finalizar novamente. A confirmação ainda não foi recebida.';
  }
  return 'Não foi possível confirmar a finalização. Tente novamente; suas respostas já salvas serão preservadas.';
}
