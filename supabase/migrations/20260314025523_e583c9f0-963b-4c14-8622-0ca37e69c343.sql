
-- ══════════════════════════════════════════════════════════════
-- Seed: Simulado #3 (currently in window) with 10 real questions
-- ══════════════════════════════════════════════════════════════

-- Insert all 7 simulados
INSERT INTO public.simulados (id, title, slug, sequence_number, description, questions_count, duration_minutes, execution_window_start, execution_window_end, results_release_at, theme_tags) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Simulado ENAMED #1', 'simulado-enamed-1', 1, 'Primeiro simulado do ciclo 2026. Avalie sua base em todas as grandes áreas da residência médica.', 10, 300, '2026-01-12T08:00:00-03:00', '2026-01-18T23:59:59-03:00', '2026-01-22T10:00:00-03:00', ARRAY['Clínica Médica','Cirurgia','Pediatria','GO','Preventiva']),
  ('00000000-0000-0000-0000-000000000002', 'Simulado ENAMED #2', 'simulado-enamed-2', 2, 'Segundo simulado com foco em temas de alta incidência nas provas de residência.', 10, 300, '2026-02-09T08:00:00-03:00', '2026-02-15T23:59:59-03:00', '2026-02-19T10:00:00-03:00', ARRAY['Clínica Médica','Cirurgia','Pediatria','GO','Preventiva']),
  ('00000000-0000-0000-0000-000000000003', 'Simulado ENAMED #3', 'simulado-enamed-3', 3, 'Terceiro simulado do ano. Monitore sua evolução e identifique áreas de melhoria.', 10, 300, '2026-03-09T08:00:00-03:00', '2026-03-22T23:59:59-03:00', '2026-03-26T10:00:00-03:00', ARRAY['Clínica Médica','Cirurgia','Pediatria','GO','Preventiva']),
  ('00000000-0000-0000-0000-000000000004', 'Simulado ENAMED #4', 'simulado-enamed-4', 4, 'Quarto simulado. Aprofundamento em diagnóstico diferencial e conduta.', 10, 300, '2026-04-13T08:00:00-03:00', '2026-04-19T23:59:59-03:00', '2026-04-23T10:00:00-03:00', ARRAY['Clínica Médica','Cirurgia','Pediatria','GO','Preventiva']),
  ('00000000-0000-0000-0000-000000000005', 'Simulado ENAMED #5', 'simulado-enamed-5', 5, 'Quinto simulado. Foco em questões com cenário clínico complexo.', 10, 300, '2026-05-11T08:00:00-03:00', '2026-05-17T23:59:59-03:00', '2026-05-21T10:00:00-03:00', ARRAY['Clínica Médica','Cirurgia','Pediatria','GO','Preventiva']),
  ('00000000-0000-0000-0000-000000000006', 'Simulado ENAMED #6', 'simulado-enamed-6', 6, 'Sexto simulado. Simulação de condições reais de prova com cronômetro.', 10, 300, '2026-06-15T08:00:00-03:00', '2026-06-21T23:59:59-03:00', '2026-06-25T10:00:00-03:00', ARRAY['Clínica Médica','Cirurgia','Pediatria','GO','Preventiva']),
  ('00000000-0000-0000-0000-000000000007', 'Simulado ENAMED #7', 'simulado-enamed-7', 7, 'Último simulado do ciclo. Avaliação final antes da prova real.', 10, 300, '2026-07-13T08:00:00-03:00', '2026-07-19T23:59:59-03:00', '2026-07-23T10:00:00-03:00', ARRAY['Clínica Médica','Cirurgia','Pediatria','GO','Preventiva']);

-- Insert 10 questions for Simulado #3 (the one in current window)
INSERT INTO public.questions (id, simulado_id, question_number, text, area, theme, explanation) VALUES
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 1, 'Paciente de 52 anos, sexo feminino, procura atendimento por poliúria, polidipsia e perda ponderal de 8 kg nos últimos 3 meses. Glicemia de jejum: 268 mg/dL. HbA1c: 10,2%. Qual a conduta inicial mais adequada?', 'Clínica Médica', 'Endocrinologia', 'Com HbA1c > 10% e sintomas catabólicos, a recomendação é iniciar insulinoterapia associada a metformina.'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003', 2, 'Homem de 35 anos apresenta dor abdominal intensa em fossa ilíaca direita há 12 horas, febre de 38,5°C e sinal de Blumberg positivo. Leucograma: 16.800/mm³ com desvio à esquerda. Qual a melhor conduta?', 'Cirurgia', 'Abdome agudo', 'Quadro clássico de apendicite aguda com alta probabilidade clínica. A conduta é cirúrgica.'),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000003', 3, 'Recém-nascido a termo, adequado para idade gestacional, apresenta icterícia nas primeiras 24 horas de vida. Bilirrubina total: 8,5 mg/dL com predomínio de bilirrubina indireta. Qual a principal hipótese diagnóstica?', 'Pediatria', 'Neonatologia', 'Icterícia nas primeiras 24h é sempre patológica. A causa mais comum é incompatibilidade sanguínea materno-fetal.'),
  ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000003', 4, 'Gestante de 28 semanas com pressão arterial de 160x110 mmHg, proteinúria de 2+ na fita e cefaleia intensa. Qual o diagnóstico e a conduta prioritária?', 'Ginecologia e Obstetrícia', 'Pré-natal', 'PA ≥ 160x110, proteinúria e cefaleia configuram pré-eclâmpsia grave. Conduta: internação, MgSO4 e controle pressórico.'),
  ('10000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000003', 5, 'Em um estudo de coorte prospectivo com 10.000 participantes acompanhados por 5 anos, 200 desenvolveram a doença entre os expostos (5.000) e 50 entre os não expostos (5.000). Qual o risco relativo (RR)?', 'Medicina Preventiva', 'Epidemiologia', 'RR = (200/5000) / (50/5000) = 0,04/0,01 = 4,0.'),
  ('10000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000003', 6, 'Paciente de 65 anos, hipertenso e diabético, apresenta dispneia aos esforços progressiva há 2 meses, ortopneia e edema de membros inferiores. Ecocardiograma mostra fração de ejeção de 30%. Qual a classe funcional NYHA e a medicação de primeira linha?', 'Clínica Médica', 'Cardiologia', 'Dispneia aos esforços com ortopneia e edema configura NYHA III. Tratamento padrão: IECA + BB + espironolactona.'),
  ('10000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000003', 7, 'Vítima de acidente automobilístico chega à emergência com FC 130 bpm, PA 80x50 mmHg, pele fria e sudorese. Após infusão de 2L de cristaloide, mantém instabilidade hemodinâmica. Qual a conduta?', 'Cirurgia', 'Trauma', 'Choque hemorrágico grau III/IV sem resposta a cristaloide indica transfusão maciça e abordagem cirúrgica.'),
  ('10000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000003', 8, 'Criança de 4 anos apresenta febre alta há 5 dias, conjuntivite bilateral não purulenta, linfadenopatia cervical, exantema polimórfico e edema de mãos e pés. Qual o diagnóstico mais provável e o risco principal?', 'Pediatria', 'Infectologia pediátrica', 'O quadro é clássico de Kawasaki (≥ 5 dias de febre + 4 critérios). O risco principal é aneurisma coronariano.'),
  ('10000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000003', 9, 'Mulher de 30 anos, sem queixas, procura o ginecologista para exame preventivo. Último Papanicolaou há 1 ano: normal. Qual a recomendação mais adequada segundo as diretrizes brasileiras?', 'Ginecologia e Obstetrícia', 'Rastreamento', 'As diretrizes recomendam citopatológico anual e, após dois consecutivos normais, trienal (25-64 anos).'),
  ('10000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000003', 10, 'Em relação à Estratégia Saúde da Família (ESF), assinale a alternativa correta:', 'Medicina Preventiva', 'Atenção Primária', 'O ACS deve obrigatoriamente residir na área de atuação da equipe, conforme a Política Nacional de Atenção Básica.');

-- Insert options for each question (5 options each, one correct)
-- Q1
INSERT INTO public.question_options (question_id, label, text, is_correct) VALUES
  ('10000000-0000-0000-0000-000000000001', 'A', 'Iniciar metformina 500 mg 2x/dia e orientar mudanças de estilo de vida.', false),
  ('10000000-0000-0000-0000-000000000001', 'B', 'Iniciar insulina NPH 10 UI à noite associada a metformina.', true),
  ('10000000-0000-0000-0000-000000000001', 'C', 'Prescrever glibenclamida 5 mg/dia e reavaliar em 3 meses.', false),
  ('10000000-0000-0000-0000-000000000001', 'D', 'Orientar apenas dieta e atividade física, com retorno em 30 dias.', false),
  ('10000000-0000-0000-0000-000000000001', 'E', 'Solicitar peptídeo C e anti-GAD antes de qualquer tratamento.', false);
-- Q2
INSERT INTO public.question_options (question_id, label, text, is_correct) VALUES
  ('10000000-0000-0000-0000-000000000002', 'A', 'Solicitar tomografia de abdome e aguardar resultado.', false),
  ('10000000-0000-0000-0000-000000000002', 'B', 'Indicar apendicectomia videolaparoscópica.', true),
  ('10000000-0000-0000-0000-000000000002', 'C', 'Prescrever antibioticoterapia e observação por 24 horas.', false),
  ('10000000-0000-0000-0000-000000000002', 'D', 'Realizar ultrassonografia de abdome e reavaliação clínica.', false),
  ('10000000-0000-0000-0000-000000000002', 'E', 'Administrar analgesia e alta com retorno se piora.', false);
-- Q3
INSERT INTO public.question_options (question_id, label, text, is_correct) VALUES
  ('10000000-0000-0000-0000-000000000003', 'A', 'Icterícia fisiológica do recém-nascido.', false),
  ('10000000-0000-0000-0000-000000000003', 'B', 'Icterícia do leite materno.', false),
  ('10000000-0000-0000-0000-000000000003', 'C', 'Doença hemolítica por incompatibilidade ABO ou Rh.', true),
  ('10000000-0000-0000-0000-000000000003', 'D', 'Atresia de vias biliares.', false),
  ('10000000-0000-0000-0000-000000000003', 'E', 'Síndrome de Gilbert.', false);
-- Q4
INSERT INTO public.question_options (question_id, label, text, is_correct) VALUES
  ('10000000-0000-0000-0000-000000000004', 'A', 'Hipertensão gestacional — iniciar metildopa e acompanhar ambulatorialmente.', false),
  ('10000000-0000-0000-0000-000000000004', 'B', 'Pré-eclâmpsia grave — internação, sulfato de magnésio e anti-hipertensivo parenteral.', true),
  ('10000000-0000-0000-0000-000000000004', 'C', 'Eclâmpsia — parto cesáreo imediato.', false),
  ('10000000-0000-0000-0000-000000000004', 'D', 'Hipertensão crônica — ajustar medicação e retornar em 1 semana.', false),
  ('10000000-0000-0000-0000-000000000004', 'E', 'Síndrome HELLP — solicitar enzimas hepáticas e plaquetas.', false);
-- Q5
INSERT INTO public.question_options (question_id, label, text, is_correct) VALUES
  ('10000000-0000-0000-0000-000000000005', 'A', '2,0', false),
  ('10000000-0000-0000-0000-000000000005', 'B', '4,0', true),
  ('10000000-0000-0000-0000-000000000005', 'C', '3,0', false),
  ('10000000-0000-0000-0000-000000000005', 'D', '1,5', false),
  ('10000000-0000-0000-0000-000000000005', 'E', '0,25', false);
-- Q6
INSERT INTO public.question_options (question_id, label, text, is_correct) VALUES
  ('10000000-0000-0000-0000-000000000006', 'A', 'NYHA II — IECA + betabloqueador.', false),
  ('10000000-0000-0000-0000-000000000006', 'B', 'NYHA III — IECA + betabloqueador + espironolactona.', true),
  ('10000000-0000-0000-0000-000000000006', 'C', 'NYHA IV — apenas diuréticos e vasodilatadores.', false),
  ('10000000-0000-0000-0000-000000000006', 'D', 'NYHA I — apenas mudança de estilo de vida.', false),
  ('10000000-0000-0000-0000-000000000006', 'E', 'NYHA III — digoxina isolada.', false);
-- Q7
INSERT INTO public.question_options (question_id, label, text, is_correct) VALUES
  ('10000000-0000-0000-0000-000000000007', 'A', 'Infundir mais 2L de cristaloide e reavaliar.', false),
  ('10000000-0000-0000-0000-000000000007', 'B', 'Iniciar noradrenalina para estabilização pressórica.', false),
  ('10000000-0000-0000-0000-000000000007', 'C', 'Indicar transfusão de concentrado de hemácias e cirurgia de controle de dano.', true),
  ('10000000-0000-0000-0000-000000000007', 'D', 'Realizar tomografia de corpo inteiro.', false),
  ('10000000-0000-0000-0000-000000000007', 'E', 'Inserir balão de Sengstaken-Blakemore.', false);
-- Q8
INSERT INTO public.question_options (question_id, label, text, is_correct) VALUES
  ('10000000-0000-0000-0000-000000000008', 'A', 'Sarampo — encefalite.', false),
  ('10000000-0000-0000-0000-000000000008', 'B', 'Doença de Kawasaki — aneurisma coronariano.', true),
  ('10000000-0000-0000-0000-000000000008', 'C', 'Escarlatina — glomerulonefrite.', false),
  ('10000000-0000-0000-0000-000000000008', 'D', 'Mononucleose — ruptura esplênica.', false),
  ('10000000-0000-0000-0000-000000000008', 'E', 'Eritema infeccioso — aplasia medular.', false);
-- Q9
INSERT INTO public.question_options (question_id, label, text, is_correct) VALUES
  ('10000000-0000-0000-0000-000000000009', 'A', 'Repetir o Papanicolaou agora e manter anual.', false),
  ('10000000-0000-0000-0000-000000000009', 'B', 'Colher Papanicolaou agora; se dois consecutivos normais, espaçar para trienal.', true),
  ('10000000-0000-0000-0000-000000000009', 'C', 'Realizar colposcopia de rotina a cada 2 anos.', false),
  ('10000000-0000-0000-0000-000000000009', 'D', 'Solicitar apenas teste de HPV a cada 5 anos.', false),
  ('10000000-0000-0000-0000-000000000009', 'E', 'Suspender rastreamento até os 40 anos.', false);
-- Q10
INSERT INTO public.question_options (question_id, label, text, is_correct) VALUES
  ('10000000-0000-0000-0000-000000000010', 'A', 'Cada equipe deve cobrir no máximo 2.000 pessoas.', false),
  ('10000000-0000-0000-0000-000000000010', 'B', 'O agente comunitário de saúde deve residir na área de atuação da equipe.', true),
  ('10000000-0000-0000-0000-000000000010', 'C', 'A ESF é obrigatória em todos os municípios do Brasil desde 1994.', false),
  ('10000000-0000-0000-0000-000000000010', 'D', 'O médico da ESF deve atender exclusivamente no consultório da UBS.', false),
  ('10000000-0000-0000-0000-000000000010', 'E', 'O NASF substitui a equipe de ESF em áreas rurais.', false);
