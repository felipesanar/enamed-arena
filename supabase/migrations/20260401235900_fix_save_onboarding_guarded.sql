-- Fix: restore save_onboarding_guarded which was missing from the schema cache.
-- Also aligns the minimum-institutions rule (1 for all segments) with the UI
-- validation in OnboardingPage — the previous rule (3 for guests) was never
-- reflected in the frontend and caused silent save failures.

CREATE OR REPLACE FUNCTION public.save_onboarding_guarded(
  p_specialty text,
  p_target_institutions text[]
)
RETURNS public.onboarding_profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_existing public.onboarding_profiles%ROWTYPE;
  v_now timestamptz := now();
  v_result public.onboarding_profiles%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado';
  END IF;

  IF p_specialty IS NULL OR btrim(p_specialty) = '' THEN
    RAISE EXCEPTION 'Especialidade obrigatoria';
  END IF;

  IF COALESCE(array_length(p_target_institutions, 1), 0) < 1 THEN
    RAISE EXCEPTION 'Selecione ao menos uma instituicao ou marque Ainda nao sei';
  END IF;

  SELECT *
  INTO v_existing
  FROM public.onboarding_profiles o
  WHERE o.user_id = v_user_id;

  IF FOUND THEN
    IF public.is_any_simulado_window_open(v_now) THEN
      RAISE EXCEPTION 'Perfil so pode ser editado entre janelas de execucao';
    END IF;

    UPDATE public.onboarding_profiles
    SET
      specialty = btrim(p_specialty),
      target_institutions = p_target_institutions,
      status = 'completed',
      completed_at = COALESCE(completed_at, v_now),
      updated_at = v_now
    WHERE user_id = v_user_id
    RETURNING *
    INTO v_result;
  ELSE
    INSERT INTO public.onboarding_profiles (
      user_id,
      specialty,
      target_institutions,
      status,
      completed_at
    ) VALUES (
      v_user_id,
      btrim(p_specialty),
      p_target_institutions,
      'completed',
      v_now
    )
    RETURNING *
    INTO v_result;
  END IF;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_onboarding_guarded(text, text[]) TO authenticated;
