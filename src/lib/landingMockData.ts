/**
 * Dados simulados plausíveis para a landing — ranking, próximo simulado e linhas de “vivo”.
 * Mantém aparência de produto real e ecossistema vivo sem dados caricatos.
 */

export type RankingPreviewRow = {
  position: number;
  name: string;
  specialty: string;
  score: number;
  variation: string;
  /** Linha do visitante — destaque visual na landing. */
  isYou?: boolean;
};

export const RANKING_PREVIEW_ROWS: readonly RankingPreviewRow[] = [
  { position: 1, name: "Ana C. M.", specialty: "Clínica Médica", score: 94, variation: "—" },
  { position: 2, name: "Você", specialty: "Clínica Médica", score: 91, variation: "+12", isYou: true },
  { position: 3, name: "Lucas R.", specialty: "Pediatria", score: 90, variation: "+2" },
  { position: 4, name: "Marina S.", specialty: "Clínica Médica", score: 89, variation: "-1" },
  { position: 5, name: "Pedro F.", specialty: "Cirurgia", score: 87, variation: "+5" },
  { position: 6, name: "Julia T.", specialty: "Clínica Médica", score: 86, variation: "—" },
];

export const NEXT_SIMULADO = {
  title: "Clínica Médica",
  questions: 120,
  date: "12 de abril",
  inscritos: "2.847",
} as const;

export const LIVE_FEEDBACK_LINES = [
  "Resultado liberado para 1.203 alunos no último simulado.",
  "Ranking atualizado há 2 horas.",
  "2.847 inscritos no próximo simulado.",
] as const;
