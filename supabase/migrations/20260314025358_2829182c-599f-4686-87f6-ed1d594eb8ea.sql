
-- ══════════════════════════════════════════════════════════════
-- Phase 9: Simulados domain — real tables
-- Following SanarFlix Academy patterns
-- ══════════════════════════════════════════════════════════════

-- ─── Enums ───
CREATE TYPE public.simulado_status AS ENUM ('draft', 'published', 'archived');
CREATE TYPE public.attempt_status AS ENUM ('in_progress', 'submitted', 'expired');
CREATE TYPE public.error_reason AS ENUM ('did_not_know', 'did_not_remember', 'did_not_understand', 'guessed_correctly');

-- ─── Simulados ───
CREATE TABLE public.simulados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  sequence_number INTEGER NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  questions_count INTEGER NOT NULL DEFAULT 0,
  duration_minutes INTEGER NOT NULL DEFAULT 300,
  execution_window_start TIMESTAMPTZ NOT NULL,
  execution_window_end TIMESTAMPTZ NOT NULL,
  results_release_at TIMESTAMPTZ NOT NULL,
  theme_tags TEXT[] NOT NULL DEFAULT '{}',
  status public.simulado_status NOT NULL DEFAULT 'published',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Questions ───
CREATE TABLE public.questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  simulado_id UUID NOT NULL REFERENCES public.simulados(id) ON DELETE CASCADE,
  question_number INTEGER NOT NULL,
  text TEXT NOT NULL,
  area TEXT NOT NULL,
  theme TEXT NOT NULL,
  difficulty TEXT DEFAULT 'medium',
  image_url TEXT,
  explanation TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_questions_simulado ON public.questions(simulado_id);

-- ─── Question Options (5 alternatives A-E) ───
CREATE TABLE public.question_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  label TEXT NOT NULL, -- 'A', 'B', 'C', 'D', 'E'
  text TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_options_question ON public.question_options(question_id);

-- ─── Attempts (one per user per simulado) ───
CREATE TABLE public.attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  simulado_id UUID NOT NULL REFERENCES public.simulados(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.attempt_status NOT NULL DEFAULT 'in_progress',
  current_question_index INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  effective_deadline TIMESTAMPTZ NOT NULL,
  last_saved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  tab_exit_count INTEGER NOT NULL DEFAULT 0,
  fullscreen_exit_count INTEGER NOT NULL DEFAULT 0,
  score_percentage NUMERIC(5,2),
  total_correct INTEGER,
  total_answered INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(simulado_id, user_id)
);

CREATE INDEX idx_attempts_user ON public.attempts(user_id);
CREATE INDEX idx_attempts_simulado ON public.attempts(simulado_id);

-- ─── Answers (one per question per attempt) ───
CREATE TABLE public.answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES public.attempts(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  selected_option_id UUID REFERENCES public.question_options(id),
  marked_for_review BOOLEAN NOT NULL DEFAULT false,
  high_confidence BOOLEAN NOT NULL DEFAULT false,
  eliminated_options UUID[] DEFAULT '{}',
  answered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(attempt_id, question_id)
);

CREATE INDEX idx_answers_attempt ON public.answers(attempt_id);

-- ─── Error Notebook ───
CREATE TABLE public.error_notebook (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  simulado_id UUID REFERENCES public.simulados(id) ON DELETE SET NULL,
  question_id UUID REFERENCES public.questions(id) ON DELETE SET NULL,
  area TEXT,
  theme TEXT,
  reason public.error_reason NOT NULL,
  learning_text TEXT,
  was_correct BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_error_notebook_user ON public.error_notebook(user_id);

-- ─── RLS ───
ALTER TABLE public.simulados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.error_notebook ENABLE ROW LEVEL SECURITY;

-- Simulados: everyone can read published
CREATE POLICY "Anyone can read published simulados" ON public.simulados
  FOR SELECT TO authenticated
  USING (status = 'published');

-- Questions: everyone can read
CREATE POLICY "Anyone can read questions" ON public.questions
  FOR SELECT TO authenticated USING (true);

-- Options: everyone can read
CREATE POLICY "Anyone can read options" ON public.question_options
  FOR SELECT TO authenticated USING (true);

-- Attempts: users own their attempts
CREATE POLICY "Users can read own attempts" ON public.attempts
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own attempts" ON public.attempts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own attempts" ON public.attempts
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Answers: users own their answers (via attempt ownership)
CREATE POLICY "Users can read own answers" ON public.answers
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.attempts WHERE attempts.id = answers.attempt_id AND attempts.user_id = auth.uid()));

CREATE POLICY "Users can insert own answers" ON public.answers
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.attempts WHERE attempts.id = answers.attempt_id AND attempts.user_id = auth.uid()));

CREATE POLICY "Users can update own answers" ON public.answers
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.attempts WHERE attempts.id = answers.attempt_id AND attempts.user_id = auth.uid()));

-- Error Notebook: users own their entries
CREATE POLICY "Users can read own notebook" ON public.error_notebook
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notebook" ON public.error_notebook
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notebook" ON public.error_notebook
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- ─── Updated_at triggers ───
CREATE TRIGGER update_simulados_updated_at BEFORE UPDATE ON public.simulados
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_answers_updated_at BEFORE UPDATE ON public.answers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_error_notebook_updated_at BEFORE UPDATE ON public.error_notebook
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
