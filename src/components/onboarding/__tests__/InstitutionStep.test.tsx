import { render, screen } from "@testing-library/react";
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
        cenario_pratica: null,
      },
    ],
  }),
}));

it("renders heading", () => {
  render(
    <InstitutionStep
      selected={[]}
      onToggle={vi.fn()}
      selectedSpecialty="Clínica Médica"
    />
  );
  expect(
    screen.getByText("Quais instituições você deseja?")
  ).toBeInTheDocument();
});

it("shows undecided option", () => {
  render(
    <InstitutionStep
      selected={[]}
      onToggle={vi.fn()}
      selectedSpecialty="Clínica Médica"
    />
  );
  expect(screen.getByText("Ainda não sei")).toBeInTheDocument();
});

it("shows selected institution chip when selected", () => {
  render(
    <InstitutionStep
      selected={["USP — Faculdade de Medicina"]}
      onToggle={vi.fn()}
      selectedSpecialty="Clínica Médica"
    />
  );
  // Selected chip appears at top
  const chips = screen.getAllByText("USP — Faculdade de Medicina");
  expect(chips.length).toBeGreaterThanOrEqual(1);
});
