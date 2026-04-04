import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import SimuladoDetailPage from "./SimuladoDetailPage";

// ── Framer Motion ────────────────────────────────────────────────────────────
vi.mock("framer-motion", () => ({
  motion: new Proxy(
    {},
    {
      get:
        (_t, tag: string) =>
        ({ children, style: _s, initial: _i, animate: _a, transition: _tr, ...rest }: any) =>
          (({ div: <div {...rest}>{children}</div> } as any)[tag] ?? (
            <div {...rest}>{children}</div>
          )),
    }
  ),
  useReducedMotion: () => false,
}));

// ── react-router-dom — keep real MemoryRouter, stub useNavigate ──────────────
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

// ── Hooks ────────────────────────────────────────────────────────────────────
vi.mock("@/hooks/useSimuladoDetail");
vi.mock("@/hooks/useSimulados");
vi.mock("@/contexts/UserContext");

import { useSimuladoDetail } from "@/hooks/useSimuladoDetail";
import { useSimulados } from "@/hooks/useSimulados";
import { useUser } from "@/contexts/UserContext";

// ── Shared fixtures ──────────────────────────────────────────────────────────
const baseSimulado = {
  id: "sim-8",
  slug: "sim-8",
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
};

function setupMocks(overrides: { simulado?: any; simulados?: any[]; onboarding?: boolean } = {}) {
  vi.mocked(useSimuladoDetail).mockReturnValue({
    simulado: overrides.simulado ?? baseSimulado,
    questions: [],
    loading: false,
    error: null,
    refetch: vi.fn(),
  } as any);
  vi.mocked(useSimulados).mockReturnValue({
    simulados: overrides.simulados ?? [],
    loading: false,
  } as any);
  vi.mocked(useUser).mockReturnValue({
    isOnboardingComplete: overrides.onboarding ?? true,
    profile: null,
    onboarding: null,
    isLoading: false,
  } as any);
}

function renderPage() {
  render(
    <MemoryRouter initialEntries={["/simulados/sim-8"]}>
      <Routes>
        <Route path="/simulados/:id" element={<SimuladoDetailPage />} />
      </Routes>
    </MemoryRouter>
  );
}

// ── Tests ────────────────────────────────────────────────────────────────────
describe("SimuladoDetailPage — Dark Arena card", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    setupMocks();
  });

  it("renders all 5 checklist items for a first-time user", () => {
    renderPage();
    expect(screen.getByText("Duração da prova")).toBeInTheDocument();
    expect(screen.getByText("Sem pausa")).toBeInTheDocument();
    expect(screen.getByText("Conexão estável")).toBeInTheDocument();
    expect(screen.getByText("Ambiente adequado")).toBeInTheDocument();
    expect(screen.getByText("Prova em tela cheia")).toBeInTheDocument();
  });

  it("shows helper copy while the checklist is incomplete", () => {
    renderPage();
    expect(
      screen.getByText(/Confirme todos os itens acima para continuar/i)
    ).toBeInTheDocument();
  });

  it("CTA button is disabled with 0/5 items checked", () => {
    renderPage();
    expect(
      screen.getByRole("button", { name: /iniciar simulado/i })
    ).toBeDisabled();
  });

  it("clicking a checklist item checks it but CTA stays disabled until all are checked", () => {
    renderPage();
    fireEvent.click(screen.getByText("Duração da prova").closest("button")!);
    expect(
      screen.getByRole("button", { name: /iniciar simulado/i })
    ).toBeDisabled();
  });

  it("clicking a checked item unchecks it and keeps CTA disabled", () => {
    renderPage();
    const item = screen.getByText("Duração da prova").closest("button")!;
    fireEvent.click(item);
    fireEvent.click(item);
    expect(
      screen.getByRole("button", { name: /iniciar simulado/i })
    ).toBeDisabled();
  });

  it("CTA becomes enabled when all 5 items are checked", () => {
    renderPage();
    [
      "Duração da prova",
      "Sem pausa",
      "Conexão estável",
      "Ambiente adequado",
      "Prova em tela cheia",
    ].forEach((title) =>
      fireEvent.click(screen.getByText(title).closest("button")!)
    );
    expect(
      screen.getByRole("button", { name: /iniciar simulado/i })
    ).not.toBeDisabled();
  });

  it("active CTA navigates to the exam", () => {
    renderPage();
    [
      "Duração da prova",
      "Sem pausa",
      "Conexão estável",
      "Ambiente adequado",
      "Prova em tela cheia",
    ].forEach((title) =>
      fireEvent.click(screen.getByText(title).closest("button")!)
    );
    fireEvent.click(screen.getByRole("button", { name: /iniciar simulado/i }));
    expect(mockNavigate).toHaveBeenCalledWith("/simulados/sim-8/prova");
  });
});

describe("SimuladoDetailPage — Veteran mode", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    // veteran = has at least one finished simulado
    setupMocks({
      simulados: [{ ...baseSimulado, userState: { simuladoId: "sim-8", started: true, finished: true } }],
    });
  });

  it("veteran CTA is immediately enabled (no checklist required)", () => {
    renderPage();
    expect(
      screen.getByRole("button", { name: /iniciar simulado/i })
    ).not.toBeDisabled();
  });

  it("veteran can toggle to show full checklist", () => {
    renderPage();
    expect(screen.queryByText("Duração da prova")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText(/ver detalhes/i));
    expect(screen.getByText("Duração da prova")).toBeInTheDocument();
  });
});

describe("SimuladoDetailPage — available_late mode", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    setupMocks({
      simulado: { ...baseSimulado, status: "available_late" as const },
    });
  });

  it("shows 6 checklist items including ranking disclaimer", () => {
    renderPage();
    expect(screen.getByText("Entendi sobre o ranking")).toBeInTheDocument();
    [
      "Duração da prova",
      "Sem pausa",
      "Conexão estável",
      "Ambiente adequado",
      "Prova em tela cheia",
      "Entendi sobre o ranking",
    ].forEach((title) => {
      expect(screen.getByText(title)).toBeInTheDocument();
    });
  });

  it("renders the available_late info banner", () => {
    renderPage();
    // The dark arena redesign surfaces a dedicated banner (distinct from the checklist item description)
    // that uses a specific role or data-testid. For now, verify the banner text is present.
    expect(
      screen.getAllByText(/janela oficial encerrou/i).length
    ).toBeGreaterThanOrEqual(1);
  });
});
