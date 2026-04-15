import type { ErrorTypeKey } from "./errorTypes";

export interface NotebookEntry {
  id: string;
  questionId: string;
  simuladoId: string;
  simuladoTitle: string;
  questionNumber: number;
  questionText: string;
  area: string;
  theme: string;
  errorType: ErrorTypeKey;
  note: string | null;
  createdAt: string; // ISO
  resolvedAt: string | null; // ISO or null
}

// 8 pending + 4 resolved, 2 specialties, realistic dates
const BASE = "2026-04-";

export const MOCK_ENTRIES: NotebookEntry[] = [
  // --- PENDING ---
  {
    id: "e1",
    questionId: "q-101",
    simuladoId: "sim-3",
    simuladoTitle: "ENAMED Simulado 3",
    questionNumber: 12,
    questionText:
      "Paciente de 45 anos com dor torácica em repouso, irradiação para mandíbula e diaforese. ECG mostra supradesnivelamento em V1-V4. A conduta imediata é:",
    area: "Cardiologia",
    theme: "IAM com supra de ST",
    errorType: "lacuna",
    note: "Revisar critérios de Killip e conduta no IAMCSST",
    createdAt: BASE + "05T10:00:00Z",
    resolvedAt: null,
  },
  {
    id: "e2",
    questionId: "q-102",
    simuladoId: "sim-3",
    simuladoTitle: "ENAMED Simulado 3",
    questionNumber: 28,
    questionText:
      "Qual o mecanismo de resistência mais comum do S. aureus à oxacilina?",
    area: "Infectologia",
    theme: "Resistência bacteriana — MRSA",
    errorType: "lacuna",
    note: null,
    createdAt: BASE + "06T08:30:00Z",
    resolvedAt: null,
  },
  {
    id: "e3",
    questionId: "q-103",
    simuladoId: "sim-4",
    simuladoTitle: "ENAMED Simulado 4",
    questionNumber: 7,
    questionText:
      "Homem de 60 anos com dispneia aos mínimos esforços, edema de membros inferiores e BNP = 1200 pg/mL. A fração de ejeção é de 35%. O diagnóstico é:",
    area: "Cardiologia",
    theme: "Insuficiência cardíaca sistólica",
    errorType: "diferencial",
    note: "Confundi critérios de Boston com Framingham",
    createdAt: BASE + "07T14:00:00Z",
    resolvedAt: null,
  },
  {
    id: "e4",
    questionId: "q-104",
    simuladoId: "sim-4",
    simuladoTitle: "ENAMED Simulado 4",
    questionNumber: 19,
    questionText:
      "Paciente HIV+ com contagem de CD4 = 80 células/mm³ apresenta febre, cefaleia e rigidez de nuca. LCR com tinta da China positivo. O tratamento é:",
    area: "Infectologia",
    theme: "Criptococose em imunossuprimido",
    errorType: "memoria",
    note: null,
    createdAt: BASE + "08T09:00:00Z",
    resolvedAt: null,
  },
  {
    id: "e5",
    questionId: "q-105",
    simuladoId: "sim-4",
    simuladoTitle: "ENAMED Simulado 4",
    questionNumber: 44,
    questionText:
      "Qual a definição correta de hipertensão arterial estágio 2 segundo as diretrizes brasileiras de 2023?",
    area: "Cardiologia",
    theme: "Hipertensão — classificação",
    errorType: "diferencial",
    note: "Estágio 1 vs 2 — diferença nas metas terapêuticas",
    createdAt: BASE + "09T11:30:00Z",
    resolvedAt: null,
  },
  {
    id: "e6",
    questionId: "q-106",
    simuladoId: "sim-5",
    simuladoTitle: "ENAMED Simulado 5",
    questionNumber: 3,
    questionText:
      "Mulher de 28 anos apresenta febre há 5 dias, adenopatia cervical e esplenomegalia. Monoteste positivo. A complicação mais temida é:",
    area: "Infectologia",
    theme: "Mononucleose infecciosa",
    errorType: "atencao",
    note: "Li 'mais comum' em vez de 'mais temida'",
    createdAt: BASE + "10T16:00:00Z",
    resolvedAt: null,
  },
  {
    id: "e7",
    questionId: "q-107",
    simuladoId: "sim-5",
    simuladoTitle: "ENAMED Simulado 5",
    questionNumber: 31,
    questionText:
      "Em relação ao tratamento da tuberculose latente, indique a afirmativa correta:",
    area: "Infectologia",
    theme: "Tuberculose latente — ILTB",
    errorType: "lacuna",
    note: null,
    createdAt: BASE + "11T10:15:00Z",
    resolvedAt: null,
  },
  {
    id: "e8",
    questionId: "q-108",
    simuladoId: "sim-5",
    simuladoTitle: "ENAMED Simulado 5",
    questionNumber: 55,
    questionText:
      "Paciente com FA de início recente (< 48h), FC = 130 bpm, PA = 90/60 mmHg. Qual a conduta imediata?",
    area: "Cardiologia",
    theme: "Fibrilação atrial — instabilidade hemodinâmica",
    errorType: "diferencial",
    note: "Cardioversão elétrica vs farmacológica — critérios de instabilidade",
    createdAt: BASE + "12T13:00:00Z",
    resolvedAt: null,
  },
  // --- RESOLVED ---
  {
    id: "e9",
    questionId: "q-91",
    simuladoId: "sim-2",
    simuladoTitle: "ENAMED Simulado 2",
    questionNumber: 8,
    questionText:
      "Criança de 3 anos com febre alta, exantema morbiliforme e manchas de Koplik. O diagnóstico mais provável é:",
    area: "Infectologia",
    theme: "Sarampo",
    errorType: "memoria",
    note: null,
    createdAt: BASE + "01T09:00:00Z",
    resolvedAt: BASE + "08T10:00:00Z",
  },
  {
    id: "e10",
    questionId: "q-92",
    simuladoId: "sim-2",
    simuladoTitle: "ENAMED Simulado 2",
    questionNumber: 22,
    questionText:
      "Paciente com choque séptico, PAM < 65 mmHg após 30 mL/kg de cristaloide. O vasopressor de primeira escolha é:",
    area: "Cardiologia",
    theme: "Choque séptico — vasopressores",
    errorType: "lacuna",
    note: "Norepinefrina como 1ª linha confirmada",
    createdAt: BASE + "02T14:00:00Z",
    resolvedAt: BASE + "09T11:00:00Z",
  },
  {
    id: "e11",
    questionId: "q-93",
    simuladoId: "sim-3",
    simuladoTitle: "ENAMED Simulado 3",
    questionNumber: 40,
    questionText:
      "Homem com HIV, carga viral indetectável há 2 anos, CD4 = 350. Viaja para área endêmica de malária. Qual a profilaxia indicada?",
    area: "Infectologia",
    theme: "HIV — profilaxias em viagens",
    errorType: "guessed_correctly",
    note: "Acertei mas revisei — atovaquona/proguanil como opção",
    createdAt: BASE + "03T11:00:00Z",
    resolvedAt: BASE + "10T09:00:00Z",
  },
  {
    id: "e12",
    questionId: "q-94",
    simuladoId: "sim-3",
    simuladoTitle: "ENAMED Simulado 3",
    questionNumber: 61,
    questionText:
      "Paciente com síncope durante exercício, sopro sistólico que aumenta com Valsalva. O diagnóstico é:",
    area: "Cardiologia",
    theme: "Cardiomiopatia hipertrófica obstrutiva",
    errorType: "diferencial",
    note: null,
    createdAt: BASE + "04T15:00:00Z",
    resolvedAt: BASE + "11T14:00:00Z",
  },
];
