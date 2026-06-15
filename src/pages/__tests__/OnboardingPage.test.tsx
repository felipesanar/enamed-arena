import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import OnboardingPage from "../OnboardingPage";

const { saveOnboarding, navigateMock, toastMock } = vi.hoisted(() => ({
  saveOnboarding: vi.fn(),
  navigateMock: vi.fn(),
  toastMock: vi.fn(),
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => navigateMock };
});

vi.mock("@/contexts/UserContext", () => ({
  useUser: () => ({
    profile: { segment: "pro" },
    onboarding: null as any,
    isOnboardingComplete: false,
    saveOnboarding,
    onboardingEditLocked: false,
    onboardingNextEditableAt: null as any,
  }),
}));

// Step mocks interativos — expõem o novo contrato baseado em objetos { id, name }
vi.mock("@/components/onboarding/SpecialtyStep", () => ({
  SpecialtyStep: ({ selection, onSelect }: any) => (
    <div data-testid="specialty-step">
      <button
        onClick={() => onSelect({ id: "spec-1", name: "Clínica Médica" })}
      >
        Selecionar Clínica Médica
      </button>
      <span data-testid="selected-specialty-name">{selection?.name ?? ""}</span>
    </div>
  ),
}));
vi.mock("@/components/onboarding/InstitutionStep", () => ({
  InstitutionStep: ({ onToggleInstitution, onToggleUndecided }: any) => (
    <div data-testid="institution-step">
      <button onClick={() => onToggleInstitution({ id: "inst-1", name: "USP" })}>
        Selecionar USP
      </button>
      <button onClick={() => onToggleUndecided()}>Marcar indeciso</button>
    </div>
  ),
}));
vi.mock("@/components/onboarding/ConfirmationStep", () => ({
  ConfirmationStep: ({ specialtyName, institutionNames }: any) => (
    <div data-testid="confirmation-step">
      <span data-testid="confirmation-specialty">{specialtyName}</span>
      <span data-testid="confirmation-institutions">
        {institutionNames.join(",")}
      </span>
    </div>
  ),
}));
vi.mock("@/hooks/usePersistedState", async () => {
  const { useState } = await import("react");
  return {
    usePersistedState: (_key: string, initial: unknown) => useState(initial),
    clearPersistedStateByPrefix: vi.fn(),
  };
});
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn() }));
vi.mock("@/hooks/use-toast", () => ({ toast: toastMock }));
vi.mock("@/components/brand/BrandMark", () => ({
  BrandLogo: () => <span>Logo</span>,
}));
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, initial, animate, exit, transition, ...rest }: any) => (
      <div {...rest}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
  useReducedMotion: () => true,
}));

function Wrapper({ children }: { children: React.ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>;
}

beforeEach(() => {
  saveOnboarding.mockClear().mockResolvedValue(undefined);
  navigateMock.mockClear();
  toastMock.mockClear();
});

it("renders onboarding header and step 0 by default", () => {
  render(<OnboardingPage />, { wrapper: Wrapper });
  expect(screen.getByText("Logo")).toBeInTheDocument();
  expect(screen.getByTestId("specialty-step")).toBeInTheDocument();
});

it("renders Continuar button on step 0", () => {
  render(<OnboardingPage />, { wrapper: Wrapper });
  expect(screen.getByRole("button", { name: /continuar/i })).toBeInTheDocument();
});

describe("desktop left column", () => {
  it("renders step 0 title text in the DOM (left column)", () => {
    render(<OnboardingPage />, { wrapper: Wrapper });
    // STEP_META[0].title is rendered by the left column — always in DOM even if hidden via CSS
    const els = screen.getAllByText("Qual sua especialidade desejada?");
    expect(els.length).toBeGreaterThanOrEqual(1);
  });

  it("renders step 0 desktop tips in the DOM", () => {
    render(<OnboardingPage />, { wrapper: Wrapper });
    expect(
      screen.getByText("Aparece no seu ranking e comparativos")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Editável entre janelas de prova")
    ).toBeInTheDocument();
  });
});

describe("fluxo completo por ID canônico", () => {
  it("salva specialtyId e targetInstitutionIds ao concluir", async () => {
    render(<OnboardingPage />, { wrapper: Wrapper });

    // Step 0: seleciona especialidade (objeto { id, name })
    fireEvent.click(screen.getByText("Selecionar Clínica Médica"));
    expect(screen.getByTestId("selected-specialty-name")).toHaveTextContent(
      "Clínica Médica"
    );
    fireEvent.click(screen.getByRole("button", { name: /continuar/i }));

    // Step 1: seleciona instituição
    expect(screen.getByTestId("institution-step")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Selecionar USP"));
    fireEvent.click(screen.getByRole("button", { name: /continuar/i }));

    // Step 2: confirmação exibe nomes resolvidos
    expect(screen.getByTestId("confirmation-specialty")).toHaveTextContent(
      "Clínica Médica"
    );
    expect(screen.getByTestId("confirmation-institutions")).toHaveTextContent(
      "USP"
    );

    fireEvent.click(screen.getByRole("button", { name: /começar/i }));
    await waitFor(() =>
      expect(saveOnboarding).toHaveBeenCalledWith({
        specialtyId: "spec-1",
        targetInstitutionIds: ["inst-1"],
      })
    );
    expect(navigateMock).toHaveBeenCalledWith("/");
  });

  it("instituições indecisas salvam array vazio e mostram toast ao limpar seleção", async () => {
    render(<OnboardingPage />, { wrapper: Wrapper });

    fireEvent.click(screen.getByText("Selecionar Clínica Médica"));
    fireEvent.click(screen.getByRole("button", { name: /continuar/i }));

    // Seleciona uma instituição e depois marca indeciso — toast de remoção sobe da página
    fireEvent.click(screen.getByText("Selecionar USP"));
    fireEvent.click(screen.getByText("Marcar indeciso"));
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.stringContaining("Seleção anterior removida"),
      })
    );

    fireEvent.click(screen.getByRole("button", { name: /continuar/i }));
    fireEvent.click(screen.getByRole("button", { name: /começar/i }));
    await waitFor(() =>
      expect(saveOnboarding).toHaveBeenCalledWith({
        specialtyId: "spec-1",
        targetInstitutionIds: [],
      })
    );
  });
});
