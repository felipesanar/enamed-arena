import { render, screen } from "@testing-library/react";
import { ConfirmationStep } from "../ConfirmationStep";

it("renders confirmation heading", () => {
  render(
    <ConfirmationStep
      segment="pro"
      specialty="Clínica Médica"
      institutions={["USP", "UNIFESP"]}
    />
  );
  expect(screen.getByText("Tudo pronto!")).toBeInTheDocument();
});

it("shows specialty and institutions", () => {
  render(
    <ConfirmationStep
      segment="pro"
      specialty="Clínica Médica"
      institutions={["USP", "UNIFESP"]}
    />
  );
  expect(screen.getByText("Clínica Médica")).toBeInTheDocument();
  expect(screen.getByText("USP")).toBeInTheDocument();
  expect(screen.getByText("UNIFESP")).toBeInTheDocument();
});

it("glyph area has lg:hidden class", () => {
  render(
    <ConfirmationStep segment="standard" specialty="Clínica Médica" institutions={["USP"]} />
  );
  const glyphArea = document.querySelector(".shrink-0.lg\\:hidden");
  expect(glyphArea).toBeInTheDocument();
});

it("cards container has lg:grid-cols-3 class", () => {
  render(
    <ConfirmationStep segment="standard" specialty="Clínica Médica" institutions={["USP"]} />
  );
  const cardsContainer = document.querySelector(".lg\\:grid-cols-3");
  expect(cardsContainer).toBeInTheDocument();
});
