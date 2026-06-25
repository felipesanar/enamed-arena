-- Corrige ERROR 42883 (operator does not exist: user_segment = text) em
-- admin_produto_feature_adoption: pr.segment é ENUM user_segment, p_segment é text.
-- Bug PRÉ-EXISTENTE (não introduzido pela auditoria) que fazia o painel
-- "Recursos mais usados" (Produto) sempre renderizar vazio, pois a RPC abortava
-- em runtime. Fix: pr.segment::text = p_segment nas duas comparações.
-- Mesma assinatura → CREATE OR REPLACE preserva grants; footer reafirma ACL limpo.
CREATE OR REPLACE FUNCTION public.admin_produto_feature_adoption(p_days integer DEFAULT 30, p_segment text DEFAULT 'all'::text)
 RETURNS TABLE(feature text, event_name text, adoption_pct numeric)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare
  v_start  timestamptz := now() - (p_days || ' days')::interval;
  v_active bigint;
begin
  perform public.admin_require('intel.view');

  select count(distinct a.user_id) into v_active
  from attempts a
  join profiles pr on pr.id = a.user_id
  where a.created_at >= v_start
    and (p_segment = 'all' or pr.segment::text = p_segment);

  return query
  with features(f, ev) as (
    values
      ('Ver desempenho',   'desempenho_viewed'),
      ('Ver ranking',      'ranking_viewed'),
      ('Ver gabarito',     'correction_viewed'),
      ('Caderno de Erros', 'caderno_erros_viewed'),
      ('Comparativo',      'comparativo_viewed'),
      ('Ver resultado',    'resultado_viewed')
  )
  select
    f.f,
    f.ev,
    round(coalesce(
      (select count(distinct ae.user_id)::numeric
       from analytics_events ae
       join profiles pr on pr.id = ae.user_id
       where ae.event_name = f.ev
         and ae.created_at >= v_start
         and (p_segment = 'all' or pr.segment::text = p_segment))
      / nullif(v_active, 0) * 100, 0
    ), 1)
  from features f
  order by 3 desc;
end;
$function$;
REVOKE ALL ON FUNCTION public.admin_produto_feature_adoption(integer, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_produto_feature_adoption(integer, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_produto_feature_adoption(integer, text) TO authenticated, service_role;
