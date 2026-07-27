import { describe, it, expect, vi, afterEach } from "vitest";
import { RenderServiceError, callRenderService } from "./renderClient";

const baseOpts = { url: "https://render.example.com/render", secret: "shh", timeoutMs: 45000 };

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  vi.useRealTimers();
});

describe("callRenderService", () => {
  it("returns the PDF bytes on success (200)", async () => {
    const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // "%PDF"
    const fetchImpl = vi.fn(async () => new Response(bytes.buffer, { status: 200 }));

    const result = await callRenderService({ hello: "world" }, { ...baseOpts, fetchImpl });

    expect(result).toEqual(bytes);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(baseOpts.url);
    expect(init?.method).toBe("POST");
    expect((init?.headers as Record<string, string>)["x-internal-secret"]).toBe("shh");
    expect((init?.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
    expect(init?.body).toBe(JSON.stringify({ hello: "world" }));
  });

  // An HTTP error response comes back fast (no network delay), so per the
  // "no máximo 1 retry, só se a falha for rápida" rule it IS retried once —
  // both attempts return the same synthetic response here, so the final
  // error still reflects the same {error, stage}. Fake timers skip the real
  // 2s backoff wait.
  it("throws RenderServiceError with stage/message from a valid {error,stage} JSON body (after the 1 fast-failure retry)", async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ error: "Falha ao escapar caractere especial", stage: "escape" }, 422),
    );

    const promise = callRenderService({}, { ...baseOpts, fetchImpl });
    const assertion = expect(promise).rejects.toMatchObject({
      stage: "escape",
      message: "Falha ao escapar caractere especial",
      httpStatus: 422,
    });

    await vi.advanceTimersByTimeAsync(2000);
    await assertion;

    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("throws RenderServiceError with stage 'unknown' for a non-JSON error body, without throwing a parse exception", async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn(
      async () =>
        new Response("<html><body>502 Bad Gateway</body></html>", {
          status: 502,
          headers: { "Content-Type": "text/html" },
        }),
    );

    const promise = callRenderService({}, { ...baseOpts, fetchImpl });
    const assertion = expect(promise).rejects.toBeInstanceOf(RenderServiceError);

    await vi.advanceTimersByTimeAsync(2000);
    await assertion;

    const err = await promise.catch((e) => e);
    expect((err as RenderServiceError).stage).toBe("unknown");
    expect((err as RenderServiceError).httpStatus).toBe(502);
    expect((err as RenderServiceError).message).toMatch(/502/);
    // Fast failure -> retried once (2nd attempt returns the same 502).
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("times out via AbortController and rejects with RenderServiceError (slow failure -> no retry)", async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn(
      (_url: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            const err = new Error("The operation was aborted");
            err.name = "AbortError";
            reject(err);
          });
        }),
    );

    const promise = callRenderService({}, { ...baseOpts, timeoutMs: 45000, fetchImpl });
    const assertion = expect(promise).rejects.toBeInstanceOf(RenderServiceError);

    await vi.advanceTimersByTimeAsync(45000);
    await assertion;

    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("retries exactly once after a fast failure, and returns success on the retry", async () => {
    vi.useFakeTimers();
    const bytes = new Uint8Array([1, 2, 3]);
    let callCount = 0;
    const fetchImpl = vi.fn(async () => {
      callCount += 1;
      if (callCount === 1) {
        throw new TypeError("network blip");
      }
      return new Response(bytes.buffer, { status: 200 });
    });

    const promise = callRenderService({}, { ...baseOpts, fetchImpl });

    // First attempt fails synchronously (fast failure) -> 2s fixed backoff before retry.
    await vi.advanceTimersByTimeAsync(2000);
    const result = await promise;

    expect(result).toEqual(bytes);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("does not retry a slow failure (fetch fake called exactly once)", async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn(
      (_url: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            const err = new Error("The operation was aborted");
            err.name = "AbortError";
            reject(err);
          });
        }),
    );

    const promise = callRenderService({}, { ...baseOpts, timeoutMs: 45000, fetchImpl });
    const assertion = expect(promise).rejects.toBeInstanceOf(RenderServiceError);

    await vi.advanceTimersByTimeAsync(45000);
    await assertion;

    // Even after time keeps moving forward, no second attempt should ever fire.
    await vi.advanceTimersByTimeAsync(10000);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("truncates a huge error message before wrapping it in RenderServiceError", async () => {
    const hugeMessage = "x".repeat(5000);
    const fetchImpl = vi.fn(async () => jsonResponse({ error: hugeMessage, stage: "compile" }, 500));

    const err = await callRenderService({}, { ...baseOpts, fetchImpl }).catch((e) => e);

    expect(err).toBeInstanceOf(RenderServiceError);
    expect((err as RenderServiceError).message.length).toBeLessThanOrEqual(2000);
  });
});
