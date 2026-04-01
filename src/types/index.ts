// ─── User Segments ───
export type UserSegment = 'guest' | 'standard' | 'pro';
export type OnboardingStatus = 'pending' | 'completed';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  segment: UserSegment;
  avatarUrl?: string;
}

export interface OnboardingProfile {
  id?: string;
  userId: string;
  specialty: string;
  targetInstitutions: string[];
  status: OnboardingStatus;
  completedAt?: string;
}

export interface OnboardingState {
  profile: UserProfile | null;
  onboarding: OnboardingProfile | null;
  isOnboardingComplete: boolean;
  isLoading: boolean;
}

// ─── Simulado ───
export type SimuladoStatus =
  | 'upcoming'           // Before window opens
  | 'available'          // Window is open, can start
  | 'available_late'     // Window closed, simulado still available; attempt does not count for ranking
  | 'in_progress'        // User has started
  | 'closed_waiting'     // Window closed, results not yet released
  | 'results_available'  // Results released
  | 'completed';         // User finished and results seen

export interface SimuladoConfig {
  id: string;
  slug: string;
  title: string;
  sequenceNumber: number;
  description: string;
  questionsCount: number;
  estimatedDuration: string; // e.g. "5h"
  estimatedDurationMinutes: number;
  executionWindowStart: string; // ISO
  executionWindowEnd: string;   // ISO
  resultsReleaseAt: string;     // ISO
  themeTags: string[];
}

export interface SimuladoUserState {
  simuladoId: string;
  started: boolean;
  startedAt?: string;
  finished: boolean;
  finishedAt?: string;
  score?: number;
}

export interface SimuladoWithStatus extends SimuladoConfig {
  status: SimuladoStatus;
  userState?: SimuladoUserState;
}

// ─── Questions ───
export type QuestionMark = 'review' | 'high_confidence' | null;

export interface QuestionOption {
  id: string;
  label: string;
  text: string;
}

export interface Question {
  id: string;
  number: number;
  text: string;
  area: string;
  theme: string;
  difficulty?: string | null;
  imageUrl?: string | null;
  options: QuestionOption[];
  correctOptionId: string;
  explanation?: string;
}

export interface QuestionAnswer {
  questionId: string;
  selectedOptionId: string | null;
  mark: QuestionMark;
  timeSpent: number;
}

// ─── Performance ───
export interface AreaPerformance {
  area: string;
  score: number;
  questions: number;
  correct: number;
}

export interface SimuladoResult {
  simuladoId: string;
  totalScore: number;
  totalQuestions: number;
  totalCorrect: number;
  areas: AreaPerformance[];
  completedAt: string;
}

// ─── Ranking ───
export interface RankingEntry {
  position: number;
  name: string;
  score: number;
  institution: string;
  isCurrentUser?: boolean;
}

// ─── Constants ───
export const SEGMENT_LABELS: Record<UserSegment, string> = {
  guest: 'Visitante',
  standard: 'Aluno SanarFlix',
  pro: 'Aluno PRO',
};

export const SEGMENT_DESCRIPTIONS: Record<UserSegment, string> = {
  guest: 'Acesse simulados e ranking. Crie sua conta para personalizar a experiência.',
  standard: 'Acesse simulados, ranking e comparativos entre simulados.',
  pro: 'Acesso completo: simulados, ranking, comparativos e Caderno de Erros.',
};

export const SEGMENT_ACCESS = {
  guest: { simulados: true, ranking: true, comparativo: false, cadernoErros: false },
  standard: { simulados: true, ranking: true, comparativo: true, cadernoErros: false },
  pro: { simulados: true, ranking: true, comparativo: true, cadernoErros: true },
} as const;

export const MIN_INSTITUTIONS_GUEST = 3;
