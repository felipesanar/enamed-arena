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

## 2026-06-24/25 — Auditoria de dados do admin: 32 RPCs de métricas (DB-only)

Migrations da auditoria severa de confiabilidade dos dados do /admin, **já aplicadas em PROD** e versionadas aqui (este PR é DB-only; o frontend correspondente foi superseubado pelo redesign — os rótulos de exibição serão reaplicados sobre as páginas do redesign em PR à parte). Cada `.sql` tem o racional no cabeçalho. **Decisões:** métricas de PROVA excluem treino (is_within_window=false); offline_pending (status real, ~30%) visível e tratado; expired é bucket morto; funis viram coorte monotônica com clamp [0,100] + insufficient_data; bucketização em America/Sao_Paulo; higiene de grants (REVOKE PUBLIC/anon + GRANT authenticated/service_role em toda função recriada). **Bugs pré-existentes de enum corrigidos:** admin_produto_friction, admin_produto_feature_adoption (faziam painel vazio/erro), admin_set_user_role (grant/revoke de papéis 100% quebrado). Verificação adversarial por domínio contra o banco real. Arquivos: 20260624210000..212700 (28), 213000/213100 (v2 marketing+funis), 20260625004000 (feature_adoption), 20260625004500 (set_user_role).

---

## 2026-08-12 — `presencial_schema`

Task 1 (fundação) da aplicação presencial do Simulado 7. **Aplicada em PROD.** Arquivo: `20260812100000_presencial_schema.sql`.

- **`attempts.attempt_type`**: `DROP CONSTRAINT` + `ADD CONSTRAINT` alargando o `CHECK` de `('online','offline')` para `('online','offline','presencial')`. Confirmado antes de aplicar que as 5905 linhas existentes de `attempts` só têm `online` (3704) e `offline` (2201) — alargamento, sem risco de violar dado existente.
- **`backup.presencial_superseded_answers`**: guarda o snapshot (respostas/status/score) de um attempt online que for supersedido quando o aluno também faz a prova presencial (conversão trata o presencial como a fonte de verdade). Schema `backup` já é convenção do projeto (hardening de 04/08).
- **`public.presencial_sessions`**: a "sala" que o QR code aponta — code (slug curto, `CHECK ~ '^[a-z0-9-]{3,32}$'`), janela `opens_at < closes_at`.
- **`public.presencial_submissions`**: escrita **sempre**, vinculada ou não a uma conta (`status unlinked|linked`), independente de identificação. `identification_path` documenta como a submissão foi (ou não) associada a um usuário. Índice único parcial `presencial_submissions_one_per_user_simulado (linked_user_id, simulado_id) WHERE linked_user_id IS NOT NULL` é a trava que implementa a regra de negócio "1 envio presencial por conta por simulado, irreversível" — intencionalmente não filtra por status para não permitir reenvio após vínculo.
- **`public.presencial_duplicate_candidates`**: subproduto do desempate por nome quando `declared_email` não bate com nenhuma conta — lista candidatos por nome para revisão humana.
- **RLS ligada e SEM nenhuma policy nas três tabelas novas** (`presencial_sessions`, `presencial_submissions`, `presencial_duplicate_candidates`), mais `REVOKE ALL ... FROM PUBLIC, anon, authenticated`: não existe fluxo client-side direto contra essas tabelas — toda escrita/leitura é por `service_role` (edge functions do fluxo presencial) ou RPC `SECURITY DEFINER`, então RLS sem policy fecha o acesso por padrão em vez de precisar acertar policies de aluno/admin agora.

**Smokes (via `execute_sql`):**

1. `pg_get_constraintdef` de `attempts_attempt_type_check` → `CHECK ((attempt_type = ANY (ARRAY['online'::text, 'offline'::text, 'presencial'::text])))`. ✓
2. Insert de `code = 'CODIGO INVALIDO'` em `presencial_sessions` dentro de bloco `do $$ ... exception when check_violation$$` → capturado (`OK: code inválido rejeitado`, sem erro do `raise exception 'FALHOU'`); confirmado depois que `count(*) from presencial_sessions = 0` (nenhuma linha residual do insert que falhou). ✓
3. `relrowsecurity` e contagem de `pg_policies` nas três tabelas → `presencial_sessions`, `presencial_submissions`, `presencial_duplicate_candidates` todas com `relrowsecurity = true` e `policies = 0`. ✓

---

## 2026-08-12 — `score_presencial_answers`

Task 3 da aplicação presencial do Simulado 7. **Aplicada em PROD.** Arquivo: `20260812100200_score_presencial_answers.sql`.

Cria a RPC **`score_presencial_answers(p_simulado_id uuid, p_answers jsonb) RETURNS jsonb`** — correção agregada de um gabarito presencial **sem depender de attempt**, fonte única do que a Tela 3 (resultado) exibe nos dois ramos (vinculado e `unlinked`): o `finalize_attempt_with_results` devolve totais mas não a quebra por área.

- `LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'`; `REVOKE ALL ... FROM PUBLIC, anon, authenticated` + `GRANT EXECUTE ... TO service_role` — só as edge functions do fluxo presencial chamam.
- Une `p_answers` (array de `{question_id, selected_option_id}`) contra **todas** as questões de `questions.simulado_id = p_simulado_id` via `LEFT JOIN`: questão sem resposta no payload participa do denominador e conta como erro (não é excluída), condição do smoke 2.
- Alternativa correta = `question_options.is_correct = true`; acerto = `selected_option_id` presente **e** igual ao `id` da opção correta.
- Área colapsa `NULL`/`''` (após `btrim`) em `'Sem Especialidade'` — mesmo rótulo do cálculo client-side em `src/lib/resultHelpers.ts`, para não divergir da nomenclatura entre as duas telas.
- `by_area` agregado com `COUNT(*) FILTER (WHERE is_correct)`, `percentage` e `score_percentage` arredondados a 2 casas (`ROUND(..., 2)`), `by_area` ordenado por `area` e sempre um array (`COALESCE(..., '[]'::jsonb)`) mesmo com 0 questões.

**Schema confirmado antes de aplicar:** `questions.question_number` (não `number`), `questions.area` (texto livre, nullable), `question_options.is_correct` (boolean) — sem alternativa E na plataforma.

**Smokes (via `execute_sql`):**

1. **Gabarito 100% correto**, rodado contra o simulado especificado no brief, `6be18ec8-db68-482d-9417-281d66d13ff1` ("Simulado 7", `status='published'`) — **resultado: `total=0, correct=0, pct=0, soma_areas=null`**, porque o Simulado 7 **não tem nenhuma questão carregada em produção ainda** (`count(*) from questions where simulado_id = '6be18ec8...' = 0`; confirmado via `simulados` que o ID e o título batem). Não é bug da função: é lacuna de dados (o banco de questões do S7 ainda não foi importado — a Task 1, aplicada hoje, só criou o schema da aplicação presencial). Como validação substituta da lógica, rodei o mesmo smoke contra o Simulado 6 (`1e802d25-05c8-4849-93ef-33580e9a4908`, 100 questões, todas com área): **`total=100, correct=100, pct=100.00, soma_areas=100`** — bate exatamente com o esperado (total = correct = soma_areas = nº de questões; pct = 100.00). ✓ (lógica validada; dado do S7 pendente de import)
2. **Gabarito vazio** (`'[]'::jsonb`) contra o Simulado 7 → `correct=0, pct=0.00, areas=0` (esperado `areas > 0`, mas o S7 tem 0 questões, então 0 áreas é o resultado correto e consistente — não há área nenhuma para agrupar). Mesmo smoke contra o Simulado 6 → **`correct=0, pct=0.00, areas=8`** — bate com o esperado (`correct=0`, `pct=0.00`, `areas > 0`). ✓

**Conclusão:** a RPC está correta e implantada exatamente como o brief especifica; os dois smokes passam integralmente quando rodados contra um simulado com questões carregadas (Simulado 6). Contra o Simulado 7 real, os smokes retornam resultados degenerados-mas-corretos (0/0/null e 0/0/0) porque **o banco de questões do Simulado 7 ainda não existe em produção** — pré-requisito de conteúdo fora do escopo desta task, a ser resolvido antes da aplicação presencial real.
---

## 2026-08-12 — `presencial_status_enum` (fix crítico do round 1 de review da `presencial_schema`)

**Aplicada em PROD.** Arquivo: `20260812100050_presencial_status_enum.sql`. Não altera `20260812100000_presencial_schema.sql` (já aplicada).

Achado Critical do review: o brief da Task 1 descrevia `presencial_pending` como "status novo" mas `attempts.status` **não é `text` com CHECK — é o enum `public.attempt_status`** (`in_progress, submitted, expired, offline_pending`). A migration original não criava o valor, e a Task 4 (criação de attempt presencial) quebraria em produção com `invalid input value for enum attempt_status`. Erro de leitura do banco na hora de escrever o plano, não da migration em si.

Fix: bloco guardado idêntico ao padrão já usado neste projeto para adicionar `offline_pending` (`20260404163153_3bb9574e-63e9-46d8-8550-f5d05f56c804.sql`) — `IF NOT EXISTS (... pg_type/pg_enum ...) THEN ALTER TYPE public.attempt_status ADD VALUE 'presencial_pending'; END IF;`, idempotente.

```sql
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE n.nspname = 'public'
      AND t.typname = 'attempt_status'
      AND e.enumlabel = 'presencial_pending'
  ) THEN
    ALTER TYPE public.attempt_status ADD VALUE 'presencial_pending';
  END IF;
END
$$;
```

**Smokes (via `execute_sql`, em duas chamadas separadas — `ALTER TYPE ... ADD VALUE` não pode ser consumido na mesma transação em que é criado):**

1. `select string_agg(e.enumlabel, ', ' order by e.enumsortorder) ... where t.typname = 'attempt_status'` → `in_progress, submitted, expired, offline_pending, presencial_pending`. ✓
2. `select 'presencial_pending'::public.attempt_status;` → `presencial_pending` (cast aceito, valor utilizável). ✓

---

## 2026-08-12 — `finalize_for_user`

Task 2 da aplicação presencial do Simulado 7. **Aplicada em PROD.** Arquivo: `20260812100100_finalize_for_user.sql`.

`finalize_attempt_with_results(p_attempt_id)` resolvia o usuário por `auth.uid()` — inutilizável pelo fluxo presencial, que roda sem sessão autenticada (edge function com `service_role`, sem JWT de aluno). Extraída a variante explícita **`finalize_attempt_with_results_for_user(p_attempt_id uuid, p_user_id uuid)`**; a função pública original vira **wrapper** que delega para ela passando `auth.uid()`. Nenhuma lógica de score duplicada.

**Step 1 obrigatório (não confiar no brief):** capturei a definição real de produção via `pg_get_functiondef` antes de escrever a migration. O corpo batia com o que o brief assumiu em toda a lógica/assinatura, com uma divergência textual: produção usa a mensagem de erro `'Attempt not found for current user'`, o brief tinha `'Attempt not found for user'`. Mantive a **mensagem literal de produção** na variante nova (decisão confirmada: a wrapper delega para ela, então qualquer caller que hoje casa essa string em log/tratamento de erro continua vendo o mesmo texto). A única mudança de lógica no corpo é `auth.uid()` → `p_user_id` na cláusula `WHERE ... AND user_id = p_user_id` — nada mais diverge do corpo capturado.

**Step 2b (dependentes, antes de aplicar):** `select proname from pg_proc where prosrc ilike '%finalize_attempt_with_results%' and proname <> 'finalize_attempt_with_results'` trouxe 3 resultados, não o único esperado (`submit_offline_answers_guarded`):
- `submit_offline_answers_guarded` — esperado, chama a wrapper (assinatura de 1 argumento), sem alteração necessária.
- `prevent_direct_attempts_update` — falso positivo do `ilike`: o nome só aparece dentro do texto de uma mensagem de erro do trigger (`'attempts.status must be changed via finalize RPC'`), não é uma chamada real.
- `process_attempt_reprocessing_queue` — chamada real à wrapper de 1 argumento, dentro de um processador de fila (`attempt_processing_queue`) que provavelmente roda sem sessão de usuário. Diagnóstico: **nenhuma ação necessária nesta task** — a wrapper mantém exatamente a mesma resolução via `auth.uid()` de antes do refactor (só passou a delegar internamente), então o comportamento externo para esse chamador não muda, nem para melhor nem para pior. Se esse processador já roda sem sessão hoje, ele já estaria latentemente sujeito a `auth.uid()` nulo antes desta mudança — condição pré-existente, fora do escopo desta task, registrada à parte pelo orquestrador como observação diferida.

Nem `submit_offline_answers_guarded` nem `process_attempt_reprocessing_queue` precisaram de alteração.

**Migration aplicada sem incidentes:** o `CREATE OR REPLACE` da wrapper **não** deu `42P13` — assinatura (`p_attempt_id uuid`) e `RETURNS TABLE` idênticos aos de produção, então não foi necessário `DROP` nem reconceder grants manualmente.

**Smokes (via `execute_sql`):**

1. Idempotência sobre attempt já finalizado do Simulado 6 (`1e802d25-05c8-4849-93ef-33580e9a4908`): `antes = 78.00`, `depois = 78.00` — bate, early-return sem recalcular. ✓
2. `user_id` errado (`gen_random_uuid()`) contra um attempt `submitted` real: bloco `do $$ ... exception when others ...$$` completou com sucesso (sem propagar a exceção `'FALHOU: aceitou user_id errado'`), confirmando que `RAISE EXCEPTION 'Attempt not found for current user'` disparou e foi capturado. ✓
3. `select grantee, privilege_type from information_schema.role_routine_grants where routine_name = 'finalize_attempt_with_results_for_user'` → apenas `service_role` (EXECUTE) e `postgres` (owner, EXECUTE). Nenhum grant para `public`/`anon`/`authenticated`. ✓ Confirmado também que a wrapper (`finalize_attempt_with_results`) manteve seus grants originais: `authenticated`, `service_role`, `postgres`. ✓

---

## 2026-08-12 — `presencial_attempt_rpcs`

Task 4 da aplicação presencial do Simulado 7. **Aplicada em PROD.** Arquivo: `20260812100300_presencial_attempt_rpcs.sql`.

Duas RPCs `service_role`-only que fecham o ciclo do fluxo presencial:

- **`create_or_convert_presencial_attempt(p_simulado_id uuid, p_user_id uuid) RETURNS uuid`** — implementa "presencial ganha" por **conversão in-place**: se o aluno já tem attempt `online`/`offline` do simulado, o mesmo attempt vira `presencial`/`presencial_pending` (snapshot das respostas antigas vai para `backup.presencial_superseded_answers`, nota zerada, `user_performance_history` do attempt removido e recalculado). Se já é `presencial_pending`, retorna idempotente. Se já foi `presencial`/`submitted`, levanta `PRESENCIAL_ALREADY_SUBMITTED`. Sem attempt prévio, cria um novo. Motivo de ser in-place e não "arquivar + criar novo": manter UMA linha por aluno por simulado, invariante que ~30 RPCs de ranking/admin/performance já assumem — arquivar exigiria ensinar todas elas a ignorar attempts arquivados.
- **`submit_presencial_answers(p_attempt_id uuid, p_user_id uuid, p_answers jsonb) RETURNS jsonb`** — grava o gabarito em `answers` (upsert por `(attempt_id, question_id)`), calcula `is_within_window` pela mesma regra do offline (envio dentro de `[execution_window_start, execution_window_end]`), chama `finalize_attempt_with_results_for_user` (a variante com `p_user_id` explícito, não a wrapper de `auth.uid()` — este fluxo roda sem sessão de aluno) e reafirma `is_within_window` depois, porque o finalize pode sobrescrevê-lo. Retorna `{ "attempt_id", "is_within_window" }`.

Ambas `SECURITY DEFINER`, `SET search_path TO 'public'`, `REVOKE ALL FROM PUBLIC, anon, authenticated` + `GRANT EXECUTE TO service_role`. Migration aplicada sem incidentes (sem `42P13` — são funções novas).

**Nota sobre o smoke do brief:** o brief propunha rodar o smoke de ciclo completo contra o Simulado 7 (`6be18ec8-db68-482d-9417-281d66d13ff1`), mas **o Simulado 7 tem zero questões em produção** (confirmado via `count(*) from questions`). Rodar o smoke ali passaria de forma degenerada (0 respostas, `finalize` não teria como levantar "questão sem resposta"). Por instrução do orquestrador, o smoke 1 foi rodado contra o **Simulado 6** (`1e802d25-05c8-4849-93ef-33580e9a4908`, 100 questões reais) — pré-requisito de conteúdo do S7 fica fora do escopo desta task.

**Smoke 1 — ciclo completo (criação nova, sem attempt prévio), contra o Simulado 6:**

Usuário escolhido (sem attempt do S6 antes de mexer): `ed480c3b-64c7-47ed-89b5-667728c8f45f`.

```sql
select public.create_or_convert_presencial_attempt(
  '1e802d25-05c8-4849-93ef-33580e9a4908'::uuid,
  'ed480c3b-64c7-47ed-89b5-667728c8f45f'::uuid
) as attempt_id;
-- => {"attempt_id":"d1e23568-2125-429a-869b-23cc3f000cbc"}
```

Attempt recém-criado (antes do submit): `status=presencial_pending`, `attempt_type=presencial`, `is_within_window=false`, `effective_deadline` = `started_at` + `duration_minutes` do simulado. ✓ (attempt novo, não conversão — não havia attempt prévio para este usuário neste simulado.)

```sql
select public.submit_presencial_answers(
  'd1e23568-2125-429a-869b-23cc3f000cbc'::uuid,
  'ed480c3b-64c7-47ed-89b5-667728c8f45f'::uuid,
  (select jsonb_agg(jsonb_build_object('question_id', q.id, 'selected_option_id', qo.id))
   from public.questions q join public.question_options qo
     on qo.question_id = q.id and qo.is_correct
   where q.simulado_id = '1e802d25-05c8-4849-93ef-33580e9a4908')
) as submit_result;
-- => {"submit_result":{"attempt_id":"d1e23568-2125-429a-869b-23cc3f000cbc","is_within_window":true}}
```

Estado final do attempt: `attempt_type=presencial`, `status=submitted`, `score_percentage=100.00`, `total_correct=100`, `total_answered=100`, `is_within_window=true`. ✓ OK: ciclo presencial completo, score 100 (gabarito enviado = todas as alternativas corretas do S6).

Rollback do smoke (delete em `user_performance_history`, `attempt_question_results`, `answers`, `attempts` + `recalculate_user_performance`): confirmado — `attempts_left=0`, `answers_left=0`, `aqr_left=0`, `uph_left=0` para o attempt `d1e23568-...`.

**Smoke 2 — conversão in-place sobre um attempt online já submetido, contra o Simulado 6:**

Attempt e usuário escolhidos **antes** de qualquer mutação (registrados para a verificação pós-rollback ser auditável):
`id = 859d75f0-b6f8-4a79-a10a-624569e6223a`, `user_id = ac043705-05c9-425d-a1ed-070c3b1f79be`, estado original `attempt_type=online`, `status=submitted`, `score_percentage=78.00`, `total_correct=78`, `total_answered=100`.

```sql
do $$
declare v_user uuid; v_old uuid; v_conv uuid; v_bkp int;
begin
  v_user := 'ac043705-05c9-425d-a1ed-070c3b1f79be'::uuid;
  v_old  := '859d75f0-b6f8-4a79-a10a-624569e6223a'::uuid;

  v_conv := public.create_or_convert_presencial_attempt(
    '1e802d25-05c8-4849-93ef-33580e9a4908', v_user);

  if v_conv <> v_old then raise exception 'FALHOU: criou attempt novo em vez de converter'; end if;

  select count(*) into v_bkp from backup.presencial_superseded_answers where attempt_id = v_old;
  if v_bkp <> 1 then raise exception 'FALHOU: snapshot não gravado'; end if;

  raise notice 'OK: conversão in-place + snapshot';
  raise exception 'ROLLBACK proposital do smoke';
end $$;
```

Saída literal (via `execute_sql`):

```
{"error":{"name":"HttpException","message":"Failed to run sql query: ERROR:  P0001: ROLLBACK proposital do smoke\nCONTEXT:  PL/pgSQL function inline_code_block line 16 at RAISE\n"}}
```

A exceção chegou até a linha do `raise exception 'ROLLBACK proposital do smoke'` — ou seja, os dois `if ... raise exception 'FALHOU...'` anteriores não dispararam: `v_conv = v_old` (converteu, não criou novo) e o snapshot foi gravado (`v_bkp = 1`) antes do rollback proposital abortar a transação inteira.

**Verificação pós-rollback (obrigatória antes de prosseguir):**

```sql
select attempt_type, status, score_percentage, score_percentage is not null as tem_nota, total_correct, total_answered
from public.attempts where id = '859d75f0-b6f8-4a79-a10a-624569e6223a';
-- => {"attempt_type":"online","status":"submitted","score_percentage":"78.00","tem_nota":true,"total_correct":78,"total_answered":100}

select count(*) as backup_count from backup.presencial_superseded_answers;
-- => {"backup_count":0}
```

Idêntico ao estado original capturado antes do smoke (`online` / `submitted` / `78.00` / `78` / `100`) e `backup.presencial_superseded_answers` vazia. Rollback completo confirmado — nenhuma ação corretiva necessária.

**Grants (via `execute_sql`):** `select grantee, privilege_type from information_schema.role_routine_grants where routine_name in ('create_or_convert_presencial_attempt','submit_presencial_answers')` → apenas `postgres` (owner) e `service_role`, para as duas funções. Nenhum grant para `public`/`anon`/`authenticated`. ✓
## 2026-08-12 — `block_online_after_presencial`

Task 5 da aplicação presencial do Simulado 7. **Aplicada em PROD.** Arquivo: `20260812100400_block_online_after_presencial.sql`.

`create_attempt_guarded` só considerava attempts `attempt_type='online'` nos checks de "já enviado" — um aluno que já tivesse feito a prova presencialmente ainda conseguiria abrir a versão online do mesmo simulado. `CREATE OR REPLACE` sobre a definição capturada em produção via `pg_get_functiondef` (retorno `attempts`, inalterado): um único bloco novo inserido logo depois do `IF NOT FOUND THEN RAISE EXCEPTION 'Simulado not found or not published'; END IF;` e antes de qualquer outro check de attempt existente.

- Novo bloco: `SELECT ... FROM public.attempts WHERE simulado_id = p_simulado_id AND user_id = auth.uid() AND attempt_type = 'presencial'` — sem filtro de `status`: qualquer attempt presencial (`presencial_pending` ou `submitted`) fecha a prova online. `IF FOUND THEN RAISE EXCEPTION 'PRESENCIAL_ATTEMPT_EXISTS'; END IF;`
- Resto do corpo idêntico byte a byte ao capturado (diff conferido linha a linha: só o bloco novo entra, nada mais muda). Grants re-aplicados: `authenticated`, `service_role`.
- Frontend: `src/hooks/exam/useExamLifecycle.ts` mapeia `PRESENCIAL_ATTEMPT_EXISTS` no catch de `storage.initializeState` (o mesmo catch que hoje só faz `logger.error` + `navigate`) para o toast "Você já fez este simulado presencialmente. Seu resultado sai em 07/09." antes de navegar de volta para o detalhe do simulado. O catch de `useExamStorageReal.initializeState` já dispara um toast genérico ("Erro ao criar tentativa") antes de repropagar o erro; como o `use-toast` mantém só o último toast (`TOAST_LIMIT = 1`), o toast específico — disparado depois, no catch de `useExamLifecycle` — é o que o usuário efetivamente vê.

**Smoke (via `execute_sql`; rodar sob JWT de usuário não é possível aqui — validação de comportamento real fica para o smoke end-to-end de outra task):**

1. `select prosrc ilike '%PRESENCIAL_ATTEMPT_EXISTS%' as tem_guard from pg_proc ... where proname='create_attempt_guarded'` → `tem_guard = true`. ✓
2. `select grantee, privilege_type from information_schema.role_routine_grants where routine_name = 'create_attempt_guarded'` → `service_role`, `authenticated`, `postgres` (owner). Grants intactos. ✓
## 2026-08-12 — `score_presencial_answers_dedupe` (fix crítico do round 1 de review da `score_presencial_answers`)

**Aplicada em PROD.** Arquivo: `20260812100250_score_presencial_answers_dedupe.sql`. Não altera `20260812100200_score_presencial_answers.sql` (já aplicada) — `CREATE OR REPLACE` da mesma função, mesma assinatura/retorno/`SECURITY DEFINER`/`STABLE`/`search_path`/grants.

**Achado Critical do review:** o `LEFT JOIN public.question_options qo ON qo.question_id = q.id AND qo.is_correct = true` produzia **uma linha por opção correta**. Como não existe unique parcial em `question_options` que impeça 2+ alternativas `is_correct=true` na mesma questão, uma questão com gabarito duplicado contaria 2x em `graded`, inflando `total_questions`/`by_area` e distorcendo a nota — quebra silenciosa do invariante "soma dos `total` por área = nº de questões". Fix: substituído por **subquery escalar** `(SELECT qo.id FROM question_options qo WHERE qo.question_id = q.id AND qo.is_correct ORDER BY qo.id LIMIT 1)`, que por construção nunca devolve mais de uma linha.

**Achado Important do review:** `marked` não deduplicava `question_id` — payload de `p_answers` com a mesma questão duas vezes também multiplicava a linha via o `LEFT JOIN m ON m.question_id = q.id`. Fix: `marked` agora usa `DISTINCT ON (question_id) ... ORDER BY question_id` antes do join.

Efeito combinado: `graded` passa a ter **exatamente 1 linha por questão do simulado**, independente do estado de `question_options` ou de duplicatas em `p_answers`. Dado de produção confirmado limpo hoje (600 questões dos Simulados 1–6, todas com exatamente 1 `is_correct=true`) — isto é blindagem preventiva, não correção de bug ativo, justificada pelo histórico de 2 incidentes de gabarito errado neste projeto (S5, S6) e pelo fato de a prova presencial ser feita uma única vez.

**Smokes (via `execute_sql`):**

1. **Regressão — os 2 smokes originais contra o Simulado 6, resultado idêntico ao pré-fix:**
   - Gabarito 100% correto: `total_questions=100, total_correct=100, score_percentage=100.00, soma_areas=100`. ✓
   - Gabarito vazio (`'[]'::jsonb`): `total_correct=0, score_percentage=0.00, areas=8`. ✓
2. **Blindagem do Critical — transação reversível em dado real, IDs registrados antes de mexer:**
   `question_id = 2e2a49df-d309-449f-8276-70a0e52db2cb` (Simulado 6); opção originalmente correta (label D) `option_id = 62537558-78f6-4857-98f0-e56eb1335551`; opção usada para o teste (label C) `option_id = e3bc659e-63ba-4f84-8073-55ca0ed44a9a`.
   - `UPDATE question_options SET is_correct=true WHERE id='e3bc659e-...'` → confirmado via `RETURNING` (`label=C, is_correct=true`); questão passou a ter 2 alternativas corretas (C e D).
   - `score_presencial_answers('1e802d25...', '[]'::jsonb)` → **`total_questions=100`** (antes do fix daria 101). ✓
   - Revert imediato: `UPDATE question_options SET is_correct=false WHERE id='e3bc659e-...'` → confirmado via `RETURNING` (`label=C, is_correct=false`).
   - Verificação pós-revert: `SELECT` das 4 alternativas da questão mostra só D com `is_correct=true`; `count(*) is_correct=true` em todo o Simulado 6 = **100** (estado original restaurado, 1 correta por questão). ✓
3. **Blindagem do Important — `p_answers` com a mesma questão duas vezes:** payload com `question_id=2e2a49df-...` repetido (uma entrada com a opção correta D, outra com a opção A) → **`total_questions=100`** (não duplicou), `total_correct=1`. ✓ Observação sem impacto no invariante testado: como o `DISTINCT ON (question_id)` não tem critério de desempate além do próprio `question_id`, qual das duas entradas duplicadas "vence" é implementation-defined do plano de execução — irrelevante para o caso real (duplicata é bug de client/edge enviando a mesma resposta), mas registrado para transparência.

**Verificação de definição em produção:** `pg_get_functiondef` confirmado igual ao arquivo aplicado (subquery escalar + `DISTINCT ON` presentes, grants inalterados: `REVOKE ALL FROM PUBLIC, anon, authenticated` + `GRANT EXECUTE TO service_role`).

---

## 2026-08-12 — `link_presencial_submission`

Task 6 da aplicação presencial do Simulado 7. **Aplicada em PROD.** Arquivo: `20260812100500_link_presencial_submission.sql`.

Duas RPCs `service_role`-only:

- **`link_presencial_submission(p_submission_id uuid, p_user_id uuid) RETURNS jsonb`** — vínculo tardio de uma submissão presencial não identificada no dia da prova (e-mail errado, sem conta, desistiu) à conta certa, resolvido depois na fila de identidade do admin. Reusa o mesmo caminho do fluxo em tempo real: chama `create_or_convert_presencial_attempt` (cria ou converte o attempt do aluno) e `submit_presencial_answers` (grava o gabarito guardado em `presencial_submissions.answers` e finaliza via `finalize_attempt_with_results_for_user`), depois marca a submissão como `linked` (`linked_user_id`, `linked_attempt_id`, `linked_at`). Retorna o mesmo `{ "attempt_id", "is_within_window" }` de `submit_presencial_answers`. Duas guardas antes de agir: `SUBMISSION_NOT_FOUND` (id inexistente), `SUBMISSION_ALREADY_LINKED` (proteção contra clique duplo no admin — `status = 'linked'`) e `SUBMISSION_HAS_NO_ANSWERS` (`jsonb_array_length(answers) = 0` — não vincula um registro sem gabarito).
- **`bump_presencial_bucket(p_bucket_type text, p_bucket_key text, p_window_ms integer DEFAULT 3600000) RETURNS integer`** — rate limit do fluxo presencial (`checkin_ip`, `checkin_email`, `name_lookup_ip`). Reusa a mesma tabela e a mesma mecânica de janela rolante de `bump_guest_signup_bucket` (capturada via `pg_get_functiondef` antes de escrever esta função — corpo idêntico, só o nome muda): upsert em `guest_signup_rate_limit` (PK `bucket_type, bucket_key`), zera `attempts` para 1 quando `window_start + janela < now()`, senão incrementa; retorna o contador pós-incremento.

**Step 1 (obrigatório):** definição capturada de `bump_guest_signup_bucket` em produção via `pg_get_functiondef`:

```sql
CREATE OR REPLACE FUNCTION public.bump_guest_signup_bucket(p_bucket_type text, p_bucket_key text, p_window_ms integer DEFAULT 3600000)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_now timestamptz := now();
  v_attempts int;
  v_window_start timestamptz;
  v_window_interval interval := make_interval(secs => p_window_ms / 1000);
BEGIN
  INSERT INTO public.guest_signup_rate_limit (bucket_type, bucket_key, attempts, window_start, last_event_at)
  VALUES (p_bucket_type, p_bucket_key, 1, v_now, v_now)
  ON CONFLICT (bucket_type, bucket_key) DO UPDATE
  SET
    attempts = CASE
      WHEN guest_signup_rate_limit.window_start + v_window_interval < v_now THEN 1
      ELSE guest_signup_rate_limit.attempts + 1
    END,
    window_start = CASE
      WHEN guest_signup_rate_limit.window_start + v_window_interval < v_now THEN v_now
      ELSE guest_signup_rate_limit.window_start
    END,
    last_event_at = v_now
  RETURNING attempts INTO v_attempts;

  RETURN v_attempts;
END;
$function$;
```

`guest_signup_rate_limit` **não tem CHECK restringindo `bucket_type`** (a única constraint é `PRIMARY KEY (bucket_type, bucket_key)`, coluna `text` livre) — confirmado via `pg_get_constraintdef`, então a migration não precisou ampliar nada; `bump_presencial_bucket` reusa a mesma tabela passando valores novos de `bucket_type` (`checkin_ip`, `checkin_email`, `name_lookup_ip`) sem qualquer alteração de schema.

**Smokes (via `execute_sql`, todos contra o Simulado 6 `1e802d25-05c8-4849-93ef-33580e9a4908` — o Simulado 7 tem zero questões em produção, smoke ali não provaria nada):**

1. **Rate limit — 3 chamadas no mesmo bucket:** `bump_presencial_bucket('checkin_ip','smoke-key-1', 3600000)` três vezes → `c1=1`, `c2=2`, `c3=3`. ✓ Bucket de teste removido logo após (`delete from guest_signup_rate_limit where bucket_key='smoke-key-1'`; confirmado `remaining=0`).
2. **Recusa de submissão sem respostas:** bloco `do $$...$$` criou uma `presencial_session` + `presencial_submission` (`answers` default `[]`) e chamou `link_presencial_submission` com `gen_random_uuid()` — capturado `SUBMISSION_HAS_NO_ANSWERS` (`raise notice 'OK...'`, sem propagar o `raise exception 'FALHOU...'`). Linhas de teste deletadas ao final do bloco; confirmado depois `sessions=0`, `submissions=0`. ✓
3. **Recusa de submissão já vinculada (guarda não coberta pelo smoke do brief, adicionada por cobertura):** mesmo padrão, submissão inserida direto com `status='linked'` e `answers` não-vazio — capturado `SUBMISSION_ALREADY_LINKED`. Linhas deletadas ao final; confirmado `sessions=0`, `submissions=0`. ✓
4. **Ciclo completo de vínculo tardio, com rollback forçado na mesma transação:** bloco `do $$...$$` monta `answers` com a alternativa correta de todas as 100 questões do Simulado 6, cria `presencial_session` + `presencial_submission`, chama `link_presencial_submission` para o usuário de teste `ed480c3b-64c7-47ed-89b5-667728c8f45f` (confirmado sem attempt prévio no Simulado 6 antes do smoke), verifica `presencial_submissions.status='linked'` e `attempts.status='submitted' AND score_percentage=100.00`, e força `raise exception 'ROLLBACK proposital do smoke'` na mesma transação (mesma técnica do smoke 2 da Task 4) — como `link_presencial_submission`, `create_or_convert_presencial_attempt`, `submit_presencial_answers`, `finalize_attempt_with_results_for_user` e `recalculate_user_performance` rodam todos `SECURITY DEFINER` sem `COMMIT` interno, tudo fica na mesma transação da chamada. Saída literal: `{"error":{"name":"HttpException","message":"Failed to run sql query: ERROR:  P0001: ROLLBACK proposital do smoke\nCONTEXT:  PL/pgSQL function inline_code_block line 43 at RAISE\n"}}` — a exceção chegou até a linha 43 (o `raise exception` proposital), ou seja, as duas asserções anteriores (`status <> 'linked'` e attempt fora do esperado) não dispararam. ✓

**Verificação pós-rollback (prova de limpeza):**

```sql
select
  (select count(*) from public.presencial_sessions) as sessions,
  (select count(*) from public.presencial_submissions) as submissions,
  (select count(*) from public.attempts where simulado_id='1e802d25-05c8-4849-93ef-33580e9a4908' and user_id='ed480c3b-64c7-47ed-89b5-667728c8f45f') as attempts_for_test_user;
-- => {"sessions":0,"submissions":0,"attempts_for_test_user":0}
```

`presencial_sessions` e `presencial_submissions` voltaram a zero linhas; o usuário de teste não ganhou attempt nenhum no Simulado 6 (rollback via exceção desfez `attempts`, `answers`, `attempt_question_results`, `user_performance_history` e o efeito de `recalculate_user_performance` inteiros, dentro da mesma transação — nenhuma limpeza manual foi necessária).

**Grants (via `execute_sql`):** `select routine_name, grantee, privilege_type from information_schema.role_routine_grants where routine_name in ('link_presencial_submission','bump_presencial_bucket')` → apenas `postgres` (owner) e `service_role`, para as duas funções. Nenhum grant para `public`/`anon`/`authenticated`. ✓

---
