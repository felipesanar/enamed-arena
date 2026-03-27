
-- ==========================================
-- STEP 1: Clean all existing data (cascade)
-- ==========================================

-- Delete dependent data first
DELETE FROM public.attempt_processing_queue;
DELETE FROM public.attempt_question_results;
DELETE FROM public.user_performance_history;
DELETE FROM public.user_performance_summary;
DELETE FROM public.error_notebook;
DELETE FROM public.answers;
DELETE FROM public.attempts;
DELETE FROM public.question_options;
DELETE FROM public.questions;
DELETE FROM public.simulados;

-- ==========================================
-- STEP 2: Create 6 Simulados
-- Weekly windows starting 2026-03-27
-- ==========================================

INSERT INTO public.simulados (id, title, slug, sequence_number, description, questions_count, duration_minutes, execution_window_start, execution_window_end, results_release_at, theme_tags, status)
VALUES
  ('10000001-0001-4001-8001-000000000001', 'Simulado #1 — Fundamentos Clínicos', 'simulado-1-fundamentos-clinicos', 1,
   'Simulado inaugural com foco em bases da Clínica Médica, Pediatria e Medicina Preventiva.',
   10, 300,
   '2026-03-27T00:00:00Z', '2026-04-02T23:59:59Z', '2026-04-03T12:00:00Z',
   ARRAY['Clínica Médica', 'Pediatria', 'Medicina Preventiva'], 'published'),

  ('10000001-0001-4001-8001-000000000002', 'Simulado #2 — Cirurgia e Emergência', 'simulado-2-cirurgia-emergencia', 2,
   'Ênfase em Cirurgia Geral, Trauma e condutas de emergência.',
   10, 300,
   '2026-04-03T00:00:00Z', '2026-04-09T23:59:59Z', '2026-04-10T12:00:00Z',
   ARRAY['Cirurgia', 'Clínica Médica'], 'published'),

  ('10000001-0001-4001-8001-000000000003', 'Simulado #3 — Saúde da Mulher e da Criança', 'simulado-3-saude-mulher-crianca', 3,
   'Ginecologia, Obstetrícia e Pediatria com questões integradas.',
   10, 300,
   '2026-04-10T00:00:00Z', '2026-04-16T23:59:59Z', '2026-04-17T12:00:00Z',
   ARRAY['Ginecologia e Obstetrícia', 'Pediatria'], 'published'),

  ('10000001-0001-4001-8001-000000000004', 'Simulado #4 — Medicina Preventiva e Saúde Coletiva', 'simulado-4-preventiva-saude-coletiva', 4,
   'Epidemiologia, políticas de saúde e atenção primária.',
   10, 300,
   '2026-04-17T00:00:00Z', '2026-04-23T23:59:59Z', '2026-04-24T12:00:00Z',
   ARRAY['Medicina Preventiva', 'Saúde Pública'], 'published'),

  ('10000001-0001-4001-8001-000000000005', 'Simulado #5 — Clínica Médica Avançada', 'simulado-5-clinica-avancada', 5,
   'Cardiologia, Endocrinologia, Infectologia e Gastroenterologia.',
   10, 300,
   '2026-04-24T00:00:00Z', '2026-04-30T23:59:59Z', '2026-05-01T12:00:00Z',
   ARRAY['Clínica Médica', 'Cirurgia'], 'published'),

  ('10000001-0001-4001-8001-000000000006', 'Simulado #6 — Revisão Geral ENAMED', 'simulado-6-revisao-geral', 6,
   'Simulado abrangente cobrindo todas as grandes áreas do ENAMED.',
   10, 300,
   '2026-05-01T00:00:00Z', '2026-05-07T23:59:59Z', '2026-05-08T12:00:00Z',
   ARRAY['Clínica Médica', 'Cirurgia', 'Pediatria', 'Ginecologia e Obstetrícia', 'Medicina Preventiva'], 'published');

-- ==========================================
-- STEP 3: Create 10 Questions per Simulado (60 total)
-- ==========================================

-- ===== SIMULADO #1 — Fundamentos Clínicos =====
INSERT INTO public.questions (id, simulado_id, question_number, text, area, theme, difficulty) VALUES
('20000001-0001-4001-8001-000000000001', '10000001-0001-4001-8001-000000000001', 1, 'Paciente de 55 anos, hipertenso, apresenta edema de membros inferiores, dispneia aos esforços e estertores crepitantes bilaterais. Qual o diagnóstico mais provável?', 'Clínica Médica', 'Cardiologia', 'medium'),
('20000001-0001-4001-8001-000000000002', '10000001-0001-4001-8001-000000000001', 2, 'Lactente de 6 meses apresenta febre alta, irritabilidade e abaulamento de fontanela anterior. Qual a conduta inicial mais adequada?', 'Pediatria', 'Neonatologia', 'hard'),
('20000001-0001-4001-8001-000000000003', '10000001-0001-4001-8001-000000000001', 3, 'Em relação ao rastreamento do câncer de colo uterino no Brasil, qual a periodicidade recomendada pelo Ministério da Saúde para mulheres entre 25 e 64 anos?', 'Medicina Preventiva', 'Saúde Pública', 'easy'),
('20000001-0001-4001-8001-000000000004', '10000001-0001-4001-8001-000000000001', 4, 'Paciente diabético tipo 2, em uso de metformina, apresenta glicemia de jejum de 250 mg/dL e HbA1c de 10%. Qual a conduta mais adequada?', 'Clínica Médica', 'Endocrinologia', 'medium'),
('20000001-0001-4001-8001-000000000005', '10000001-0001-4001-8001-000000000001', 5, 'Criança de 3 anos com quadro de tosse seca há 2 semanas, seguida de paroxismos de tosse com guincho inspiratório. Qual o agente etiológico mais provável?', 'Pediatria', 'Infectologia Pediátrica', 'medium'),
('20000001-0001-4001-8001-000000000006', '10000001-0001-4001-8001-000000000001', 6, 'Qual indicador epidemiológico mede a probabilidade de um indivíduo doente ter resultado positivo em um teste diagnóstico?', 'Medicina Preventiva', 'Epidemiologia', 'easy'),
('20000001-0001-4001-8001-000000000007', '10000001-0001-4001-8001-000000000001', 7, 'Paciente com quadro de icterícia, colúria e acolia fecal. A ultrassonografia mostra dilatação de vias biliares intra e extra-hepáticas. Qual a hipótese diagnóstica principal?', 'Clínica Médica', 'Gastroenterologia', 'medium'),
('20000001-0001-4001-8001-000000000008', '10000001-0001-4001-8001-000000000001', 8, 'Recém-nascido apresenta cianose central que não melhora com oxigênio a 100%. Qual a principal suspeita diagnóstica?', 'Pediatria', 'Neonatologia', 'hard'),
('20000001-0001-4001-8001-000000000009', '10000001-0001-4001-8001-000000000001', 9, 'A Estratégia Saúde da Família preconiza uma equipe mínima composta por quais profissionais?', 'Medicina Preventiva', 'Saúde Pública', 'easy'),
('20000001-0001-4001-8001-000000000010', '10000001-0001-4001-8001-000000000001', 10, 'Paciente de 70 anos apresenta dor torácica retroesternal em aperto, irradiada para membro superior esquerdo, com duração de 30 minutos. ECG mostra supradesnivelamento de ST em derivações DII, DIII e aVF. Qual o diagnóstico?', 'Clínica Médica', 'Cardiologia', 'medium');

-- ===== SIMULADO #2 — Cirurgia e Emergência =====
INSERT INTO public.questions (id, simulado_id, question_number, text, area, theme, difficulty) VALUES
('20000001-0001-4001-8001-000000000011', '10000001-0001-4001-8001-000000000002', 1, 'Paciente vítima de acidente automobilístico apresenta hipotensão, taquicardia e distensão abdominal. Qual o exame inicial mais indicado?', 'Cirurgia', 'Trauma', 'medium'),
('20000001-0001-4001-8001-000000000012', '10000001-0001-4001-8001-000000000002', 2, 'Homem de 45 anos com dor abdominal em fossa ilíaca direita, febre e sinal de Blumberg positivo. Qual a conduta?', 'Cirurgia', 'Abdome Agudo', 'easy'),
('20000001-0001-4001-8001-000000000013', '10000001-0001-4001-8001-000000000002', 3, 'Paciente com hérnia inguinal encarcerada há 6 horas, com sinais de sofrimento de alça. Qual a classificação e conduta?', 'Cirurgia', 'Hérnias', 'hard'),
('20000001-0001-4001-8001-000000000014', '10000001-0001-4001-8001-000000000002', 4, 'Qual a sequência correta do ABCDE no atendimento inicial ao politraumatizado?', 'Cirurgia', 'Trauma', 'easy'),
('20000001-0001-4001-8001-000000000015', '10000001-0001-4001-8001-000000000002', 5, 'Paciente com queimadura de 2º grau em 36% da superfície corporal. Qual o volume de Ringer Lactato nas primeiras 24 horas para um paciente de 70 kg?', 'Cirurgia', 'Trauma', 'hard'),
('20000001-0001-4001-8001-000000000016', '10000001-0001-4001-8001-000000000002', 6, 'Paciente com dor epigástrica súbita, abdome em tábua e pneumoperitônio ao raio-X. Qual o diagnóstico mais provável?', 'Cirurgia', 'Abdome Agudo', 'medium'),
('20000001-0001-4001-8001-000000000017', '10000001-0001-4001-8001-000000000002', 7, 'Mulher de 35 anos com nódulo tireoidiano de 2,5 cm, PAAF compatível com Bethesda IV. Qual a conduta?', 'Cirurgia', 'Cirurgia de Cabeça e Pescoço', 'hard'),
('20000001-0001-4001-8001-000000000018', '10000001-0001-4001-8001-000000000002', 8, 'Paciente hipotenso com trauma torácico fechado, desvio de traqueia e ausência de murmúrio vesicular à esquerda. Qual o diagnóstico e conduta imediata?', 'Cirurgia', 'Trauma', 'medium'),
('20000001-0001-4001-8001-000000000019', '10000001-0001-4001-8001-000000000002', 9, 'Paciente com dor abdominal em cólica, vômitos biliosos e parada de eliminação de gases e fezes. Raio-X mostra níveis hidroaéreos. Qual o diagnóstico?', 'Clínica Médica', 'Gastroenterologia', 'medium'),
('20000001-0001-4001-8001-000000000020', '10000001-0001-4001-8001-000000000002', 10, 'Qual a indicação de esplenectomia na púrpura trombocitopênica imune crônica?', 'Cirurgia', 'Cirurgia Geral', 'hard');

-- ===== SIMULADO #3 — Saúde da Mulher e da Criança =====
INSERT INTO public.questions (id, simulado_id, question_number, text, area, theme, difficulty) VALUES
('20000001-0001-4001-8001-000000000021', '10000001-0001-4001-8001-000000000003', 1, 'Gestante de 28 semanas com pressão arterial de 160x110 mmHg, proteinúria de 3+ e cefaleia intensa. Qual o diagnóstico e a conduta inicial?', 'Ginecologia e Obstetrícia', 'Pré-natal', 'hard'),
('20000001-0001-4001-8001-000000000022', '10000001-0001-4001-8001-000000000003', 2, 'Qual o método contraceptivo mais adequado para uma puérpera em aleitamento materno exclusivo?', 'Ginecologia e Obstetrícia', 'Ginecologia', 'easy'),
('20000001-0001-4001-8001-000000000023', '10000001-0001-4001-8001-000000000003', 3, 'Criança de 2 anos com diarreia aquosa há 3 dias, olhos fundos, sinal da prega positivo. Qual a classificação de desidratação e conduta?', 'Pediatria', 'Gastroenterologia Pediátrica', 'medium'),
('20000001-0001-4001-8001-000000000024', '10000001-0001-4001-8001-000000000003', 4, 'Mulher de 50 anos com sangramento uterino anormal na pós-menopausa. Qual o exame inicial mais indicado?', 'Ginecologia e Obstetrícia', 'Ginecologia', 'medium'),
('20000001-0001-4001-8001-000000000025', '10000001-0001-4001-8001-000000000003', 5, 'Recém-nascido prematuro de 32 semanas apresenta desconforto respiratório progressivo nas primeiras horas de vida. Qual a principal hipótese diagnóstica?', 'Pediatria', 'Neonatologia', 'medium'),
('20000001-0001-4001-8001-000000000026', '10000001-0001-4001-8001-000000000003', 6, 'Gestante com diabetes gestacional diagnosticada na 24ª semana. Qual a conduta nutricional e de monitoramento inicial?', 'Ginecologia e Obstetrícia', 'Pré-natal', 'medium'),
('20000001-0001-4001-8001-000000000027', '10000001-0001-4001-8001-000000000003', 7, 'Criança de 5 anos com febre, exantema maculopapular craniocaudal e manchas de Koplik. Qual o diagnóstico?', 'Pediatria', 'Infectologia Pediátrica', 'easy'),
('20000001-0001-4001-8001-000000000028', '10000001-0001-4001-8001-000000000003', 8, 'Qual a principal causa de hemorragia pós-parto imediata?', 'Ginecologia e Obstetrícia', 'Obstetrícia', 'easy'),
('20000001-0001-4001-8001-000000000029', '10000001-0001-4001-8001-000000000003', 9, 'Adolescente de 14 anos com amenorreia primária, desenvolvimento mamário presente e ausência de pelos pubianos. Qual a principal suspeita?', 'Ginecologia e Obstetrícia', 'Ginecologia', 'hard'),
('20000001-0001-4001-8001-000000000030', '10000001-0001-4001-8001-000000000003', 10, 'Lactente de 4 meses em aleitamento materno exclusivo. A mãe questiona sobre a necessidade de suplementação. Qual vitamina deve ser suplementada?', 'Pediatria', 'Puericultura', 'easy');

-- ===== SIMULADO #4 — Medicina Preventiva e Saúde Coletiva =====
INSERT INTO public.questions (id, simulado_id, question_number, text, area, theme, difficulty) VALUES
('20000001-0001-4001-8001-000000000031', '10000001-0001-4001-8001-000000000004', 1, 'Um estudo avalia a associação entre tabagismo e câncer de pulmão acompanhando fumantes e não fumantes por 10 anos. Qual o tipo de estudo?', 'Medicina Preventiva', 'Epidemiologia', 'easy'),
('20000001-0001-4001-8001-000000000032', '10000001-0001-4001-8001-000000000004', 2, 'Qual indicador de saúde reflete a proporção de casos novos de uma doença em uma população em um período específico?', 'Medicina Preventiva', 'Epidemiologia', 'easy'),
('20000001-0001-4001-8001-000000000033', '10000001-0001-4001-8001-000000000004', 3, 'A Política Nacional de Atenção Básica define que cada equipe de Saúde da Família deve ser responsável por quantas pessoas?', 'Medicina Preventiva', 'Saúde Pública', 'medium'),
('20000001-0001-4001-8001-000000000034', '10000001-0001-4001-8001-000000000004', 4, 'Qual o princípio do SUS que garante que todo cidadão tem direito de acesso aos serviços de saúde?', 'Medicina Preventiva', 'Saúde Pública', 'easy'),
('20000001-0001-4001-8001-000000000035', '10000001-0001-4001-8001-000000000004', 5, 'Em um teste diagnóstico com sensibilidade de 95% e especificidade de 80%, qual o significado de um resultado falso-positivo?', 'Medicina Preventiva', 'Epidemiologia', 'medium'),
('20000001-0001-4001-8001-000000000036', '10000001-0001-4001-8001-000000000004', 6, 'Qual a vacina do calendário nacional que protege contra tuberculose e deve ser administrada ao nascimento?', 'Medicina Preventiva', 'Imunização', 'easy'),
('20000001-0001-4001-8001-000000000037', '10000001-0001-4001-8001-000000000004', 7, 'Em vigilância epidemiológica, qual a diferença entre notificação compulsória imediata e semanal?', 'Medicina Preventiva', 'Epidemiologia', 'medium'),
('20000001-0001-4001-8001-000000000038', '10000001-0001-4001-8001-000000000004', 8, 'O Programa Nacional de Imunizações (PNI) recomenda a vacina tríplice viral aos 12 meses. Contra quais doenças ela protege?', 'Medicina Preventiva', 'Imunização', 'easy'),
('20000001-0001-4001-8001-000000000039', '10000001-0001-4001-8001-000000000004', 9, 'Qual a diferença entre eficácia e efetividade de uma vacina?', 'Medicina Preventiva', 'Epidemiologia', 'hard'),
('20000001-0001-4001-8001-000000000040', '10000001-0001-4001-8001-000000000004', 10, 'Município com 50.000 habitantes registrou 500 casos de dengue em 2025. Qual a taxa de incidência por 100.000 habitantes?', 'Medicina Preventiva', 'Epidemiologia', 'medium');

-- ===== SIMULADO #5 — Clínica Médica Avançada =====
INSERT INTO public.questions (id, simulado_id, question_number, text, area, theme, difficulty) VALUES
('20000001-0001-4001-8001-000000000041', '10000001-0001-4001-8001-000000000005', 1, 'Paciente de 60 anos com fibrilação atrial crônica, CHA2DS2-VASc de 4. Qual a conduta anticoagulante mais adequada?', 'Clínica Médica', 'Cardiologia', 'hard'),
('20000001-0001-4001-8001-000000000042', '10000001-0001-4001-8001-000000000005', 2, 'Paciente HIV positivo com CD4 de 150 células/mm³ apresenta febre, tosse seca e infiltrado intersticial bilateral. Qual a hipótese principal?', 'Clínica Médica', 'Infectologia', 'medium'),
('20000001-0001-4001-8001-000000000043', '10000001-0001-4001-8001-000000000005', 3, 'Mulher de 30 anos com taquicardia, tremores, perda de peso e exoftalmia bilateral. TSH suprimido e T4 livre elevado. Qual o diagnóstico?', 'Clínica Médica', 'Endocrinologia', 'easy'),
('20000001-0001-4001-8001-000000000044', '10000001-0001-4001-8001-000000000005', 4, 'Paciente com cirrose hepática Child-Pugh C apresenta encefalopatia hepática grau II. Qual a medicação de primeira linha?', 'Clínica Médica', 'Gastroenterologia', 'medium'),
('20000001-0001-4001-8001-000000000045', '10000001-0001-4001-8001-000000000005', 5, 'Paciente com insuficiência renal crônica estágio 5 (TFG < 15 mL/min). Quais são as indicações absolutas de diálise de urgência?', 'Clínica Médica', 'Nefrologia', 'hard'),
('20000001-0001-4001-8001-000000000046', '10000001-0001-4001-8001-000000000005', 6, 'Homem de 50 anos com dor articular em primeira metatarsofalangeana, ácido úrico sérico de 9,5 mg/dL. Qual o diagnóstico e tratamento da crise aguda?', 'Clínica Médica', 'Reumatologia', 'medium'),
('20000001-0001-4001-8001-000000000047', '10000001-0001-4001-8001-000000000005', 7, 'Paciente com anemia megaloblástica, glossite e parestesias em membros inferiores. Qual a deficiência mais provável?', 'Clínica Médica', 'Hematologia', 'easy'),
('20000001-0001-4001-8001-000000000048', '10000001-0001-4001-8001-000000000005', 8, 'Jovem de 25 anos com pneumonia adquirida na comunidade, sem comorbidades, CURB-65 = 0. Qual o tratamento ambulatorial de escolha?', 'Clínica Médica', 'Pneumologia', 'easy'),
('20000001-0001-4001-8001-000000000049', '10000001-0001-4001-8001-000000000005', 9, 'Paciente com colecistite aguda litiásica. Qual o melhor momento para a colecistectomia laparoscópica?', 'Cirurgia', 'Cirurgia Geral', 'medium'),
('20000001-0001-4001-8001-000000000050', '10000001-0001-4001-8001-000000000005', 10, 'Paciente de 40 anos com dispneia progressiva, tosse seca e infiltrado em vidro fosco bilateral. Qual o principal diagnóstico diferencial?', 'Clínica Médica', 'Pneumologia', 'hard');

-- ===== SIMULADO #6 — Revisão Geral ENAMED =====
INSERT INTO public.questions (id, simulado_id, question_number, text, area, theme, difficulty) VALUES
('20000001-0001-4001-8001-000000000051', '10000001-0001-4001-8001-000000000006', 1, 'Paciente de 65 anos com dor precordial típica, troponina elevada e infradesnivelamento de ST. Qual a classificação do evento coronariano?', 'Clínica Médica', 'Cardiologia', 'medium'),
('20000001-0001-4001-8001-000000000052', '10000001-0001-4001-8001-000000000006', 2, 'Gestante com bolsa rota há 20 horas e temperatura de 38,5°C. Qual a principal complicação e conduta?', 'Ginecologia e Obstetrícia', 'Obstetrícia', 'hard'),
('20000001-0001-4001-8001-000000000053', '10000001-0001-4001-8001-000000000006', 3, 'Criança de 8 anos com edema periorbital, hipertensão e hematúria macroscópica 2 semanas após faringite. Qual o diagnóstico?', 'Pediatria', 'Nefrologia Pediátrica', 'medium'),
('20000001-0001-4001-8001-000000000054', '10000001-0001-4001-8001-000000000006', 4, 'Paciente com apendicite perfurada e abscesso pélvico. Qual a conduta cirúrgica?', 'Cirurgia', 'Abdome Agudo', 'hard'),
('20000001-0001-4001-8001-000000000055', '10000001-0001-4001-8001-000000000006', 5, 'Qual o conceito de integralidade no SUS segundo a Lei 8.080/90?', 'Medicina Preventiva', 'Saúde Pública', 'easy'),
('20000001-0001-4001-8001-000000000056', '10000001-0001-4001-8001-000000000006', 6, 'Paciente com cetoacidose diabética. Qual a prioridade no manejo inicial?', 'Clínica Médica', 'Endocrinologia', 'medium'),
('20000001-0001-4001-8001-000000000057', '10000001-0001-4001-8001-000000000006', 7, 'Mulher de 28 anos com massa anexial complexa e beta-hCG elevado. Qual a principal hipótese diagnóstica?', 'Ginecologia e Obstetrícia', 'Ginecologia', 'medium'),
('20000001-0001-4001-8001-000000000058', '10000001-0001-4001-8001-000000000006', 8, 'Recém-nascido com icterícia nas primeiras 24 horas de vida. Qual a causa mais provável?', 'Pediatria', 'Neonatologia', 'medium'),
('20000001-0001-4001-8001-000000000059', '10000001-0001-4001-8001-000000000006', 9, 'Paciente vítima de FAF em abdome com instabilidade hemodinâmica. Qual a conduta?', 'Cirurgia', 'Trauma', 'easy'),
('20000001-0001-4001-8001-000000000060', '10000001-0001-4001-8001-000000000006', 10, 'Em um ensaio clínico randomizado, qual a função da randomização?', 'Medicina Preventiva', 'Epidemiologia', 'easy');

-- ==========================================
-- STEP 4: Create 4 options per question (240 total)
-- Pattern: option A=1, B=2, C=3, D=4 for each question
-- Correct answer varies per question
-- ==========================================

-- Helper: Generate options for all 60 questions
-- SIMULADO #1, Q1 (correct: A - ICC)
INSERT INTO public.question_options (id, question_id, label, text, is_correct) VALUES
('30000001-0001-4001-a001-000000000001', '20000001-0001-4001-8001-000000000001', 'A', 'Insuficiência cardíaca congestiva', true),
('30000001-0001-4001-a001-000000000002', '20000001-0001-4001-8001-000000000001', 'B', 'Tromboembolismo pulmonar', false),
('30000001-0001-4001-a001-000000000003', '20000001-0001-4001-8001-000000000001', 'C', 'Síndrome nefrótica', false),
('30000001-0001-4001-a001-000000000004', '20000001-0001-4001-8001-000000000001', 'D', 'Cirrose hepática descompensada', false);

-- Q2 (correct: B - punção lombar)
INSERT INTO public.question_options (id, question_id, label, text, is_correct) VALUES
('30000001-0001-4001-a002-000000000001', '20000001-0001-4001-8001-000000000002', 'A', 'Prescrever antitérmico e observar', false),
('30000001-0001-4001-a002-000000000002', '20000001-0001-4001-8001-000000000002', 'B', 'Realizar punção lombar e iniciar antibioticoterapia empírica', true),
('30000001-0001-4001-a002-000000000003', '20000001-0001-4001-8001-000000000002', 'C', 'Solicitar tomografia de crânio', false),
('30000001-0001-4001-a002-000000000004', '20000001-0001-4001-8001-000000000002', 'D', 'Iniciar anticonvulsivante profilático', false);

-- Q3 (correct: C - trienal)
INSERT INTO public.question_options (id, question_id, label, text, is_correct) VALUES
('30000001-0001-4001-a003-000000000001', '20000001-0001-4001-8001-000000000003', 'A', 'Anualmente', false),
('30000001-0001-4001-a003-000000000002', '20000001-0001-4001-8001-000000000003', 'B', 'Bienalmente', false),
('30000001-0001-4001-a003-000000000003', '20000001-0001-4001-8001-000000000003', 'C', 'Trienal, após dois exames anuais normais', true),
('30000001-0001-4001-a003-000000000004', '20000001-0001-4001-8001-000000000003', 'D', 'A cada 5 anos', false);

-- Q4 (correct: D - insulina)
INSERT INTO public.question_options (id, question_id, label, text, is_correct) VALUES
('30000001-0001-4001-a004-000000000001', '20000001-0001-4001-8001-000000000004', 'A', 'Aumentar dose de metformina', false),
('30000001-0001-4001-a004-000000000002', '20000001-0001-4001-8001-000000000004', 'B', 'Adicionar sulfonilureia', false),
('30000001-0001-4001-a004-000000000003', '20000001-0001-4001-8001-000000000004', 'C', 'Iniciar inibidor de SGLT2', false),
('30000001-0001-4001-a004-000000000004', '20000001-0001-4001-8001-000000000004', 'D', 'Iniciar insulinoterapia', true);

-- Q5 (correct: A - Bordetella pertussis)
INSERT INTO public.question_options (id, question_id, label, text, is_correct) VALUES
('30000001-0001-4001-a005-000000000001', '20000001-0001-4001-8001-000000000005', 'A', 'Bordetella pertussis', true),
('30000001-0001-4001-a005-000000000002', '20000001-0001-4001-8001-000000000005', 'B', 'Mycoplasma pneumoniae', false),
('30000001-0001-4001-a005-000000000003', '20000001-0001-4001-8001-000000000005', 'C', 'Vírus sincicial respiratório', false),
('30000001-0001-4001-a005-000000000004', '20000001-0001-4001-8001-000000000005', 'D', 'Haemophilus influenzae', false);

-- Q6 (correct: B - sensibilidade)
INSERT INTO public.question_options (id, question_id, label, text, is_correct) VALUES
('30000001-0001-4001-a006-000000000001', '20000001-0001-4001-8001-000000000006', 'A', 'Especificidade', false),
('30000001-0001-4001-a006-000000000002', '20000001-0001-4001-8001-000000000006', 'B', 'Sensibilidade', true),
('30000001-0001-4001-a006-000000000003', '20000001-0001-4001-8001-000000000006', 'C', 'Valor preditivo positivo', false),
('30000001-0001-4001-a006-000000000004', '20000001-0001-4001-8001-000000000006', 'D', 'Acurácia', false);

-- Q7 (correct: C - neoplasia periampular)
INSERT INTO public.question_options (id, question_id, label, text, is_correct) VALUES
('30000001-0001-4001-a007-000000000001', '20000001-0001-4001-8001-000000000007', 'A', 'Hepatite viral aguda', false),
('30000001-0001-4001-a007-000000000002', '20000001-0001-4001-8001-000000000007', 'B', 'Coledocolitíase', false),
('30000001-0001-4001-a007-000000000003', '20000001-0001-4001-8001-000000000007', 'C', 'Neoplasia de cabeça de pâncreas', true),
('30000001-0001-4001-a007-000000000004', '20000001-0001-4001-8001-000000000007', 'D', 'Colangite esclerosante primária', false);

-- Q8 (correct: D - cardiopatia congênita cianótica)
INSERT INTO public.question_options (id, question_id, label, text, is_correct) VALUES
('30000001-0001-4001-a008-000000000001', '20000001-0001-4001-8001-000000000008', 'A', 'Doença da membrana hialina', false),
('30000001-0001-4001-a008-000000000002', '20000001-0001-4001-8001-000000000008', 'B', 'Taquipneia transitória do recém-nascido', false),
('30000001-0001-4001-a008-000000000003', '20000001-0001-4001-8001-000000000008', 'C', 'Pneumonia neonatal', false),
('30000001-0001-4001-a008-000000000004', '20000001-0001-4001-8001-000000000008', 'D', 'Cardiopatia congênita cianótica', true);

-- Q9 (correct: A - médico, enfermeiro, ACS, técnico)
INSERT INTO public.question_options (id, question_id, label, text, is_correct) VALUES
('30000001-0001-4001-a009-000000000001', '20000001-0001-4001-8001-000000000009', 'A', 'Médico, enfermeiro, técnico de enfermagem e agentes comunitários de saúde', true),
('30000001-0001-4001-a009-000000000002', '20000001-0001-4001-8001-000000000009', 'B', 'Médico, enfermeiro e assistente social', false),
('30000001-0001-4001-a009-000000000003', '20000001-0001-4001-8001-000000000009', 'C', 'Médico, enfermeiro, dentista e nutricionista', false),
('30000001-0001-4001-a009-000000000004', '20000001-0001-4001-8001-000000000009', 'D', 'Médico, farmacêutico e agentes comunitários de saúde', false);

-- Q10 (correct: B - IAM inferior)
INSERT INTO public.question_options (id, question_id, label, text, is_correct) VALUES
('30000001-0001-4001-a010-000000000001', '20000001-0001-4001-8001-000000000010', 'A', 'Infarto agudo do miocárdio de parede anterior', false),
('30000001-0001-4001-a010-000000000002', '20000001-0001-4001-8001-000000000010', 'B', 'Infarto agudo do miocárdio de parede inferior', true),
('30000001-0001-4001-a010-000000000003', '20000001-0001-4001-8001-000000000010', 'C', 'Pericardite aguda', false),
('30000001-0001-4001-a010-000000000004', '20000001-0001-4001-8001-000000000010', 'D', 'Dissecção aórtica', false);

-- SIMULADO #2 options
-- Q11 (correct: B - FAST)
INSERT INTO public.question_options (id, question_id, label, text, is_correct) VALUES
('30000001-0001-4001-a011-000000000001', '20000001-0001-4001-8001-000000000011', 'A', 'Tomografia computadorizada de abdome', false),
('30000001-0001-4001-a011-000000000002', '20000001-0001-4001-8001-000000000011', 'B', 'FAST (Focused Assessment with Sonography for Trauma)', true),
('30000001-0001-4001-a011-000000000003', '20000001-0001-4001-8001-000000000011', 'C', 'Lavado peritoneal diagnóstico', false),
('30000001-0001-4001-a011-000000000004', '20000001-0001-4001-8001-000000000011', 'D', 'Raio-X de abdome', false);

-- Q12 (correct: C - apendicectomia)
INSERT INTO public.question_options (id, question_id, label, text, is_correct) VALUES
('30000001-0001-4001-a012-000000000001', '20000001-0001-4001-8001-000000000012', 'A', 'Tratamento conservador com antibióticos', false),
('30000001-0001-4001-a012-000000000002', '20000001-0001-4001-8001-000000000012', 'B', 'Solicitar tomografia e reavaliar', false),
('30000001-0001-4001-a012-000000000003', '20000001-0001-4001-8001-000000000012', 'C', 'Apendicectomia de urgência', true),
('30000001-0001-4001-a012-000000000004', '20000001-0001-4001-8001-000000000012', 'D', 'Drenagem percutânea guiada por ultrassom', false);

-- Q13 (correct: A - estrangulada, cirurgia imediata)
INSERT INTO public.question_options (id, question_id, label, text, is_correct) VALUES
('30000001-0001-4001-a013-000000000001', '20000001-0001-4001-8001-000000000013', 'A', 'Hérnia estrangulada, indicação de cirurgia de urgência', true),
('30000001-0001-4001-a013-000000000002', '20000001-0001-4001-8001-000000000013', 'B', 'Hérnia encarcerada, tentativa de redução manual', false),
('30000001-0001-4001-a013-000000000003', '20000001-0001-4001-8001-000000000013', 'C', 'Hérnia redutível, cirurgia eletiva', false),
('30000001-0001-4001-a013-000000000004', '20000001-0001-4001-8001-000000000013', 'D', 'Hérnia incisional, uso de cinta abdominal', false);

-- Q14 (correct: A - ABCDE)
INSERT INTO public.question_options (id, question_id, label, text, is_correct) VALUES
('30000001-0001-4001-a014-000000000001', '20000001-0001-4001-8001-000000000014', 'A', 'Via aérea, Respiração, Circulação, Déficit neurológico, Exposição', true),
('30000001-0001-4001-a014-000000000002', '20000001-0001-4001-8001-000000000014', 'B', 'Circulação, Via aérea, Respiração, Déficit neurológico, Exposição', false),
('30000001-0001-4001-a014-000000000003', '20000001-0001-4001-8001-000000000014', 'C', 'Via aérea, Circulação, Respiração, Exposição, Déficit neurológico', false),
('30000001-0001-4001-a014-000000000004', '20000001-0001-4001-8001-000000000014', 'D', 'Respiração, Via aérea, Circulação, Exposição, Déficit neurológico', false);

-- Q15 (correct: C - Parkland formula)
INSERT INTO public.question_options (id, question_id, label, text, is_correct) VALUES
('30000001-0001-4001-a015-000000000001', '20000001-0001-4001-8001-000000000015', 'A', 'Aproximadamente 5.000 mL', false),
('30000001-0001-4001-a015-000000000002', '20000001-0001-4001-8001-000000000015', 'B', 'Aproximadamente 7.500 mL', false),
('30000001-0001-4001-a015-000000000003', '20000001-0001-4001-8001-000000000015', 'C', 'Aproximadamente 10.080 mL (4 mL x 70 kg x 36%)', true),
('30000001-0001-4001-a015-000000000004', '20000001-0001-4001-8001-000000000015', 'D', 'Aproximadamente 15.000 mL', false);

-- Q16 (correct: B - úlcera perfurada)
INSERT INTO public.question_options (id, question_id, label, text, is_correct) VALUES
('30000001-0001-4001-a016-000000000001', '20000001-0001-4001-8001-000000000016', 'A', 'Pancreatite aguda necrosante', false),
('30000001-0001-4001-a016-000000000002', '20000001-0001-4001-8001-000000000016', 'B', 'Úlcera péptica perfurada', true),
('30000001-0001-4001-a016-000000000003', '20000001-0001-4001-8001-000000000016', 'C', 'Colecistite aguda enfisematosa', false),
('30000001-0001-4001-a016-000000000004', '20000001-0001-4001-8001-000000000016', 'D', 'Diverticulite perfurada', false);

-- Q17 (correct: D - lobectomia)
INSERT INTO public.question_options (id, question_id, label, text, is_correct) VALUES
('30000001-0001-4001-a017-000000000001', '20000001-0001-4001-8001-000000000017', 'A', 'Repetir PAAF em 6 meses', false),
('30000001-0001-4001-a017-000000000002', '20000001-0001-4001-8001-000000000017', 'B', 'Tireoidectomia total imediata', false),
('30000001-0001-4001-a017-000000000003', '20000001-0001-4001-8001-000000000017', 'C', 'Acompanhamento clínico sem intervenção', false),
('30000001-0001-4001-a017-000000000004', '20000001-0001-4001-8001-000000000017', 'D', 'Lobectomia tireoidiana diagnóstica', true);

-- Q18 (correct: A - pneumotórax hipertensivo, descompressão)
INSERT INTO public.question_options (id, question_id, label, text, is_correct) VALUES
('30000001-0001-4001-a018-000000000001', '20000001-0001-4001-8001-000000000018', 'A', 'Pneumotórax hipertensivo, descompressão torácica imediata', true),
('30000001-0001-4001-a018-000000000002', '20000001-0001-4001-8001-000000000018', 'B', 'Hemotórax maciço, drenagem torácica', false),
('30000001-0001-4001-a018-000000000003', '20000001-0001-4001-8001-000000000018', 'C', 'Tamponamento cardíaco, pericardiocentese', false),
('30000001-0001-4001-a018-000000000004', '20000001-0001-4001-8001-000000000018', 'D', 'Contusão pulmonar, oxigenoterapia', false);

-- Q19 (correct: C - obstrução intestinal)
INSERT INTO public.question_options (id, question_id, label, text, is_correct) VALUES
('30000001-0001-4001-a019-000000000001', '20000001-0001-4001-8001-000000000019', 'A', 'Pancreatite aguda', false),
('30000001-0001-4001-a019-000000000002', '20000001-0001-4001-8001-000000000019', 'B', 'Úlcera péptica perfurada', false),
('30000001-0001-4001-a019-000000000003', '20000001-0001-4001-8001-000000000019', 'C', 'Obstrução intestinal mecânica', true),
('30000001-0001-4001-a019-000000000004', '20000001-0001-4001-8001-000000000019', 'D', 'Gastroenterite aguda', false);

-- Q20 (correct: B - refratariedade a corticoide)
INSERT INTO public.question_options (id, question_id, label, text, is_correct) VALUES
('30000001-0001-4001-a020-000000000001', '20000001-0001-4001-8001-000000000020', 'A', 'Plaquetas abaixo de 50.000/mm³ em qualquer momento', false),
('30000001-0001-4001-a020-000000000002', '20000001-0001-4001-8001-000000000020', 'B', 'Falha ou dependência de corticoterapia após 6-12 meses', true),
('30000001-0001-4001-a020-000000000003', '20000001-0001-4001-8001-000000000020', 'C', 'Presença de esplenomegalia ao exame físico', false),
('30000001-0001-4001-a020-000000000004', '20000001-0001-4001-8001-000000000020', 'D', 'Diagnóstico confirmado de PTI em qualquer faixa etária', false);

-- SIMULADO #3 options
-- Q21 (correct: C - pré-eclâmpsia grave, sulfato de magnésio)
INSERT INTO public.question_options (id, question_id, label, text, is_correct) VALUES
('30000001-0001-4001-a021-000000000001', '20000001-0001-4001-8001-000000000021', 'A', 'Hipertensão gestacional, iniciar anti-hipertensivo oral', false),
('30000001-0001-4001-a021-000000000002', '20000001-0001-4001-8001-000000000021', 'B', 'Eclâmpsia iminente, parto cesáreo imediato', false),
('30000001-0001-4001-a021-000000000003', '20000001-0001-4001-8001-000000000021', 'C', 'Pré-eclâmpsia grave, iniciar sulfato de magnésio e anti-hipertensivo parenteral', true),
('30000001-0001-4001-a021-000000000004', '20000001-0001-4001-8001-000000000021', 'D', 'Hipertensão crônica, ajustar medicação prévia', false);

-- Q22 (correct: A - minipílula)
INSERT INTO public.question_options (id, question_id, label, text, is_correct) VALUES
('30000001-0001-4001-a022-000000000001', '20000001-0001-4001-8001-000000000022', 'A', 'Minipílula (progestágeno isolado)', true),
('30000001-0001-4001-a022-000000000002', '20000001-0001-4001-8001-000000000022', 'B', 'Anticoncepcional combinado oral', false),
('30000001-0001-4001-a022-000000000003', '20000001-0001-4001-8001-000000000022', 'C', 'Anel vaginal combinado', false),
('30000001-0001-4001-a022-000000000004', '20000001-0001-4001-8001-000000000022', 'D', 'Adesivo transdérmico combinado', false);

-- Q23 (correct: B - desidratação grave, reidratação IV)
INSERT INTO public.question_options (id, question_id, label, text, is_correct) VALUES
('30000001-0001-4001-a023-000000000001', '20000001-0001-4001-8001-000000000023', 'A', 'Desidratação leve, soro de reidratação oral em domicílio', false),
('30000001-0001-4001-a023-000000000002', '20000001-0001-4001-8001-000000000023', 'B', 'Desidratação grave, reidratação venosa com plano C', true),
('30000001-0001-4001-a023-000000000003', '20000001-0001-4001-8001-000000000023', 'C', 'Sem desidratação, orientar sinais de alarme', false),
('30000001-0001-4001-a023-000000000004', '20000001-0001-4001-8001-000000000023', 'D', 'Desidratação moderada, reidratação oral supervisionada', false);

-- Q24 (correct: D - USTV)
INSERT INTO public.question_options (id, question_id, label, text, is_correct) VALUES
('30000001-0001-4001-a024-000000000001', '20000001-0001-4001-8001-000000000024', 'A', 'Histeroscopia diagnóstica', false),
('30000001-0001-4001-a024-000000000002', '20000001-0001-4001-8001-000000000024', 'B', 'Ressonância magnética pélvica', false),
('30000001-0001-4001-a024-000000000003', '20000001-0001-4001-8001-000000000024', 'C', 'Citologia oncótica', false),
('30000001-0001-4001-a024-000000000004', '20000001-0001-4001-8001-000000000024', 'D', 'Ultrassonografia transvaginal', true);

-- Q25 (correct: A - doença da membrana hialina)
INSERT INTO public.question_options (id, question_id, label, text, is_correct) VALUES
('30000001-0001-4001-a025-000000000001', '20000001-0001-4001-8001-000000000025', 'A', 'Doença da membrana hialina (síndrome do desconforto respiratório)', true),
('30000001-0001-4001-a025-000000000002', '20000001-0001-4001-8001-000000000025', 'B', 'Pneumonia neonatal', false),
('30000001-0001-4001-a025-000000000003', '20000001-0001-4001-8001-000000000025', 'C', 'Aspiração meconial', false),
('30000001-0001-4001-a025-000000000004', '20000001-0001-4001-8001-000000000025', 'D', 'Hérnia diafragmática congênita', false);

-- Q26 (correct: C - dieta + monitoramento glicêmico)
INSERT INTO public.question_options (id, question_id, label, text, is_correct) VALUES
('30000001-0001-4001-a026-000000000001', '20000001-0001-4001-8001-000000000026', 'A', 'Iniciar insulina imediatamente', false),
('30000001-0001-4001-a026-000000000002', '20000001-0001-4001-8001-000000000026', 'B', 'Prescrever metformina e encaminhar ao endocrinologista', false),
('30000001-0001-4001-a026-000000000003', '20000001-0001-4001-8001-000000000026', 'C', 'Orientação nutricional com dieta fracionada e monitoramento glicêmico capilar', true),
('30000001-0001-4001-a026-000000000004', '20000001-0001-4001-8001-000000000026', 'D', 'Apenas restrição calórica sem monitoramento', false);

-- Q27 (correct: B - sarampo)
INSERT INTO public.question_options (id, question_id, label, text, is_correct) VALUES
('30000001-0001-4001-a027-000000000001', '20000001-0001-4001-8001-000000000027', 'A', 'Rubéola', false),
('30000001-0001-4001-a027-000000000002', '20000001-0001-4001-8001-000000000027', 'B', 'Sarampo', true),
('30000001-0001-4001-a027-000000000003', '20000001-0001-4001-8001-000000000027', 'C', 'Escarlatina', false),
('30000001-0001-4001-a027-000000000004', '20000001-0001-4001-8001-000000000027', 'D', 'Eritema infeccioso', false);

-- Q28 (correct: A - atonia uterina)
INSERT INTO public.question_options (id, question_id, label, text, is_correct) VALUES
('30000001-0001-4001-a028-000000000001', '20000001-0001-4001-8001-000000000028', 'A', 'Atonia uterina', true),
('30000001-0001-4001-a028-000000000002', '20000001-0001-4001-8001-000000000028', 'B', 'Laceração do canal de parto', false),
('30000001-0001-4001-a028-000000000003', '20000001-0001-4001-8001-000000000028', 'C', 'Retenção placentária', false),
('30000001-0001-4001-a028-000000000004', '20000001-0001-4001-8001-000000000028', 'D', 'Coagulopatia', false);

-- Q29 (correct: D - síndrome de insensibilidade androgênica)
INSERT INTO public.question_options (id, question_id, label, text, is_correct) VALUES
('30000001-0001-4001-a029-000000000001', '20000001-0001-4001-8001-000000000029', 'A', 'Síndrome de Turner', false),
('30000001-0001-4001-a029-000000000002', '20000001-0001-4001-8001-000000000029', 'B', 'Hiperplasia adrenal congênita', false),
('30000001-0001-4001-a029-000000000003', '20000001-0001-4001-8001-000000000029', 'C', 'Síndrome de Mayer-Rokitansky-Küster-Hauser', false),
('30000001-0001-4001-a029-000000000004', '20000001-0001-4001-8001-000000000029', 'D', 'Síndrome de insensibilidade androgênica completa', true);

-- Q30 (correct: C - vitamina D)
INSERT INTO public.question_options (id, question_id, label, text, is_correct) VALUES
('30000001-0001-4001-a030-000000000001', '20000001-0001-4001-8001-000000000030', 'A', 'Vitamina A', false),
('30000001-0001-4001-a030-000000000002', '20000001-0001-4001-8001-000000000030', 'B', 'Ferro elementar', false),
('30000001-0001-4001-a030-000000000003', '20000001-0001-4001-8001-000000000030', 'C', 'Vitamina D', true),
('30000001-0001-4001-a030-000000000004', '20000001-0001-4001-8001-000000000030', 'D', 'Vitamina K', false);

-- SIMULADO #4 options
-- Q31 (correct: B - coorte)
INSERT INTO public.question_options (id, question_id, label, text, is_correct) VALUES
('30000001-0001-4001-a031-000000000001', '20000001-0001-4001-8001-000000000031', 'A', 'Estudo caso-controle', false),
('30000001-0001-4001-a031-000000000002', '20000001-0001-4001-8001-000000000031', 'B', 'Estudo de coorte prospectivo', true),
('30000001-0001-4001-a031-000000000003', '20000001-0001-4001-8001-000000000031', 'C', 'Estudo transversal', false),
('30000001-0001-4001-a031-000000000004', '20000001-0001-4001-8001-000000000031', 'D', 'Ensaio clínico randomizado', false);

-- Q32 (correct: A - incidência)
INSERT INTO public.question_options (id, question_id, label, text, is_correct) VALUES
('30000001-0001-4001-a032-000000000001', '20000001-0001-4001-8001-000000000032', 'A', 'Incidência', true),
('30000001-0001-4001-a032-000000000002', '20000001-0001-4001-8001-000000000032', 'B', 'Prevalência', false),
('30000001-0001-4001-a032-000000000003', '20000001-0001-4001-8001-000000000032', 'C', 'Mortalidade', false),
('30000001-0001-4001-a032-000000000004', '20000001-0001-4001-8001-000000000032', 'D', 'Letalidade', false);

-- Q33 (correct: C - 2000 a 3500)
INSERT INTO public.question_options (id, question_id, label, text, is_correct) VALUES
('30000001-0001-4001-a033-000000000001', '20000001-0001-4001-8001-000000000033', 'A', 'Até 1.000 pessoas', false),
('30000001-0001-4001-a033-000000000002', '20000001-0001-4001-8001-000000000033', 'B', 'Entre 1.000 e 2.000 pessoas', false),
('30000001-0001-4001-a033-000000000003', '20000001-0001-4001-8001-000000000033', 'C', 'Entre 2.000 e 3.500 pessoas', true),
('30000001-0001-4001-a033-000000000004', '20000001-0001-4001-8001-000000000033', 'D', 'Entre 5.000 e 10.000 pessoas', false);

-- Q34 (correct: D - universalidade)
INSERT INTO public.question_options (id, question_id, label, text, is_correct) VALUES
('30000001-0001-4001-a034-000000000001', '20000001-0001-4001-8001-000000000034', 'A', 'Equidade', false),
('30000001-0001-4001-a034-000000000002', '20000001-0001-4001-8001-000000000034', 'B', 'Integralidade', false),
('30000001-0001-4001-a034-000000000003', '20000001-0001-4001-8001-000000000034', 'C', 'Descentralização', false),
('30000001-0001-4001-a034-000000000004', '20000001-0001-4001-8001-000000000034', 'D', 'Universalidade', true);

-- Q35 (correct: B - pessoa saudável identificada como doente)
INSERT INTO public.question_options (id, question_id, label, text, is_correct) VALUES
('30000001-0001-4001-a035-000000000001', '20000001-0001-4001-8001-000000000035', 'A', 'Pessoa doente com resultado negativo', false),
('30000001-0001-4001-a035-000000000002', '20000001-0001-4001-8001-000000000035', 'B', 'Pessoa saudável com resultado positivo', true),
('30000001-0001-4001-a035-000000000003', '20000001-0001-4001-8001-000000000035', 'C', 'Pessoa doente com resultado positivo', false),
('30000001-0001-4001-a035-000000000004', '20000001-0001-4001-8001-000000000035', 'D', 'Pessoa saudável com resultado negativo', false);

-- Q36 (correct: A - BCG)
INSERT INTO public.question_options (id, question_id, label, text, is_correct) VALUES
('30000001-0001-4001-a036-000000000001', '20000001-0001-4001-8001-000000000036', 'A', 'BCG', true),
('30000001-0001-4001-a036-000000000002', '20000001-0001-4001-8001-000000000036', 'B', 'Hepatite B', false),
('30000001-0001-4001-a036-000000000003', '20000001-0001-4001-8001-000000000036', 'C', 'Pentavalente', false),
('30000001-0001-4001-a036-000000000004', '20000001-0001-4001-8001-000000000036', 'D', 'VIP', false);

-- Q37 (correct: C - imediata 24h, semanal até 7 dias)
INSERT INTO public.question_options (id, question_id, label, text, is_correct) VALUES
('30000001-0001-4001-a037-000000000001', '20000001-0001-4001-8001-000000000037', 'A', 'Não há diferença, ambas são feitas em até 30 dias', false),
('30000001-0001-4001-a037-000000000002', '20000001-0001-4001-8001-000000000037', 'B', 'Imediata é para doenças graves e semanal para doenças crônicas', false),
('30000001-0001-4001-a037-000000000003', '20000001-0001-4001-8001-000000000037', 'C', 'Imediata deve ser feita em até 24 horas; semanal até o final da semana epidemiológica', true),
('30000001-0001-4001-a037-000000000004', '20000001-0001-4001-8001-000000000037', 'D', 'Imediata é exclusiva para surtos e semanal para casos isolados', false);

-- Q38 (correct: B - sarampo, caxumba, rubéola)
INSERT INTO public.question_options (id, question_id, label, text, is_correct) VALUES
('30000001-0001-4001-a038-000000000001', '20000001-0001-4001-8001-000000000038', 'A', 'Difteria, tétano e coqueluche', false),
('30000001-0001-4001-a038-000000000002', '20000001-0001-4001-8001-000000000038', 'B', 'Sarampo, caxumba e rubéola', true),
('30000001-0001-4001-a038-000000000003', '20000001-0001-4001-8001-000000000038', 'C', 'Hepatite A, hepatite B e poliomielite', false),
('30000001-0001-4001-a038-000000000004', '20000001-0001-4001-8001-000000000038', 'D', 'Varicela, rotavírus e meningite', false);

-- Q39 (correct: D)
INSERT INTO public.question_options (id, question_id, label, text, is_correct) VALUES
('30000001-0001-4001-a039-000000000001', '20000001-0001-4001-8001-000000000039', 'A', 'Ambas medem o mesmo resultado em populações diferentes', false),
('30000001-0001-4001-a039-000000000002', '20000001-0001-4001-8001-000000000039', 'B', 'Eficácia é medida em estudos observacionais e efetividade em ensaios clínicos', false),
('30000001-0001-4001-a039-000000000003', '20000001-0001-4001-8001-000000000039', 'C', 'Efetividade é sempre superior à eficácia', false),
('30000001-0001-4001-a039-000000000004', '20000001-0001-4001-8001-000000000039', 'D', 'Eficácia é medida em condições ideais (ensaio clínico); efetividade em condições reais', true);

-- Q40 (correct: C - 1000)
INSERT INTO public.question_options (id, question_id, label, text, is_correct) VALUES
('30000001-0001-4001-a040-000000000001', '20000001-0001-4001-8001-000000000040', 'A', '500 por 100.000 habitantes', false),
('30000001-0001-4001-a040-000000000002', '20000001-0001-4001-8001-000000000040', 'B', '100 por 100.000 habitantes', false),
('30000001-0001-4001-a040-000000000003', '20000001-0001-4001-8001-000000000040', 'C', '1.000 por 100.000 habitantes', true),
('30000001-0001-4001-a040-000000000004', '20000001-0001-4001-8001-000000000040', 'D', '5.000 por 100.000 habitantes', false);

-- SIMULADO #5 options
-- Q41 (correct: C - DOAC)
INSERT INTO public.question_options (id, question_id, label, text, is_correct) VALUES
('30000001-0001-4001-a041-000000000001', '20000001-0001-4001-8001-000000000041', 'A', 'AAS isolado', false),
('30000001-0001-4001-a041-000000000002', '20000001-0001-4001-8001-000000000041', 'B', 'Varfarina com controle de INR', false),
('30000001-0001-4001-a041-000000000003', '20000001-0001-4001-8001-000000000041', 'C', 'Anticoagulante oral direto (rivaroxabana ou apixabana)', true),
('30000001-0001-4001-a041-000000000004', '20000001-0001-4001-8001-000000000041', 'D', 'Clopidogrel associado a AAS', false);

-- Q42 (correct: B - PCP)
INSERT INTO public.question_options (id, question_id, label, text, is_correct) VALUES
('30000001-0001-4001-a042-000000000001', '20000001-0001-4001-8001-000000000042', 'A', 'Tuberculose pulmonar', false),
('30000001-0001-4001-a042-000000000002', '20000001-0001-4001-8001-000000000042', 'B', 'Pneumocistose (Pneumocystis jirovecii)', true),
('30000001-0001-4001-a042-000000000003', '20000001-0001-4001-8001-000000000042', 'C', 'Sarcoma de Kaposi pulmonar', false),
('30000001-0001-4001-a042-000000000004', '20000001-0001-4001-8001-000000000042', 'D', 'Pneumonia bacteriana comunitária', false);

-- Q43 (correct: A - Graves)
INSERT INTO public.question_options (id, question_id, label, text, is_correct) VALUES
('30000001-0001-4001-a043-000000000001', '20000001-0001-4001-8001-000000000043', 'A', 'Doença de Graves', true),
('30000001-0001-4001-a043-000000000002', '20000001-0001-4001-8001-000000000043', 'B', 'Tireoidite de Hashimoto', false),
('30000001-0001-4001-a043-000000000003', '20000001-0001-4001-8001-000000000043', 'C', 'Adenoma tóxico', false),
('30000001-0001-4001-a043-000000000004', '20000001-0001-4001-8001-000000000043', 'D', 'Bócio multinodular tóxico', false);

-- Q44 (correct: D - lactulose)
INSERT INTO public.question_options (id, question_id, label, text, is_correct) VALUES
('30000001-0001-4001-a044-000000000001', '20000001-0001-4001-8001-000000000044', 'A', 'Flumazenil', false),
('30000001-0001-4001-a044-000000000002', '20000001-0001-4001-8001-000000000044', 'B', 'Metronidazol', false),
('30000001-0001-4001-a044-000000000003', '20000001-0001-4001-8001-000000000044', 'C', 'N-acetilcisteína', false),
('30000001-0001-4001-a044-000000000004', '20000001-0001-4001-8001-000000000044', 'D', 'Lactulose', true);

-- Q45 (correct: A - hipercalemia refratária, edema pulmonar, acidose grave)
INSERT INTO public.question_options (id, question_id, label, text, is_correct) VALUES
('30000001-0001-4001-a045-000000000001', '20000001-0001-4001-8001-000000000045', 'A', 'Hipercalemia refratária, edema agudo de pulmão, acidose metabólica grave e uremia sintomática', true),
('30000001-0001-4001-a045-000000000002', '20000001-0001-4001-8001-000000000045', 'B', 'Apenas creatinina sérica acima de 10 mg/dL', false),
('30000001-0001-4001-a045-000000000003', '20000001-0001-4001-8001-000000000045', 'C', 'Presença de anemia e hiperfosfatemia', false),
('30000001-0001-4001-a045-000000000004', '20000001-0001-4001-8001-000000000045', 'D', 'TFG abaixo de 30 mL/min independente dos sintomas', false);

-- Q46 (correct: C - gota, colchicina/AINE)
INSERT INTO public.question_options (id, question_id, label, text, is_correct) VALUES
('30000001-0001-4001-a046-000000000001', '20000001-0001-4001-8001-000000000046', 'A', 'Artrite reumatoide, iniciar metotrexato', false),
('30000001-0001-4001-a046-000000000002', '20000001-0001-4001-8001-000000000046', 'B', 'Pseudogota, tratar com alopurinol', false),
('30000001-0001-4001-a046-000000000003', '20000001-0001-4001-8001-000000000046', 'C', 'Artrite gotosa aguda, tratar com AINE ou colchicina', true),
('30000001-0001-4001-a046-000000000004', '20000001-0001-4001-8001-000000000046', 'D', 'Artrite séptica, iniciar antibioticoterapia empírica', false);

-- Q47 (correct: B - B12)
INSERT INTO public.question_options (id, question_id, label, text, is_correct) VALUES
('30000001-0001-4001-a047-000000000001', '20000001-0001-4001-8001-000000000047', 'A', 'Deficiência de ácido fólico', false),
('30000001-0001-4001-a047-000000000002', '20000001-0001-4001-8001-000000000047', 'B', 'Deficiência de vitamina B12', true),
('30000001-0001-4001-a047-000000000003', '20000001-0001-4001-8001-000000000047', 'C', 'Deficiência de ferro', false),
('30000001-0001-4001-a047-000000000004', '20000001-0001-4001-8001-000000000047', 'D', 'Deficiência de vitamina B6', false);

-- Q48 (correct: A - amoxicilina)
INSERT INTO public.question_options (id, question_id, label, text, is_correct) VALUES
('30000001-0001-4001-a048-000000000001', '20000001-0001-4001-8001-000000000048', 'A', 'Amoxicilina 500 mg 8/8h por 7 dias', true),
('30000001-0001-4001-a048-000000000002', '20000001-0001-4001-8001-000000000048', 'B', 'Levofloxacino 500 mg/dia por 5 dias', false),
('30000001-0001-4001-a048-000000000003', '20000001-0001-4001-8001-000000000048', 'C', 'Ceftriaxona IV 1g/dia por 10 dias', false),
('30000001-0001-4001-a048-000000000004', '20000001-0001-4001-8001-000000000048', 'D', 'Azitromicina 500 mg/dia por 3 dias', false);

-- Q49 (correct: C - precoce, primeiras 72h)
INSERT INTO public.question_options (id, question_id, label, text, is_correct) VALUES
('30000001-0001-4001-a049-000000000001', '20000001-0001-4001-8001-000000000049', 'A', 'Após resolução completa do quadro com antibioticoterapia', false),
('30000001-0001-4001-a049-000000000002', '20000001-0001-4001-8001-000000000049', 'B', 'Após 6 semanas de tratamento conservador', false),
('30000001-0001-4001-a049-000000000003', '20000001-0001-4001-8001-000000000049', 'C', 'Precoce, nas primeiras 72 horas de admissão', true),
('30000001-0001-4001-a049-000000000004', '20000001-0001-4001-8001-000000000049', 'D', 'Apenas se houver perfuração da vesícula', false);

-- Q50 (correct: D - pneumonia intersticial / COVID / PH)
INSERT INTO public.question_options (id, question_id, label, text, is_correct) VALUES
('30000001-0001-4001-a050-000000000001', '20000001-0001-4001-8001-000000000050', 'A', 'Pneumonia bacteriana típica', false),
('30000001-0001-4001-a050-000000000002', '20000001-0001-4001-8001-000000000050', 'B', 'Tuberculose pulmonar cavitária', false),
('30000001-0001-4001-a050-000000000003', '20000001-0001-4001-8001-000000000050', 'C', 'Asma brônquica', false),
('30000001-0001-4001-a050-000000000004', '20000001-0001-4001-8001-000000000050', 'D', 'Pneumonite de hipersensibilidade ou doença intersticial pulmonar', true);

-- SIMULADO #6 options
-- Q51 (correct: B - IAM sem supra)
INSERT INTO public.question_options (id, question_id, label, text, is_correct) VALUES
('30000001-0001-4001-a051-000000000001', '20000001-0001-4001-8001-000000000051', 'A', 'Angina estável', false),
('30000001-0001-4001-a051-000000000002', '20000001-0001-4001-8001-000000000051', 'B', 'Infarto agudo do miocárdio sem supradesnivelamento de ST (IAMSSST)', true),
('30000001-0001-4001-a051-000000000003', '20000001-0001-4001-8001-000000000051', 'C', 'Angina instável', false),
('30000001-0001-4001-a051-000000000004', '20000001-0001-4001-8001-000000000051', 'D', 'Pericardite aguda', false);

-- Q52 (correct: A - corioamnionite, ATB + resolução)
INSERT INTO public.question_options (id, question_id, label, text, is_correct) VALUES
('30000001-0001-4001-a052-000000000001', '20000001-0001-4001-8001-000000000052', 'A', 'Corioamnionite, iniciar antibioticoterapia e resolução da gestação', true),
('30000001-0001-4001-a052-000000000002', '20000001-0001-4001-8001-000000000052', 'B', 'Endometrite puerperal, antibioticoterapia ambulatorial', false),
('30000001-0001-4001-a052-000000000003', '20000001-0001-4001-8001-000000000052', 'C', 'Infecção urinária, tratar e manter gestação', false),
('30000001-0001-4001-a052-000000000004', '20000001-0001-4001-8001-000000000052', 'D', 'Trabalho de parto prematuro, iniciar tocólise', false);

-- Q53 (correct: C - GNDA)
INSERT INTO public.question_options (id, question_id, label, text, is_correct) VALUES
('30000001-0001-4001-a053-000000000001', '20000001-0001-4001-8001-000000000053', 'A', 'Síndrome nefrótica', false),
('30000001-0001-4001-a053-000000000002', '20000001-0001-4001-8001-000000000053', 'B', 'Infecção urinária complicada', false),
('30000001-0001-4001-a053-000000000003', '20000001-0001-4001-8001-000000000053', 'C', 'Glomerulonefrite difusa aguda pós-estreptocócica', true),
('30000001-0001-4001-a053-000000000004', '20000001-0001-4001-8001-000000000053', 'D', 'Nefropatia por IgA', false);

-- Q54 (correct: D - laparotomia + drenagem)
INSERT INTO public.question_options (id, question_id, label, text, is_correct) VALUES
('30000001-0001-4001-a054-000000000001', '20000001-0001-4001-8001-000000000054', 'A', 'Apendicectomia videolaparoscópica eletiva', false),
('30000001-0001-4001-a054-000000000002', '20000001-0001-4001-8001-000000000054', 'B', 'Tratamento conservador com antibióticos por 14 dias', false),
('30000001-0001-4001-a054-000000000003', '20000001-0001-4001-8001-000000000054', 'C', 'Drenagem percutânea isolada do abscesso', false),
('30000001-0001-4001-a054-000000000004', '20000001-0001-4001-8001-000000000054', 'D', 'Laparotomia exploradora com apendicectomia e drenagem do abscesso', true);

-- Q55 (correct: B - integralidade)
INSERT INTO public.question_options (id, question_id, label, text, is_correct) VALUES
('30000001-0001-4001-a055-000000000001', '20000001-0001-4001-8001-000000000055', 'A', 'Atendimento apenas nas emergências médicas', false),
('30000001-0001-4001-a055-000000000002', '20000001-0001-4001-8001-000000000055', 'B', 'Conjunto articulado de ações preventivas e curativas em todos os níveis de complexidade', true),
('30000001-0001-4001-a055-000000000003', '20000001-0001-4001-8001-000000000055', 'C', 'Priorização dos serviços hospitalares sobre atenção básica', false),
('30000001-0001-4001-a055-000000000004', '20000001-0001-4001-8001-000000000055', 'D', 'Acesso universal sem necessidade de referência', false);

-- Q56 (correct: A - hidratação IV)
INSERT INTO public.question_options (id, question_id, label, text, is_correct) VALUES
('30000001-0001-4001-a056-000000000001', '20000001-0001-4001-8001-000000000056', 'A', 'Reposição volêmica agressiva com solução salina isotônica', true),
('30000001-0001-4001-a056-000000000002', '20000001-0001-4001-8001-000000000056', 'B', 'Administração imediata de bicarbonato de sódio', false),
('30000001-0001-4001-a056-000000000003', '20000001-0001-4001-8001-000000000056', 'C', 'Insulina subcutânea em dose única', false),
('30000001-0001-4001-a056-000000000004', '20000001-0001-4001-8001-000000000056', 'D', 'Correção do potássio antes de qualquer outra medida', false);

-- Q57 (correct: C - gravidez ectópica)
INSERT INTO public.question_options (id, question_id, label, text, is_correct) VALUES
('30000001-0001-4001-a057-000000000001', '20000001-0001-4001-8001-000000000057', 'A', 'Cisto ovariano funcional', false),
('30000001-0001-4001-a057-000000000002', '20000001-0001-4001-8001-000000000057', 'B', 'Endometrioma', false),
('30000001-0001-4001-a057-000000000003', '20000001-0001-4001-8001-000000000057', 'C', 'Gravidez ectópica', true),
('30000001-0001-4001-a057-000000000004', '20000001-0001-4001-8001-000000000057', 'D', 'Teratoma maduro', false);

-- Q58 (correct: D - doença hemolítica)
INSERT INTO public.question_options (id, question_id, label, text, is_correct) VALUES
('30000001-0001-4001-a058-000000000001', '20000001-0001-4001-8001-000000000058', 'A', 'Icterícia fisiológica', false),
('30000001-0001-4001-a058-000000000002', '20000001-0001-4001-8001-000000000058', 'B', 'Icterícia do leite materno', false),
('30000001-0001-4001-a058-000000000003', '20000001-0001-4001-8001-000000000058', 'C', 'Atresia de vias biliares', false),
('30000001-0001-4001-a058-000000000004', '20000001-0001-4001-8001-000000000058', 'D', 'Doença hemolítica do recém-nascido (incompatibilidade ABO ou Rh)', true);

-- Q59 (correct: A - laparotomia imediata)
INSERT INTO public.question_options (id, question_id, label, text, is_correct) VALUES
('30000001-0001-4001-a059-000000000001', '20000001-0001-4001-8001-000000000059', 'A', 'Laparotomia exploradora imediata', true),
('30000001-0001-4001-a059-000000000002', '20000001-0001-4001-8001-000000000059', 'B', 'FAST seguido de tomografia', false),
('30000001-0001-4001-a059-000000000003', '20000001-0001-4001-8001-000000000059', 'C', 'Reposição volêmica e observação clínica', false),
('30000001-0001-4001-a059-000000000004', '20000001-0001-4001-8001-000000000059', 'D', 'Videolaparoscopia diagnóstica', false);

-- Q60 (correct: C - eliminar viés de seleção)
INSERT INTO public.question_options (id, question_id, label, text, is_correct) VALUES
('30000001-0001-4001-a060-000000000001', '20000001-0001-4001-8001-000000000060', 'A', 'Garantir que todos os participantes recebam o tratamento', false),
('30000001-0001-4001-a060-000000000002', '20000001-0001-4001-8001-000000000060', 'B', 'Aumentar o tamanho amostral do estudo', false),
('30000001-0001-4001-a060-000000000003', '20000001-0001-4001-8001-000000000060', 'C', 'Distribuir igualmente fatores de confusão entre os grupos, eliminando viés de seleção', true),
('30000001-0001-4001-a060-000000000004', '20000001-0001-4001-8001-000000000060', 'D', 'Permitir que o pesquisador escolha os melhores participantes para o grupo tratamento', false);
