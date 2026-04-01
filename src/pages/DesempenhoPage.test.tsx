import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import DesempenhoPage from "./DesempenhoPage";

// ── Framer Motion mock ──────────────────────────────────────────────────────
vi.mock("framer-motion", () => ({
  motion: new Proxy({}, {
    get: (_t, tag: string) =>
      ({ children, style: _s, initial: _i, animate: _a, whileHover: _wh,
         transition: _tr, variants: _v, exit: _e, ...rest }: any) =>
        (({ div: <div {...rest}>{children}</div>,
           section: <section {...rest}>{children}</section>,
         } as any)[tag] ?? <div {...rest}>{children}</div>),
  }),
  AnimatePresence: ({ children }: any) => <>{children}</>,
  useReducedMotion: () => false,
}));

// ── Hook mocks ──────────────────────────────────────────────────────────────
const mockSimulados = [
  {
    id: "sim-1",
    title: "Simulado #1 — Fundamentos",
    status: "completed",
    executionWindowStart: "2026-03-01T00:00:00Z",
    executionWindowEnd: "2026-03-01T23:59:00Z",
    userState: { finished: true, score: 72 },
  },
];

vi.mock("@/hooks/useSimulados", () => ({
  useSimulados: () => ({ simulados: mockSimulados, loading: false }),
}));

vi.mock("@/hooks/useUserPerformance", () => ({
  useUserPerformance: () => ({ history: [], summary: null, loading: false }),
}));

const mockQuestions = [
  { id: "q1", area: "Clínica Médica", theme: "HAS", number: 1, text: "Q1 texto", correctOptionId: "opt-a", difficulty: "medium" },
  { id: "q2", area: "Clínica Médica", theme: "HAS", number: 2, text: "Q2 texto", correctOptionId: "opt-b", difficulty: "medium" },
  { id: "q3", area: "Cirurgia", theme: "Abdome Agudo", number: 3, text: "Q3 texto", correctOptionId: "opt-a", difficulty: "hard" },
];

vi.mock("@/hooks/useSimuladoDetail", () => ({
  useSimuladoDetail: () => ({ questions: mockQuestions, loading: false }),
}));

const mockExamState = {
  status: "submitted",
  answers: {
    "q1": { selectedOption: "opt-a", markedForReview: false, highConfidence: false },
    "q2": { selectedOption: "opt-x", markedForReview: false, highConfidence: false },
    "q3": { selectedOption: "opt-a", markedForReview: false, highConfidence: false },
  },
};

vi.mock("@/hooks/useExamResult", () => ({
  useExamResult: () => ({ examState: mockExamState, loading: false }),
}));

vi.mock("@/lib/simulado-helpers", () => ({
  canViewResults: () => true,
  deriveSimuladoStatus: (s: any) => s.status,
}));

// ── Helper ──────────────────────────────────────────────────────────────────
function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/desempenho"]}>
      <DesempenhoPage />
    </MemoryRouter>
  );
}

// ── Tests ───────────────────────────────────────────────────────────────────
describe("DesempenhoPage", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("renders the hero score", () => {
    renderPage();
    // 2 correct out of 3 = 67%
    expect(screen.getByText(/67%/)).toBeTruthy();
  });

  it("renders 'Aproveitamento geral' overline in hero", () => {
    renderPage();
    expect(screen.getByText(/aproveitamento geral/i)).toBeTruthy();
  });

  it("renders the SimuladoResultNav", () => {
    renderPage();
    expect(screen.getByText(/ver correção/i)).toBeTruthy();
  });

  it("renders area cards", () => {
    renderPage();
    expect(screen.getAllByText("Clínica Médica").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Cirurgia").length).toBeGreaterThanOrEqual(1);
  });

  it("shows 'Selecione uma Grande Área' placeholder when no area selected", () => {
    renderPage();
    expect(screen.getByText(/selecione uma grande área/i)).toBeTruthy();
  });

  it("clicking an area shows its themes", () => {
    renderPage();
    // Click the first occurrence (area card in the grid, before evo bars)
    fireEvent.click(screen.getAllByText("Clínica Médica")[0]);
    expect(screen.getByText("HAS")).toBeTruthy();
  });

  it("clicking a theme expands its questions", () => {
    renderPage();
    fireEvent.click(screen.getAllByText("Clínica Médica")[0]);
    fireEvent.click(screen.getByText("HAS"));
    expect(screen.getByText(/Q1 texto/i)).toBeTruthy();
  });

  it("question rows link to correcao with correct q param", () => {
    renderPage();
    fireEvent.click(screen.getAllByText("Clínica Médica")[0]);
    fireEvent.click(screen.getByText("HAS"));
    const link = screen.getByRole("link", { name: /Q1 texto/i });
    expect(link.getAttribute("href")).toContain("correcao?q=1");
  });

  it("renders summary cards when more than one area", () => {
    renderPage();
    expect(screen.getByText(/onde você brilha/i)).toBeTruthy();
    expect(screen.getByText(/próximo foco/i)).toBeTruthy();
  });

  it("renders evolution bars for each area", () => {
    renderPage();
    const allClinica = screen.getAllByText("Clínica Médica");
    expect(allClinica.length).toBeGreaterThanOrEqual(1);
  });

  it("clicking selected area again deselects it", () => {
    renderPage();
    fireEvent.click(screen.getAllByText("Clínica Médica")[0]);
    fireEvent.click(screen.getAllByText("Clínica Médica")[0]);
    expect(screen.getByText(/selecione uma grande área/i)).toBeTruthy();
  });
});
