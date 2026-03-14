import type { Question } from '@/types';

/**
 * Mock questions for simulado s3 (the one currently available).
 * Using 10 questions for dev; real simulados will have 120.
 */
export const MOCK_QUESTIONS: Question[] = [
  {
    id: 'q1', number: 1, area: 'Clínica Médica', theme: 'Endocrinologia',
    text: 'Paciente de 52 anos, sexo feminino, procura atendimento por poliúria, polidipsia e perda ponderal de 8 kg nos últimos 3 meses. Glicemia de jejum: 268 mg/dL. HbA1c: 10,2%. Qual a conduta inicial mais adequada?',
    options: [
      { id: 'q1a', label: 'A', text: 'Iniciar metformina 500 mg 2x/dia e orientar mudanças de estilo de vida.' },
      { id: 'q1b', label: 'B', text: 'Iniciar insulina NPH 10 UI à noite associada a metformina.' },
      { id: 'q1c', label: 'C', text: 'Prescrever glibenclamida 5 mg/dia e reavaliar em 3 meses.' },
      { id: 'q1d', label: 'D', text: 'Orientar apenas dieta e atividade física, com retorno em 30 dias.' },
      { id: 'q1e', label: 'E', text: 'Solicitar peptídeo C e anti-GAD antes de qualquer tratamento.' },
    ],
    correctOptionId: 'q1b',
    explanation: 'Com HbA1c > 10% e sintomas catabólicos, a recomendação é iniciar insulinoterapia associada a metformina.',
  },
  {
    id: 'q2', number: 2, area: 'Cirurgia', theme: 'Abdome agudo',
    text: 'Homem de 35 anos apresenta dor abdominal intensa em fossa ilíaca direita há 12 horas, febre de 38,5°C e sinal de Blumberg positivo. Leucograma: 16.800/mm³ com desvio à esquerda. Qual a melhor conduta?',
    options: [
      { id: 'q2a', label: 'A', text: 'Solicitar tomografia de abdome e aguardar resultado.' },
      { id: 'q2b', label: 'B', text: 'Indicar apendicectomia videolaparoscópica.' },
      { id: 'q2c', label: 'C', text: 'Prescrever antibioticoterapia e observação por 24 horas.' },
      { id: 'q2d', label: 'D', text: 'Realizar ultrassonografia de abdome e reavaliação clínica.' },
      { id: 'q2e', label: 'E', text: 'Administrar analgesia e alta com retorno se piora.' },
    ],
    correctOptionId: 'q2b',
    explanation: 'Quadro clássico de apendicite aguda com alta probabilidade clínica. A conduta é cirúrgica.',
  },
  {
    id: 'q3', number: 3, area: 'Pediatria', theme: 'Neonatologia',
    text: 'Recém-nascido a termo, adequado para idade gestacional, apresenta icterícia nas primeiras 24 horas de vida. Bilirrubina total: 8,5 mg/dL com predomínio de bilirrubina indireta. Qual a principal hipótese diagnóstica?',
    options: [
      { id: 'q3a', label: 'A', text: 'Icterícia fisiológica do recém-nascido.' },
      { id: 'q3b', label: 'B', text: 'Icterícia do leite materno.' },
      { id: 'q3c', label: 'C', text: 'Doença hemolítica por incompatibilidade ABO ou Rh.' },
      { id: 'q3d', label: 'D', text: 'Atresia de vias biliares.' },
      { id: 'q3e', label: 'E', text: 'Síndrome de Gilbert.' },
    ],
    correctOptionId: 'q3c',
    explanation: 'Icterícia nas primeiras 24h é sempre patológica. A causa mais comum é incompatibilidade sanguínea materno-fetal.',
  },
  {
    id: 'q4', number: 4, area: 'Ginecologia e Obstetrícia', theme: 'Pré-natal',
    text: 'Gestante de 28 semanas com pressão arterial de 160x110 mmHg, proteinúria de 2+ na fita e cefaleia intensa. Qual o diagnóstico e a conduta prioritária?',
    options: [
      { id: 'q4a', label: 'A', text: 'Hipertensão gestacional — iniciar metildopa e acompanhar ambulatorialmente.' },
      { id: 'q4b', label: 'B', text: 'Pré-eclâmpsia grave — internação, sulfato de magnésio e anti-hipertensivo parenteral.' },
      { id: 'q4c', label: 'C', text: 'Eclâmpsia — parto cesáreo imediato.' },
      { id: 'q4d', label: 'D', text: 'Hipertensão crônica — ajustar medicação e retornar em 1 semana.' },
      { id: 'q4e', label: 'E', text: 'Síndrome HELLP — solicitar enzimas hepáticas e plaquetas.' },
    ],
    correctOptionId: 'q4b',
    explanation: 'PA ≥ 160x110, proteinúria e cefaleia configuram pré-eclâmpsia grave. Conduta: internação, MgSO4 e controle pressórico.',
  },
  {
    id: 'q5', number: 5, area: 'Medicina Preventiva', theme: 'Epidemiologia',
    text: 'Em um estudo de coorte prospectivo com 10.000 participantes acompanhados por 5 anos, 200 desenvolveram a doença entre os expostos (5.000) e 50 entre os não expostos (5.000). Qual o risco relativo (RR)?',
    options: [
      { id: 'q5a', label: 'A', text: '2,0' },
      { id: 'q5b', label: 'B', text: '4,0' },
      { id: 'q5c', label: 'C', text: '3,0' },
      { id: 'q5d', label: 'D', text: '1,5' },
      { id: 'q5e', label: 'E', text: '0,25' },
    ],
    correctOptionId: 'q5b',
    explanation: 'RR = (200/5000) / (50/5000) = 0,04/0,01 = 4,0.',
  },
  {
    id: 'q6', number: 6, area: 'Clínica Médica', theme: 'Cardiologia',
    text: 'Paciente de 65 anos, hipertenso e diabético, apresenta dispneia aos esforços progressiva há 2 meses, ortopneia e edema de membros inferiores. Ecocardiograma mostra fração de ejeção de 30%. Qual a classe funcional NYHA e a medicação de primeira linha?',
    options: [
      { id: 'q6a', label: 'A', text: 'NYHA II — IECA + betabloqueador.' },
      { id: 'q6b', label: 'B', text: 'NYHA III — IECA + betabloqueador + espironolactona.' },
      { id: 'q6c', label: 'C', text: 'NYHA IV — apenas diuréticos e vasodilatadores.' },
      { id: 'q6d', label: 'D', text: 'NYHA I — apenas mudança de estilo de vida.' },
      { id: 'q6e', label: 'E', text: 'NYHA III — digoxina isolada.' },
    ],
    correctOptionId: 'q6b',
    explanation: 'Dispneia aos esforços com ortopneia e edema configura NYHA III. Tratamento padrão: IECA + BB + espironolactona.',
  },
  {
    id: 'q7', number: 7, area: 'Cirurgia', theme: 'Trauma',
    text: 'Vítima de acidente automobilístico chega à emergência com FC 130 bpm, PA 80x50 mmHg, pele fria e sudorese. Após infusão de 2L de cristaloide, mantém instabilidade hemodinâmica. Qual a conduta?',
    options: [
      { id: 'q7a', label: 'A', text: 'Infundir mais 2L de cristaloide e reavaliar.' },
      { id: 'q7b', label: 'B', text: 'Iniciar noradrenalina para estabilização pressórica.' },
      { id: 'q7c', label: 'C', text: 'Indicar transfusão de concentrado de hemácias e cirurgia de controle de dano.' },
      { id: 'q7d', label: 'D', text: 'Realizar tomografia de corpo inteiro.' },
      { id: 'q7e', label: 'E', text: 'Inserir balão de Sengstaken-Blakemore.' },
    ],
    correctOptionId: 'q7c',
    explanation: 'Choque hemorrágico grau III/IV sem resposta a cristaloide indica transfusão maciça e abordagem cirúrgica.',
  },
  {
    id: 'q8', number: 8, area: 'Pediatria', theme: 'Infectologia pediátrica',
    text: 'Criança de 4 anos apresenta febre alta há 5 dias, conjuntivite bilateral não purulenta, linfadenopatia cervical, exantema polimórfico e edema de mãos e pés. Qual o diagnóstico mais provável e o risco principal?',
    options: [
      { id: 'q8a', label: 'A', text: 'Sarampo — encefalite.' },
      { id: 'q8b', label: 'B', text: 'Doença de Kawasaki — aneurisma coronariano.' },
      { id: 'q8c', label: 'C', text: 'Escarlatina — glomerulonefrite.' },
      { id: 'q8d', label: 'D', text: 'Mononucleose — ruptura esplênica.' },
      { id: 'q8e', label: 'E', text: 'Eritema infeccioso — aplasia medular.' },
    ],
    correctOptionId: 'q8b',
    explanation: 'O quadro é clássico de Kawasaki (≥ 5 dias de febre + 4 critérios). O risco principal é aneurisma coronariano.',
  },
  {
    id: 'q9', number: 9, area: 'Ginecologia e Obstetrícia', theme: 'Rastreamento',
    text: 'Mulher de 30 anos, sem queixas, procura o ginecologista para exame preventivo. Último Papanicolaou há 1 ano: normal. Qual a recomendação mais adequada segundo as diretrizes brasileiras?',
    options: [
      { id: 'q9a', label: 'A', text: 'Repetir o Papanicolaou agora e manter anual.' },
      { id: 'q9b', label: 'B', text: 'Colher Papanicolaou agora; se dois consecutivos normais, espaçar para trienal.' },
      { id: 'q9c', label: 'C', text: 'Realizar colposcopia de rotina a cada 2 anos.' },
      { id: 'q9d', label: 'D', text: 'Solicitar apenas teste de HPV a cada 5 anos.' },
      { id: 'q9e', label: 'E', text: 'Suspender rastreamento até os 40 anos.' },
    ],
    correctOptionId: 'q9b',
    explanation: 'As diretrizes recomendam citopatológico anual e, após dois consecutivos normais, trienal (25-64 anos).',
  },
  {
    id: 'q10', number: 10, area: 'Medicina Preventiva', theme: 'Atenção Primária',
    text: 'Em relação à Estratégia Saúde da Família (ESF), assinale a alternativa correta:',
    options: [
      { id: 'q10a', label: 'A', text: 'Cada equipe deve cobrir no máximo 2.000 pessoas.' },
      { id: 'q10b', label: 'B', text: 'O agente comunitário de saúde deve residir na área de atuação da equipe.' },
      { id: 'q10c', label: 'C', text: 'A ESF é obrigatória em todos os municípios do Brasil desde 1994.' },
      { id: 'q10d', label: 'D', text: 'O médico da ESF deve atender exclusivamente no consultório da UBS.' },
      { id: 'q10e', label: 'E', text: 'O NASF substitui a equipe de ESF em áreas rurais.' },
    ],
    correctOptionId: 'q10b',
    explanation: 'O ACS deve obrigatoriamente residir na área de atuação da equipe, conforme a Política Nacional de Atenção Básica.',
  },
];

/**
 * Get questions for a given simulado.
 * In production this would fetch from API; for now returns mock set.
 */
export function getQuestionsForSimulado(simuladoId: string): Question[] {
  // All simulados share the same mock questions for dev
  return MOCK_QUESTIONS;
}
