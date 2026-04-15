import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ToastProvider } from "../ui/ToastProvider";
import { AddToNotebookModal } from "./AddToNotebookModal/index";

const BASE_PROPS = {
  open: true,
  onClose: vi.fn(),
  questionId: "q-1",
  simuladoId: "sim-1",
  simuladoTitle: "ENAMED Simulado 1",
  area: "Cardiologia",
  theme: "IAM",
  questionNumber: 12,
  questionText: "Qual conduta no IAM?",
  wasCorrect: false,
  userId: "user-1",
  onAdded: vi.fn(),
};

function renderModal(props = {}) {
  return render(
    <ToastProvider>
      <AddToNotebookModal {...BASE_PROPS} {...props} />
    </ToastProvider>
  );
}

describe("AddToNotebookModal", () => {
  it("renders 4 reason cards when wasCorrect=false", () => {
    renderModal();
    expect(screen.getAllByRole("radio")).toHaveLength(4);
  });

  it("renders 1 reason card when wasCorrect=true", () => {
    renderModal({ wasCorrect: true });
    expect(screen.getAllByRole("radio")).toHaveLength(1);
  });

  it("shows correct banner when wasCorrect=true", () => {
    renderModal({ wasCorrect: true });
    expect(screen.getByText(/Acertou por exclusão ou intuição/i)).toBeInTheDocument();
  });

  it("continue button is disabled when no reason selected", () => {
    renderModal();
    const btn = screen.getByRole("button", { name: /continuar/i });
    expect(btn).toBeDisabled();
  });

  it("selecting a reason enables continue button", () => {
    renderModal();
    const cards = screen.getAllByRole("radio");
    fireEvent.click(cards[0]);
    const btn = screen.getByRole("button", { name: /continuar/i });
    expect(btn).not.toBeDisabled();
  });

  it("clicking continue advances to step 2", async () => {
    renderModal();
    const cards = screen.getAllByRole("radio");
    fireEvent.click(cards[0]);
    const continueBtn = screen.getByRole("button", { name: /continuar/i });
    expect(continueBtn).not.toBeDisabled();
    fireEvent.click(continueBtn);
    // step 2 renders the save button — wait for it
    const { waitFor } = await import("@testing-library/react");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /salvar/i })).toBeInTheDocument()
    );
  });

  it("shows duplicate banner when existingEntry is provided", () => {
    renderModal({
      existingEntry: { reason: "Não sei o conceito", addedAt: "2026-04-10T10:00:00Z" },
    });
    expect(screen.getByText(/Já está no Caderno/i)).toBeInTheDocument();
  });

  it("calls onClose when backdrop is clicked", () => {
    const onClose = vi.fn();
    renderModal({ onClose });
    // backdrop is the first sibling before dialog
    const dialog = screen.getByRole("dialog");
    fireEvent.click(dialog.previousElementSibling!);
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose when escape is pressed", () => {
    const onClose = vi.fn();
    renderModal({ onClose });
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("does not render when open=false", () => {
    renderModal({ open: false });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
