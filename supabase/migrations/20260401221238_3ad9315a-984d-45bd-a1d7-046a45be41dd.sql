
-- 1. Create enum and table
CREATE TYPE public.app_role AS ENUM ('admin');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 2. Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 3. RLS on user_roles: only admins can read
CREATE POLICY "Admins can read roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 4. Admin policies on simulados (INSERT, UPDATE, DELETE)
CREATE POLICY "Admins can insert simulados"
  ON public.simulados FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update simulados"
  ON public.simulados FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete simulados"
  ON public.simulados FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 5. Admin policies on questions (INSERT, UPDATE, DELETE)
CREATE POLICY "Admins can insert questions"
  ON public.questions FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update questions"
  ON public.questions FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete questions"
  ON public.questions FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 6. Admin policies on question_options (INSERT, UPDATE, DELETE)
CREATE POLICY "Admins can insert question_options"
  ON public.question_options FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update question_options"
  ON public.question_options FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete question_options"
  ON public.question_options FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 7. Allow admins to read ALL simulados (including draft/archived)
CREATE POLICY "Admins can read all simulados"
  ON public.simulados FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
