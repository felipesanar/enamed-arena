# Supabase Migrations Log

Este arquivo mantém rastreabilidade das migrations aplicadas diretamente no projeto remoto
(o repositório não versiona os arquivos de migration gerados pelo CLI do Supabase remoto).

---

## 2026-06-11 — `admin_capabilities_infra`

Cria a tabela `role_capabilities` (mapeamento role → capability) com RLS, seed de 21 pares,
e as funções `has_capability`, `admin_require`, `admin_get_access` e `admin_quick_search`.

```sql
-- Tabela de mapeamento role → capability
create table if not exists public.role_capabilities (
  role public.app_role not null,
  capability text not null,
  primary key (role, capability)
);
alter table public.role_capabilities enable row level security;

create policy "Admins podem ler capabilities"
  on public.role_capabilities for select
  using (public.has_role((select auth.uid()), 'admin'::public.app_role));

-- Seed (idempotente)
insert into public.role_capabilities (role, capability) values
  ('admin','dashboard.view'),('admin','content.manage'),('admin','users.view'),
  ('admin','users.manage'),('admin','attempts.view'),('admin','attempts.manage'),
  ('admin','intel.view'),('admin','previews.view'),('admin','roles.manage'),
  ('content_editor','dashboard.view'),('content_editor','content.manage'),
  ('content_editor','previews.view'),('content_editor','attempts.view'),
  ('support','dashboard.view'),('support','users.view'),('support','users.manage'),
  ('support','attempts.view'),('support','attempts.manage'),
  ('analyst','dashboard.view'),('analyst','intel.view'),('analyst','previews.view')
on conflict do nothing;

-- Checagem de capability do usuário corrente
create or replace function public.has_capability(p_capability text)
returns boolean
language sql stable security definer
set search_path to 'public'
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.role_capabilities rc on rc.role = ur.role
    where ur.user_id = (select auth.uid())
      and rc.capability = p_capability
  );
$$;

-- Guard para RPCs (mesmo contrato de erro atual: unauthorized / P0003)
create or replace function public.admin_require(p_capability text)
returns void
language plpgsql stable security definer
set search_path to 'public'
as $$
begin
  if not public.has_capability(p_capability) then
    raise exception 'unauthorized' using errcode = 'P0003';
  end if;
end;
$$;

-- Acesso do usuário corrente (roles + união de capabilities)
create or replace function public.admin_get_access()
returns table(roles text[], capabilities text[])
language sql stable security definer
set search_path to 'public'
as $$
  select
    coalesce(array_agg(distinct ur.role::text), '{}'),
    coalesce(array_agg(distinct rc.capability) filter (where rc.capability is not null), '{}')
  from public.user_roles ur
  left join public.role_capabilities rc on rc.role = ur.role
  where ur.user_id = (select auth.uid());
$$;

-- Busca rápida da paleta de comandos (top 5 usuários + top 5 simulados)
create or replace function public.admin_quick_search(p_query text)
returns table(kind text, id uuid, title text, subtitle text)
language plpgsql stable security definer
set search_path to 'public'
as $$
begin
  if not exists (select 1 from public.user_roles where user_id = (select auth.uid())) then
    raise exception 'unauthorized' using errcode = 'P0003';
  end if;

  return query
  (
    select 'user'::text, p.id, coalesce(p.full_name, '(sem nome)')::text, u.email::text
    from public.profiles p
    join auth.users u on u.id = p.id
    where public.has_capability('users.view')
      and (p.full_name ilike '%' || p_query || '%' or u.email ilike '%' || p_query || '%')
    order by p.created_at desc
    limit 5
  )
  union all
  (
    select 'simulado'::text, s.id, s.title::text,
           ('Simulado ' || coalesce(s.sequence_number::text, ''))::text
    from public.simulados s
    where public.has_capability('content.manage')
      and s.title ilike '%' || p_query || '%'
    order by s.sequence_number
    limit 5
  );
end;
$$;
```

---

## 2026-06-11 — `admin_roles_enum_values`

Adiciona os valores `content_editor`, `support` e `analyst` ao enum `public.app_role`,
preparando a infra de roles granulares do módulo admin.

```sql
alter type public.app_role add value if not exists 'content_editor';
alter type public.app_role add value if not exists 'support';
alter type public.app_role add value if not exists 'analyst';
```
