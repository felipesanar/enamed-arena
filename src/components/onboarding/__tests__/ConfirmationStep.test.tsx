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
