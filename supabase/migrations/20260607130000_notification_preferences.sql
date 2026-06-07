-- =====================================================================
-- Notification preferences (Caderno de Erros — plano 08 §3.1)
-- =====================================================================
-- Tabela de preferências de notificação por usuário. Suporta o slice de
-- lembretes do Caderno de Erros (revisão diária, streak, reta final,
-- triagem pós-prova).
--
-- IMPORTANTE — decisão de Produto PENDENTE:
--   Os canais (email / push / in-app) e a cadência exata ainda não foram
--   definidos pelo time. Esta tabela modela apenas o OPT-IN por categoria.
--   O mapeamento categoria → canal vive na edge function / workflow Novu,
--   não aqui. Mantemos a granularidade por categoria para que, quando a
--   cadência for decidida, nada na superfície de dados precise mudar.
--
-- Convenções copiadas das migrations existentes:
--   * profiles: PK = auth.users(id), RLS owner-only (ver migration
--     20260314011304). Usamos o mesmo padrão aqui.
--   * RPC guardado SECURITY DEFINER no estilo de save_onboarding_guarded
--     (ver migration 20260401235900) para o upsert — o frontend nunca
--     escreve direto na tabela (regra crítica do projeto).
-- =====================================================================

-- ─── Tabela ───────────────────────────────────────────────────────────
-- user_id é PK e FK para auth.users (1 linha por usuário), seguindo o
-- mesmo padrão de profiles. Defaults = opt-in (true): se o time decidir
-- enviar lembretes, o comportamento padrão é receber; o usuário desliga
-- explicitamente. Isso é seguro porque a edge function só dispara quando
-- o env do Novu está configurado (no-op até lá).
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id              uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  caderno_daily_review boolean NOT NULL DEFAULT true,
  caderno_streak       boolean NOT NULL DEFAULT true,
  caderno_reta_final   boolean NOT NULL DEFAULT true,
  caderno_post_triage  boolean NOT NULL DEFAULT true,
  updated_at           timestamptz NOT NULL DEFAULT now()
);

-- ─── RLS (owner-only read/write) ──────────────────────────────────────
-- Mesmo modelo de profiles: cada usuário só enxerga/edita a própria linha.
-- Sem acesso anônimo. As escritas do app passam pelo RPC guardado abaixo,
-- mas mantemos políticas de INSERT/UPDATE owner-scoped por consistência
-- com o restante do schema.
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own notification preferences"
  ON public.notification_preferences;
CREATE POLICY "Users can read own notification preferences"
  ON public.notification_preferences FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own notification preferences"
  ON public.notification_preferences;
CREATE POLICY "Users can insert own notification preferences"
  ON public.notification_preferences FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own notification preferences"
  ON public.notification_preferences;
CREATE POLICY "Users can update own notification preferences"
  ON public.notification_preferences FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Sem política de DELETE: linha some junto com o usuário (ON DELETE CASCADE).

GRANT SELECT, INSERT, UPDATE ON public.notification_preferences TO authenticated;

-- ─── updated_at automático ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.touch_notification_preferences_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notification_preferences_updated_at
  ON public.notification_preferences;
CREATE TRIGGER trg_notification_preferences_updated_at
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_notification_preferences_updated_at();

-- ─── RPC guardado: upsert_notification_preferences ────────────────────
-- Segue a convenção do projeto: o frontend NUNCA escreve direto, sempre
-- via RPC SECURITY DEFINER que ancora a escrita em auth.uid() (ver regras
-- críticas em CLAUDE.md e o padrão de save_onboarding_guarded).
--
-- Todos os parâmetros são opcionais (DEFAULT NULL) → atualização parcial:
-- NULL significa "não mexe nessa categoria", preservando o valor atual.
-- Retorna a linha final como jsonb para o cliente sincronizar o estado.
CREATE OR REPLACE FUNCTION public.upsert_notification_preferences(
  p_caderno_daily_review boolean DEFAULT NULL,
  p_caderno_streak       boolean DEFAULT NULL,
  p_caderno_reta_final   boolean DEFAULT NULL,
  p_caderno_post_triage  boolean DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.notification_preferences;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  INSERT INTO public.notification_preferences AS np (
    user_id,
    caderno_daily_review,
    caderno_streak,
    caderno_reta_final,
    caderno_post_triage
  )
  VALUES (
    v_uid,
    COALESCE(p_caderno_daily_review, true),
    COALESCE(p_caderno_streak, true),
    COALESCE(p_caderno_reta_final, true),
    COALESCE(p_caderno_post_triage, true)
  )
  ON CONFLICT (user_id) DO UPDATE SET
    caderno_daily_review = COALESCE(p_caderno_daily_review, np.caderno_daily_review),
    caderno_streak       = COALESCE(p_caderno_streak, np.caderno_streak),
    caderno_reta_final   = COALESCE(p_caderno_reta_final, np.caderno_reta_final),
    caderno_post_triage  = COALESCE(p_caderno_post_triage, np.caderno_post_triage),
    updated_at           = now()
  RETURNING np.* INTO v_row;

  RETURN jsonb_build_object(
    'user_id',              v_row.user_id,
    'caderno_daily_review', v_row.caderno_daily_review,
    'caderno_streak',       v_row.caderno_streak,
    'caderno_reta_final',   v_row.caderno_reta_final,
    'caderno_post_triage',  v_row.caderno_post_triage,
    'updated_at',           v_row.updated_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_notification_preferences(boolean, boolean, boolean, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_notification_preferences(boolean, boolean, boolean, boolean) TO authenticated;
