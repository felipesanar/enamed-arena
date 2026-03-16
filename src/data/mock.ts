import type { RankingEntry, AreaPerformance, UserProfile } from '@/types';

export const CURRENT_USER: UserProfile = {
  id: 'user-1',
  name: 'Usuário',
  email: 'usuario@email.com',
  segment: 'pro',
};

// ─── Other mock data (non-simulado) ───
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
