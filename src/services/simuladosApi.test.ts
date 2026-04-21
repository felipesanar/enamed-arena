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

import { simuladosApi } from "./simuladosApi";

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
