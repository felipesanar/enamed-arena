import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { SpecialtyStep } from "../SpecialtyStep";

vi.mock("@/hooks/useEnamedData", () => ({
  useEnamedSpecialties: () => ({
    data: [{ name: "Clínica Médica" }, { name: "Cirurgia Geral" }],
    isLoading: false,
    isError: false,
  }),
}));

it("renders heading and search input", () => {
  render(<SpecialtyStep specialty="" onSelect={vi.fn()} />);
  expect(
    screen.getByText("Qual sua especialidade desejada?")
  ).toBeInTheDocument();
  expect(
    screen.getByPlaceholderText("Buscar especialidade...")
  ).toBeInTheDocument();
});

it("renders specialty options from data", () => {
  render(<SpecialtyStep specialty="" onSelect={vi.fn()} />);
  expect(screen.getByText("Clínica Médica")).toBeInTheDocument();
  expect(screen.getByText("Cirurgia Geral")).toBeInTheDocument();
});

it("calls onSelect when a specialty is clicked", async () => {
  const onSelect = vi.fn();
  render(<SpecialtyStep specialty="" onSelect={onSelect} />);
  screen.getByText("Clínica Médica").click();
  expect(onSelect).toHaveBeenCalledWith("Clínica Médica");
});

it("glyph area has lg:hidden class", () => {
  render(<SpecialtyStep specialty="" onSelect={vi.fn()} />);
  const glyphArea = document.querySelector(".shrink-0.lg\\:hidden");
  expect(glyphArea).toBeInTheDocument();
});
