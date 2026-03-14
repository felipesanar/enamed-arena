
-- Create enum for user segments
CREATE TYPE public.user_segment AS ENUM ('guest', 'standard', 'pro');

-- Create enum for onboarding status
CREATE TYPE public.onboarding_status AS ENUM ('pending', 'completed');

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  segment user_segment NOT NULL DEFAULT 'guest',
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Onboarding profiles table
CREATE TABLE public.onboarding_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  specialty TEXT NOT NULL,
  target_institutions TEXT[] NOT NULL DEFAULT '{}',
  status onboarding_status NOT NULL DEFAULT 'pending',
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_profiles ENABLE ROW LEVEL SECURITY;

-- RLS policies for profiles
CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- RLS policies for onboarding_profiles
CREATE POLICY "Users can read own onboarding"
  ON public.onboarding_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own onboarding"
  ON public.onboarding_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own onboarding"
  ON public.onboarding_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER onboarding_profiles_updated_at
  BEFORE UPDATE ON public.onboarding_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();
