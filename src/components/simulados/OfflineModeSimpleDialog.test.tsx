import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { OfflineModeSimpleDialog } from "./OfflineModeSimpleDialog";

// ── react-router-dom — stub useNavigate ──────────────────────────────────────
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

// ── Side-effect deps (not exercised by the online path) ──────────────────────
vi.mock("@/services/offlineApi", () => ({
  offlineApi: {
    createOfflineAttempt: vi.fn(),
    getSignedPdfUrl: vi.fn(),
  },
}));
vi.mock("@/hooks/useOfflineAttempt", () => ({
  persistOfflineAttempt: vi.fn(),
}));
vi.mock("@/hooks/use-toast", () => ({
  toast: vi.fn(),
}));

const sim = {
  id: "11111111-1111-1111-1111-111111111111",
  slug: "simulado-8-enamed",
  title: "Simulado Teste",
  description: "Desc",
  sequenceNumber: 8,
  status: "available" as const,
  questionsCount: 100,
  estimatedDuration: "5h",
  estimatedDurationMinutes: 300,
  themeTags: [] as string[],
  resultsReleaseAt: "2026-04-15T12:00:00Z",
  executionWindowStart: "2026-04-01T08:00:00Z",
  executionWindowEnd: "2026-04-01T18:00:00Z",
  userState: { simuladoId: "sim-8", started: false, finished: false },
} as any;

describe("OfflineModeSimpleDialog — online mode start", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
  });

  it("navigates to the exam route (/prova) when choosing 'Experiência online'", () => {
    render(
      <OfflineModeSimpleDialog open onOpenChange={vi.fn()} sim={sim} />
    );

    fireEvent.click(
      screen.getByText("Experiência online").closest("button")!
    );

    expect(mockNavigate).toHaveBeenCalledWith(`/simulados/${sim.slug}/prova`);
    // Must NOT bounce back to the pre-exam detail route, which loops the flow.
    expect(mockNavigate).not.toHaveBeenCalledWith(`/simulados/${sim.slug}/start`);
  });
});
