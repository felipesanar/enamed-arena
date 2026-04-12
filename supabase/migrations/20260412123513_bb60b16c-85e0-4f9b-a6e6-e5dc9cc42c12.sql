
CREATE TABLE public.enamed_cutoff_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_name text NOT NULL,
  practice_scenario text NOT NULL DEFAULT '',
  specialty_name text NOT NULL,
  cutoff_score_general numeric NOT NULL,
  cutoff_score_quota numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_cutoff_specialty ON public.enamed_cutoff_scores (specialty_name);
CREATE INDEX idx_cutoff_institution ON public.enamed_cutoff_scores (institution_name);

ALTER TABLE public.enamed_cutoff_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read cutoff scores"
  ON public.enamed_cutoff_scores FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert cutoff scores"
  ON public.enamed_cutoff_scores FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update cutoff scores"
  ON public.enamed_cutoff_scores FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete cutoff scores"
  ON public.enamed_cutoff_scores FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
