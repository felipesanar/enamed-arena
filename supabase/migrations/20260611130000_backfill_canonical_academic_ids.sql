-- 1. Cortes: specialty_id por match exato normalizado
UPDATE public.enamed_cutoff_scores cs
SET specialty_id = es.id
FROM public.enamed_specialties es
WHERE cs.specialty_id IS NULL
  AND normalize_text_for_match(es.name) = normalize_text_for_match(cs.specialty_name);

-- 2. Cortes: institution_id por match exato normalizado
UPDATE public.enamed_cutoff_scores cs
SET institution_id = ei.id
FROM public.enamed_institutions ei
WHERE cs.institution_id IS NULL
  AND normalize_text_for_match(ei.name) = normalize_text_for_match(cs.institution_name);

-- 3. Cortes: de-para curado e aprovado (confianca=alta; revisado adversarialmente)
UPDATE public.enamed_cutoff_scores
SET institution_id = 'f5acfe5f-fb09-413b-8652-ff3c4f14656a'
WHERE institution_id IS NULL
  AND institution_name = 'ASSOCIACAO IGREJA ADVENTISTA MISSIONARIA - AIAMIS';

UPDATE public.enamed_cutoff_scores
SET institution_id = '9ca5af46-652f-41dc-9e39-784a660a8010'
WHERE institution_id IS NULL
  AND institution_name = 'Fundação Hospitalar São Francisco de Assis - FHSFA';

UPDATE public.enamed_cutoff_scores
SET institution_id = 'fb9be9b5-90c3-41c0-97c5-ff2e84663c0d'
WHERE institution_id IS NULL
  AND institution_name = 'Fundação Universidade Federal de Mato Grosso do Sul';

UPDATE public.enamed_cutoff_scores
SET institution_id = '1efb7792-7420-4b50-b499-90c8a88ad9d9'
WHERE institution_id IS NULL
  AND institution_name = 'Fundação Universidade Federal do Tocantins - UFT';

UPDATE public.enamed_cutoff_scores
SET institution_id = '4b35e562-0db3-46b2-a5af-c9280bdfca4a'
WHERE institution_id IS NULL
  AND institution_name = 'Hospital de Clínicas da UFPR';

UPDATE public.enamed_cutoff_scores
SET institution_id = '93fe51ad-4459-46c6-9069-c84d8bc633b1'
WHERE institution_id IS NULL
  AND institution_name = 'Hospital Municipal Odilon Behrens';

UPDATE public.enamed_cutoff_scores
SET institution_id = '6a359220-671d-4baa-9de7-3f7b3d78faff'
WHERE institution_id IS NULL
  AND institution_name = 'Hospital Universitário Antônio Pedro - HUAP';

UPDATE public.enamed_cutoff_scores
SET institution_id = '499376d8-6af3-4633-a975-d55424ff472f'
WHERE institution_id IS NULL
  AND institution_name = 'Hospital Universitário Bettina Ferro de Souza - HUBFS';

UPDATE public.enamed_cutoff_scores
SET institution_id = '8aa1662e-f5f3-4020-9c0f-86e22791db6d'
WHERE institution_id IS NULL
  AND institution_name = 'Hospital Universitário Clementino Fraga Filho';

UPDATE public.enamed_cutoff_scores
SET institution_id = '73d9fa3a-0488-45cc-85c8-abd4555a5038'
WHERE institution_id IS NULL
  AND institution_name = 'Hospital Universitário da UFMA - HU-UFMA';

UPDATE public.enamed_cutoff_scores
SET institution_id = '90b14c2c-f839-48d0-a28d-c58b923aa57e'
WHERE institution_id IS NULL
  AND institution_name = 'Hospital Universitário de Brasília';

UPDATE public.enamed_cutoff_scores
SET institution_id = 'fe58bcb8-3b1d-412a-ad88-99979c7a9c5b'
WHERE institution_id IS NULL
  AND institution_name = 'Hospital Universitário Gaffrée e Guinle - HUGG';

UPDATE public.enamed_cutoff_scores
SET institution_id = 'ad689124-016e-4dc9-baa3-88df5e09b3da'
WHERE institution_id IS NULL
  AND institution_name = 'Hospital Universitário Lauro Wanderley da UFPB';

UPDATE public.enamed_cutoff_scores
SET institution_id = '4b3577cf-1a22-418c-aa21-5d4266db8196'
WHERE institution_id IS NULL
  AND institution_name = 'Hospital Universitário Onofre Lopes - HUOL';

UPDATE public.enamed_cutoff_scores
SET institution_id = '3c9d9a96-fab2-488e-9f09-05daa23252d7'
WHERE institution_id IS NULL
  AND institution_name = 'Hospital Universitário Professor Edgard Santos';

UPDATE public.enamed_cutoff_scores
SET institution_id = 'fa42adf3-0ce0-4eb9-8801-d1a6bb7e6c7a'
WHERE institution_id IS NULL
  AND institution_name = 'Prefeitura Municipal de Belo Horizonte';

UPDATE public.enamed_cutoff_scores
SET institution_id = '4b02eec6-db3e-44f6-9333-5598e2602baf'
WHERE institution_id IS NULL
  AND institution_name = 'Secretaria de Saúde do Estado da Bahia - SESAB';

UPDATE public.enamed_cutoff_scores
SET institution_id = '38441e49-96ed-42da-b580-d947b71026d8'
WHERE institution_id IS NULL
  AND institution_name = 'Universidade Federal de Minas Gerais';

UPDATE public.enamed_cutoff_scores
SET institution_id = 'd392c4b3-ebb2-4ed8-89ab-33e218ff25da'
WHERE institution_id IS NULL
  AND institution_name = 'Universidade Federal de Uberlândia';

UPDATE public.enamed_cutoff_scores
SET institution_id = '3c4e7995-2252-4426-afa7-6f8cf5a3f0d0'
WHERE institution_id IS NULL
  AND institution_name = 'Universidade Federal do Amazonas - UFAM';

UPDATE public.enamed_cutoff_scores
SET institution_id = '73d9fa3a-0488-45cc-85c8-abd4555a5038'
WHERE institution_id IS NULL
  AND institution_name = 'Universidade Federal do Maranhão - UFMA';

UPDATE public.enamed_cutoff_scores
SET institution_id = '084be4db-8f44-4620-9ef6-9527a7ea02c2'
WHERE institution_id IS NULL
  AND institution_name = 'Universidade Federal do Mato Grosso';

UPDATE public.enamed_cutoff_scores
SET institution_id = '4b35e562-0db3-46b2-a5af-c9280bdfca4a'
WHERE institution_id IS NULL
  AND institution_name = 'Universidade Federal do Paraná';

UPDATE public.enamed_cutoff_scores
SET institution_id = 'f528196c-b7b1-454b-b137-6afb5465142c'
WHERE institution_id IS NULL
  AND institution_name = 'Universidade Federal do Piauí (UFPI)';

UPDATE public.enamed_cutoff_scores
SET institution_id = '2355e5bc-6606-4f42-8509-d3d40615b717'
WHERE institution_id IS NULL
  AND institution_name = 'Universidade Federal do Vale do São Francisco';

-- 4. Perfis: specialty_id por match exato
UPDATE public.onboarding_profiles op
SET specialty_id = es.id
FROM public.enamed_specialties es
WHERE op.specialty_id IS NULL
  AND op.specialty IS NOT NULL
  AND normalize_text_for_match(es.name) = normalize_text_for_match(op.specialty);

-- 5. Perfis: literal "Ainda não sei" => NULL no texto
UPDATE public.onboarding_profiles
SET specialty = NULL
WHERE specialty IS NOT NULL
  AND normalize_text_for_match(specialty) = normalize_text_for_match('Ainda não sei')
  AND specialty_id IS NULL;

-- 6. Perfis: instituições => ids (preserva ordem, descarta "Ainda não sei"
--    e nomes sem match) e re-sincroniza o array de nomes canônicos
UPDATE public.onboarding_profiles op
SET target_institution_ids = sub.ids,
    target_institutions    = sub.names
FROM (
  SELECT op2.user_id,
         COALESCE(array_agg(ei.id   ORDER BY t.ord) FILTER (WHERE ei.id IS NOT NULL), '{}') AS ids,
         COALESCE(array_agg(ei.name ORDER BY t.ord) FILTER (WHERE ei.id IS NOT NULL), '{}') AS names
  FROM public.onboarding_profiles op2
  CROSS JOIN LATERAL unnest(op2.target_institutions) WITH ORDINALITY AS t(name, ord)
  LEFT JOIN public.enamed_institutions ei
    ON normalize_text_for_match(ei.name) = normalize_text_for_match(t.name)
  GROUP BY op2.user_id
) sub
WHERE sub.user_id = op.user_id;
