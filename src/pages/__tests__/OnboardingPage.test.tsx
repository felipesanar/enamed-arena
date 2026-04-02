import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import OnboardingPage from "../OnboardingPage";

vi.mock("@/contexts/UserContext", () => ({
  useUser: () => ({
    profile: { segment: "pro" },
    onboarding: null as any,
    isOnboardingComplete: false,
    saveOnboarding: vi.fn(),
    onboardingEditLocked: false,
    onboardingNextEditableAt: null as any,
  }),
}));
vi.mock("@/components/onboarding/SpecialtyStep", () => ({
  SpecialtyStep: () => <div data-testid="specialty-step">SpecialtyStep</div>,
}));
vi.mock("@/components/onboarding/InstitutionStep", () => ({
  InstitutionStep: () => <div data-testid="institution-step">InstitutionStep</div>,
}));
vi.mock("@/components/onboarding/ConfirmationStep", () => ({
  ConfirmationStep: () => <div data-testid="confirmation-step">ConfirmationStep</div>,
}));
vi.mock("@/hooks/usePersistedState", () => ({
  usePersistedState: (_key: string, initial: unknown) => [initial, vi.fn()],
  clearPersistedStateByPrefix: vi.fn(),
}));
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn() }));
vi.mock("@/components/brand/BrandMark", () => ({
  BrandLogo: () => <span>Logo</span>,
}));

function Wrapper({ children }: { children: React.ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>;
}

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
