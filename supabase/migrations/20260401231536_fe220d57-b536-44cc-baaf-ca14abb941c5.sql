INSERT INTO public.enamed_programs (specialty_id, institution_id, vagas, cenario_pratica)
SELECT s.id, i.id, v.vagas, v.cenario
FROM (VALUES
('psiquiatria', 'universidade-estadual-de-ciencias-da-saude-de-alagoas-al', 2, 'Hospital Escola Portugal Ramalho'),
('psiquiatria', 'universidade-federal-de-alagoas-al', 2, 'Universidade Federal de Alagoas'),
('pediatria', 'hospital-de-emergencia-dr-daniel-houly-al', 2, 'Hospital Regional da Mata'),
('pediatria', 'hospital-geral-do-estado-prof-osvaldo-brandao-vilela-al', 4, 'Hospital Geral do Estado Prof. Osvaldo Brandão Vilela'),
('pediatria', 'universidade-estadual-de-ciencias-da-saude-de-alagoas-al', 2, 'Hospital Geral do Estado Prof. Osvaldo Brandão Vilela'),
('pediatria', 'universidade-federal-de-alagoas-al', 5, 'Universidade Federal de Alagoas'),
('ortopedia-e-traumatologia', 'hospital-de-emergencia-dr-daniel-houly-al', 2, 'Hospital Regional da Mata'),
('ortopedia-e-traumatologia', 'hospital-geral-do-estado-prof-osvaldo-brandao-vilela-al', 2, 'Hospital Geral do Estado Prof. Osvaldo Brandão Vilela'),
('oftalmologia', 'universidade-federal-de-alagoas-al', 4, 'Universidade Federal de Alagoas'),
('neurologia', 'hospital-geral-do-estado-prof-osvaldo-brandao-vilela-al', 2, 'Hospital Geral do Estado Prof. Osvaldo Brandão Vilela')
) AS v(spec_slug, inst_slug, vagas, cenario)
JOIN public.enamed_specialties s ON s.slug = v.spec_slug
JOIN public.enamed_institutions i ON i.slug = v.inst_slug
WHERE NOT EXISTS (SELECT 1 FROM enamed_programs LIMIT 0);