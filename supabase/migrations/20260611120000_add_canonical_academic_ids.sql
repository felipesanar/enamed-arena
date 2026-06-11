-- Modelo canônico por ID para perfil acadêmico e nota de corte.
-- Colunas aditivas; texto permanece como coluna derivada durante a transição.

ALTER TABLE public.onboarding_profiles
  ADD COLUMN IF NOT EXISTS specialty_id uuid NULL
    REFERENCES public.enamed_specialties(id),
  ADD COLUMN IF NOT EXISTS target_institution_ids uuid[] NOT NULL DEFAULT '{}';

-- "Ainda não sei" passa a ser representado por NULL
ALTER TABLE public.onboarding_profiles
  ALTER COLUMN specialty DROP NOT NULL;

ALTER TABLE public.enamed_cutoff_scores
  ADD COLUMN IF NOT EXISTS specialty_id uuid NULL
    REFERENCES public.enamed_specialties(id),
  ADD COLUMN IF NOT EXISTS institution_id uuid NULL
    REFERENCES public.enamed_institutions(id);

CREATE INDEX IF NOT EXISTS idx_cutoff_scores_inst_spec
  ON public.enamed_cutoff_scores (institution_id, specialty_id);
