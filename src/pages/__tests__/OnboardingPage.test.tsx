import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import OnboardingPage from "../OnboardingPage";

vi.mock("@/contexts/UserContext", () => ({
  useUser: () => ({
    profile: { segment: "pro" },
    onboarding: null,
    isOnboardingComplete: false,
    saveOnboarding: vi.fn(),
    onboardingEditLocked: false,
    onboardingNextEditableAt: null,
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
  BrandIcon: () => <span>B</span>,
}));

function Wrapper({ children }: { children: React.ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>;
}

it("renders brand header and step 0 by default", () => {
  render(<OnboardingPage />, { wrapper: Wrapper });
  expect(screen.getByText("PRO: ENAMED")).toBeInTheDocument();
  expect(screen.getByTestId("specialty-step")).toBeInTheDocument();
});

it("renders Continuar button on step 0", () => {
  render(<OnboardingPage />, { wrapper: Wrapper });
  expect(screen.getByRole("button", { name: /continuar/i })).toBeInTheDocument();
});
