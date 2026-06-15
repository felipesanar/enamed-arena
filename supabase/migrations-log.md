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

---

## 2026-06-11 — `admin_capabilities_policies`

Troca o check `has_role(admin)` / `role = 'admin'` por `public.has_capability(...)` nas
32 policies RLS de admin (`intel.view` para analytics_events, `roles.manage` para
user_roles, `content.manage` para o restante — incluindo as 7 policies de storage.objects).
A policy "Admins podem ler capabilities" de `role_capabilities` continua usando `has_role`
de propósito (bootstrap).

```sql
alter policy "Admins can read analytics events" on public.analytics_events
  using (public.has_capability('intel.view'));

alter policy "Admins can insert cutoff scores" on public.enamed_cutoff_scores with check (public.has_capability('content.manage'));
alter policy "Admins can update cutoff scores" on public.enamed_cutoff_scores using (public.has_capability('content.manage')) with check (public.has_capability('content.manage'));
alter policy "Admins can delete cutoff scores" on public.enamed_cutoff_scores using (public.has_capability('content.manage'));

alter policy "Admins can insert institutions" on public.enamed_institutions with check (public.has_capability('content.manage'));
alter policy "Admins can update institutions" on public.enamed_institutions using (public.has_capability('content.manage')) with check (public.has_capability('content.manage'));
alter policy "Admins can delete institutions" on public.enamed_institutions using (public.has_capability('content.manage'));

alter policy "Admins can insert programs" on public.enamed_programs with check (public.has_capability('content.manage'));
alter policy "Admins can update programs" on public.enamed_programs using (public.has_capability('content.manage')) with check (public.has_capability('content.manage'));
alter policy "Admins can delete programs" on public.enamed_programs using (public.has_capability('content.manage'));

alter policy "Admins can insert specialties" on public.enamed_specialties with check (public.has_capability('content.manage'));
alter policy "Admins can update specialties" on public.enamed_specialties using (public.has_capability('content.manage')) with check (public.has_capability('content.manage'));
alter policy "Admins can delete specialties" on public.enamed_specialties using (public.has_capability('content.manage'));

alter policy "Admins can insert questions" on public.questions with check (public.has_capability('content.manage'));
alter policy "Admins can update questions" on public.questions using (public.has_capability('content.manage')) with check (public.has_capability('content.manage'));
alter policy "Admins can delete questions" on public.questions using (public.has_capability('content.manage'));

alter policy "Admins can insert question_options" on public.question_options with check (public.has_capability('content.manage'));
alter policy "Admins can update question_options" on public.question_options using (public.has_capability('content.manage')) with check (public.has_capability('content.manage'));
alter policy "Admins can delete question_options" on public.question_options using (public.has_capability('content.manage'));

alter policy "Admins can insert simulados" on public.simulados with check (public.has_capability('content.manage'));
alter policy "Admins can update simulados" on public.simulados using (public.has_capability('content.manage')) with check (public.has_capability('content.manage'));
alter policy "Admins can delete simulados" on public.simulados using (public.has_capability('content.manage'));
alter policy "Admins can read all simulados" on public.simulados using (public.has_capability('content.manage'));
alter policy "Admins can read test simulados" on public.simulados using (status = 'test'::public.simulado_status and public.has_capability('content.manage'));

alter policy "Admins can read roles" on public.user_roles using (public.has_capability('roles.manage'));

alter policy "Admins can read question images" on storage.objects using (bucket_id = 'question-images' and public.has_capability('content.manage'));
alter policy "Admins can upload question images" on storage.objects with check (bucket_id = 'question-images' and public.has_capability('content.manage'));
alter policy "Admins can update question images" on storage.objects using (bucket_id = 'question-images' and public.has_capability('content.manage')) with check (bucket_id = 'question-images' and public.has_capability('content.manage'));
alter policy "Admins can delete question images" on storage.objects using (bucket_id = 'question-images' and public.has_capability('content.manage'));

alter policy "Admins podem fazer upload de imagens de simulado" on storage.objects with check (bucket_id = 'imagensSimulado' and public.has_capability('content.manage'));
alter policy "Admins podem atualizar imagens de simulado" on storage.objects using (bucket_id = 'imagensSimulado' and public.has_capability('content.manage')) with check (bucket_id = 'imagensSimulado' and public.has_capability('content.manage'));
alter policy "Admins podem deletar imagens de simulado" on storage.objects using (bucket_id = 'imagensSimulado' and public.has_capability('content.manage'));
```

---

## 2026-06-11 — `admin_cap_rpc_dashboard`, `admin_cap_rpc_intel`, `admin_cap_rpc_users_roles`, `admin_cap_rpc_attempts_content_previews`

Sweep das 31 RPCs `admin_*`: o guard inline de role hardcoded foi substituído por
`perform public.admin_require('<capability>');`. Os corpos das funções permaneceram
idênticos (exceto os 3 casos especiais abaixo) — o SQL completo de cada função está
no banco (`select pg_get_functiondef(...)`).

Transformação aplicada em todas (variações de alias/case existiam, mesma semântica):

```sql
-- ANTES
if not exists (
  select 1 from user_roles where user_id = auth.uid() and role = 'admin'
) then
  raise exception 'unauthorized' using errcode = 'P0003';
end if;

-- DEPOIS
perform public.admin_require('<capability>');
```

Mapa RPC → capability:

| Migration | Capability | Funções |
|---|---|---|
| `admin_cap_rpc_dashboard` | `dashboard.view` | admin_dashboard_kpis, admin_events_timeseries, admin_funnel_stats, admin_simulado_engagement, admin_live_signals |
| `admin_cap_rpc_intel` | `intel.view` | admin_analytics_funnel, admin_analytics_sources, admin_analytics_time_to_convert, admin_analytics_timeseries, admin_marketing_kpis, admin_marketing_sources, admin_marketing_mediums, admin_marketing_campaigns, admin_produto_segmented_funnel, admin_produto_friction, admin_produto_feature_adoption, admin_produto_top_events |
| `admin_cap_rpc_users_roles` | `users.view` | admin_list_users, admin_get_user, admin_get_user_attempts |
| `admin_cap_rpc_users_roles` | `users.manage` | admin_set_user_segment, admin_reset_user_onboarding |
| `admin_cap_rpc_users_roles` | `roles.manage` | admin_set_user_role |
| `admin_cap_rpc_attempts_content_previews` | `attempts.view` | admin_attempts_kpis, admin_list_attempts |
| `admin_cap_rpc_attempts_content_previews` | `attempts.manage` | admin_cancel_attempt, admin_delete_attempt |
| `admin_cap_rpc_attempts_content_previews` | `content.manage` | admin_simulado_detail_stats, admin_simulado_question_stats |
| `admin_cap_rpc_attempts_content_previews` | `previews.view` | admin_get_ranking_for_simulado, admin_list_simulados_for_ranking_preview |

**Casos especiais:**

1. `admin_get_user` — assinatura de retorno mudou (drop + recreate na mesma migration):
   adicionada coluna `roles text[]` ao RETURNS TABLE e ao SELECT:

```sql
drop function public.admin_get_user(uuid);
-- recreate com guard novo e coluna extra:
--   ... is_admin boolean, roles text[])
--   (select coalesce(array_agg(ur.role::text), '{}') from user_roles ur where ur.user_id = p_user_id) as roles
```

2. `admin_set_user_role` — proteção contra auto-revogação de admin, logo após o guard:

```sql
if p_user_id = (select auth.uid()) and p_role = 'admin' and p_grant = false then
  raise exception 'cannot_revoke_own_admin' using errcode = 'P0004';
end if;
```

   (não havia whitelist manual de p_role a remover)

3. `admin_simulado_question_stats` — era `language sql` e **não tinha guard nenhum**
   (qualquer authenticated conseguia executar — brecha pré-existente). Recriada como
   `language plpgsql STABLE` com `perform public.admin_require('content.manage');` +
   `return query <mesma query>`, mantendo o contrato de erro P0003.

**Verificações (2026-06-11):**

- Nenhuma policy restante com `has_role` além de "Admins podem ler capabilities" (proposital).
- Todas as 31 RPCs contêm `admin_require('<capability>')` com a capability correta; nenhuma
  contém mais o guard antigo (`from user_roles ... auth.uid()`).
- `role_capabilities`: admin=9, analyst=3, content_editor=4, support=5.
- Smoke test com JWT simulado de admin: `admin_simulado_question_stats`, `admin_get_user`
  (roles=`{admin}`) e `admin_live_signals` executam; sem contexto de auth → `P0003 unauthorized`.

**Edge function `admin-delete-user` (v26):** o check de admin via
`rpc('has_role', ...)` foi substituído por checagem de capability `users.manage` com
service role em duas queries (roles do caller em `user_roles` → match em
`role_capabilities` com `capability = 'users.manage'`), pois PostgREST não faz join
sem FK entre as duas tabelas. Restante do código (CORS, validações, deleteUser) intacto;
`verify_jwt` permanece `false` (a função valida o JWT internamente).

---

## Apêndice — Hardening pós-review (2026-06-11)

Fixes aprovados na revisão de qualidade da migração de capabilities.

### `admin_harden_revoke_anon_execute`

Revoga `EXECUTE` de `anon` e `PUBLIC` nas 34 funções `public.admin_*` + `public.has_capability(text)`,
e concede explicitamente a `authenticated` + `service_role`. Defesa em profundidade: mesmo que
`admin_require` já bloqueie por capability, anon nem chega a executar a função (antes recebia
`P0003`; agora `permission denied`). `has_role` ficou intencionalmente fora (usada fora do
escopo admin).

Verificação: `has_function_privilege('anon', oid, 'execute')` sobre `admin_%` + `has_capability`
→ **0 linhas**.

### `admin_harden_set_user_role`

Dois guards novos em `admin_set_user_role`, logo após o `admin_require('roles.manage')` e antes
do guard de auto-revogação (P0004):

```sql
if p_role not in ('admin','content_editor','support','analyst') then
  raise exception 'invalid_role' using errcode = 'P0005';
end if;
if p_role = 'admin' and p_grant = false
   and (select count(*) from user_roles where role = 'admin') <= 1 then
  raise exception 'cannot_remove_last_admin' using errcode = 'P0006';
end if;
```

Resto do corpo intacto; `CREATE OR REPLACE` preserva os grants da migration anterior.

### `admin_harden_policies_initplan`

1. Initplan wrap nas 32 policies que usam `has_capability`: `public.has_capability('x')` →
   `(select public.has_capability('x'))`, para o Postgres avaliar uma vez por statement em vez
   de por linha (mesmo padrão initplan já adotado no projeto). Regras do `alter policy`
   preservadas: INSERT só `with check`; UPDATE ambos; SELECT/DELETE só `using`; policies de
   `storage.objects` preservam o filtro `bucket_id`.
2. `drop policy "Admins can read test simulados" on public.simulados;` — redundante com
   "Admins can read all simulados" (ambas `content.manage` após a migração).

Verificação: 31 policies com qual/with_check contendo `( SELECT has_capability` (forma
deparsada pelo Postgres — o prefixo `public.` é omitido por estar no search_path), 0 sem wrap,
7 de storage mantendo `bucket_id`, policy redundante ausente.

### Edge function `admin-delete-user` (v27)

Proteção de contas admin: após o check de `users.manage` e do bloqueio de auto-delete, se o
usuário-alvo possuir o role `admin` em `user_roles`, o caller precisa também da capability
`roles.manage` (mesmo lookup service-role `user_roles` → `role_capabilities`); senão **403**
com `"cannot delete admin accounts without roles.manage"`. Resto intacto; `verify_jwt`
permanece `false`.

---

## 2026-06-15 — `admin_intel_metrics` (Task I1)

7 RPCs de métricas de inteligência (Panorama do admin), todas `STABLE SECURITY DEFINER
SET search_path TO 'public'`, com guard `perform public.admin_require('intel.view')` como
primeira instrução (contrato P0003 `unauthorized`). Divisões protegidas com `nullif`;
degradam para 0 linhas / 0 valores quando não há dados. "Attempt analisável" =
`status in ('submitted','expired')` (e `is_within_window` onde indicado).

Aplicadas em 3 migrations: `admin_intel_metrics_part1` (funções 1–4),
`admin_intel_metrics_part2` (funções 5–7), `admin_intel_metrics_grants` (revoke/grant).
Correção pós-smoke `admin_intel_metrics_fix_percentile_cast`: `percentile_cont` retorna
`double precision` e `round(double, int)` não existe no Postgres — cast para `::numeric`
em `admin_score_evolution.median_score` e `admin_engagement_metrics.median_minutes`.

Adaptação de schema: `onboarding_profiles` tem tanto a coluna enum `status` (valores
`pending`/`completed`) quanto `completed_at`. `admin_cohort_retention.did_onboarding` usa
`status = 'completed' OR completed_at is not null` (robusto a ambos).

Grants (para cada função): `revoke execute ... from anon, public;
grant execute ... to authenticated, service_role;`.

Smoke (dados reais 2026-06-15): área mais fraca = Pediatria (56.6%); tema mais fraco =
Medicina de Família e Comunidade > Introdução (6.7%); 3 simulados na evolução (avg
61.6/64.1/71.9); distribuição soma 1432 (pico em 60–70: 440); engajamento 30d started=1384
completed=701 abandono 49.3% (prev 64.8%) mediana 189.4 min; segmentos: pro participa 51.4%
vs guest 11.5% / standard 12.1%. Verificado: anon_exec=false e guard presente nas 7.

```sql
-- 1. admin_cohort_retention(p_months int default 6)
--    -> (cohort_month date, cohort_size, did_onboarding, did_1_plus, did_2_plus, did_3_plus, avg_score)
--    Coorte = date_trunc('month', profiles.created_at); did_N_plus via COUNT(DISTINCT simulado_id)
--    em attempts analisáveis; janela = últimas p_months coortes; ordena cohort_month desc.

-- 2. admin_performance_by_area(p_simulado_id uuid default null, p_segment text default 'all')
--    -> (area, total_responses, correct_responses, correct_rate, n_users, n_questions)
--    base aqr JOIN attempts JOIN questions JOIN profiles; filtros status analisável +
--    is_within_window + was_answered; group by coalesce(area,'(sem área)'); ordena correct_rate asc.

-- 3. admin_performance_by_theme(p_simulado_id uuid, p_area text, p_limit int default 12)
--    -> (theme, area, correct_rate, total_responses); mesma base; group by theme,area; limit p_limit.

-- 4. admin_score_distribution(p_simulado_id uuid default null)
--    -> (bucket_label, bucket_min, count); generate_series(0,90,10) LEFT JOIN history
--    (buckets vazios = 0); valor 100 cai no bucket 90 via least(...,90).

-- 5. admin_score_evolution()
--    -> (simulado_id, sequence_number, title, participants, avg_score, median_score, cutoff_proxy)
--    median via percentile_cont(0.5)::numeric; cutoff_proxy = avg - 0.5*stddev_pop.

-- 6. admin_engagement_metrics(p_days int default 30)
--    -> (started, completed, abandonment_rate(+_prev), avg_minutes(+_prev), median_minutes,
--        avg_tab_exits, avg_fullscreen_exits, high_integrity_flag_pct); janela atual vs prev;
--    high_integrity = tab_exit_count >= 3; sempre 1 linha (coalesce 0).

-- 7. admin_segment_breakdown()
--    -> (segment, users, participants, participation_rate, avg_score, avg_attempts)
--    profiles LEFT JOIN (distinct user_id com attempt analisável) LEFT JOIN user_performance_summary;
--    ordena CASE guest,standard,pro.

-- Para cada função:
-- revoke execute on function public.<nome>(<assinatura>) from anon, public;
-- grant  execute on function public.<nome>(<assinatura>) to authenticated, service_role;
```
