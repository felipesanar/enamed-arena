/**
 * Cliente HTTP (chamada AWAITED — não fire-and-forget) para o futuro serviço
 * de render (LaTeX + Tectonic, Task 6). Adaptado do padrão de
 * `supabase/functions/request-password-reset/index.ts` (chamada a `novu-email`
 * com header `x-internal-secret`), mas aqui o chamador precisa dos bytes do
 * PDF de volta, então a chamada é aguardada e tem timeout/retry próprios.
 *
 * `opts.fetchImpl` é injetável (default `fetch` global) para permitir testes
 * sem rede real — só `callRenderService` recebe as credenciais/URL via
 * parâmetros; ele nunca lê `Deno.env` diretamente (isso é responsabilidade do
 * chamador, Task 16).
 */

export class RenderServiceError extends Error {
  constructor(public stage: string, message: string, public httpStatus?: number) {
    super(message);
    this.name = "RenderServiceError";
  }
}

/** Falhas com menos que isso de wall-clock desde o início da tentativa contam como "rápidas" e ganham 1 retry. */
const FAST_FAILURE_THRESHOLD_MS = 5000;
/** Backoff fixo antes do retry (só ocorre em falha rápida). */
const RETRY_BACKOFF_MS = 2000;
/** Evita logs/mensagens gigantes se o serviço devolver um dump de erro do Tectonic. */
const MAX_ERROR_MESSAGE_LEN = 2000;

function truncateMessage(message: string): string {
  return message.length > MAX_ERROR_MESSAGE_LEN ? message.slice(0, MAX_ERROR_MESSAGE_LEN) : message;
}

interface AttemptOpts {
  url: string;
  secret: string;
  timeoutMs: number;
  fetchImpl: typeof fetch;
}

/** Uma única tentativa de chamada HTTP. Lança RenderServiceError em qualquer falha (rede, timeout ou HTTP não-2xx). */
async function attemptOnce(payload: object, opts: AttemptOpts): Promise<Uint8Array> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs);

  try {
    let response: Response;
    try {
      response = await opts.fetchImpl(opts.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-secret": opts.secret,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } catch (err) {
      const isAbort = err instanceof Error && err.name === "AbortError";
      const detail = err instanceof Error ? err.message : String(err);
      const message = isAbort
        ? `Timeout ao chamar o serviço de render (${opts.timeoutMs}ms)`
        : `Falha ao chamar o serviço de render: ${detail}`;
      throw new RenderServiceError("unknown", truncateMessage(message));
    }

    if (!response.ok) {
      // Parsing defensivo: o corpo pode não ser JSON válido (ex.: página de
      // erro de um load balancer). Nunca deixar o parse quebrar o fluxo.
      let stage = "unknown";
      let message = `Render service respondeu HTTP ${response.status}`;
      try {
        const body = await response.json();
        if (body && typeof body === "object") {
          const b = body as { error?: unknown; stage?: unknown };
          if (typeof b.error === "string" && b.error.length > 0) message = b.error;
          if (typeof b.stage === "string" && b.stage.length > 0) stage = b.stage;
        }
      } catch {
        // corpo não-JSON: mantém stage 'unknown' e mensagem genérica com o status.
      }
      throw new RenderServiceError(stage, truncateMessage(message), response.status);
    }

    return new Uint8Array(await response.arrayBuffer());
  } finally {
    clearTimeout(timer);
  }
}

export async function callRenderService(
  payload: object,
  opts: { url: string; secret: string; timeoutMs: number; fetchImpl?: typeof fetch },
): Promise<Uint8Array> {
  const attemptOpts: AttemptOpts = {
    url: opts.url,
    secret: opts.secret,
    timeoutMs: opts.timeoutMs,
    fetchImpl: opts.fetchImpl ?? fetch,
  };

  const startedAt = Date.now();
  try {
    return await attemptOnce(payload, attemptOpts);
  } catch (firstError) {
    const elapsedMs = Date.now() - startedAt;
    // Falha lenta (ex.: bateu no timeout de 45s): sem orçamento de tempo para
    // retry dentro da janela de ~90s de polling do client. Propaga direto.
    if (elapsedMs >= FAST_FAILURE_THRESHOLD_MS) {
      throw firstError;
    }
    // Falha rápida: 1 retry só, com backoff fixo.
    await new Promise((resolve) => setTimeout(resolve, RETRY_BACKOFF_MS));
    return await attemptOnce(payload, attemptOpts);
  }
}
