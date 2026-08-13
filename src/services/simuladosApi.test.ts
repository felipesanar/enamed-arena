import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the supabase client before importing the module under test
vi.mock("@/integrations/supabase/client", () => {
  return {
    supabase: {
      from: vi.fn(),
      rpc: vi.fn(),
    },
  };
});

import { supabase } from "@/integrations/supabase/client";
import { simuladosApi } from "./simuladosApi";

// Chainable query builder mock for the `attempts` table: select/eq/in/order/limit/maybeSingle
// all return `this` (except the terminal ones), mirroring how `supabase.from(...)` is awaited
// directly in simuladosApi (e.g. `await supabase.from('attempts').select('*').eq(...)`).
function setupAttemptQueryMock() {
  const eq = vi.fn(() => builder);
  const inFn = vi.fn(() => builder);
  const order = vi.fn(() => builder);
  const limit = vi.fn(() => builder);
  const select = vi.fn(() => builder);
  const maybeSingle = vi.fn(() => Promise.resolve({ data: null, error: null }));

  const builder: any = {
    select,
    eq,
    in: inFn,
    order,
    limit,
    maybeSingle,
    then: (resolve: any) => resolve({ data: [], error: null }),
  };

  (supabase.from as any).mockReturnValue(builder);

  return { eq, inFn, order, limit, select, maybeSingle };
}

describe("simuladosApi — filtro de modalidade", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("usa .eq quando recebe uma única modalidade", async () => {
    const { eq } = setupAttemptQueryMock();
    await simuladosApi.getUserAttempts("user-1", "online");
    expect(eq).toHaveBeenCalledWith("attempt_type", "online");
  });

  it("usa .in quando recebe um array de modalidades", async () => {
    const { inFn } = setupAttemptQueryMock();
    await simuladosApi.getUserAttempts("user-1", ["online", "presencial"]);
    expect(inFn).toHaveBeenCalledWith("attempt_type", ["online", "presencial"]);
  });

  it("getAttempt também aceita array", async () => {
    const { inFn } = setupAttemptQueryMock();
    await simuladosApi.getAttempt("sim-1", "user-1", ["online", "presencial"]);
    expect(inFn).toHaveBeenCalledWith("attempt_type", ["online", "presencial"]);
  });

  it("rejeita array vazio em vez de devolver zero linhas silenciosamente (getUserAttempts)", async () => {
    setupAttemptQueryMock();
    await expect(simuladosApi.getUserAttempts("user-1", [])).rejects.toThrow(
      /filter array vazio/i,
    );
  });

  it("rejeita array vazio em vez de devolver zero linhas silenciosamente (getAttempt)", async () => {
    setupAttemptQueryMock();
    await expect(simuladosApi.getAttempt("sim-1", "user-1", [])).rejects.toThrow(
      /filter array vazio/i,
    );
  });
});

describe("simuladosApi.updateAttempt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws when the caller tries to update protected (score/status) columns directly", async () => {
    // Non-progress updates must never hit the table from the client.
    // After the hardening, they must throw synchronously with a clear message.
    await expect(
      simuladosApi.updateAttempt("attempt-id", { score_percentage: 90 }),
    ).rejects.toThrow(/not allowed/i);

    await expect(
      simuladosApi.updateAttempt("attempt-id", { status: "submitted" }),
    ).rejects.toThrow(/not allowed/i);

    await expect(
      simuladosApi.updateAttempt("attempt-id", { finished_at: new Date().toISOString() }),
    ).rejects.toThrow(/not allowed/i);
  });
});
