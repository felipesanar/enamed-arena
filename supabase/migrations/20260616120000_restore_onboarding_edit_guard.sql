-- Restaura get_onboarding_edit_guard_state.
--
-- Contexto: a migration 20260326162000 implementou o guard checando janelas de
-- execução abertas (can_edit=false + next_edit_available_at durante a janela).
-- No dia seguinte, 20260327171414 a substituiu por um STUB que sempre retorna
-- can_edit=true — sem comentário/justificativa.
--
-- Efeito do stub: o front (UserContext → ConfiguracoesPage) achava que sempre
-- podia editar, mostrava o editor e escondia o banner "Bloqueado". Mas
-- save_onboarding_guarded SEMPRE manteve a regra (is_any_simulado_window_open
-- => RAISE 'Perfil so pode ser editado entre janelas de execucao'). Resultado:
-- o usuário preenchia tudo, clicava Salvar e só então recebia um erro genérico
-- ("Erro ao salvar / Tente novamente em instantes"). Bug reportado por aluna
-- tentando editar perfil durante a janela do Simulado 3 (2026-06).
--
-- Este fix recoloca o guard em paridade exata com save_onboarding_guarded:
-- ambos usam o mesmo critério de "janela aberta".

CREATE OR REPLACE FUNCTION public.get_onboarding_edit_guard_state()
RETURNS TABLE (
  can_edit boolean,
  reason text,
  next_edit_available_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
  v_active_end timestamptz;
BEGIN
  SELECT MIN(s.execution_window_end)
  INTO v_active_end
  FROM public.simulados s
  WHERE s.status = 'published'
    AND v_now >= s.execution_window_start
    AND v_now <= s.execution_window_end;

  IF v_active_end IS NOT NULL THEN
    RETURN QUERY
    SELECT false, 'edicao_bloqueada_janela_aberta'::text, v_active_end;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT true, 'ok'::text, NULL::timestamptz;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_onboarding_edit_guard_state() TO authenticated;
