-- Corrige 42804/42883 em admin_set_user_role: p_role (text) ia para a coluna
-- user_roles.role (enum app_role) sem cast — o INSERT (grant) e o DELETE (revoke)
-- abortavam em runtime. Gestão de papéis pelo admin estava QUEBRADA (papéis só
-- existiam por seed SQL direto). Bug PRÉ-EXISTENTE (não introduzido pela auditoria).
-- Fix: p_role::app_role no insert e no delete. Mantém todos os guards (P0004/5/6).
-- Mesma assinatura → CREATE OR REPLACE preserva grants.
CREATE OR REPLACE FUNCTION public.admin_set_user_role(p_user_id uuid, p_role text, p_grant boolean)
 RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
begin
  perform public.admin_require('roles.manage');

  if p_role not in ('admin','content_editor','support','analyst') then
    raise exception 'invalid_role' using errcode = 'P0005';
  end if;
  if p_role = 'admin' and p_grant = false
     and (select count(*) from user_roles where role = 'admin') <= 1 then
    raise exception 'cannot_remove_last_admin' using errcode = 'P0006';
  end if;

  if p_user_id = (select auth.uid()) and p_role = 'admin' and p_grant = false then
    raise exception 'cannot_revoke_own_admin' using errcode = 'P0004';
  end if;

  if p_grant then
    insert into user_roles (user_id, role)
    values (p_user_id, p_role::app_role)
    on conflict do nothing;
  else
    delete from user_roles
    where user_id = p_user_id and role = p_role::app_role;
  end if;

  begin
    perform public.admin_log_action(
      case when p_grant then 'grant_role' else 'revoke_role' end,
      'user', p_user_id,
      'Papel '||p_role||(case when p_grant then ' concedido' else ' revogado' end),
      jsonb_build_object('role',p_role,'grant',p_grant)
    );
  exception when others then null; end;
end;
$function$;
REVOKE ALL ON FUNCTION public.admin_set_user_role(uuid, text, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_set_user_role(uuid, text, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role(uuid, text, boolean) TO authenticated, service_role;
