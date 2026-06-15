import { render, screen, fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import { AcademicProfileEditor } from "../AcademicProfileEditor";
import { UNDECIDED_LABEL } from "@/lib/academic-profile";

const SPECIALTIES = [
  { id: "spec-1", name: "Clínica Médica", slug: "clinica-medica" },
  { id: "spec-2", name: "Cirurgia Geral", slug: "cirurgia-geral" },
];

const INSTITUTIONS = [
  { id: "inst-a", name: "Hospital Alfa", uf: "SP", vagas: 12, cenario_pratica: "Hospital das Clínicas" },
  { id: "inst-b", name: "Hospital Beta", uf: "SP", vagas: 8, cenario_pratica: null as string | null },
  { id: "inst-c", name: "Hospital Gama", uf: "RJ", vagas: 5, cenario_pratica: null as string | null },
  { id: "inst-d", name: "Hospital Delta", uf: "RJ", vagas: 3, cenario_pratica: null as string | null },
];

vi.mock("@/hooks/useEnamedData", () => ({
  useEnamedSpecialties: () => ({
    data: SPECIALTIES,
    isLoading: false,
  }),
  useInstitutionsBySpecialty: () => ({
    grouped: {
      SP: INSTITUTIONS.filter((i) => i.uf === "SP"),
      RJ: INSTITUTIONS.filter((i) => i.uf === "RJ"),
    },
    flat: INSTITUTIONS,
  }),
}));

function setup(overrides: Partial<React.ComponentProps<typeof AcademicProfileEditor>> = {}) {
  const onSave = vi.fn().mockResolvedValue(undefined);
  const onCancel = vi.fn();
  const utils = render(
    <AcademicProfileEditor
      initialSpecialty={null}
      initialInstitutions={[]}
      onSave={onSave}
      onCancel={onCancel}
      {...overrides}
    />
  );
  return { onSave, onCancel, ...utils };
}

const saveButton = () => screen.getByRole("button", { name: /salvar/i });

// O label "Ainda não sei" aparece na lista de especialidades (1ª) e como
// toggle de instituições (última ocorrência).
const undecidedInstitutionsButton = () => {
  const all = screen.getAllByText(UNDECIDED_LABEL);
  return all[all.length - 1];
};

const clickInstitution = (name: string) => {
  fireEvent.click(screen.getByText(name).closest("button")!);
};

it("salva especialidade + instituição selecionadas com payload de IDs", () => {
  const { onSave } = setup();

  fireEvent.click(screen.getByText("Clínica Médica"));
  clickInstitution("Hospital Alfa");
  fireEvent.click(saveButton());

  expect(onSave).toHaveBeenCalledTimes(1);
  expect(onSave).toHaveBeenCalledWith({
    specialtyId: "spec-1",
    targetInstitutionIds: ["inst-a"],
  });
});

it('"Ainda não sei" (instituições) limpa a seleção e salva targetInstitutionIds vazio', () => {
  const { onSave } = setup();

  fireEvent.click(screen.getByText("Clínica Médica"));
  clickInstitution("Hospital Alfa");
  clickInstitution("Hospital Beta");

  fireEvent.click(undecidedInstitutionsButton());
  fireEvent.click(saveButton());

  expect(onSave).toHaveBeenCalledTimes(1);
  expect(onSave).toHaveBeenCalledWith({
    specialtyId: "spec-1",
    targetInstitutionIds: [],
  });
});

it("sem mudanças em relação ao estado inicial, Salvar fica desabilitado", () => {
  setup({
    initialSpecialty: { id: "spec-1", name: "Clínica Médica" },
    initialInstitutions: [{ id: "inst-a", name: "Hospital Alfa" }],
  });

  expect(saveButton()).toBeDisabled();
});

it("trocar especialidade reseta instituições e desabilita Salvar até nova escolha", () => {
  setup({
    initialSpecialty: { id: "spec-1", name: "Clínica Médica" },
    initialInstitutions: [{ id: "inst-a", name: "Hospital Alfa" }],
  });

  fireEvent.click(screen.getByText("Cirurgia Geral"));

  // Instituições resetadas e indeciso desmarcado → não dá para salvar ainda.
  expect(saveButton()).toBeDisabled();

  clickInstitution("Hospital Beta");
  expect(saveButton()).not.toBeDisabled();
});

it("com 3 instituições selecionadas, a 4ª fica desabilitada e não entra no payload", () => {
  const { onSave } = setup();

  fireEvent.click(screen.getByText("Clínica Médica"));
  clickInstitution("Hospital Alfa");
  clickInstitution("Hospital Beta");
  clickInstitution("Hospital Gama");

  const fourth = screen.getByText("Hospital Delta").closest("button")!;
  expect(fourth).toBeDisabled();
  fireEvent.click(fourth);

  fireEvent.click(saveButton());

  expect(onSave).toHaveBeenCalledTimes(1);
  expect(onSave).toHaveBeenCalledWith({
    specialtyId: "spec-1",
    targetInstitutionIds: ["inst-a", "inst-b", "inst-c"],
  });
});
