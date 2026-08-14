/**
 * Serviço da aplicação presencial (QR → gabarito → resultado).
 * Fala com a Edge Function `presencial`, que roteia por `action` no body:
 * checkin | claim | start-unlinked | submit.
 *
 * A prova nunca chega ao cliente com enunciado ou texto de alternativa —
 * apenas o esqueleto (question_id, number, options com id/label) necessário
 * para marcar o gabarito de uma prova impressa. Nenhum identificador de
 * usuário circula pelo cliente: o servidor deriva tudo do token assinado.
 */
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { trackEvent } from '@/lib/analytics';
import type {
  PresencialAnswer,
  PresencialCheckinResult,
  PresencialClaimInput,
  PresencialIdentifyInput,
  PresencialReady,
  PresencialResult,
} from '@/types/presencial';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Normaliza os campos de identificação:
 * - `code`: minúsculas (o CHECK do banco só aceita `^[a-z0-9-]{3,32}$` e o
 *   aluno pode digitar o código à mão em maiúsculas se não conseguir ler o QR).
 * - `name`: trim.
 * - `email`: trim + minúsculas.
 */
function normalizeIdentify(input: PresencialIdentifyInput): PresencialIdentifyInput {
  return {
    code: input.code.trim().toLowerCase(),
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
  };
}

/**
 * Invoca a Edge Function `presencial` para a `action` dada e trata o
 * contrato de erro: a function responde alguns erros de negócio no corpo
 * com status 200 (`{ error: '...' }`), igual à `create-guest-account` —
 * então checamos `data?.error` mesmo quando o `error` do `invoke` é nulo.
 */
/**
 * Extrai a mensagem de erro em pt-BR do corpo da resposta de um
 * FunctionsHttpError. Devolve `null` quando não há corpo legível — aí o caller
 * usa uma mensagem genérica, nunca a do erro de transporte.
 */
async function lerMensagemDoCorpo(error: unknown): Promise<string | null> {
  const ctx = (error as { context?: unknown } | null)?.context;
  if (!ctx || typeof (ctx as Response).clone !== 'function') return null;
  try {
    const corpo = await (ctx as Response).clone().json();
    const msg = (corpo as { error?: unknown } | null)?.error;
    return typeof msg === 'string' && msg.trim() ? msg : null;
  } catch {
    return null;
  }
}

async function invokePresencial<T>(action: string, body: object): Promise<T> {
  const { data, error } = await supabase.functions.invoke('presencial', {
    body: { action, ...body },
  });

  if (error) {
    // `functions.invoke` transforma qualquer status não-2xx num FunctionsHttpError
    // cuja mensagem é genérica e em inglês ("Edge Function returned a non-2xx
    // status code"). A mensagem útil, em pt-BR, está no CORPO da resposta, que
    // fica acessível via `error.context`. Sem ler isso, o aluno vê texto técnico
    // em inglês numa sala de prova — foi o que aconteceu no primeiro teste real.
    const doServidor = await lerMensagemDoCorpo(error);
    logger.error(`[PresencialApi] Erro ao invocar a action "${action}":`, doServidor ?? error);
    throw new Error(doServidor ?? 'Não foi possível continuar. Chame o fiscal da sala.');
  }

  const payload = data as ({ error?: string } & Partial<T>) | null;
  if (payload?.error) {
    logger.error(`[PresencialApi] Erro de negócio na action "${action}":`, payload.error);
    throw new Error(payload.error);
  }

  return payload as T;
}

// ─── API ──────────────────────────────────────────────────────────────────────

export const presencialApi = {
  /**
   * Primeiro passo do check-in presencial: identifica o aluno pelo código da
   * sala (QR), nome e e-mail. Pode resolver direto (`ready`), pedir
   * confirmação entre candidatos ambíguos (`suggestions`) ou não achar
   * nenhuma conta (`no_account`).
   */
  async checkin(input: PresencialIdentifyInput): Promise<PresencialCheckinResult> {
    const normalized = normalizeIdentify(input);
    logger.log('[PresencialApi] Iniciando checkin, code:', normalized.code);
    trackEvent('presencial_checkin_started', { code: normalized.code });

    const result = await invokePresencial<PresencialCheckinResult>('checkin', normalized);

    if (result.status === 'ready') {
      trackEvent('presencial_identified', { identification_path: 'checkin' });
    } else if (result.status === 'no_account') {
      trackEvent('presencial_no_account', { code: normalized.code });
    }

    return result;
  },

  /**
   * Confirma um dos candidatos sugeridos pelo checkin, quando havia
   * ambiguidade entre duas ou mais contas parecidas.
   */
  async claim(input: PresencialClaimInput): Promise<PresencialReady> {
    const { candidateRef, ...identify } = input;
    const normalized = normalizeIdentify(identify);
    logger.log('[PresencialApi] Confirmando candidato:', candidateRef);

    const result = await invokePresencial<PresencialReady>('claim', {
      ...normalized,
      candidateRef,
    });

    trackEvent('presencial_identified', { identification_path: 'claim' });

    return result;
  },

  /**
   * Segue sem vincular a uma conta existente (aluno sem cadastro reconhecido
   * — resultado fica registrado, mas fora do ranking/histórico do usuário).
   */
  async startUnlinked(input: PresencialIdentifyInput): Promise<PresencialReady> {
    const normalized = normalizeIdentify(input);
    logger.log('[PresencialApi] Iniciando fluxo sem vínculo de conta, code:', normalized.code);
    trackEvent('presencial_unlinked_started', { code: normalized.code });

    return invokePresencial<PresencialReady>('start-unlinked', normalized);
  },

  /**
   * Envia o gabarito marcado e recebe o resultado agregado. O score nunca é
   * calculado no cliente — a function corrige e devolve o resultado pronto.
   */
  async submit(input: { token: string; answers: PresencialAnswer[] }): Promise<PresencialResult> {
    logger.log('[PresencialApi] Enviando gabarito, total de respostas:', input.answers.length);

    const result = await invokePresencial<PresencialResult>('submit', {
      token: input.token,
      answers: input.answers,
    });

    trackEvent('presencial_submitted', {
      total_questions: result.total_questions,
      total_correct: result.total_correct,
      is_linked: result.is_linked,
      is_within_window: result.is_within_window,
    });

    return result;
  },
};
