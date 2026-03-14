// ─── User Segments ───
export type UserSegment = 'guest' | 'standard' | 'pro';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  segment: UserSegment;
  avatarUrl?: string;
}

export interface OnboardingProfile {
  userId: string;
  specialty: string;
  targetInstitutions: string[];
  completedAt?: string;
}

// ─── Simulado ───
export type SimuladoStatus = 'available' | 'upcoming' | 'completed' | 'locked' | 'live' | 'in_progress';

export interface SimuladoWindow {
  start: string; // ISO date
  end: string;   // ISO date
}

export interface Simulado {
  id: string;
  title: string;
  number: number;
  date: string;
  status: SimuladoStatus;
  questions: number;
  duration: string;
  window?: SimuladoWindow;
  score?: number;
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
  options: QuestionOption[];
  correctOptionId: string;
  explanation?: string;
}

export interface QuestionAnswer {
  questionId: string;
  selectedOptionId: string | null;
  mark: QuestionMark;
  timeSpent: number; // seconds
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
  guest: 'Não Aluno',
  standard: 'SanarFlix Padrão',
  pro: 'PRO: ENAMED',
};

export const SEGMENT_ACCESS = {
  guest: {
    simulados: true,
    ranking: true,
    comparativo: false,
    cadernoErros: false,
  },
  standard: {
    simulados: true,
    ranking: true,
    comparativo: true,
    cadernoErros: false,
  },
  pro: {
    simulados: true,
    ranking: true,
    comparativo: true,
    cadernoErros: true,
  },
} as const;
