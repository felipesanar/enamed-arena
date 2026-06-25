# Supabase Migrations Log

Este arquivo mantém rastreabilidade das migrations aplicadas diretamente no projeto remoto
(o repositório não versiona os arquivos de migration gerados pelo CLI do Supabase remoto).

---

## 2026-06-24 — `fix_admin_get_user_attempts_and_attempt_questions`

**Aplicada em PROD.** Arquivo: `20260624120000_fix_admin_get_user_attempts_and_attempt_questions.sql`.

Corrige `admin_get_user_attempts`, que referenciava `user_performance_history.is_within_window`
(coluna inexistente — `is_within_window` vive em `attempts`). A subquery de ranking lançava
`42703: column uph2.is_within_window does not exist` em runtime, então a RPC inteira falhava e o
"Histórico de tentativas" no detalhe do usuário (admin) sempre exibia "Nenhuma tentativa
encontrada", mesmo com KPIs (de `user_performance_summary`) mostrando tentativas.

- Ranking agora calculado contra tentativas in-window submetidas do mesmo simulado, espelhando
  `admin_simulado_results_roster` (`coalesce(uph.score_percentage, attempts.score_percentage)`);
  tentativas de treino (`is_within_window = false`) recebem `ranking_position = null`.
- Return type ganhou `is_within_window` (drop+recreate; grants re-aplicados: authenticated, service_role).
- **Nova RPC** `admin_get_attempt_questions(p_attempt_id uuid)` — breakdown por questão de uma
  tentativa (sobre `attempt_question_results` + `questions`/`question_options`/`answers`), para o
  drill-down do detalhe do usuário. Gate `admin_require('users.view')`. Grants: authenticated, service_role.

Também (não-migration, mesmo PR): edge function `sso-magic-link` v60 — restaura elevação de
segment PRO/standard (modo unsigned quando `SSO_SIGNING_SECRET` ausente) + regra never-downgrade.

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

---

## 2026-06-15 — `admin_intel_metrics_trim_fix`

Correção cirúrgica nas 3 RPCs de desempenho de inteligência para eliminar agrupamentos
duplicados causados por espaços extras em `questions.area` e `questions.theme`
(e.g. `'Preventiva'` vs `'Preventiva '`), e corrigir cast implícito em `cutoff_proxy`.

Verificação de impacto: `count(distinct area) raw = 11` vs `count(distinct trim(area)) trimmed = 10`
— 1 área com espaço à direita colapsou corretamente.

### `admin_performance_by_area`

- `coalesce(q.area, '(sem área)')` → `coalesce(nullif(trim(q.area), ''), '(sem área)')` em SELECT e GROUP BY.
- O `nullif` garante que strings que viram vazias após trim também caem no placeholder.

### `admin_performance_by_theme`

- Mesma transformação trim+nullif para `q.theme` em SELECT/GROUP BY.
- Mesma transformação trim+nullif para `q.area` em SELECT/GROUP BY.
- Filtro de área: `q.area = p_area` → `trim(q.area) = trim(p_area)` para compatibilidade com callers que passam valor sem espaço.

### `admin_score_evolution`

- `cutoff_proxy`: `round(avg(...) - 0.5 * coalesce(stddev_pop(...), 0), 1)` →
  `round((avg(h.score_percentage) - 0.5 * coalesce(stddev_pop(h.score_percentage)::numeric, 0))::numeric, 1)`
  — cast explícito em `stddev_pop(double precision)` e na expressão completa antes do `round`,
  evitando falha implícita de tipo em Postgres estrito.

Verificações pós-aplicação:

- `trim(` presente no functiondef de `admin_performance_by_area` e `admin_performance_by_theme`. ✓
- `::numeric` presente no functiondef de `admin_score_evolution` (linha cutoff_proxy). ✓
- `admin_require('intel.view')` presente nas 3 funções (guard intacto). ✓
- `has_function_privilege('anon', oid, 'execute')` = false nas 3 (grants intactos). ✓
- `count(distinct trim(area)) = 10 < count(distinct area) = 11` (colisão por espaço confirmada). ✓

```sql
-- admin_performance_by_area: área SELECT alias e GROUP BY
coalesce(nullif(trim(q.area), ''), '(sem área)') as area
-- (group by usa a mesma expressão)

-- admin_performance_by_theme: tema e área, mais filtro de área
coalesce(nullif(trim(q.theme), ''), '(sem tema)') as theme,
coalesce(nullif(trim(q.area),  ''), '(sem área)') as area
-- filtro: (p_area is null or trim(q.area) = trim(p_area))

-- admin_score_evolution: cutoff_proxy com cast explícito
round((avg(h.score_percentage) - 0.5 * coalesce(stddev_pop(h.score_percentage)::numeric, 0))::numeric, 1) as cutoff_proxy
```

---

## Apêndice — RPCs Task I1 (definições de referência)

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

---

## 2026-06-15 — `admin_intel_insights` (Task I2)

Motor de alertas/insights por regras. Função `admin_intel_insights()`
-> `(id, severity, category, title, detail, metric_value numeric, metric_unit, route)[]`,
`STABLE SECURITY DEFINER SET search_path = 'public'`, guard `admin_require('intel.view')`.
`revoke execute from anon, public; grant execute to authenticated, service_role`.

Cada regra roda em bloco `begin ... exception when others then null; end;` (nunca lança por
falta de dados) e emite 0 ou 1 linha quando a métrica cruza o threshold. As linhas são
acumuladas num `jsonb` e devolvidas via `jsonb_to_recordset`, ordenadas por
severity (critical=0, warning=1, info=2) e depois `metric_value`.

**Gotcha (corrigido):** versão inicial acumulava num `CREATE TEMPORARY TABLE` — ilegal em
função `STABLE` (`0A000: CREATE TABLE is not allowed in a non-volatile function`); o guard
mascarava o erro no smoke sob MCP. `record[]` também é proibido (pseudo-tipo). Solução final:
acumulador `jsonb`.

Regras (replicam as queries-base das RPCs da I1, sem depender do guard delas):
- `weakest_area`: menor correct_rate por área (aqr+attempts+questions, status analisável,
  is_within_window, was_answered). < 60 → emite; critical se < 50, senão warning. `#areas`.
- `score_decline`: 2 últimas linhas de score_evolution; cur < prev-5 → warning; metric = cur-prev (points). `#evolucao`.
- `participation_drop`: participants último vs anterior; queda > 15% → warning. `#evolucao`.
- `high_abandonment`: abandono 30d = 100*(started-completed)/started (completed=submitted);
  > 25 → emite; critical se > 40, senão warning. `#engajamento`.
- `integrity_spike`: % attempts 30d com tab_exit_count >= 3; > 20 → warning. `#engajamento`.
- `low_cohort_activation`: coorte de cadastro mais recente com idade >= 30d; did_1_plus/cohort_size
  < 40% → emite; warning se < 25, senão info. `#cohorts`.

**Validação (dados de produção em 2026-06-15):** disparam 4 insights — `high_abandonment` 49.3%
critical, `low_cohort_activation` 6.4% (coorte 05/2026) warning, `weakest_area` Pediatria 56.6%
warning, `participation_drop` 57.5% warning. Não disparam: `score_decline` (média subiu 64.1→71.9),
`integrity_spike` (3.3%). Lógica validada via clone temporário sem guard (criado e dropado).

Tipos TS regenerados (`src/integrations/supabase/types.ts`); build verde.

---

## 2026-06-15 — `admin_audit_infra`

Infra de auditoria da central de gestão (Fase 3, Task G1). Cria a tabela `admin_audit_log`
com RLS (SELECT gated por `has_capability('audit.view')`), seed da capability `audit.view`
para o role `admin`, a RPC de escrita `admin_log_action`, a trigger fn `tg_admin_audit`
ligada a `simulados`/`questions`/`question_options` (after insert/update/delete), e a RPC
de leitura paginada `admin_list_audit` (guard `admin_require('audit.view')`).

A trigger fn é no-op quando `auth.uid()` é null (não polui em escritas de sistema/seed) e
delega o INSERT para `admin_log_action` (SECURITY DEFINER) — o summary humaniza cada entidade
(`Simulado: <title>`, `Questão nº <question_number>`, `Alternativa <label>`). As RPCs são
`SECURITY DEFINER SET search_path='public'`; `admin_log_action` é `VOLATILE`, `admin_list_audit`
é `STABLE`. `revoke execute from anon, public; grant execute to authenticated, service_role`
nas duas RPCs. A trigger fn não recebe grant/revoke (roda no contexto da tabela).

```sql
create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  actor_email text,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  summary text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists idx_audit_created on public.admin_audit_log (created_at desc);
create index if not exists idx_audit_entity on public.admin_audit_log (entity_type, entity_id);
create index if not exists idx_audit_actor on public.admin_audit_log (actor_id);

alter table public.admin_audit_log enable row level security;
create policy "Auditores podem ler audit log" on public.admin_audit_log
  for select using (public.has_capability('audit.view'));

insert into role_capabilities (role, capability) values ('admin','audit.view') on conflict do nothing;

create or replace function public.admin_log_action(
  p_action text, p_entity_type text, p_entity_id uuid,
  p_summary text default null, p_metadata jsonb default '{}'
) returns void
language plpgsql volatile security definer set search_path to 'public'
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then return; end if;
  insert into public.admin_audit_log (actor_id, actor_email, action, entity_type, entity_id, summary, metadata)
  values (v_uid, (select email from auth.users where id = v_uid), p_action, p_entity_type, p_entity_id, p_summary, coalesce(p_metadata,'{}'::jsonb));
end; $$;

create or replace function public.tg_admin_audit() returns trigger
language plpgsql security definer set search_path to 'public'
as $$
declare v_summary text; v_id uuid;
begin
  if auth.uid() is null then return coalesce(NEW, OLD); end if;
  v_id := coalesce(NEW.id, OLD.id);
  v_summary := case TG_TABLE_NAME
    when 'simulados' then 'Simulado: ' || coalesce(NEW.title, OLD.title)
    when 'questions' then 'Questão nº ' || coalesce(NEW.question_number, OLD.question_number)::text
    when 'question_options' then 'Alternativa ' || coalesce(NEW.label, OLD.label)
    else TG_TABLE_NAME end;
  perform public.admin_log_action(TG_OP, TG_TABLE_NAME, v_id, v_summary, jsonb_build_object('op', TG_OP));
  return coalesce(NEW, OLD);
end; $$;

create trigger trg_audit_simulados after insert or update or delete on public.simulados for each row execute function public.tg_admin_audit();
create trigger trg_audit_questions after insert or update or delete on public.questions for each row execute function public.tg_admin_audit();
create trigger trg_audit_question_options after insert or update or delete on public.question_options for each row execute function public.tg_admin_audit();

create or replace function public.admin_list_audit(
  p_days int default 30, p_action text default 'all', p_entity_type text default 'all',
  p_search text default '', p_limit int default 50, p_offset int default 0
) returns table(id uuid, actor_email text, action text, entity_type text, entity_id uuid, summary text, metadata jsonb, created_at timestamptz, total_count bigint)
language plpgsql stable security definer set search_path to 'public'
as $$
begin
  perform public.admin_require('audit.view');
  return query
  select a.id, a.actor_email, a.action, a.entity_type, a.entity_id, a.summary, a.metadata, a.created_at, count(*) over () as total_count
  from public.admin_audit_log a
  where a.created_at >= now() - (p_days || ' days')::interval
    and (p_action = 'all' or a.action = p_action)
    and (p_entity_type = 'all' or a.entity_type = p_entity_type)
    and (p_search = '' or a.summary ilike '%'||p_search||'%' or coalesce(a.actor_email,'') ilike '%'||p_search||'%')
  order by a.created_at desc
  limit p_limit offset p_offset;
end; $$;

revoke execute on function public.admin_log_action(text,text,uuid,text,jsonb) from anon, public;
grant execute on function public.admin_log_action(text,text,uuid,text,jsonb) to authenticated, service_role;
revoke execute on function public.admin_list_audit(int,text,text,text,int,int) from anon, public;
grant execute on function public.admin_list_audit(int,text,text,text,int,int) to authenticated, service_role;
```

**Verificação de schema (pré-migration):** confirmado que `simulados.title`,
`questions.question_number` e `question_options.label` existem — summary aplicado sem ajuste.

**Smoke (2026-06-15):** `rowsecurity=true`; policy `Auditores podem ler audit log` (SELECT);
`role_capabilities` admin/audit.view = 1; 3 triggers `trg_audit_*`; as 3 funções `prosecdef=true`;
`admin_log_action`/`admin_list_audit` com `anon execute=false`, `authenticated execute=true`;
`tg_admin_audit` mantém execute público (trigger fn — correto). Nenhum write em produção feito
no smoke (apenas inspeção estrutural).

---

## G2 — RPCs de edição de questão + retrofit de logging de auditoria (2026-06-15)

**Migration `admin_question_editing`** — 5 funções `content.manage`, todas `SECURITY DEFINER
SET search_path TO 'public'`, guard `admin_require('content.manage')` como 1ª instrução,
`revoke ... from anon, public` + `grant ... to authenticated, service_role`:

- `admin_get_simulado_questions(uuid)` (stable) — retorna questões + `options` jsonb (jsonb_agg
  ordenado por label) de um simulado.
- `admin_update_question(uuid, text x8)` — atualiza texto/área/tema/dificuldade/explicação/imagens;
  `not_found` P0007 se questão inexistente.
- `admin_update_option(uuid, text)` — atualiza texto da alternativa; `not_found` P0007 se `not found`.
- `admin_set_correct_option(uuid, uuid)` — marca alternativa correta (uma só); `invalid_option`
  P0008 se a opção não pertence à questão.
- `admin_delete_question(uuid)` — bloqueia com `question_has_answers` P0009 se há
  `attempt_question_results`; `not_found` P0007 se questão inexistente; decrementa
  `simulados.questions_count` (greatest 0).

**Migration `admin_audit_retrofit_rpcs`** — `CREATE OR REPLACE` das 5 RPCs mutadoras já existentes,
adicionando ao fim do caminho de sucesso um bloco tolerante
`begin perform public.admin_log_action(...); exception when others then null; end;`. Assinaturas e
guards originais 100% preservados:

- `admin_set_user_role(uuid,text,boolean)` — log `grant_role`/`revoke_role`; guards P0004
  (revogar próprio admin), P0005 (role inválida), P0006 (último admin) preservados.
- `admin_set_user_segment(uuid,text)` — log `set_segment`.
- `admin_reset_user_onboarding(uuid)` — log `reset_onboarding`.
- `admin_cancel_attempt(uuid)` — log `cancel_attempt`; guard P0004 (not found / not in_progress) preservado.
- `admin_delete_attempt(uuid)` — log `delete_attempt`.

**Smoke (2026-06-15):** 5 funções novas com `prosecdef=true`, `anon execute=false`,
`authenticated execute=true`, guard `content.manage` presente. Montagem do `options` jsonb validada
crua (ordem A–D, estrutura id/label/text/is_correct). Condição de bloqueio do delete confirmada
(`exists` de questão respondida = true → delete bloqueado). 5 RPCs retrofitadas confirmadas via
`pg_get_functiondef`: `admin_log_action` presente; assinaturas inalteradas; P0004/P0005/P0006
preservados em `admin_set_user_role`, P0004 em `admin_cancel_attempt`. Nenhum write/delete em
produção no smoke.

**Types:** regenerados via MCP; `src/integrations/supabase/types.ts` substituído; contém
`admin_get_simulado_questions`, `admin_update_question`, `admin_update_option`,
`admin_set_correct_option`, `admin_delete_question`, `admin_list_audit`, `admin_audit_log`.
`npm run build` verde.

---

## 2026-06-15 — `admin_gestao_hardening` (Fase 3 — hardening pós-review)

Dois fixes de defesa em profundidade aplicados no DB de produção. Não há mudança de
comportamento para o fluxo normal de estudantes (as alterações afetam apenas permissões de
escrita em tabela de auditoria e comportamento de DELETE em questões, operação exclusiva de admins).

### Fix 1 — Revoke de grants de escrita inerte em `admin_audit_log`

`anon` e `authenticated` possuíam grants de tabela INSERT/UPDATE/DELETE/TRUNCATE em
`admin_audit_log`. Esses grants eram **inerts** (RLS default-deny sem policies de escrita para
esses roles), mas representavam dívida de defesa em profundidade. Revogados:

```sql
revoke insert, update, delete, truncate on public.admin_audit_log from anon, authenticated;
```

`SELECT` e `REFERENCES`/`TRIGGER` foram mantidos (SELECT é governado pela policy RLS
`Auditores podem ler audit log`; `service_role` não foi tocado).

**Verificação (após migration):** `information_schema.role_table_grants` para `anon`/`authenticated`
em `admin_audit_log` mostra apenas `REFERENCES`, `SELECT`, `TRIGGER` — INSERT/UPDATE/DELETE/TRUNCATE
ausentes. ✓

**Situação antes da migration:** anon e authenticated tinham INSERT, UPDATE, DELETE, REFERENCES,
SELECT, TRIGGER, TRUNCATE (7 grants cada).

### Fix 2 — FK `attempt_question_results.question_id`: CASCADE → RESTRICT

**Constraint confirmada antes da alteração:**
```
FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
```
Exatamente FK simples `(question_id) → questions(id)`, safe para alterar.

O comportamento CASCADE significava que deletar uma questão eliminaria silenciosamente todas as
~143k linhas de histórico em `attempt_question_results`. O guard de aplicação
(`admin_delete_question` P0009) era a única proteção. A migration adiciona enforcement no DB:

```sql
alter table public.attempt_question_results
  drop constraint attempt_question_results_question_id_fkey;
alter table public.attempt_question_results
  add constraint attempt_question_results_question_id_fkey
    foreign key (question_id) references public.questions(id) on delete restrict;
```

As FKs de `selected_option_id` e `correct_option_id` não foram tocadas (permanecem `confdeltype='a'`).

**Verificação (após migration):**

| Constraint | confdeltype | Significado |
|---|---|---|
| `attempt_question_results_attempt_id_fkey` | `c` (cascade) | inalterado |
| `attempt_question_results_correct_option_id_fkey` | `a` (no action) | inalterado |
| `attempt_question_results_question_id_fkey` | **`r` (restrict)** | ✓ alterado |
| `attempt_question_results_selected_option_id_fkey` | `a` (no action) | inalterado |

**Row count smoke:** `count(*) from attempt_question_results = 143200` (ALTER não toca linhas). ✓

---

## 2026-06-17 — `fase4_results_view_capability`

Fase 4 (Dados & Ranking). Adiciona a capability **`results.view`** à `role_capabilities` para os roles `admin`, `content_editor` e `analyst` (o roster de concluintes expõe PII — nome + e-mail — então é separada de `content.manage`). Aditiva e idempotente.

```sql
insert into public.role_capabilities (role, capability) values
  ('admin'::app_role,          'results.view'),
  ('content_editor'::app_role, 'results.view'),
  ('analyst'::app_role,        'results.view')
on conflict (role, capability) do nothing;
```

**Smoke:** `select role from role_capabilities where capability='results.view'` → admin, content_editor, analyst (support **não** tem). ✓

---

## 2026-06-17 — `fase4_results_roster_rpc`

Fase 4 (Dados & Ranking). Cria a RPC **`admin_simulado_results_roster(p_simulado_id, p_sort, p_dir, p_scope, p_search, p_segment, p_institution, p_limit, p_offset)`** — roster de concluintes (`status='submitted'`) de um simulado com ordenação/filtro/paginação **no servidor** (contorna o teto de 1000 do PostgREST). `SECURITY DEFINER`, `set search_path=public`, primeiro statement `perform admin_require('results.view')`. Read-only (sem audit log). `revoke all ... from public, anon`.

- **Joins:** `attempts` → `simulados` (total_count = questions_count) → `profiles` (nome/segmento) → `auth.users` (email) → `onboarding_profiles` (instituição = `target_institutions[1]`, especialidade). Score = `coalesce(user_performance_history.score_percentage, attempts.score_percentage)`.
- **rank:** `rank() over (order by score desc)` calculado no escopo (valid/training/all) **antes** dos filtros de exibição (busca/segmento/instituição), refletindo a posição real no simulado.
- **scope:** `valid` (is_within_window), `training` (not), `all`.
- **Ordenação:** por `CASE` whitelistado (name/segment/institution/specialty/score/correct_count/duration_seconds/submitted_at), sem SQL dinâmico → sem injeção. Tiebreaker estável por `rnk`.

**Smoke:** corpo da query sobre simulado `887c0554…` (552 concluintes válidos) retornou ranking com empates corretos (1,2,2,4…), `total_rows` estável (552), e todos os campos (nome/email/segmento/instituição/especialidade/score/acertos/duração) populados. Chamada direta da RPC sob role sem capability → `P0003 unauthorized` (guard OK). ✓

---

## 2026-06-17 — `fase4_results_roster_rpc_email_sort`

Fase 4 (refino). `CREATE OR REPLACE` da `admin_simulado_results_roster` (mesma assinatura) acrescentando os dois `CASE` de ordenação por `email` no `ORDER BY`, para que a coluna E-mail do roster seja de fato ordenável no servidor (antes caía no rank por fallback). Sem outras mudanças.

## 2026-06-24 — Auditoria de dados do admin: correção de 28 RPCs de métricas

Correção severa pós-auditoria de confiabilidade dos dados do /admin. 28 RPCs `SECURITY DEFINER` reescritas e aplicadas em PROD (atômico, em ordem). **Decisões:** (1) métricas de PROVA excluem treino (`is_within_window=false`); 'iniciados' mantém treino; (2) `offline_pending` (status real, ~30% das tentativas) passa a ser visível e tratado em conclusão/abandono; (3) `expired` é bucket morto (sempre 0) e nunca mais é sinônimo de concluído; (4) funis/jornada/marketing viram COORTE por `user_id`, com conversão clampada a [0,100] e sinal `insufficient_data` (telemetria só existe desde 2026-06-17); (5) bucketização por dia/semana em `America/Sao_Paulo`; (6) anti-join `user_roles` onde fez sentido.

**Mudanças de assinatura:** todas ADITIVAS (colunas novas no fim; colunas originais preservadas em nome/tipo/ordem). Funções que mudaram o row-type exigiram `DROP FUNCTION` + recriação.

**Higiene de grants (segurança):** toda função recriada recebeu `REVOKE ALL ... FROM PUBLIC, anon` + `GRANT EXECUTE ... TO authenticated, service_role`. Isso REMOVEU exposição a `anon` que existia em `admin_analytics_funnel`, `admin_funnel_stats` e `admin_produto_segmented_funnel`. ACL final de todas: `authenticated` + `service_role` apenas.

**Bug pré-existente corrigido:** `admin_produto_friction` já falhava em runtime em PROD (`operator does not exist: user_segment = text`) — corrigido com `pr.segment::text = p_segment`.

**Funções (migration → correção):**

- `fix_admin_attempts_kpis_offline_pending` — Tornar offline_pending visivel e fechar a conta total = soma dos status. Adita 4 colunas no FIM do retorno (offline_pending, submitted_valid, in_progress_valid, offline_pending_valid) preservando tota
- `fix_admin_simulado_engagement_window_abandon_unified` — Unifica abandono = (in_progress+offline_pending DENTRO da janela)/(tentativas na janela), igual à detail RPC. Conclusão, abandono, avg_score e participants passam a excluir treino (is_within_window=fa
- `fix_admin_simulado_detail_stats_window_median_capped_time` — Abandono unificado (in_progress+offline_pending na janela)/(tentativas na janela). Conclusão/participants/avg_time excluem treino. avg_time deixa de ser wall-clock sem cap: usa least(finished_at, effe
- `fix_admin_dashboard_kpis_exclude_treino_offline_pending` — Corrige completion_rate e avg_score para EXCLUIR treino (is_within_window=false). Conclusão = submitted/valid; denominador valido = submitted+offline_pending+in_progress (expired NUNCA conta como conc
- `fix_admin_events_timeseries_brt_bucket_exclude_treino` — date_trunc por dia em America/Sao_Paulo (era UTC, ~9.5% das tentativas caem em dia diferente) e ancora generate_series no horario local. exams_completed passa a contar SOMENTE provas validas submitted
- `fix_admin_analytics_funnel_cohort` — Reconstrói o funil de Jornada como COORTE por user_id (cada passo subconjunto do anterior via IN), em vez de 5 contagens independentes de universos diferentes (8d de eventos vs anos de profiles/attemp
- `fix_admin_funnel_stats_cohort` — Funil do Dashboard: era coorte por signup do período (7d) misturando passos de evento (simulado_detail_viewed/resultado_viewed) com passos de ação sem garantir subconjunto, e usava status in ('submitt
- `fix_admin_produto_segmented_funnel_cohort` — Funil Segmentado por segmento: a base de cada segmento era gated por created_at >= 30d, o que ZERAVA 'standard' (maior segmento, 4214 no banco -> apenas 8 caíam na janela). Como o objetivo é COMPARAR 
- `fix_admin_time_to_convert_honest_cohorts` — Corrige admin_analytics_time_to_convert: landing->signup vira INSALVÁVEL (N=0, landing dispara DEPOIS do signup) -> retorna -1 (sentinel 'dados insuficientes') quando a amostra < 5. signup->onboarding
- `fix_admin_produto_friction_exclude_training_honest_results` — Corrige admin_produto_friction (assinatura key/title/event_name/metric_value/metric_unit/severity PRESERVADA; colunas aditivas no fim). post_exam_churn = coorte de quem teve 1ª PROVA VÁLIDA no período
- `fix_admin_marketing_campaigns_cohort_granularity` — Corrige o bug CRITICO: o FULL JOIN por texto de campanha replicava signups/first_exams (ate 1076/182) em cada linha de source, gerando conv_rate=107600%. Agora signups e first_exams sao atribuidos a c
- `fix_admin_marketing_kpis_honest_landing_conv` — Corrige landing_to_signup_pct que dava 623%/3937% (cruzava signups de meses com visitas de 8 dias, sem cap). Agora o denominador sao as visitas de landing na janela de telemetria e o numerador e a coo
- `fix_admin_marketing_sources_real_conversion` — O conv_rate atual e PARTICIPACAO (soma ~100%), nao conversao. Mantem conv_rate (participacao) por compat de assinatura e ADICIONA signup_conv_pct = conversao REAL por origem (cadastros da coorte ident
- `fix_admin_marketing_mediums_real_conversion` — Mesma correcao de semantica do sources para mediums: conv_rate continua sendo participacao (compat) e ADICIONA signup_conv_pct = conversao real por medium (coorte identificada / visitas de landing do 
- `fix_admin_cohort_retention_exclude_treino_add_pending` — Corrige admin_cohort_retention: did_1/2/3_plus passam a contar APENAS provas válidas (status='submitted' AND is_within_window=true), excluindo treino e o bucket morto 'expired'. avg_score passa a vir 
- `fix_admin_analytics_timeseries_valid_exams_sp_tz` — first_exams passa a contar a 1a PROVA VALIDA (status submitted + is_within_window=true), nao o min(created_at) de qualquer attempt (que contava treino/in_progress). Bucketizacao semanal migrada para A
- `fix_admin_segment_breakdown_offline_pending_antijoin_no_treino` — participants passa a contar participantes REAIS de prova valida: status in (in_progress, offline_pending, submitted) com is_within_window=true (inclui offline_pending = 727 users antes excluidos; remo
- `fix_admin_score_distribution_exclude_treino` — admin_score_distribution lê user_performance_history (uph) diretamente, que contém 345 linhas de treino (is_within_window=false). Junta a attempts via attempt_id e filtra is_within_window=true para ex
- `fix_admin_score_evolution_exclude_treino` — admin_score_evolution agrega user_performance_history sem excluir treino, inflando participants/avg/median/cutoff com tentativas is_within_window=false. Junta a attempts via attempt_id e filtra is_wit
- `fix_admin_engagement_metrics_treino_offline_pending` — admin_engagement_metrics tratava 'completed' como qualquer status='submitted' (incluindo treino) e abandono = (started-completed)/started misturando treino com prova. Correções: (1) started/started_pr
- `fix_admin_users_exclude_training_expose_offline_pending` — Corrige avg_score/best_score/last_score/total_attempts dos RPCs de usuarios para EXCLUIR treino (is_within_window=false). A causa-raiz: user_performance_summary (e user_performance_history que o alime
- `fix_admin_get_user_exclude_training_expose_offline_pending` — Mesma correcao para admin_get_user: avg_score/best_score/last_score/total_attempts agora vem de user_performance_history JOIN attempts filtrando is_within_window=true (exclui treino). last_score/last_
- `fix_admin_live_signals_offline_pending_honest_tickets` — Corrige admin_live_signals: (1) online_last_15min passa a usar fonte confiavel = UNIAO de atividade real (analytics_events + attempts.last_saved_at) excluindo contas internas via anti-join com user_ro
- `fix_admin_get_ranking_dedupe_best_attempt` — admin_get_ranking_for_simulado e a verdade do app (get_ranking_for_simulado) NAO deduplicam por usuario: 19 pares user/simulado tem >1 tentativa valida; no simulado 887c0554 isso gera 552 posicoes par
- `fix_admin_results_roster_rank_dedupe_rownumber` — O 'rank' (#) do roster usava rank() sobre TODAS as tentativas do escopo apos search/segment/institution, sem dedupe por usuario e com semantica RANK (empates compartilham posicao) -> diverge do rankin
- `fix_admin_question_stats_valid_only_and_disc_scale` — Dois bugs: (1) estatisticas por questao incluiam tentativas de treino (is_within_window=false): no simulado 887c0554, Q1 tinha 775 respostas vs 552 validas, correct_rate 36.90% vs 37.50%; percentis to
- `fix_admin_get_user_attempts_rownumber_dedupe` — ranking_position usava count(*)+1 de tentativas validas com score estritamente maior (semantica RANK, empates compartilham posicao) e contava POR TENTATIVA sem dedupe por usuario -> diverge do ROW_NUM
- `fix_admin_list_attempts_ranking_rownumber_valid` — ranking_position usava count(*)+1 sobre user_performance_history filtrado so por simulado (sem is_within_window, por-tentativa, semantica RANK). uph mistura tentativas de treino (is_within_window=fals

**Smoke (PROD, contexto admin):** todas as 28 executam sem erro; grants = `authenticated`+`service_role` (sem anon/public); `admin_attempts_kpis` fecha total = soma dos 4 buckets; `admin_produto_friction` roda (enum corrigido) e `results_view` retorna sentinel -1/insuficiente; funis monotônicos e conversões em [0,100]. Verificação adversarial por domínio executada.

**Follow-up registrado:** 31 OUTRAS RPCs admin ainda executáveis por `anon` (pré-existente, gated por `admin_require`); `admin_get_ranking_for_simulado` não chama `admin_require` (comportamento pré-existente, preservado).

---

## 2026-06-24 — Auditoria do admin (v2): conserto de runtime + funis honestos

Dois ajustes pós-verificação adversarial das 28 RPCs:

1. **`fix_admin_marketing_ambiguous_colref_v2`** — `admin_marketing_sources/mediums/campaigns` passaram a falhar em runtime com `ERROR 42702 column reference "source/medium/campaign" is ambiguous` (alias de CTE colidindo com coluna do `RETURNS TABLE`). Fix: diretiva `#variable_conflict use_column`. `CREATE OR REPLACE` (mesma assinatura → grants preservados). **Smoke (admin):** as 3 executam; `campaigns` sem fan-out (signups por (campaign,source), conv_rate ≤ 100), `sources/mediums` com `signup_conv_pct` em [0,100]/null.

2. **`fix_admin_funnels_reliable_cohort_spine_v2`** — `admin_analytics_funnel` e `admin_funnel_stats` eram não-monotônicos: misturavam passos de EVENTO (telemetria só desde 2026-06-17) com passos all-time, e o `least(100,...)` mascarava conversão 1574% como "100". Fix: funil reduzido à **coorte confiável estritamente aninhada** (Cadastro→Onboarding→Iniciou prova→Submeteu válida [→Retornou 2+]), derivada de profiles/onboarding/attempts; passos de evento removidos (métricas de aquisição vivem no Marketing). **Smoke (admin, 90d):** Jornada 6899→3928(56.9%)→1736(44.2%)→769(44.3%)→314(40.8%), monotônico, conversões em [0,100].

---

## 2026-06-25 — `fix_admin_produto_feature_adoption_enum_cast`

Bug PRÉ-EXISTENTE (não introduzido pela auditoria, mas descoberto ao revisar a página Produto): `admin_produto_feature_adoption` abortava em runtime com `42883 operator does not exist: user_segment = text` (`pr.segment` é ENUM, `p_segment` é text), fazendo o painel "Recursos mais usados" renderizar sempre vazio. Fix: `pr.segment::text = p_segment` nas 2 comparações. `CREATE OR REPLACE` (mesma assinatura → grants preservados). **Smoke (admin):** `admin_produto_feature_adoption(30,'all')` retorna 6 linhas (Ver desempenho 25,7%, Ver gabarito/Ver resultado 18,9%, Ver ranking 15,0%, Comparativo 5,3%, Caderno 3,1%). Não precisa de deploy de frontend — o front antigo já chama essa RPC; corrigir o erro de runtime já popula o painel.

---

## 2026-06-25 — `fix_admin_set_user_role_enum_cast`

Varredura de todo o banco (não só admin) pelo padrão enum=text descobriu um 2º bug PRÉ-EXISTENTE, mais grave: `admin_set_user_role` falhava com `42804 column "role" is of type app_role but expression is of type text` no INSERT (grant) e `42883` no DELETE (revoke) — `p_role` (text) sem cast para `app_role`. **Gestão de papéis pelo admin estava 100% quebrada** (papéis só existiam por seed SQL direto; o caminho da UI nunca funcionou). Fix: `p_role::app_role`. **Smoke (admin, tx revertida):** grant+revoke de 'analyst' rodam sem erro de tipo. Demais colunas enum (attempt_status/onboarding_status/etc.) são escritas por literais (coagem ok); `admin_set_user_segment` já tinha cast. Comparações enum=text variável: só `admin_produto_feature_adoption` e `admin_produto_friction` estavam afetadas (corrigidas).

---
