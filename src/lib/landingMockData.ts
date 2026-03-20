/**
 * Dados simulados plausíveis para a landing — ranking, próximo simulado, stats e feedbacks.
 * Mantém aparência de produto real e ecossistema vivo sem dados caricatos.
 */

export const RANKING_PREVIEW_ROWS = [
  { position: 1, name: "Ana C. M.", specialty: "Clínica Médica", score: 94, variation: "—" },
  { position: 2, name: "Lucas R.", specialty: "Pediatria", score: 92, variation: "+2" },
  { position: 3, name: "Marina S.", specialty: "Clínica Médica", score: 91, variation: "-1" },
  { position: 4, name: "Você", specialty: "Clínica Médica", score: 87, variation: "+12", highlight: true },
  { position: 5, name: "Pedro F.", specialty: "Cirurgia", score: 86, variation: "+5" },
  { position: 6, name: "Julia T.", specialty: "Clínica Médica", score: 85, variation: "—" },
] as const;

export const NEXT_SIMULADO = {
  title: "Clínica Médica",
  questions: 120,
  date: "12 de abril",
  inscritos: "2.847",
} as const;

export const SOCIAL_PROOF_STATS = [
  { value: "2.4k+", label: "alunos ativos no último mês" },
  { value: "340+", label: "simulados realizados em março" },
  { value: "12", label: "especialidades com ranking dedicado" },
] as const;

export const LIVE_FEEDBACK_LINES = [
  "Resultado liberado para 1.203 alunos no último simulado.",
  "Ranking atualizado há 2 horas.",
  "2.847 inscritos no próximo simulado.",
] as const;
