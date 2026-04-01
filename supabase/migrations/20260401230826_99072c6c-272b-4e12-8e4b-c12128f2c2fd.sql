
-- 1. Create enamed_specialties table
CREATE TABLE public.enamed_specialties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Create enamed_institutions table
CREATE TABLE public.enamed_institutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  uf text NOT NULL,
  slug text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Create enamed_programs junction table
CREATE TABLE public.enamed_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  specialty_id uuid NOT NULL REFERENCES public.enamed_specialties(id) ON DELETE CASCADE,
  institution_id uuid NOT NULL REFERENCES public.enamed_institutions(id) ON DELETE CASCADE,
  vagas integer NOT NULL DEFAULT 0,
  cenario_pratica text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Indexes for fast lookups
CREATE INDEX idx_enamed_programs_specialty ON public.enamed_programs(specialty_id);
CREATE INDEX idx_enamed_programs_institution ON public.enamed_programs(institution_id);
CREATE INDEX idx_enamed_institutions_uf ON public.enamed_institutions(uf);

-- 5. Enable RLS
ALTER TABLE public.enamed_specialties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enamed_institutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enamed_programs ENABLE ROW LEVEL SECURITY;

-- 6. RLS: SELECT for any authenticated user (reference data)
CREATE POLICY "Anyone can read specialties"
  ON public.enamed_specialties FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Anyone can read institutions"
  ON public.enamed_institutions FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Anyone can read programs"
  ON public.enamed_programs FOR SELECT
  TO authenticated USING (true);

-- 7. RLS: Admin-only writes
CREATE POLICY "Admins can insert specialties"
  ON public.enamed_specialties FOR INSERT
  TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update specialties"
  ON public.enamed_specialties FOR UPDATE
  TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete specialties"
  ON public.enamed_specialties FOR DELETE
  TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert institutions"
  ON public.enamed_institutions FOR INSERT
  TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update institutions"
  ON public.enamed_institutions FOR UPDATE
  TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete institutions"
  ON public.enamed_institutions FOR DELETE
  TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert programs"
  ON public.enamed_programs FOR INSERT
  TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update programs"
  ON public.enamed_programs FOR UPDATE
  TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete programs"
  ON public.enamed_programs FOR DELETE
  TO authenticated USING (public.has_role(auth.uid(), 'admin'));
