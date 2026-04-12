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
  difficulty: string | null;
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

export interface DifficultyPerformance {
  difficulty: string;
  total: number;
  correct: number;
  score: number;
}

export interface PerformanceBreakdown {
  overall: SimuladoScore;
  byArea: AreaPerformance[];
  byTheme: ThemePerformance[];
  byDifficulty: DifficultyPerformance[];
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
      difficulty: q.difficulty ?? null,
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

/**
 * Parse the `theme` field which contains "Especialidade > Tema".
 * Returns { specialty, subTopic }.
 */
export function parseThemeField(theme: string): { specialty: string; subTopic: string } {
  const parts = theme.split('>').map(p => p.trim());
  return {
    specialty: parts[0] || 'Sem Especialidade',
    subTopic: parts[1] || 'Geral',
  };
}

export function computePerformanceBreakdown(
  state: ExamState,
  questions: Question[],
): PerformanceBreakdown {
  const overall = computeSimuladoScore(state, questions);

  // Group by specialty (first part of theme field) instead of area
  const specialtyMap = new Map<string, { total: number; correct: number }>();
  overall.questionResults.forEach(r => {
    const { specialty } = parseThemeField(r.theme);
    const entry = specialtyMap.get(specialty) || { total: 0, correct: 0 };
    entry.total++;
    if (r.isCorrect) entry.correct++;
    specialtyMap.set(specialty, entry);
  });

  const byArea: AreaPerformance[] = Array.from(specialtyMap.entries())
    .map(([specialty, data]) => ({
      area: specialty,
      score: data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0,
      questions: data.total,
      correct: data.correct,
    }))
    .sort((a, b) => b.score - a.score);

  // Group by sub-topic (second part of theme) within each specialty
  const themeMap = new Map<string, { area: string; total: number; correct: number }>();
  overall.questionResults.forEach(r => {
    const { specialty, subTopic } = parseThemeField(r.theme);
    const key = `${specialty}::${subTopic}`;
    const entry = themeMap.get(key) || { area: specialty, total: 0, correct: 0 };
    entry.total++;
    if (r.isCorrect) entry.correct++;
    themeMap.set(key, entry);
  });

  const byTheme: ThemePerformance[] = Array.from(themeMap.entries()).map(([key, data]) => {
    const [specialty, subTopic] = key.split('::');
    return {
      theme: subTopic || specialty,
      area: specialty,
      total: data.total,
      correct: data.correct,
      score: data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0,
    };
  }).sort((a, b) => b.score - a.score);

  // Group by difficulty
  const diffMap = new Map<string, { total: number; correct: number }>();
  const DIFF_LABELS: Record<string, string> = { easy: 'Fácil', medium: 'Média', hard: 'Difícil' };
  overall.questionResults.forEach(r => {
    const diff = r.difficulty || 'medium';
    const entry = diffMap.get(diff) || { total: 0, correct: 0 };
    entry.total++;
    if (r.isCorrect) entry.correct++;
    diffMap.set(diff, entry);
  });

  const diffOrder = ['easy', 'medium', 'hard'];
  const byDifficulty: DifficultyPerformance[] = Array.from(diffMap.entries())
    .map(([difficulty, data]) => ({
      difficulty: DIFF_LABELS[difficulty] || difficulty,
      total: data.total,
      correct: data.correct,
      score: data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0,
    }))
    .sort((a, b) => {
      const aIdx = diffOrder.indexOf(Object.keys(DIFF_LABELS).find(k => DIFF_LABELS[k] === a.difficulty) || '');
      const bIdx = diffOrder.indexOf(Object.keys(DIFF_LABELS).find(k => DIFF_LABELS[k] === b.difficulty) || '');
      return aIdx - bIdx;
    });

  return { overall, byArea, byTheme, byDifficulty };
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
