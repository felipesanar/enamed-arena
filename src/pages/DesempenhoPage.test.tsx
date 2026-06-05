import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import DesempenhoPage from "./DesempenhoPage";

// ── Framer Motion mock ──────────────────────────────────────────────────────
vi.mock("framer-motion", () => ({
  motion: new Proxy({}, {
    get: (_t, tag: string) =>
      ({ children, style: _s, initial: _i, animate: _a, whileHover: _wh,
         whileTap: _wt, transition: _tr, variants: _v, exit: _e, layout: _l, ...rest }: any) =>
        (({ div: <div {...rest}>{children}</div>,
           section: <section {...rest}>{children}</section>,
           button: <button {...rest}>{children}</button>,
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
  useUserPerformance: () => ({ history: [] as any[], summary: null as any, loading: false }),
}));

vi.mock("@/contexts/UserContext", () => ({
  useUser: () => ({
    profile: { id: "user-1", segment: "pro", full_name: "Aluno Teste" },
    isOnboardingComplete: true,
  }),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "user-1" }, loading: false }),
}));

vi.mock("@/admin/hooks/useAdminAuth", () => ({
  useAdminAuth: () => ({ user: { id: "user-1" }, isAdmin: false, loading: false }),
}));

// `theme` is hierarchical: "Subespecialidade > Tema" (3-level drill-down model).
const mockQuestions = [
  { id: "q1", area: "Clínica Médica", theme: "Cardiologia > HAS", number: 1, text: "Q1 texto", correctOptionId: "opt-a", difficulty: "medium" },
  { id: "q2", area: "Clínica Médica", theme: "Cardiologia > HAS", number: 2, text: "Q2 texto", correctOptionId: "opt-b", difficulty: "medium" },
  { id: "q3", area: "Cirurgia", theme: "Abdome > Apendicite", number: 3, text: "Q3 texto", correctOptionId: "opt-a", difficulty: "hard" },
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

// Correct answers come from attemptQuestionResults (keyed by question id):
// q1 → opt-a (answered opt-a ✓), q2 → opt-b (answered opt-x ✗), q3 → opt-a (answered opt-a ✓)
const mockAttemptQuestionResults = {
  q1: { correct_option_id: "opt-a" },
  q2: { correct_option_id: "opt-b" },
  q3: { correct_option_id: "opt-a" },
};

vi.mock("@/hooks/useExamResult", () => ({
  useExamResult: () => ({
    examState: mockExamState,
    attemptQuestionResults: mockAttemptQuestionResults,
    loading: false,
  }),
}));

vi.mock("@/lib/simulado-helpers", () => ({
  canViewResults: () => true,
  canViewResultsOrAdminPreview: () => true,
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

  it("shows the Especialidade grid by default (no drill-down active)", () => {
    renderPage();
    // No breadcrumb until a specialty is drilled into
    expect(screen.queryByLabelText("Navegação de drill-down")).toBeNull();
    // Level-1 area cards are clickable buttons (aria-label ends with "aproveitamento")
    expect(screen.getByRole("button", { name: /^Clínica Médica:/i })).toBeTruthy();
  });

  it("clicking an area shows its subspecialties (level 2)", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /^Clínica Médica:/i }));
    expect(screen.getByRole("button", { name: /^Cardiologia:/i })).toBeTruthy();
  });

  it("drilling down to a theme expands its questions (level 3)", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /^Clínica Médica:/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Cardiologia:/i }));
    // Theme accordion row toggle
    fireEvent.click(screen.getByRole("button", { name: /HAS/i }));
    expect(screen.getByText(/Q1 texto/i)).toBeTruthy();
  });

  it("question rows link to correcao with correct q param", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /^Clínica Médica:/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Cardiologia:/i }));
    fireEvent.click(screen.getByRole("button", { name: /HAS/i }));
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

  it("breadcrumb reset returns to the Especialidade grid", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /^Clínica Médica:/i }));
    // Breadcrumb appears after drilling in
    expect(screen.getByLabelText("Navegação de drill-down")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^Especialidades$/i }));
    // Back at level 1 — the area card is clickable again
    expect(screen.getByRole("button", { name: /^Clínica Médica:/i })).toBeTruthy();
  });
});
