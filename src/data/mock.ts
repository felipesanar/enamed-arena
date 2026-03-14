import type { Simulado, RankingEntry, AreaPerformance, UserProfile } from '@/types';

export const CURRENT_USER: UserProfile = {
  id: 'user-1',
  name: 'Usuário',
  email: 'usuario@email.com',
  segment: 'pro',
};

export const SIMULADOS: Simulado[] = [
  { id: 's1', title: 'Simulado ENAMED #1', number: 1, date: '18 Jan 2026', status: 'completed', questions: 120, duration: '5h', score: 68 },
  { id: 's2', title: 'Simulado ENAMED #2', number: 2, date: '15 Fev 2026', status: 'completed', questions: 120, duration: '5h', score: 76 },
  { id: 's3', title: 'Simulado ENAMED #3', number: 3, date: '22 Mar 2026', status: 'available', questions: 120, duration: '5h', window: { start: '2026-03-14T00:00:00Z', end: '2026-03-22T23:59:59Z' } },
  { id: 's4', title: 'Simulado ENAMED #4', number: 4, date: '19 Abr 2026', status: 'upcoming', questions: 120, duration: '5h' },
  { id: 's5', title: 'Simulado ENAMED #5', number: 5, date: '17 Mai 2026', status: 'upcoming', questions: 120, duration: '5h' },
  { id: 's6', title: 'Simulado ENAMED #6', number: 6, date: '21 Jun 2026', status: 'locked', questions: 120, duration: '5h' },
  { id: 's7', title: 'Simulado ENAMED #7', number: 7, date: '19 Jul 2026', status: 'locked', questions: 120, duration: '5h' },
];

export const NEXT_SIMULADO = SIMULADOS.find(s => s.status === 'available') ?? SIMULADOS.find(s => s.status === 'upcoming')!;

export const RECENT_SIMULADOS = SIMULADOS.filter(s => s.status === 'completed').reverse();

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
  'Clínica Médica',
  'Cirurgia Geral',
  'Pediatria',
  'Ginecologia e Obstetrícia',
  'Ortopedia e Traumatologia',
  'Cardiologia',
  'Dermatologia',
  'Oftalmologia',
  'Otorrinolaringologia',
  'Anestesiologia',
  'Radiologia',
  'Psiquiatria',
  'Neurologia',
  'Urologia',
  'Medicina de Família e Comunidade',
];

export const INSTITUTIONS = [
  'USP', 'UNICAMP', 'UFMG', 'UFRJ', 'UFBA', 'UnB', 'UFPE', 'UFPR',
  'UFSC', 'UFRGS', 'UFES', 'UFG', 'UFMA', 'UFPA', 'UFPI', 'UFRN',
  'UFS', 'UFAL', 'UFAM', 'UFMS', 'UFMT', 'UFPB', 'UFSM', 'UFU',
  'UNIFESP', 'USP-RP', 'FMUSP', 'ENARE', 'SUS-SP', 'SES-RJ',
];
