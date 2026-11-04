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

describe('simuladosApi edition metadata opt-in', () => {
  const row = { id: 's1', slug: 'simulado-1', sequence_number: 1, duration_minutes: 300,
    edition_id: 'e1', source_simulado_id: 'source', exam_editions: { code: '2027.1', label: 'ENAMED 2027.1' } };
  function mockRow(value: unknown = row) {
    const builder = {
      select: vi.fn(() => builder), in: vi.fn(() => builder), order: vi.fn(() => builder),
      eq: vi.fn(() => builder), maybeSingle: vi.fn(async () => ({ data: value, error: null })),
      then: (resolve: (value: unknown) => unknown) => resolve({ data: [value], error: null }),
    };
    vi.mocked(supabase.from).mockReturnValue(builder as never);
    return builder;
  }
  beforeEach(() => vi.clearAllMocks());

  it('keeps the old select and ignores new metadata by default', async () => {
    const query = mockRow();
    const result = await simuladosApi.listSimulados();
    expect(query.select).toHaveBeenCalledWith('*');
    expect(query.in).toHaveBeenCalledWith('status', ['published', 'test']);
    expect(result[0].editionCode).toBeUndefined();
  });

  it('opts into the real FK relationship without filtering away history', async () => {
    const query = mockRow();
    const result = await simuladosApi.listSimulados(true);
    expect(query.select).toHaveBeenCalledWith('*, exam_editions!simulados_edition_id_fkey(code, label)');
    expect(query.in).toHaveBeenCalledWith('status', ['published', 'test', 'archived']);
    expect(query.eq).not.toHaveBeenCalled();
    expect(result[0]).toMatchObject({ editionId: 'e1', editionCode: '2027.1', editionLabel: 'ENAMED 2027.1', sourceSimuladoId: 'source' });
  });

  it.each(['simulado-1', '123e4567-e89b-42d3-a456-426614174000'])('preserves slug/UUID lookup %s', async (ref) => {
    const query = mockRow();
    expect((await simuladosApi.getSimulado(ref, true))?.editionCode).toBe('2027.1');
    expect(query.eq).toHaveBeenCalledWith(ref === 'simulado-1' ? 'slug' : 'id', ref);
    expect(query.select).toHaveBeenCalledWith('*, exam_editions!simulados_edition_id_fkey(code, label)');
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it.each(['simulado-1', '123e4567-e89b-42d3-a456-426614174000'])('keeps direct lookup neutral without a join when disabled: %s', async ref => {
    const query = mockRow();
    const result = await simuladosApi.getSimulado(ref, false);
    expect(query.select).toHaveBeenCalledWith('*');
    expect(query.eq).toHaveBeenCalledWith(ref === 'simulado-1' ? 'slug' : 'id', ref);
    expect(result?.editionCode).toBeUndefined();
    expect(result?.editionLabel).toBeUndefined();
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it.each([null, [], [{ code: '2027.1' }], { code: 2027, label: false }])('does not trust malformed relation %j', async (exam_editions) => {
    mockRow({ ...row, exam_editions });
    const [result] = await simuladosApi.listSimulados(true);
    expect(result.editionCode).toBeUndefined();
    expect(result.editionLabel).toBeUndefined();
  });
});
