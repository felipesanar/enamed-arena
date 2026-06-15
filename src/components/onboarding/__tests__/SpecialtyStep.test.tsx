import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { SpecialtyStep } from "../SpecialtyStep";

vi.mock("@/hooks/useEnamedData", () => ({
  useEnamedSpecialties: () => ({
    data: [
      { id: "spec-cm", name: "Clínica Médica", slug: "clinica-medica" },
      { id: "spec-cg", name: "Cirurgia Geral", slug: "cirurgia-geral" },
    ],
    isLoading: false,
    isError: false,
  }),
}));

it("renders heading and search input", () => {
  render(<SpecialtyStep selection={null} onSelect={vi.fn()} />);
  expect(
    screen.getByText("Qual sua especialidade desejada?")
  ).toBeInTheDocument();
  expect(
    screen.getByPlaceholderText("Buscar especialidade...")
  ).toBeInTheDocument();
});

it("renders specialty options from data", () => {
  render(<SpecialtyStep selection={null} onSelect={vi.fn()} />);
  expect(screen.getByText("Clínica Médica")).toBeInTheDocument();
  expect(screen.getByText("Cirurgia Geral")).toBeInTheDocument();
});

it("calls onSelect with the full selection when a specialty is clicked", async () => {
  const onSelect = vi.fn();
  render(<SpecialtyStep selection={null} onSelect={onSelect} />);
  screen.getByText("Clínica Médica").click();
  expect(onSelect).toHaveBeenCalledWith({ id: "spec-cm", name: "Clínica Médica" });
});

it('calls onSelect with id null for "Ainda não sei"', () => {
  const onSelect = vi.fn();
  render(<SpecialtyStep selection={null} onSelect={onSelect} />);
  screen.getByText("Ainda não sei").click();
  expect(onSelect).toHaveBeenCalledWith({ id: null, name: "Ainda não sei" });
});

it("glyph area has lg:hidden class", () => {
  render(<SpecialtyStep selection={null} onSelect={vi.fn()} />);
  const glyphArea = document.querySelector(".shrink-0.lg\\:hidden");
  expect(glyphArea).toBeInTheDocument();
});
