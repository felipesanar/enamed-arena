/**
 * Result calculation helpers — computes scores, area/theme breakdowns, and mock ranking.
 * Based on SanarFlix Academy's performance aggregation patterns.
 */

import type { ExamState } from '@/types/exam';
import type { Question, AreaPerformance } from '@/types';

// ─── Score Computation ───

export interface QuestionResult {
  questionId: string;
  area: string;
  theme: string;
  isCorrect: boolean;
  wasAnswered: boolean;
  selectedOptionId: string | null;
  correctOptionId: string;
  markedForReview: boolean;
  highConfidence: boolean;
}

export interface SimuladoScore {
  totalQuestions: number;
  totalAnswered: number;
  totalCorrect: number;
  totalIncorrect: number;
  totalUnanswered: number;
  percentageScore: number;
  questionResults: QuestionResult[];
}

export interface ThemePerformance {
  theme: string;
  area: string;
  total: number;
  correct: number;
  score: number;
}

export interface PerformanceBreakdown {
  overall: SimuladoScore;
  byArea: AreaPerformance[];
  byTheme: ThemePerformance[];
}

export function computeSimuladoScore(
  state: ExamState,
  questions: Question[],
): SimuladoScore {
  const questionResults: QuestionResult[] = questions.map(q => {
    const answer = state.answers[q.id];
    const wasAnswered = !!answer?.selectedOption;
    const isCorrect = wasAnswered && answer.selectedOption === q.correctOptionId;

    return {
      questionId: q.id,
      area: q.area,
      theme: q.theme,
      isCorrect,
      wasAnswered,
      selectedOptionId: answer?.selectedOption ?? null,
      correctOptionId: q.correctOptionId,
      markedForReview: answer?.markedForReview ?? false,
      highConfidence: answer?.highConfidence ?? false,
    };
  });

  const totalCorrect = questionResults.filter(r => r.isCorrect).length;
  const totalAnswered = questionResults.filter(r => r.wasAnswered).length;

  return {
    totalQuestions: questions.length,
    totalAnswered,
    totalCorrect,
    totalIncorrect: totalAnswered - totalCorrect,
    totalUnanswered: questions.length - totalAnswered,
    percentageScore: questions.length > 0 ? Math.round((totalCorrect / questions.length) * 100) : 0,
    questionResults,
  };
}

export function computePerformanceBreakdown(
  state: ExamState,
  questions: Question[],
): PerformanceBreakdown {
  const overall = computeSimuladoScore(state, questions);

  // Group by area
  const areaMap = new Map<string, { total: number; correct: number }>();
  overall.questionResults.forEach(r => {
    const entry = areaMap.get(r.area) || { total: 0, correct: 0 };
    entry.total++;
    if (r.isCorrect) entry.correct++;
    areaMap.set(r.area, entry);
  });

  const byArea: AreaPerformance[] = Array.from(areaMap.entries())
    .map(([area, data]) => ({
      area,
      score: data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0,
      questions: data.total,
      correct: data.correct,
    }))
    .sort((a, b) => b.score - a.score);

  // Group by theme
  const themeMap = new Map<string, { area: string; total: number; correct: number }>();
  overall.questionResults.forEach(r => {
    const key = `${r.area}::${r.theme}`;
    const entry = themeMap.get(key) || { area: r.area, total: 0, correct: 0 };
    entry.total++;
    if (r.isCorrect) entry.correct++;
    themeMap.set(key, entry);
  });

  const byTheme: ThemePerformance[] = Array.from(themeMap.entries()).map(([key, data]) => {
    const [area, theme] = key.split('::');
    return {
      theme: theme || area,
      area,
      total: data.total,
      correct: data.correct,
      score: data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0,
    };
  }).sort((a, b) => b.score - a.score);

  return { overall, byArea, byTheme };
}

// ─── Mock Ranking Generation ───

export interface RankingParticipant {
  position: number;
  name: string;
  score: number;
  specialty: string;
  institution: string;
  segment: 'guest' | 'standard' | 'pro';
  isCurrentUser?: boolean;
}

const MOCK_NAMES = [
  'Ana C.', 'Lucas M.', 'Maria S.', 'João P.', 'Carla D.', 'Pedro H.', 'Beatriz R.',
  'Rafael A.', 'Juliana F.', 'Thiago L.', 'Fernanda O.', 'Bruno G.', 'Camila V.',
  'Diego N.', 'Amanda K.', 'Gabriel T.', 'Larissa B.', 'Marcos E.', 'Natália W.',
  'Felipe S.', 'Isabela M.', 'Rodrigo C.', 'Patricia L.', 'Eduardo R.', 'Vanessa P.',
  'Leonardo D.', 'Tatiana F.', 'Ricardo H.', 'Daniela A.', 'Gustavo J.',
];

const MOCK_SPECIALTIES = [
  'Clínica Médica', 'Cirurgia Geral', 'Pediatria', 'Ginecologia e Obstetrícia',
  'Ortopedia', 'Cardiologia', 'Dermatologia', 'Medicina de Família',
];

const MOCK_INSTITUTIONS = [
  'USP', 'UNICAMP', 'UFMG', 'UFRJ', 'UFBA', 'UnB', 'UFPE', 'UFPR',
  'UFSC', 'UFRGS', 'UNIFESP', 'USP-RP',
];

const MOCK_SEGMENTS: Array<'guest' | 'standard' | 'pro'> = ['guest', 'standard', 'pro'];

export function generateMockRanking(
  userScore: number,
  userSpecialty: string,
  userInstitution: string,
  totalParticipants: number = 50,
): RankingParticipant[] {
  const participants: RankingParticipant[] = [];
  const scores: number[] = [];
  for (let i = 0; i < totalParticipants - 1; i++) {
    scores.push(Math.round(40 + Math.random() * 55));
  }
  scores.push(userScore);
  scores.sort((a, b) => b - a);

  const userIndex = scores.indexOf(userScore);
  let nameIdx = 0;

  scores.forEach((score, i) => {
    if (score === userScore && i === userIndex) {
      participants.push({
        position: i + 1,
        name: 'Você',
        score,
        specialty: userSpecialty || 'Clínica Médica',
        institution: userInstitution || 'USP',
        segment: 'pro',
        isCurrentUser: true,
      });
    } else {
      participants.push({
        position: i + 1,
        name: MOCK_NAMES[nameIdx % MOCK_NAMES.length],
        score,
        specialty: MOCK_SPECIALTIES[Math.floor(Math.random() * MOCK_SPECIALTIES.length)],
        institution: MOCK_INSTITUTIONS[Math.floor(Math.random() * MOCK_INSTITUTIONS.length)],
        segment: MOCK_SEGMENTS[Math.floor(Math.random() * MOCK_SEGMENTS.length)],
      });
      nameIdx++;
    }
  });

  return participants;
}

// ─── Comparative Helpers ───

export interface SimuladoComparativeEntry {
  simuladoId: string;
  title: string;
  sequenceNumber: number;
  percentageScore: number;
  totalCorrect: number;
  totalQuestions: number;
  completedAt: string;
  areaScores: Record<string, number>;
}

export interface ComparativeInsight {
  type: 'improvement' | 'decline' | 'consistent' | 'best' | 'worst';
  title: string;
  description: string;
  value?: string;
}

export function computeComparativeInsights(entries: SimuladoComparativeEntry[]): ComparativeInsight[] {
  if (entries.length < 2) return [];

  const sorted = [...entries].sort((a, b) => a.sequenceNumber - b.sequenceNumber);
  const insights: ComparativeInsight[] = [];

  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const diff = last.percentageScore - first.percentageScore;

  if (diff > 0) {
    insights.push({
      type: 'improvement',
      title: 'Evolução positiva',
      description: `Você melhorou ${diff} pontos percentuais do ${first.title} ao ${last.title}.`,
      value: `+${diff}%`,
    });
  } else if (diff < 0) {
    insights.push({
      type: 'decline',
      title: 'Queda de desempenho',
      description: `Seu score caiu ${Math.abs(diff)} pontos percentuais do ${first.title} ao ${last.title}.`,
      value: `${diff}%`,
    });
  }

  const best = sorted.reduce((a, b) => a.percentageScore > b.percentageScore ? a : b);
  insights.push({
    type: 'best',
    title: 'Melhor simulado',
    description: `${best.title} com ${best.percentageScore}% de aproveitamento.`,
    value: `${best.percentageScore}%`,
  });

  const worst = sorted.reduce((a, b) => a.percentageScore < b.percentageScore ? a : b);
  if (worst.simuladoId !== best.simuladoId) {
    insights.push({
      type: 'worst',
      title: 'Simulado com menor score',
      description: `${worst.title} com ${worst.percentageScore}% de aproveitamento.`,
      value: `${worst.percentageScore}%`,
    });
  }

  // Consistency
  const scores = sorted.map(s => s.percentageScore);
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  const variance = scores.reduce((acc, s) => acc + Math.pow(s - avg, 2), 0) / scores.length;
  const stdDev = Math.round(Math.sqrt(variance));

  insights.push({
    type: 'consistent',
    title: stdDev < 5 ? 'Desempenho consistente' : 'Desempenho variável',
    description: stdDev < 5
      ? `Seu desempenho é estável entre os simulados (desvio padrão: ${stdDev}%).`
      : `Seu desempenho varia significativamente entre simulados (desvio padrão: ${stdDev}%).`,
    value: `σ ${stdDev}%`,
  });

  return insights;
}
