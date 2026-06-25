DROP FUNCTION IF EXISTS public.admin_produto_segmented_funnel(integer);

CREATE OR REPLACE FUNCTION public.admin_produto_segmented_funnel(p_days integer DEFAULT 30)
 RETURNS TABLE(step_order integer, step_label text, guest_count bigint, guest_pct numeric, standard_count bigint, standard_pct numeric, pro_count bigint, pro_pct numeric, insufficient_data boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_min_base constant bigint := 30;
  v_g bigint; v_s bigint; v_p bigint;
begin
  perform public.admin_require('intel.view');

  select
    count(*) filter (where p.segment = 'guest'),
    count(*) filter (where p.segment = 'standard'),
    count(*) filter (where p.segment = 'pro')
  into v_g, v_s, v_p
  from profiles p
  where p.id not in (select ur.user_id from user_roles ur);

  return query
  with internal as (select ur.user_id from user_roles ur),
  base as (
    select p.id as user_id, p.segment
    from profiles p
    where p.id not in (select i.user_id from internal i)
  ),
  onb as (
    select distinct b.user_id, b.segment
    from base b
    join onboarding_profiles op on op.user_id = b.user_id and op.completed_at is not null
  ),
  prova1 as (
    select distinct o.user_id, o.segment
    from onb o
    join attempts a on a.user_id = o.user_id
      and a.is_within_window = true and a.status = 'submitted'
  ),
  ret as (
    select pv.user_id, pv.segment
    from prova1 pv
    join attempts a on a.user_id = pv.user_id
      and a.is_within_window = true and a.status = 'submitted'
    group by pv.user_id, pv.segment
    having count(*) >= 2
  )
  select t.step_order, t.step_label,
         t.guest_count, t.guest_pct, t.standard_count, t.standard_pct, t.pro_count, t.pro_pct,
         t.insufficient_data
  from (
    select 1 as step_order, 'Cadastrou'::text as step_label,
      v_g, 100.0::numeric, v_s, 100.0::numeric, v_p, 100.0::numeric,
      (v_g < v_min_base or v_s < v_min_base or v_p < v_min_base) as insufficient_data
    union all
    select 2, 'Onboarding',
      count(*) filter (where segment='guest')::bigint,
      least(100, round(count(*) filter (where segment='guest')::numeric / nullif(v_g,0)*100,1)),
      count(*) filter (where segment='standard')::bigint,
      least(100, round(count(*) filter (where segment='standard')::numeric / nullif(v_s,0)*100,1)),
      count(*) filter (where segment='pro')::bigint,
      least(100, round(count(*) filter (where segment='pro')::numeric / nullif(v_p,0)*100,1)),
      (v_g < v_min_base or v_s < v_min_base or v_p < v_min_base)
    from onb
    union all
    select 3, '1ª prova válida',
      count(*) filter (where segment='guest')::bigint,
      least(100, round(count(*) filter (where segment='guest')::numeric / nullif(v_g,0)*100,1)),
      count(*) filter (where segment='standard')::bigint,
      least(100, round(count(*) filter (where segment='standard')::numeric / nullif(v_s,0)*100,1)),
      count(*) filter (where segment='pro')::bigint,
      least(100, round(count(*) filter (where segment='pro')::numeric / nullif(v_p,0)*100,1)),
      (v_g < v_min_base or v_s < v_min_base or v_p < v_min_base)
    from prova1
    union all
    select 4, 'Retornou (2+)',
      count(*) filter (where segment='guest')::bigint,
      least(100, round(count(*) filter (where segment='guest')::numeric / nullif(v_g,0)*100,1)),
      count(*) filter (where segment='standard')::bigint,
      least(100, round(count(*) filter (where segment='standard')::numeric / nullif(v_s,0)*100,1)),
      count(*) filter (where segment='pro')::bigint,
      least(100, round(count(*) filter (where segment='pro')::numeric / nullif(v_p,0)*100,1)),
      (v_g < v_min_base or v_s < v_min_base or v_p < v_min_base)
    from ret
  ) as t(step_order, step_label, guest_count, guest_pct, standard_count, standard_pct, pro_count, pro_pct, insufficient_data)
  order by t.step_order;
end;
$function$;
-- [grant-hygiene] ACL limpo: só authenticated + service_role
REVOKE ALL ON FUNCTION public.admin_produto_segmented_funnel(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_produto_segmented_funnel(integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_produto_segmented_funnel(integer) TO authenticated, service_role;
