import type { SimuladoConfig, SimuladoUserState, RankingEntry, AreaPerformance, UserProfile } from '@/types';
import { enrichSimulado } from '@/lib/simulado-helpers';

export const CURRENT_USER: UserProfile = {
  id: 'user-1',
  name: 'Usuário',
  email: 'usuario@email.com',
  segment: 'pro',
};

// ─── Simulado Configs (source of truth for the 7 simulados) ───
export const SIMULADO_CONFIGS: SimuladoConfig[] = [
  {
    id: 's1', slug: 'simulado-enamed-1', title: 'Simulado ENAMED #1', sequenceNumber: 1,
    description: 'Primeiro simulado do ciclo 2026. Avalie sua base em todas as grandes áreas da residência médica.',
    questionsCount: 120, estimatedDuration: '5h', estimatedDurationMinutes: 300,
    executionWindowStart: '2026-01-12T08:00:00-03:00', executionWindowEnd: '2026-01-18T23:59:59-03:00',
    resultsReleaseAt: '2026-01-22T10:00:00-03:00',
    themeTags: ['Clínica Médica', 'Cirurgia', 'Pediatria', 'GO', 'Preventiva'],
  },
  {
    id: 's2', slug: 'simulado-enamed-2', title: 'Simulado ENAMED #2', sequenceNumber: 2,
    description: 'Segundo simulado com foco em temas de alta incidência nas provas de residência.',
    questionsCount: 120, estimatedDuration: '5h', estimatedDurationMinutes: 300,
    executionWindowStart: '2026-02-09T08:00:00-03:00', executionWindowEnd: '2026-02-15T23:59:59-03:00',
    resultsReleaseAt: '2026-02-19T10:00:00-03:00',
    themeTags: ['Clínica Médica', 'Cirurgia', 'Pediatria', 'GO', 'Preventiva'],
  },
  {
    id: 's3', slug: 'simulado-enamed-3', title: 'Simulado ENAMED #3', sequenceNumber: 3,
    description: 'Terceiro simulado do ano. Monitore sua evolução e identifique áreas de melhoria.',
    questionsCount: 120, estimatedDuration: '5h', estimatedDurationMinutes: 300,
    executionWindowStart: '2026-03-09T08:00:00-03:00', executionWindowEnd: '2026-03-22T23:59:59-03:00',
    resultsReleaseAt: '2026-03-26T10:00:00-03:00',
    themeTags: ['Clínica Médica', 'Cirurgia', 'Pediatria', 'GO', 'Preventiva'],
  },
  {
    id: 's4', slug: 'simulado-enamed-4', title: 'Simulado ENAMED #4', sequenceNumber: 4,
    description: 'Quarto simulado. Aprofundamento em diagnóstico diferencial e conduta.',
    questionsCount: 120, estimatedDuration: '5h', estimatedDurationMinutes: 300,
    executionWindowStart: '2026-04-13T08:00:00-03:00', executionWindowEnd: '2026-04-19T23:59:59-03:00',
    resultsReleaseAt: '2026-04-23T10:00:00-03:00',
    themeTags: ['Clínica Médica', 'Cirurgia', 'Pediatria', 'GO', 'Preventiva'],
  },
  {
    id: 's5', slug: 'simulado-enamed-5', title: 'Simulado ENAMED #5', sequenceNumber: 5,
    description: 'Quinto simulado. Foco em questões com cenário clínico complexo.',
    questionsCount: 120, estimatedDuration: '5h', estimatedDurationMinutes: 300,
    executionWindowStart: '2026-05-11T08:00:00-03:00', executionWindowEnd: '2026-05-17T23:59:59-03:00',
    resultsReleaseAt: '2026-05-21T10:00:00-03:00',
    themeTags: ['Clínica Médica', 'Cirurgia', 'Pediatria', 'GO', 'Preventiva'],
  },
  {
    id: 's6', slug: 'simulado-enamed-6', title: 'Simulado ENAMED #6', sequenceNumber: 6,
    description: 'Sexto simulado. Simulação de condições reais de prova com cronômetro.',
    questionsCount: 120, estimatedDuration: '5h', estimatedDurationMinutes: 300,
    executionWindowStart: '2026-06-15T08:00:00-03:00', executionWindowEnd: '2026-06-21T23:59:59-03:00',
    resultsReleaseAt: '2026-06-25T10:00:00-03:00',
    themeTags: ['Clínica Médica', 'Cirurgia', 'Pediatria', 'GO', 'Preventiva'],
  },
  {
    id: 's7', slug: 'simulado-enamed-7', title: 'Simulado ENAMED #7', sequenceNumber: 7,
    description: 'Último simulado do ciclo. Avaliação final antes da prova real.',
    questionsCount: 120, estimatedDuration: '5h', estimatedDurationMinutes: 300,
    executionWindowStart: '2026-07-13T08:00:00-03:00', executionWindowEnd: '2026-07-19T23:59:59-03:00',
    resultsReleaseAt: '2026-07-23T10:00:00-03:00',
    themeTags: ['Clínica Médica', 'Cirurgia', 'Pediatria', 'GO', 'Preventiva'],
  },
];

// ─── User states (mock: first 2 completed) ───
export const SIMULADO_USER_STATES: SimuladoUserState[] = [
  { simuladoId: 's1', started: true, startedAt: '2026-01-12T09:00:00-03:00', finished: true, finishedAt: '2026-01-12T13:30:00-03:00', score: 68 },
  { simuladoId: 's2', started: true, startedAt: '2026-02-09T10:00:00-03:00', finished: true, finishedAt: '2026-02-09T14:45:00-03:00', score: 76 },
];

// ─── Derived simulados with status ───
export function getSimulados(now?: Date) {
  return SIMULADO_CONFIGS.map(config => {
    const userState = SIMULADO_USER_STATES.find(s => s.simuladoId === config.id);
    return enrichSimulado(config, userState, now);
  });
}

// ─── Convenience getters ───
export function getNextSimulado(now?: Date) {
  const simulados = getSimulados(now);
  return simulados.find(s => s.status === 'available') ?? simulados.find(s => s.status === 'upcoming');
}

export function getRecentSimulados(now?: Date) {
  const simulados = getSimulados(now);
  return simulados.filter(s => s.status === 'completed' || s.status === 'results_available').reverse();
}

export function getSimuladoById(id: string, now?: Date) {
  const config = SIMULADO_CONFIGS.find(c => c.id === id);
  if (!config) return null;
  const userState = SIMULADO_USER_STATES.find(s => s.simuladoId === id);
  return enrichSimulado(config, userState, now);
}

// ─── Other mock data ───
export const RANKING_DATA: RankingEntry[] = [
  { position: 1, name: 'Ana C.', score: 92, institution: 'USP' },
  { position: 2, name: 'Lucas M.', score: 89, institution: 'UNICAMP' },
  { position: 3, name: 'Maria S.', score: 87, institution: 'UFMG' },
  { position: 4, name: 'João P.', score: 85, institution: 'UFBA' },
  { position: 5, name: 'Carla D.', score: 84, institution: 'UFRJ' },
  { position: 6, name: 'Pedro H.', score: 82, institution: 'UnB' },
  { position: 7, name: 'Beatriz R.', score: 80, institution: 'UFPE' },
  { position: 8, name: 'Rafael A.', score: 79, institution: 'UFPR' },
  { position: 9, name: 'Juliana F.', score: 78, institution: 'UFSC' },
  { position: 10, name: 'Thiago L.', score: 76, institution: 'USP-RP' },
];

export const AREA_PERFORMANCE: AreaPerformance[] = [
  { area: 'Clínica Médica', score: 78, questions: 30, correct: 23 },
  { area: 'Cirurgia', score: 65, questions: 25, correct: 16 },
  { area: 'Pediatria', score: 82, questions: 20, correct: 16 },
  { area: 'Ginecologia e Obstetrícia', score: 71, questions: 25, correct: 18 },
  { area: 'Medicina Preventiva', score: 88, questions: 20, correct: 18 },
];

export const USER_STATS = {
  simuladosCompleted: 2,
  averageScore: 72,
  rankingPosition: 142,
  totalParticipants: 3241,
  rankingTrend: '+18',
  scoreTrend: '+5%',
};

export const SPECIALTIES = [
  'Clínica Médica', 'Cirurgia Geral', 'Pediatria', 'Ginecologia e Obstetrícia',
  'Ortopedia e Traumatologia', 'Cardiologia', 'Dermatologia', 'Oftalmologia',
  'Otorrinolaringologia', 'Anestesiologia', 'Radiologia', 'Psiquiatria',
  'Neurologia', 'Urologia', 'Medicina de Família e Comunidade',
];

export const INSTITUTIONS = [
  'USP', 'UNICAMP', 'UFMG', 'UFRJ', 'UFBA', 'UnB', 'UFPE', 'UFPR',
  'UFSC', 'UFRGS', 'UFES', 'UFG', 'UFMA', 'UFPA', 'UFPI', 'UFRN',
  'UFS', 'UFAL', 'UFAM', 'UFMS', 'UFMT', 'UFPB', 'UFSM', 'UFU',
  'UNIFESP', 'USP-RP', 'FMUSP', 'ENARE', 'SUS-SP', 'SES-RJ',
];
