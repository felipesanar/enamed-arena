import { render, screen, fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import { InstitutionStep } from "../InstitutionStep";

vi.mock("@/hooks/useEnamedData", () => ({
  useInstitutionsBySpecialty: () => ({
    grouped: {
      SP: [
        {
          id: "1",
          name: "USP — Faculdade de Medicina",
          uf: "SP",
          vagas: 12,
          cenario_pratica: "Hospital das Clínicas",
        },
      ],
    },
    flat: [
      {
        id: "1",
        name: "USP — Faculdade de Medicina",
        uf: "SP",
        vagas: 12,
        cenario_pratica: null as string | null,
      },
    ],
  }),
}));

const SPECIALTY = { id: "spec-1", name: "Clínica Médica" };

const defaultProps = {
  selected: [],
  undecided: false,
  onToggleInstitution: vi.fn(),
  onToggleUndecided: vi.fn(),
  selectedSpecialty: SPECIALTY,
};

it("renders heading", () => {
  render(<InstitutionStep {...defaultProps} />);
  expect(
    screen.getByText("Quais instituições você deseja?")
  ).toBeInTheDocument();
});

it("shows undecided option", () => {
  render(<InstitutionStep {...defaultProps} />);
  expect(screen.getByText("Ainda não sei")).toBeInTheDocument();
});

it("calls onToggleUndecided when undecided option is clicked", () => {
  const onToggleUndecided = vi.fn();
  render(
    <InstitutionStep {...defaultProps} onToggleUndecided={onToggleUndecided} />
  );
  fireEvent.click(screen.getByText("Ainda não sei"));
  expect(onToggleUndecided).toHaveBeenCalledTimes(1);
});

it("shows selected institution chip when selected", () => {
  render(
    <InstitutionStep
      {...defaultProps}
      selected={[{ id: "1", name: "USP — Faculdade de Medicina" }]}
    />
  );
  // Selected chip appears at top
  const chips = screen.getAllByText("USP — Faculdade de Medicina");
  expect(chips.length).toBeGreaterThanOrEqual(1);
});

it("toggles institution with { id, name } object", () => {
  const onToggleInstitution = vi.fn();
  render(
    <InstitutionStep
      {...defaultProps}
      onToggleInstitution={onToggleInstitution}
    />
  );
  // UF group starts collapsed — expand SP first
  fireEvent.click(screen.getByText("SP"));
  fireEvent.click(screen.getByText("USP — Faculdade de Medicina"));
  expect(onToggleInstitution).toHaveBeenCalledWith({
    id: "1",
    name: "USP — Faculdade de Medicina",
  });
});

it("glyph area has lg:hidden class", () => {
  render(<InstitutionStep {...defaultProps} />);
  const glyphArea = document.querySelector(".shrink-0.lg\\:hidden");
  expect(glyphArea).toBeInTheDocument();
});
