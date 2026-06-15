# Admin Fundação — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar a Fase 1 (Fundação) do admin: sidebar fixa colapsável, tema control-room dual com tokens `--admin-*`, paleta de comandos Ctrl+K, roles granulares com capabilities (banco + UI) e saneamento de débitos.

**Architecture:** Evolução in-place do admin existente (`src/admin/`). Banco primeiro (migrations aditivas: enum → infra de capabilities → enforcement), depois tokens de tema, depois camada de acesso no front, shell, paleta e adaptação das 13 páginas. Cada task termina com testes verdes e commit.

**Tech Stack:** React 18 + Vite + TS (relaxado), Tailwind 3.4, shadcn/Radix, cmdk, TanStack Query 5, Supabase (RPCs SECURITY DEFINER + RLS), Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-06-11-admin-fundacao-design.md`

**Branch:** `feat/admin-fundacao` (já criada a partir de `main`).

**Regras gerais para o executor:**
- Migrations via MCP do Supabase (`apply_migration`). NUNCA rodar DDL com `execute_sql`.
- Depois de qualquer migration que crie/altere RPC, regenerar `src/integrations/supabase/types.ts` via MCP `generate_typescript_types` (arquivo é gerado — substituir inteiro).
- Logging com `import { logger } from "@/lib/logger"`, nunca `console.log`.
- Toasts com `import { toast } from "@/hooks/use-toast"`.
- Imports com alias `@/`.
- Testes: `npm run test` (Vitest run único). Lint: `npm run lint`. Build: `npm run build`.

---

## Mapa de capabilities (referência canônica)

Capabilities: `dashboard.view`, `content.manage`, `users.view`, `users.manage`, `attempts.view`, `attempts.manage`, `intel.view`, `previews.view`, `roles.manage`.

| Role | Capabilities |
|---|---|
| `admin` | todas as 9 |
| `content_editor` | `dashboard.view`, `content.manage`, `previews.view`, `attempts.view` |
| `support` | `dashboard.view`, `users.view`, `users.manage`, `attempts.view`, `attempts.manage` |
| `analyst` | `dashboard.view`, `intel.view`, `previews.view` |

### Mapa RPC → capability (31 funções, lista completa do banco)

| Capability | RPCs |
|---|---|
| `dashboard.view` | `admin_dashboard_kpis`, `admin_events_timeseries`, `admin_funnel_stats`, `admin_simulado_engagement`, `admin_live_signals` |
| `intel.view` | `admin_analytics_funnel`, `admin_analytics_sources`, `admin_analytics_time_to_convert`, `admin_analytics_timeseries`, `admin_marketing_kpis`, `admin_marketing_sources`, `admin_marketing_mediums`, `admin_marketing_campaigns`, `admin_produto_segmented_funnel`, `admin_produto_friction`, `admin_produto_feature_adoption`, `admin_produto_top_events` |
| `users.view` | `admin_list_users`, `admin_get_user`, `admin_get_user_attempts` |
| `users.manage` | `admin_set_user_segment`, `admin_reset_user_onboarding` |
| `roles.manage` | `admin_set_user_role` |
| `attempts.view` | `admin_attempts_kpis`, `admin_list_attempts` |
| `attempts.manage` | `admin_cancel_attempt`, `admin_delete_attempt` |
| `content.manage` | `admin_simulado_detail_stats`, `admin_simulado_question_stats` |
| `previews.view` | `admin_get_ranking_for_simulado`, `admin_list_simulados_for_ranking_preview` |

### Mapa policy RLS → capability (32 policies que hoje checam `role='admin'`)

| Tabela | Policies | Capability |
|---|---|---|
| `public.analytics_events` | "Admins can read analytics events" (SELECT) | `intel.view` |
| `public.enamed_cutoff_scores` | insert/update/delete (3) | `content.manage` |
| `public.enamed_institutions` | insert/update/delete (3) | `content.manage` |
| `public.enamed_programs` | insert/update/delete (3) | `content.manage` |
| `public.enamed_specialties` | insert/update/delete (3) | `content.manage` |
| `public.questions` | insert/update/delete (3) | `content.manage` |
| `public.question_options` | insert/update/delete (3) | `content.manage` |
| `public.simulados` | insert/update/delete + "read all" + "read test" (5) | `content.manage` |
| `public.user_roles` | "Admins can read roles" (SELECT) | `roles.manage` |
| `storage.objects` | 4 de `question-images` + 3 de `imagensSimulado` | `content.manage` |

---

## Task 1: Migration — novos valores do enum `app_role`

`ALTER TYPE ... ADD VALUE` não pode ser usado na mesma transação que usa o valor novo → migration isolada, sem seed.

- [ ] **Step 1: Aplicar migration**

Via MCP `apply_migration`, name `admin_roles_enum_values`:

```sql
alter type public.app_role add value if not exists 'content_editor';
alter type public.app_role add value if not exists 'support';
alter type public.app_role add value if not exists 'analyst';
```

- [ ] **Step 2: Verificar**

Via `execute_sql`:

```sql
select enumlabel from pg_enum e join pg_type t on t.oid = e.enumtypid
where t.typname = 'app_role' order by e.enumsortorder;
```

Expected: `admin`, `content_editor`, `support`, `analyst`.

- [ ] **Step 3: Commit de registro**

Criar `supabase/migrations-log.md` se não existir (ou apêndice ao existente) registrando nome e SQL da migration aplicada (o repo não versiona migrations do projeto remoto; este log mantém rastreabilidade no git).

```bash
git add supabase/migrations-log.md
git commit -m "feat(admin-db): adiciona roles content_editor, support e analyst ao enum app_role"
```

## Task 2: Migration — infra de capabilities (`role_capabilities`, funções, `admin_get_access`, `admin_quick_search`)

- [ ] **Step 1: Aplicar migration**

Via MCP `apply_migration`, name `admin_capabilities_infra`:

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

- [ ] **Step 2: Smoke da infra**

Via `execute_sql` (sem usuário autenticado, `auth.uid()` é null — só valida que as funções existem e a tabela está seedada):

```sql
select count(*) as caps from public.role_capabilities;            -- esperado: 21
select public.has_capability('dashboard.view');                   -- esperado: false (uid null)
select * from public.admin_get_access();                          -- esperado: 1 linha, arrays vazios
```

- [ ] **Step 3: Registrar no log e commit**

```bash
git add supabase/migrations-log.md
git commit -m "feat(admin-db): infra de capabilities (role_capabilities, has_capability, admin_require, admin_get_access, admin_quick_search)"
```

## Task 3: Migration — enforcement (32 policies + 31 RPCs)

- [ ] **Step 1: Aplicar migration das policies**

Via MCP `apply_migration`, name `admin_capabilities_policies`. Os nomes exatos das policies vêm da consulta `pg_policies` (já validados). INSERT usa só `with check`; SELECT/DELETE usam só `using`; UPDATE usa ambos:

```sql
-- analytics_events
alter policy "Admins can read analytics events" on public.analytics_events
  using (public.has_capability('intel.view'));

-- enamed_cutoff_scores
alter policy "Admins can insert cutoff scores" on public.enamed_cutoff_scores with check (public.has_capability('content.manage'));
alter policy "Admins can update cutoff scores" on public.enamed_cutoff_scores using (public.has_capability('content.manage')) with check (public.has_capability('content.manage'));
alter policy "Admins can delete cutoff scores" on public.enamed_cutoff_scores using (public.has_capability('content.manage'));

-- enamed_institutions
alter policy "Admins can insert institutions" on public.enamed_institutions with check (public.has_capability('content.manage'));
alter policy "Admins can update institutions" on public.enamed_institutions using (public.has_capability('content.manage')) with check (public.has_capability('content.manage'));
alter policy "Admins can delete institutions" on public.enamed_institutions using (public.has_capability('content.manage'));

-- enamed_programs
alter policy "Admins can insert programs" on public.enamed_programs with check (public.has_capability('content.manage'));
alter policy "Admins can update programs" on public.enamed_programs using (public.has_capability('content.manage')) with check (public.has_capability('content.manage'));
alter policy "Admins can delete programs" on public.enamed_programs using (public.has_capability('content.manage'));

-- enamed_specialties
alter policy "Admins can insert specialties" on public.enamed_specialties with check (public.has_capability('content.manage'));
alter policy "Admins can update specialties" on public.enamed_specialties using (public.has_capability('content.manage')) with check (public.has_capability('content.manage'));
alter policy "Admins can delete specialties" on public.enamed_specialties using (public.has_capability('content.manage'));

-- questions
alter policy "Admins can insert questions" on public.questions with check (public.has_capability('content.manage'));
alter policy "Admins can update questions" on public.questions using (public.has_capability('content.manage')) with check (public.has_capability('content.manage'));
alter policy "Admins can delete questions" on public.questions using (public.has_capability('content.manage'));

-- question_options
alter policy "Admins can insert question_options" on public.question_options with check (public.has_capability('content.manage'));
alter policy "Admins can update question_options" on public.question_options using (public.has_capability('content.manage')) with check (public.has_capability('content.manage'));
alter policy "Admins can delete question_options" on public.question_options using (public.has_capability('content.manage'));

-- simulados
alter policy "Admins can insert simulados" on public.simulados with check (public.has_capability('content.manage'));
alter policy "Admins can update simulados" on public.simulados using (public.has_capability('content.manage')) with check (public.has_capability('content.manage'));
alter policy "Admins can delete simulados" on public.simulados using (public.has_capability('content.manage'));
alter policy "Admins can read all simulados" on public.simulados using (public.has_capability('content.manage'));
alter policy "Admins can read test simulados" on public.simulados using (status = 'test'::public.simulado_status and public.has_capability('content.manage'));

-- user_roles
alter policy "Admins can read roles" on public.user_roles using (public.has_capability('roles.manage'));

-- storage.objects — question-images
alter policy "Admins can read question images" on storage.objects using (bucket_id = 'question-images' and public.has_capability('content.manage'));
alter policy "Admins can upload question images" on storage.objects with check (bucket_id = 'question-images' and public.has_capability('content.manage'));
alter policy "Admins can update question images" on storage.objects using (bucket_id = 'question-images' and public.has_capability('content.manage')) with check (bucket_id = 'question-images' and public.has_capability('content.manage'));
alter policy "Admins can delete question images" on storage.objects using (bucket_id = 'question-images' and public.has_capability('content.manage'));

-- storage.objects — imagensSimulado
alter policy "Admins podem fazer upload de imagens de simulado" on storage.objects with check (bucket_id = 'imagensSimulado' and public.has_capability('content.manage'));
alter policy "Admins podem atualizar imagens de simulado" on storage.objects using (bucket_id = 'imagensSimulado' and public.has_capability('content.manage')) with check (bucket_id = 'imagensSimulado' and public.has_capability('content.manage'));
alter policy "Admins podem deletar imagens de simulado" on storage.objects using (bucket_id = 'imagensSimulado' and public.has_capability('content.manage'));
```

Se alguma `alter policy` falhar por nome divergente, rodar `select policyname, tablename, cmd from pg_policies where qual ilike '%has_role%' or with_check ilike '%has_role%'` e ajustar o nome — NÃO pular a policy.

- [ ] **Step 2: Migrar as 31 RPCs (sweep mecânico)**

Para CADA função do mapa RPC → capability (lista canônica acima), executar o procedimento:

1. Buscar a definição atual: `select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='<nome>';`
2. Na definição retornada, localizar o bloco de autorização inline (formato atual, com pequenas variações de alias/whitespace):

```sql
  if not exists (
    select 1 from user_roles where user_id = auth.uid() and role = 'admin'
  ) then
    raise exception 'unauthorized' using errcode = 'P0003';
  end if;
```

3. Substituir o bloco inteiro por (capability conforme o mapa):

```sql
  perform public.admin_require('<capability>');
```

4. Reaplicar a função inteira via `apply_migration` (name `admin_cap_rpc_<nome>` ou agrupado em lotes por capability).

**Casos especiais:**

- `admin_get_user`: além do guard (`users.view`), adicionar coluna `roles text[]` ao retorno: incluir no SELECT final `(select coalesce(array_agg(ur.role::text), '{}') from user_roles ur where ur.user_id = p_user_id) as roles`. Como a assinatura de retorno muda, fazer `drop function public.admin_get_user(uuid);` antes do `create or replace` na MESMA migration.
- `admin_set_user_role` (guard `roles.manage`): verificar o corpo — se houver validação que restringe `p_role` a `'admin'`, ampliar para aceitar os 4 valores do enum (`p_role::public.app_role` já valida; remover whitelist manual se existir). Garantir que um admin não possa revogar o próprio role `admin` (adicionar no início: `if p_user_id = (select auth.uid()) and p_role = 'admin' and p_grant = false then raise exception 'cannot_revoke_own_admin' using errcode = 'P0004'; end if;`).
- Funções SQL puras (não plpgsql), se houver: o guard `perform` não existe em SQL — converter o check para `where public.has_capability('<cap>')` ou recriar como plpgsql seguindo o padrão das demais.

- [ ] **Step 3: Verificar que nenhuma RPC ficou com o check antigo**

```sql
select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname like 'admin\_%'
  and pg_get_functiondef(p.oid) ilike '%role = ''admin''%';
```

Expected: 0 linhas (nenhuma função restante com check hardcoded).

- [ ] **Step 4: Smoke por role**

Criar um usuário de teste por role (ou usar `execute_sql` com `set local role` não funciona para auth.uid — alternativa: validar logicamente):

```sql
-- has_capability respeita o mapa
select rc.role, count(*) from public.role_capabilities rc group by rc.role order by rc.role;
-- esperado: admin=9, analyst=3, content_editor=4, support=5
```

E via app (passo manual na Task 14): login com usuário admin continua vendo tudo.

- [ ] **Step 5: Regenerar tipos TS**

Via MCP `generate_typescript_types`, substituir o conteúdo de `src/integrations/supabase/types.ts`. Rodar `npm run build` para garantir que nada quebrou.

- [ ] **Step 6: Atualizar edge function `admin-delete-user`**

Via MCP `get_edge_function` ler o código atual. Localizar o check de admin (consulta a `user_roles` por `role = 'admin'` com service key, ou RPC `has_role`). Substituir por chamada equivalente que aceite capability: consultar `user_roles ur join role_capabilities rc on rc.role = ur.role where ur.user_id = <uid> and rc.capability = 'users.manage'`. Redeploy via MCP `deploy_edge_function` mantendo o restante intacto.

- [ ] **Step 7: Registrar no log e commit**

```bash
git add supabase/migrations-log.md src/integrations/supabase/types.ts
git commit -m "feat(admin-db): enforcement por capability em 32 policies e 31 RPCs admin"
```

## Task 4: Tokens de tema (`--admin-*` + Tailwind + chart theme)

**Files:**
- Modify: `src/index.css` (apêndice no fim do arquivo)
- Modify: `tailwind.config.ts:90` (depois do objeto `landing`)
- Modify: `src/admin/lib/adminChartTheme.ts` (substituição completa)

- [ ] **Step 1: Adicionar tokens no `src/index.css`**

Apêndice ao FINAL do arquivo. Tokens globais em `:root`/`.dark` (namespaced `--admin-*` — precisam ser globais porque Dialog/Popover/Select do Radix portalam para `document.body`, fora de qualquer wrapper do admin):

```css
/* ─────────────────── Admin control-room tokens (namespace --admin-*) ───────────────────
   Dual de primeira classe: cada token tem par light/dark explícito.
   Formato: canais HSL para suportar alpha via Tailwind (<alpha-value>). */
:root {
  --admin-bg: 40 20% 97%;
  --admin-surface: 0 0% 100%;
  --admin-raised: 40 15% 95%;
  --admin-line: 40 10% 88%;
  --admin-line-strong: 40 8% 78%;
  --admin-text: 220 15% 12%;
  --admin-muted: 220 8% 42%;
  --admin-faint: 220 6% 60%;
  --admin-accent: 345 65% 42%;
  --admin-accent-soft: 345 45% 94%;
  --admin-accent-contrast: 0 0% 100%;
  --admin-success: 160 60% 32%;
  --admin-warning: 35 85% 40%;
  --admin-info: 210 70% 45%;
  --admin-destructive: 0 70% 45%;
}

.dark {
  --admin-bg: 210 10% 7%;
  --admin-surface: 210 9% 10%;
  --admin-raised: 210 8% 13%;
  --admin-line: 210 8% 16%;
  --admin-line-strong: 210 8% 24%;
  --admin-text: 210 14% 95%;
  --admin-muted: 210 8% 64%;
  --admin-faint: 210 6% 46%;
  --admin-accent: 345 72% 58%;
  --admin-accent-soft: 345 40% 16%;
  --admin-accent-contrast: 210 10% 7%;
  --admin-success: 160 50% 56%;
  --admin-warning: 38 90% 60%;
  --admin-info: 210 75% 65%;
  --admin-destructive: 0 70% 62%;
}

/* Base do admin: aplicada pelo AdminApp no wrapper raiz */
.admin-root {
  background-color: hsl(var(--admin-bg));
  color: hsl(var(--admin-text));
  font-variant-numeric: tabular-nums;
}
```

- [ ] **Step 2: Expor no Tailwind**

Em `tailwind.config.ts`, dentro de `theme.extend.colors`, logo após o objeto `landing` (linha ~89), adicionar:

```ts
admin: {
  bg: "hsl(var(--admin-bg) / <alpha-value>)",
  surface: "hsl(var(--admin-surface) / <alpha-value>)",
  raised: "hsl(var(--admin-raised) / <alpha-value>)",
  line: "hsl(var(--admin-line) / <alpha-value>)",
  "line-strong": "hsl(var(--admin-line-strong) / <alpha-value>)",
  text: "hsl(var(--admin-text) / <alpha-value>)",
  muted: "hsl(var(--admin-muted) / <alpha-value>)",
  faint: "hsl(var(--admin-faint) / <alpha-value>)",
  accent: {
    DEFAULT: "hsl(var(--admin-accent) / <alpha-value>)",
    soft: "hsl(var(--admin-accent-soft) / <alpha-value>)",
    contrast: "hsl(var(--admin-accent-contrast) / <alpha-value>)",
  },
  success: "hsl(var(--admin-success) / <alpha-value>)",
  warning: "hsl(var(--admin-warning) / <alpha-value>)",
  info: "hsl(var(--admin-info) / <alpha-value>)",
  destructive: "hsl(var(--admin-destructive) / <alpha-value>)",
},
```

Gera utilitários `bg-admin-surface`, `border-admin-line`, `text-admin-muted`, `bg-admin-accent/10` (alpha funciona — tokens são canais HSL, não cores completas; ver gotcha do Tailwind v3 com opacity sobre `var()`).

- [ ] **Step 3: Reescrever `src/admin/lib/adminChartTheme.ts`**

Substituir o arquivo inteiro por:

```ts
/**
 * Tema de gráficos admin (Recharts) alinhado aos tokens `--admin-*` em `src/index.css`.
 * Usa `hsl(var(--token))` para respeitar light/dark automaticamente.
 */
export function getAdminChartTheme() {
  return {
    gridStroke: 'hsl(var(--admin-line))',
    axisTick: { fontSize: 9, fill: 'hsl(var(--admin-muted))' },
    tooltip: {
      backgroundColor: 'hsl(var(--admin-raised))',
      border: '1px solid hsl(var(--admin-line-strong))',
      borderRadius: '8px',
      fontSize: '11px',
      color: 'hsl(var(--admin-text))',
    },
    cursorFill: 'hsl(var(--admin-raised) / 0.6)',
    legend: {
      wrapperStyle: {
        fontSize: '10px',
        paddingTop: '8px',
        color: 'hsl(var(--admin-muted))',
      },
    },
  } as const
}

/** Cores de séries (ordem: wine, teal, âmbar, azul, neutro) */
export const adminChartSeriesColors = {
  primary: 'hsl(var(--admin-accent))',
  success: 'hsl(var(--admin-success))',
  warning: 'hsl(var(--admin-warning))',
  info: 'hsl(var(--admin-info))',
  muted: 'hsl(var(--admin-muted) / 0.45)',
} as const
```

Nota: o shape (`primary/success/muted/info`) é mantido e `warning` é adicionado — consumidores existentes não quebram.

- [ ] **Step 4: Verificar build e testes**

Run: `npm run test` e `npm run build`
Expected: verdes (tokens são aditivos; chart theme mantém shape).

- [ ] **Step 5: Commit**

```bash
git add src/index.css tailwind.config.ts src/admin/lib/adminChartTheme.ts
git commit -m "feat(admin): tokens de tema control-room --admin-* (dual light/dark) + chart theme"
```

## Task 5: Saneamento base — `constants.ts`, `format.ts`, `useDebounce`

**Files:**
- Create: `src/admin/lib/constants.ts`
- Create: `src/admin/lib/format.ts`
- Create: `src/hooks/useDebounce.ts`
- Create: `src/admin/lib/__tests__/format.test.ts`

- [ ] **Step 1: Escrever teste de `format.ts` (falhando)**

`src/admin/lib/__tests__/format.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { getInitials } from '@/admin/lib/format'

describe('getInitials', () => {
  it('retorna iniciais dos dois primeiros nomes', () => {
    expect(getInitials('Felipe Souza Lima')).toBe('FS')
  })
  it('retorna fallback para vazio/null', () => {
    expect(getInitials(null)).toBe('A')
    expect(getInitials('')).toBe('A')
  })
  it('funciona com nome único', () => {
    expect(getInitials('Felipe')).toBe('F')
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/admin/lib/__tests__/format.test.ts`
Expected: FAIL (módulo não existe).

- [ ] **Step 3: Criar `src/admin/lib/format.ts`**

```ts
/** Iniciais (2 primeiros nomes) para avatares. Fallback 'A'. */
export function getInitials(name: string | null | undefined): string {
  if (!name) return 'A'
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(n => n[0])
    .join('')
    .toUpperCase() || 'A'
}

/** Número compacto pt-BR (12.4 mil → "12,4 mil" fica verboso; usamos notação curta) */
export function formatCompact(n: number): string {
  return new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(n)
}

/** Inteiro com separador pt-BR */
export function formatInt(n: number): string {
  return new Intl.NumberFormat('pt-BR').format(n)
}
```

- [ ] **Step 4: Criar `src/admin/lib/constants.ts`**

Consolida o que hoje está duplicado em `AdminUsuarios.tsx:20-24`, `AdminUsuarioDetail.tsx:21-25`, `AdminTentativas.tsx:28-33` e os `PERIODS`/`PERIOD_OPTIONS` espalhados:

```ts
/** Períodos padrão dos dashboards (dias) */
export const PERIOD_OPTIONS = [
  { value: 7,  label: '7 dias' },
  { value: 14, label: '14 dias' },
  { value: 30, label: '30 dias' },
  { value: 90, label: '90 dias' },
] as const

/** Labels e classes (tokens admin) por segmento de usuário */
export const SEGMENT_META: Record<string, { label: string; className: string }> = {
  guest:    { label: 'Visitante',        className: 'bg-admin-raised text-admin-muted border-admin-line' },
  standard: { label: 'Aluno SanarFlix',  className: 'bg-admin-info/10 text-admin-info border-admin-info/30' },
  pro:      { label: 'Aluno PRO',        className: 'bg-admin-accent/10 text-admin-accent border-admin-accent/30' },
}

/** Labels e classes por status de tentativa */
export const ATTEMPT_STATUS_META: Record<string, { label: string; className: string }> = {
  in_progress:     { label: 'Em andamento', className: 'bg-admin-info/10 text-admin-info border-admin-info/30' },
  submitted:       { label: 'Enviada',      className: 'bg-admin-success/10 text-admin-success border-admin-success/30' },
  expired:         { label: 'Expirada',     className: 'bg-admin-warning/10 text-admin-warning border-admin-warning/30' },
  offline_pending: { label: 'Offline',      className: 'bg-admin-raised text-admin-muted border-admin-line' },
}

/** Labels por role do admin */
export const ROLE_META: Record<string, { label: string; description: string }> = {
  admin:          { label: 'Admin',            description: 'Acesso total, incluindo gestão de roles' },
  content_editor: { label: 'Editor de conteúdo', description: 'Simulados, questões e previews' },
  support:        { label: 'Suporte',          description: 'Usuários e tentativas' },
  analyst:        { label: 'Analista',         description: 'Dashboards e inteligência (leitura)' },
}
```

Ao adaptar as páginas (Task 13), os literais antigos (`SEGMENT_CLASSES` etc.) são removidos em favor destes.

- [ ] **Step 5: Criar `src/hooks/useDebounce.ts`**

```ts
import { useEffect, useState } from 'react'

/** Retorna o valor após `delay` ms sem mudanças. */
export function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}
```

- [ ] **Step 6: Rodar testes**

Run: `npx vitest run src/admin/lib/__tests__/format.test.ts`
Expected: PASS (3 testes).

- [ ] **Step 7: Commit**

```bash
git add src/admin/lib/constants.ts src/admin/lib/format.ts src/hooks/useDebounce.ts src/admin/lib/__tests__/format.test.ts
git commit -m "refactor(admin): consolida constantes, formatadores e useDebounce compartilhado"
```

## Task 6: Camada de acesso — `useAdminAuth`, `AdminAccessContext`, `AdminGuard`, `AdminLoginPage`

**Files:**
- Modify: `src/admin/hooks/useAdminAuth.ts` (substituição completa)
- Create: `src/admin/contexts/AdminAccessContext.tsx`
- Modify: `src/admin/AdminGuard.tsx` (substituição completa)
- Modify: `src/admin/AdminLoginPage.tsx` (trocar validação `has_role` → `admin_get_access`)
- Create: `src/admin/__tests__/AdminAccessContext.test.tsx`

- [ ] **Step 1: Teste do contexto (falhando)**

`src/admin/__tests__/AdminAccessContext.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { AdminAccessProvider, useAdminCan, useAdminAccess } from '@/admin/contexts/AdminAccessContext'
import type { ReactNode } from 'react'

const wrapper = (caps: string[], roles: string[] = ['support']) =>
  ({ children }: { children: ReactNode }) => (
    <AdminAccessProvider roles={roles} capabilities={caps}>{children}</AdminAccessProvider>
  )

describe('AdminAccessContext', () => {
  it('useAdminCan responde por capability', () => {
    const { result } = renderHook(() => useAdminCan('users.manage'), {
      wrapper: wrapper(['users.view', 'users.manage']),
    })
    expect(result.current).toBe(true)
  })

  it('useAdminCan nega capability ausente', () => {
    const { result } = renderHook(() => useAdminCan('roles.manage'), {
      wrapper: wrapper(['users.view']),
    })
    expect(result.current).toBe(false)
  })

  it('expõe roles e capabilities como Set', () => {
    const { result } = renderHook(() => useAdminAccess(), {
      wrapper: wrapper(['intel.view'], ['analyst']),
    })
    expect(result.current.roles).toEqual(['analyst'])
    expect(result.current.capabilities.has('intel.view')).toBe(true)
  })

  it('fora do provider, nega tudo (default seguro)', () => {
    const { result } = renderHook(() => useAdminCan('dashboard.view'))
    expect(result.current).toBe(false)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/admin/__tests__/AdminAccessContext.test.tsx`
Expected: FAIL (módulo não existe).

- [ ] **Step 3: Criar `src/admin/contexts/AdminAccessContext.tsx`**

```tsx
import { createContext, useContext, useMemo, type ReactNode } from 'react'

interface AdminAccessValue {
  roles: string[]
  capabilities: Set<string>
}

const AdminAccessContext = createContext<AdminAccessValue>({
  roles: [],
  capabilities: new Set(),
})

interface AdminAccessProviderProps {
  roles: string[]
  capabilities: string[]
  children: ReactNode
}

export function AdminAccessProvider({ roles, capabilities, children }: AdminAccessProviderProps) {
  const value = useMemo(
    () => ({ roles, capabilities: new Set(capabilities) }),
    [roles, capabilities],
  )
  return <AdminAccessContext.Provider value={value}>{children}</AdminAccessContext.Provider>
}

export function useAdminAccess() {
  return useContext(AdminAccessContext)
}

/** Gate de UI por capability. Fora do provider → false (default seguro). */
export function useAdminCan(capability: string): boolean {
  return useAdminAccess().capabilities.has(capability)
}
```

- [ ] **Step 4: Rodar teste**

Run: `npx vitest run src/admin/__tests__/AdminAccessContext.test.tsx`
Expected: PASS (4 testes).

- [ ] **Step 5: Reescrever `src/admin/hooks/useAdminAuth.ts`**

```ts
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export interface AdminAccessData {
  roles: string[];
  capabilities: string[];
}

/**
 * Acesso admin do usuário corrente via RPC admin_get_access().
 * Entrada no /admin é permitida para qualquer role presente em user_roles.
 */
export function useAdminAuth() {
  const { user, loading: authLoading } = useAuth();
  const [access, setAccess] = useState<AdminAccessData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setAccess(null);
      setLoading(false);
      return;
    }

    supabase
      .rpc('admin_get_access')
      .then(({ data, error }) => {
        const row = Array.isArray(data) ? data[0] : data;
        if (error || !row) {
          setAccess(null);
        } else {
          setAccess({ roles: row.roles ?? [], capabilities: row.capabilities ?? [] });
        }
        setLoading(false);
      });
  }, [user, authLoading]);

  return {
    user,
    roles: access?.roles ?? [],
    capabilities: access?.capabilities ?? [],
    hasAccess: (access?.roles.length ?? 0) > 0,
    /** retrocompat: telas antigas que checavam isAdmin */
    isAdmin: (access?.roles ?? []).includes('admin'),
    loading: authLoading || loading,
  };
}
```

- [ ] **Step 6: Reescrever `src/admin/AdminGuard.tsx`**

```tsx
import { Navigate, Outlet } from 'react-router-dom';
import { useAdminAuth } from './hooks/useAdminAuth';
import { AdminAccessProvider } from './contexts/AdminAccessContext';

export function AdminGuard() {
  const { user, hasAccess, roles, capabilities, loading } = useAdminAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-admin-bg">
        <div className="h-10 w-10 border-3 border-admin-accent/30 border-t-admin-accent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/admin/login" replace />;
  if (!hasAccess) return (
    <div className="min-h-screen flex items-center justify-center bg-admin-bg">
      <div className="text-center space-y-4">
        <h1 className="text-2xl font-bold text-admin-text">Acesso negado</h1>
        <p className="text-admin-muted">Você não tem permissão para acessar o painel.</p>
      </div>
    </div>
  );

  return (
    <AdminAccessProvider roles={roles} capabilities={capabilities}>
      <Outlet />
    </AdminAccessProvider>
  );
}
```

- [ ] **Step 7: Atualizar `src/admin/AdminLoginPage.tsx`**

Ler o arquivo. Localizar a chamada `supabase.rpc('has_role', { _user_id: ..., _role: 'admin' })` (validação pós-login) e substituir por:

```ts
const { data, error: accessError } = await supabase.rpc('admin_get_access')
const row = Array.isArray(data) ? data[0] : data
const hasAccess = !accessError && (row?.roles?.length ?? 0) > 0
```

Mantendo o fluxo existente (se `!hasAccess`, signOut + mensagem de acesso negado; senão redirect `/admin`). Ajustar a mensagem de erro para "Sua conta não tem acesso ao painel.".

- [ ] **Step 8: Rodar suite inteira e corrigir mocks**

Run: `npm run test`
Testes existentes que mockam `useAdminAuth` (retorno `{ user, isAdmin, loading }`) continuam válidos pela chave `isAdmin` retrocompat; se algum mockar o shape inteiro, adicionar `hasAccess: true, roles: ['admin'], capabilities: [...]`.
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/admin/hooks/useAdminAuth.ts src/admin/contexts/AdminAccessContext.tsx src/admin/AdminGuard.tsx src/admin/AdminLoginPage.tsx src/admin/__tests__/AdminAccessContext.test.tsx
git commit -m "feat(admin): camada de acesso por capabilities (admin_get_access + AdminAccessContext)"
```

## Task 7: Navegação declarativa + `AdminSidebar`

**Files:**
- Create: `src/admin/lib/navigation.ts`
- Create: `src/admin/components/AdminSidebar.tsx`
- Create: `src/admin/__tests__/AdminSidebar.test.tsx`

- [ ] **Step 1: Criar `src/admin/lib/navigation.ts`**

```ts
import {
  LayoutDashboard, FileText, Users, ClipboardList,
  Route, Megaphone, Compass, Eye, type LucideIcon,
} from 'lucide-react'

export interface AdminNavItem {
  to: string
  label: string
  icon: LucideIcon
  capability: string
  /** NavLink end (rota index) */
  end?: boolean
}

export interface AdminNavGroup {
  title: string
  items: AdminNavItem[]
}

export const ADMIN_NAV: AdminNavGroup[] = [
  {
    title: 'Visão',
    items: [
      { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, capability: 'dashboard.view', end: true },
    ],
  },
  {
    title: 'Gestão',
    items: [
      { to: '/admin/simulados',  label: 'Simulados',  icon: FileText,      capability: 'content.manage' },
      { to: '/admin/usuarios',   label: 'Usuários',   icon: Users,         capability: 'users.view' },
      { to: '/admin/tentativas', label: 'Tentativas', icon: ClipboardList, capability: 'attempts.view' },
    ],
  },
  {
    title: 'Inteligência',
    items: [
      { to: '/admin/analytics', label: 'Jornada',   icon: Route,      capability: 'intel.view' },
      { to: '/admin/marketing', label: 'Aquisição', icon: Megaphone,  capability: 'intel.view' },
      { to: '/admin/produto',   label: 'Produto',   icon: Compass,    capability: 'intel.view' },
    ],
  },
  {
    title: 'Ferramentas',
    items: [
      { to: '/admin/previews', label: 'Previews', icon: Eye, capability: 'previews.view' },
    ],
  },
]

/** Grupos visíveis para um conjunto de capabilities (grupo some se vazio). */
export function visibleNav(capabilities: Set<string>): AdminNavGroup[] {
  return ADMIN_NAV
    .map(g => ({ ...g, items: g.items.filter(i => capabilities.has(i.capability)) }))
    .filter(g => g.items.length > 0)
}
```

- [ ] **Step 2: Teste do filtro + render (falhando)**

`src/admin/__tests__/AdminSidebar.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { visibleNav } from '@/admin/lib/navigation'
import { AdminSidebar } from '@/admin/components/AdminSidebar'
import { AdminAccessProvider } from '@/admin/contexts/AdminAccessContext'

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { email: 'ana@sanar.com', user_metadata: { full_name: 'Ana Beta' } },
    loading: false,
  }),
}))
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { auth: { signOut: vi.fn() } },
}))

describe('visibleNav', () => {
  it('analyst vê Visão, Inteligência e Ferramentas; não vê Gestão', () => {
    const nav = visibleNav(new Set(['dashboard.view', 'intel.view', 'previews.view']))
    expect(nav.map(g => g.title)).toEqual(['Visão', 'Inteligência', 'Ferramentas'])
  })

  it('support vê Usuários e Tentativas mas não Simulados', () => {
    const nav = visibleNav(new Set(['dashboard.view', 'users.view', 'users.manage', 'attempts.view', 'attempts.manage']))
    const gestao = nav.find(g => g.title === 'Gestão')
    expect(gestao?.items.map(i => i.label)).toEqual(['Usuários', 'Tentativas'])
  })
})

describe('AdminSidebar', () => {
  it('renderiza só grupos permitidos', () => {
    render(
      <MemoryRouter>
        <AdminAccessProvider roles={['analyst']} capabilities={['dashboard.view', 'intel.view', 'previews.view']}>
          <AdminSidebar collapsed={false} onToggle={() => {}} onOpenPalette={() => {}} />
        </AdminAccessProvider>
      </MemoryRouter>,
    )
    expect(screen.getByText('Jornada')).toBeInTheDocument()
    expect(screen.queryByText('Simulados')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npx vitest run src/admin/__tests__/AdminSidebar.test.tsx`
Expected: FAIL (AdminSidebar não existe).

- [ ] **Step 4: Criar `src/admin/components/AdminSidebar.tsx`**

```tsx
import { NavLink, useNavigate } from 'react-router-dom'
import { Search, LogOut, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { useAdminAccess } from '@/admin/contexts/AdminAccessContext'
import { visibleNav } from '@/admin/lib/navigation'
import { getInitials } from '@/admin/lib/format'
import { ROLE_META } from '@/admin/lib/constants'
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip'

interface AdminSidebarProps {
  collapsed: boolean
  onToggle: () => void
  onOpenPalette: () => void
}

export function AdminSidebar({ collapsed, onToggle, onOpenPalette }: AdminSidebarProps) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { roles, capabilities } = useAdminAccess()
  const nav = visibleNav(capabilities)
  const roleLabel = roles.map(r => ROLE_META[r]?.label ?? r).join(' · ')

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/admin/login')
  }

  return (
    <TooltipProvider delayDuration={100}>
      <aside
        className={cn(
          'shrink-0 min-h-screen z-20 flex flex-col bg-admin-surface border-r border-admin-line',
          'motion-safe:transition-[width] motion-safe:duration-200',
          collapsed ? 'w-14' : 'w-[232px]',
        )}
      >
        {/* Logo */}
        <div className={cn('flex items-center gap-2.5 px-3 pt-4 pb-3', collapsed && 'justify-center px-0')}>
          <div className="w-8 h-8 rounded-lg bg-admin-accent flex items-center justify-center shrink-0">
            <span className="text-admin-accent-contrast text-sm font-black">A</span>
          </div>
          {!collapsed && (
            <span className="text-sm font-semibold text-admin-text truncate">Arena Admin</span>
          )}
        </div>

        {/* Busca / paleta */}
        <div className={cn('px-3 pb-3', collapsed && 'px-2')}>
          <button
            type="button"
            onClick={onOpenPalette}
            aria-label="Buscar (Ctrl+K)"
            className={cn(
              'flex items-center gap-2 w-full rounded-md border border-admin-line bg-admin-raised/60',
              'text-admin-faint hover:border-admin-line-strong hover:text-admin-muted motion-safe:transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-admin-accent/50',
              collapsed ? 'h-9 justify-center' : 'h-8 px-2.5',
            )}
          >
            <Search className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {!collapsed && (
              <>
                <span className="text-xs flex-1 text-left">Buscar…</span>
                <kbd className="text-[10px] bg-admin-raised border border-admin-line rounded px-1 py-0.5 text-admin-faint">
                  Ctrl K
                </kbd>
              </>
            )}
          </button>
        </div>

        {/* Navegação */}
        <nav className="flex-1 overflow-y-auto px-2 flex flex-col gap-4">
          {nav.map(group => (
            <div key={group.title}>
              {!collapsed && (
                <p className="text-[10px] font-semibold text-admin-faint uppercase tracking-widest px-2 mb-1">
                  {group.title}
                </p>
              )}
              <div className="flex flex-col gap-0.5">
                {group.items.map(item => {
                  const Icon = item.icon
                  const link = (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.end}
                      className={({ isActive }) =>
                        cn(
                          'relative flex items-center gap-2.5 rounded-md motion-safe:transition-colors',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-admin-accent/50',
                          collapsed ? 'h-9 justify-center' : 'h-8 px-2.5',
                          isActive
                            ? 'bg-admin-accent/10 text-admin-accent'
                            : 'text-admin-muted hover:bg-admin-raised hover:text-admin-text',
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          {isActive && (
                            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-admin-accent rounded-r" />
                          )}
                          <Icon className="h-4 w-4 shrink-0" aria-hidden />
                          {!collapsed && (
                            <span className="text-[13px] font-medium truncate">{item.label}</span>
                          )}
                        </>
                      )}
                    </NavLink>
                  )
                  return collapsed ? (
                    <Tooltip key={item.to}>
                      <TooltipTrigger asChild>{link}</TooltipTrigger>
                      <TooltipContent side="right" className="text-xs">{item.label}</TooltipContent>
                    </Tooltip>
                  ) : link
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Rodapé: usuário + sair + colapso */}
        <div className="border-t border-admin-line p-2 flex flex-col gap-1">
          <div className={cn('flex items-center gap-2 px-1.5 py-1', collapsed && 'justify-center px-0')}>
            <div className="w-7 h-7 rounded-full bg-admin-raised border border-admin-line flex items-center justify-center shrink-0">
              <span className="text-[10px] font-bold text-admin-muted leading-none">
                {getInitials(user?.user_metadata?.full_name ?? user?.email)}
              </span>
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium text-admin-text truncate">
                  {user?.user_metadata?.full_name ?? user?.email}
                </p>
                <p className="text-[10px] text-admin-faint truncate">{roleLabel || '—'}</p>
              </div>
            )}
          </div>
          <div className={cn('flex gap-1', collapsed && 'flex-col items-center')}>
            <button
              type="button"
              title="Sair"
              onClick={handleLogout}
              className="h-7 flex-1 rounded-md flex items-center justify-center text-admin-faint hover:bg-admin-raised hover:text-admin-text motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-admin-accent/50"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden />
            </button>
            <button
              type="button"
              title={collapsed ? 'Expandir (Ctrl+B)' : 'Colapsar (Ctrl+B)'}
              onClick={onToggle}
              className="h-7 flex-1 rounded-md flex items-center justify-center text-admin-faint hover:bg-admin-raised hover:text-admin-text motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-admin-accent/50"
            >
              {collapsed
                ? <ChevronsRight className="h-3.5 w-3.5" aria-hidden />
                : <ChevronsLeft className="h-3.5 w-3.5" aria-hidden />}
            </button>
          </div>
        </div>
      </aside>
    </TooltipProvider>
  )
}
```

Nota: `NavLink` com children-as-function exige React Router 6.4+ (projeto usa RR6 ✓). Se `@/components/ui/tooltip` não existir, usar `title=` simples no modo colapsado.

- [ ] **Step 5: Rodar teste**

Run: `npx vitest run src/admin/__tests__/AdminSidebar.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/admin/lib/navigation.ts src/admin/components/AdminSidebar.tsx src/admin/__tests__/AdminSidebar.test.tsx
git commit -m "feat(admin): AdminSidebar fixa colapsável com navegação declarativa filtrada por capability"
```

## Task 8: Shell — `AdminApp` + `AdminTopbar` reformulados

**Files:**
- Modify: `src/admin/AdminApp.tsx` (substituição completa)
- Modify: `src/admin/components/AdminTopbar.tsx` (substituição completa)
- Delete: `src/admin/components/AdminRail.tsx`, `src/admin/components/AdminFlyout.tsx`

- [ ] **Step 1: Reescrever `src/admin/components/AdminTopbar.tsx`**

```tsx
import { useLocation } from 'react-router-dom'
import { Bell, ChevronRight, Moon, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { ADMIN_NAV } from '@/admin/lib/navigation'

function getBreadcrumb(pathname: string): { group: string | null; label: string } {
  for (const group of ADMIN_NAV) {
    for (const item of group.items) {
      if (item.end ? pathname === item.to : pathname === item.to) {
        return { group: group.title, label: item.label }
      }
    }
  }
  if (pathname.includes('/admin/preview/simulados/')) {
    if (pathname.endsWith('/correcao'))   return { group: 'Ferramentas', label: 'Preview correção' }
    if (pathname.endsWith('/desempenho')) return { group: 'Ferramentas', label: 'Preview desempenho' }
  }
  if (pathname.startsWith('/admin/usuarios/'))  return { group: 'Gestão', label: 'Usuários' }
  if (pathname.startsWith('/admin/simulados'))  return { group: 'Gestão', label: 'Simulados' }
  if (pathname.startsWith('/admin/tentativas')) return { group: 'Gestão', label: 'Tentativas' }
  return { group: null, label: 'Admin' }
}

function AdminThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  if (!mounted) return <span className="w-7 h-7 rounded-md shrink-0" aria-hidden />
  const isDark = resolvedTheme === 'dark'
  return (
    <button
      type="button"
      aria-label={isDark ? 'Ativar tema claro' : 'Ativar tema escuro'}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="w-7 h-7 rounded-md flex items-center justify-center text-admin-muted hover:bg-admin-raised motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-admin-accent/50"
    >
      {isDark ? <Sun className="h-3.5 w-3.5" aria-hidden /> : <Moon className="h-3.5 w-3.5" aria-hidden />}
    </button>
  )
}

export function AdminTopbar() {
  const { pathname } = useLocation()
  const { group, label } = getBreadcrumb(pathname)

  return (
    <header className="h-11 border-b border-admin-line bg-admin-bg/80 backdrop-blur-sm flex items-center justify-between px-4 shrink-0">
      <div className="flex items-center gap-1.5 min-w-0">
        {group && (
          <>
            <span className="text-xs text-admin-faint">{group}</span>
            <ChevronRight className="h-3 w-3 text-admin-faint/60" aria-hidden />
          </>
        )}
        <span className="text-[13px] font-semibold text-admin-text truncate">{label}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <AdminThemeToggle />
        <button
          type="button"
          title="Alertas (em breve)"
          aria-disabled
          className="w-7 h-7 rounded-md flex items-center justify-center text-admin-faint opacity-50 cursor-not-allowed"
        >
          <Bell className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
    </header>
  )
}
```

- [ ] **Step 2: Reescrever `src/admin/AdminApp.tsx`**

A paleta (`AdminCommandPalette`) só existe na Task 10 — nesta task, montar o shell com um stub: estado `paletteOpen` e um `<div />` no lugar; a Task 10 substitui. Para evitar import quebrado, criar já o arquivo da paleta como stub mínimo (passo 3).

```tsx
// src/admin/AdminApp.tsx
import { useCallback, useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import { AdminSidebar } from './components/AdminSidebar'
import { AdminTopbar } from './components/AdminTopbar'
import { AdminCommandPalette } from './components/AdminCommandPalette'
import { AdminPeriodProvider } from './contexts/AdminPeriodContext'

const SIDEBAR_KEY = 'admin.sidebar.collapsed'

export function AdminApp() {
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(SIDEBAR_KEY) === '1' } catch { return false }
  })
  const [paletteOpen, setPaletteOpen] = useState(false)

  const toggleSidebar = useCallback(() => {
    setCollapsed(prev => {
      const next = !prev
      try { localStorage.setItem(SIDEBAR_KEY, next ? '1' : '0') } catch { /* noop */ }
      return next
    })
  }, [])

  const openPalette = useCallback(() => setPaletteOpen(true), [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen(open => !open)
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault()
        toggleSidebar()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [toggleSidebar])

  return (
    <AdminPeriodProvider>
      <div className="admin-root flex min-h-screen antialiased">
        <AdminSidebar collapsed={collapsed} onToggle={toggleSidebar} onOpenPalette={openPalette} />
        <div className="flex flex-col flex-1 min-w-0">
          <AdminTopbar />
          <div
            role="note"
            className="md:hidden flex items-center gap-2 border-b border-admin-warning/30 bg-admin-warning/10 px-4 py-2 text-[11px] font-medium"
          >
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-admin-warning" aria-hidden />
            <span className="text-admin-text/80">
              Painel admin otimizado para desktop. Recomendamos usar uma tela maior.
            </span>
          </div>
          <main className="flex-1 p-5 overflow-auto">
            <Outlet />
          </main>
        </div>
        <AdminCommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      </div>
    </AdminPeriodProvider>
  )
}
```

- [ ] **Step 3: Stub da paleta**

Create `src/admin/components/AdminCommandPalette.tsx` (substituído por completo na Task 10):

```tsx
interface AdminCommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Stub — implementação completa na task da paleta de comandos. */
export function AdminCommandPalette(_props: AdminCommandPaletteProps) {
  return null
}
```

- [ ] **Step 4: Remover Rail e Flyout**

```bash
git rm src/admin/components/AdminRail.tsx src/admin/components/AdminFlyout.tsx
```

Rodar `npx tsc --noEmit` (ou `npm run build`) — se algo ainda importar `AdminRail`/`AdminFlyout` (ex.: testes), atualizar/remover essas referências.

- [ ] **Step 5: Testes e build**

Run: `npm run test` e `npm run build`
Expected: PASS. Testes existentes que renderizavam o shell antigo (se houver) passam a montar `AdminSidebar` — ajustar imports/asserts conforme necessário (procurar por `AdminRail|AdminFlyout|flyout` em `src/admin/__tests__/`).

- [ ] **Step 6: Commit**

```bash
git add -A src/admin
git commit -m "feat(admin): shell novo com sidebar fixa, topbar enxuta e atalhos Ctrl+B/Ctrl+K"
```

## Task 9: Componentes base novos (`AdminPageHeader`, `AdminBadge`, `AdminEmptyState`, `AdminConfirmDialog`)

**Files:**
- Create: `src/admin/components/ui/AdminPageHeader.tsx`
- Create: `src/admin/components/ui/AdminBadge.tsx`
- Create: `src/admin/components/ui/AdminEmptyState.tsx`
- Create: `src/admin/components/ui/AdminConfirmDialog.tsx`

- [ ] **Step 1: `AdminPageHeader.tsx`**

```tsx
import type { ReactNode } from 'react'

interface AdminPageHeaderProps {
  title: string
  /** linha auxiliar: contagem, período, descrição curta */
  subtitle?: ReactNode
  /** slot à direita: botões de ação, seletor de período */
  actions?: ReactNode
}

export function AdminPageHeader({ title, subtitle, actions }: AdminPageHeaderProps) {
  return (
    <div className="flex items-end justify-between gap-4 mb-5">
      <div className="min-w-0">
        <h1 className="text-lg font-semibold text-admin-text tracking-tight">{title}</h1>
        {subtitle && <p className="text-xs text-admin-muted mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  )
}
```

- [ ] **Step 2: `AdminBadge.tsx`**

```tsx
import { cn } from '@/lib/utils'
import { SEGMENT_META, ATTEMPT_STATUS_META, ROLE_META } from '@/admin/lib/constants'

interface AdminBadgeProps {
  kind: 'segment' | 'attemptStatus' | 'role'
  value: string
  className?: string
}

const NEUTRAL = 'bg-admin-raised text-admin-muted border-admin-line'

export function AdminBadge({ kind, value, className }: AdminBadgeProps) {
  let label = value
  let tone = NEUTRAL

  if (kind === 'segment') {
    const meta = SEGMENT_META[value]
    if (meta) { label = meta.label; tone = meta.className }
  } else if (kind === 'attemptStatus') {
    const meta = ATTEMPT_STATUS_META[value]
    if (meta) { label = meta.label; tone = meta.className }
  } else if (kind === 'role') {
    const meta = ROLE_META[value]
    if (meta) { label = meta.label; tone = 'bg-admin-accent/10 text-admin-accent border-admin-accent/30' }
  }

  return (
    <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium', tone, className)}>
      {label}
    </span>
  )
}
```

- [ ] **Step 3: `AdminEmptyState.tsx`**

```tsx
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Inbox } from 'lucide-react'

interface AdminEmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  action?: ReactNode
}

export function AdminEmptyState({ icon: Icon = Inbox, title, description, action }: AdminEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-4">
      <div className="w-10 h-10 rounded-full bg-admin-raised border border-admin-line flex items-center justify-center mb-3">
        <Icon className="h-4 w-4 text-admin-faint" aria-hidden />
      </div>
      <p className="text-sm font-medium text-admin-text">{title}</p>
      {description && <p className="text-xs text-admin-muted mt-1 max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
```

- [ ] **Step 4: `AdminConfirmDialog.tsx`**

```tsx
import type { ReactNode } from 'react'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'

interface AdminConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: ReactNode
  confirmLabel?: string
  /** destrutivo pinta o botão de destructive */
  destructive?: boolean
  onConfirm: () => void
  loading?: boolean
}

export function AdminConfirmDialog({
  open, onOpenChange, title, description,
  confirmLabel = 'Confirmar', destructive = false, onConfirm, loading = false,
}: AdminConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="bg-admin-surface border-admin-line text-admin-text">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-admin-text">{title}</AlertDialogTitle>
          <AlertDialogDescription className="text-admin-muted">{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="border-admin-line bg-transparent text-admin-muted hover:bg-admin-raised hover:text-admin-text">
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={loading}
            onClick={onConfirm}
            className={cn(
              destructive
                ? 'bg-admin-destructive text-white hover:bg-admin-destructive/90'
                : 'bg-admin-accent text-admin-accent-contrast hover:bg-admin-accent/90',
            )}
          >
            {loading ? 'Aguarde…' : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
```

Nota: se `@/components/ui/alert-dialog` não existir no projeto, usar `@/components/ui/dialog` com a mesma estrutura (verificar `src/components/ui/`).

- [ ] **Step 5: Build + commit**

Run: `npm run build`
Expected: PASS.

```bash
git add src/admin/components/ui/AdminPageHeader.tsx src/admin/components/ui/AdminBadge.tsx src/admin/components/ui/AdminEmptyState.tsx src/admin/components/ui/AdminConfirmDialog.tsx
git commit -m "feat(admin): componentes base AdminPageHeader, AdminBadge, AdminEmptyState e AdminConfirmDialog"
```

## Task 10: Paleta de comandos (registry, hook, componente, API)

**Files:**
- Create: `src/admin/lib/commandRegistry.ts`
- Create: `src/admin/hooks/useAdminQuickSearch.ts`
- Modify: `src/admin/components/AdminCommandPalette.tsx` (substitui o stub)
- Modify: `src/admin/services/adminApi.ts` (adicionar `getAccess` não é necessário — usado direto no hook; adicionar `quickSearch`)
- Modify: `src/admin/types.ts` (adicionar `QuickSearchResult`)
- Create: `src/admin/__tests__/commandRegistry.test.ts`

- [ ] **Step 1: Teste do registry (falhando)**

`src/admin/__tests__/commandRegistry.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { getAvailableCommands } from '@/admin/lib/commandRegistry'

describe('commandRegistry', () => {
  it('filtra comandos por capability', () => {
    const cmds = getAvailableCommands(new Set(['dashboard.view', 'intel.view']))
    const ids = cmds.map(c => c.id)
    expect(ids).toContain('nav.dashboard')
    expect(ids).toContain('nav.analytics')
    expect(ids).not.toContain('nav.simulados')
    expect(ids).not.toContain('action.create-simulado')
  })

  it('ações utilitárias (tema/sidebar) aparecem para qualquer acesso', () => {
    const cmds = getAvailableCommands(new Set(['intel.view']))
    expect(cmds.map(c => c.id)).toContain('action.toggle-theme')
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/admin/__tests__/commandRegistry.test.ts`
Expected: FAIL.

- [ ] **Step 3: Criar `src/admin/lib/commandRegistry.ts`**

```ts
import {
  FilePlus, Upload, SunMoon, PanelLeftClose, type LucideIcon,
} from 'lucide-react'
import { ADMIN_NAV } from '@/admin/lib/navigation'

export interface AdminCommand {
  id: string
  label: string
  icon: LucideIcon
  group: 'Navegação' | 'Ações'
  /** null = disponível para qualquer usuário com acesso ao admin */
  capability: string | null
  keywords: string[]
  /** rota para navegar OU id de ação tratada pelo consumidor */
  route?: string
  actionId?: 'toggle-theme' | 'toggle-sidebar'
}

const NAV_COMMANDS: AdminCommand[] = ADMIN_NAV.flatMap(group =>
  group.items.map(item => ({
    id: `nav.${item.to.replace('/admin', '').replace(/^\//, '') || 'dashboard'}`,
    label: item.label,
    icon: item.icon,
    group: 'Navegação' as const,
    capability: item.capability,
    keywords: [item.label.toLowerCase(), group.title.toLowerCase()],
    route: item.to,
  })),
)

const ACTION_COMMANDS: AdminCommand[] = [
  {
    id: 'action.create-simulado',
    label: 'Criar simulado',
    icon: FilePlus,
    group: 'Ações',
    capability: 'content.manage',
    keywords: ['novo', 'criar', 'simulado'],
    route: '/admin/simulados/novo',
  },
  {
    id: 'action.upload-questions',
    label: 'Enviar questões (upload)',
    icon: Upload,
    group: 'Ações',
    capability: 'content.manage',
    keywords: ['upload', 'questões', 'xlsx', 'planilha'],
    route: '/admin/simulados',
  },
  {
    id: 'action.toggle-theme',
    label: 'Alternar tema',
    icon: SunMoon,
    group: 'Ações',
    capability: null,
    keywords: ['tema', 'dark', 'light', 'claro', 'escuro'],
    actionId: 'toggle-theme',
  },
  {
    id: 'action.toggle-sidebar',
    label: 'Colapsar/expandir sidebar',
    icon: PanelLeftClose,
    group: 'Ações',
    capability: null,
    keywords: ['sidebar', 'menu', 'colapsar'],
    actionId: 'toggle-sidebar',
  },
]

/** Comandos disponíveis para um conjunto de capabilities. */
export function getAvailableCommands(capabilities: Set<string>): AdminCommand[] {
  return [...NAV_COMMANDS, ...ACTION_COMMANDS].filter(
    c => c.capability === null || capabilities.has(c.capability),
  )
}
```

- [ ] **Step 4: Rodar teste**

Run: `npx vitest run src/admin/__tests__/commandRegistry.test.ts`
Expected: PASS.

- [ ] **Step 5: Tipo + método de API**

Em `src/admin/types.ts`, adicionar ao final:

```ts
export interface QuickSearchResult {
  kind: 'user' | 'simulado'
  id: string
  title: string
  subtitle: string | null
}
```

Em `src/admin/services/adminApi.ts`, adicionar método ao objeto `adminApi` (seguir o padrão dos vizinhos) e o import do tipo:

```ts
  async quickSearch(query: string): Promise<QuickSearchResult[]> {
    const { data, error } = await supabase.rpc('admin_quick_search', { p_query: query });
    if (error) throw error;
    return (data ?? []) as QuickSearchResult[];
  },
```

- [ ] **Step 6: Criar `src/admin/hooks/useAdminQuickSearch.ts`**

```ts
import { useQuery } from '@tanstack/react-query'
import { adminApi } from '@/admin/services/adminApi'
import { useDebounce } from '@/hooks/useDebounce'

/** Busca de entidades da paleta: 2+ chars, debounce 250ms. */
export function useAdminQuickSearch(query: string) {
  const debounced = useDebounce(query.trim(), 250)
  const enabled = debounced.length >= 2

  const { data, isFetching, isError } = useQuery({
    queryKey: ['admin', 'quick-search', debounced],
    queryFn: () => adminApi.quickSearch(debounced),
    enabled,
    staleTime: 30_000,
  })

  return { results: data ?? [], isFetching: enabled && isFetching, isError, enabled }
}
```

- [ ] **Step 7: Substituir o stub `AdminCommandPalette.tsx`**

```tsx
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from 'next-themes'
import { User, FileText, Clock } from 'lucide-react'
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput,
  CommandItem, CommandList, CommandSeparator,
} from '@/components/ui/command'
import { useAdminAccess } from '@/admin/contexts/AdminAccessContext'
import { getAvailableCommands, type AdminCommand } from '@/admin/lib/commandRegistry'
import { useAdminQuickSearch } from '@/admin/hooks/useAdminQuickSearch'
import { logger } from '@/lib/logger'

const RECENTS_KEY = 'admin.recents'
const MAX_RECENTS = 5

interface RecentEntry { route: string; label: string }

function readRecents(): RecentEntry[] {
  try {
    return JSON.parse(localStorage.getItem(RECENTS_KEY) ?? '[]') as RecentEntry[]
  } catch { return [] }
}

export function pushRecent(entry: RecentEntry) {
  try {
    const list = [entry, ...readRecents().filter(r => r.route !== entry.route)].slice(0, MAX_RECENTS)
    localStorage.setItem(RECENTS_KEY, JSON.stringify(list))
  } catch { /* noop */ }
}

interface AdminCommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AdminCommandPalette({ open, onOpenChange }: AdminCommandPaletteProps) {
  const navigate = useNavigate()
  const { setTheme, resolvedTheme } = useTheme()
  const { capabilities } = useAdminAccess()
  const [query, setQuery] = useState('')
  const { results, isFetching, isError } = useAdminQuickSearch(query)
  const commands = getAvailableCommands(capabilities)
  const recents = readRecents()

  useEffect(() => {
    if (!open) setQuery('')
  }, [open])

  const runCommand = useCallback((cmd: AdminCommand) => {
    onOpenChange(false)
    if (cmd.actionId === 'toggle-theme') {
      setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
      return
    }
    if (cmd.actionId === 'toggle-sidebar') {
      document.dispatchEvent(new CustomEvent('admin:toggle-sidebar'))
      return
    }
    if (cmd.route) {
      pushRecent({ route: cmd.route, label: cmd.label })
      navigate(cmd.route)
    }
  }, [navigate, onOpenChange, resolvedTheme, setTheme])

  const goToEntity = useCallback((kind: string, id: string, title: string) => {
    onOpenChange(false)
    const route = kind === 'user' ? `/admin/usuarios/${id}` : `/admin/simulados/${id}`
    pushRecent({ route, label: title })
    navigate(route)
  }, [navigate, onOpenChange])

  if (isError) logger.error('[AdminCommandPalette] Erro na busca de entidades')

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Buscar página, usuário, simulado ou ação…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>
          {isFetching ? 'Buscando…' : isError ? 'Erro na busca — tente de novo.' : 'Nada encontrado.'}
        </CommandEmpty>

        {query.length === 0 && recents.length > 0 && (
          <>
            <CommandGroup heading="Recentes">
              {recents.map(r => (
                <CommandItem key={r.route} value={`recent ${r.label}`} onSelect={() => {
                  onOpenChange(false); navigate(r.route)
                }}>
                  <Clock className="mr-2 h-3.5 w-3.5 text-admin-faint" aria-hidden />
                  {r.label}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        <CommandGroup heading="Navegação">
          {commands.filter(c => c.group === 'Navegação').map(cmd => (
            <CommandItem
              key={cmd.id}
              value={`${cmd.label} ${cmd.keywords.join(' ')}`}
              onSelect={() => runCommand(cmd)}
            >
              <cmd.icon className="mr-2 h-3.5 w-3.5 text-admin-muted" aria-hidden />
              {cmd.label}
            </CommandItem>
          ))}
        </CommandGroup>

        {results.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Resultados">
              {results.map(r => (
                <CommandItem
                  key={`${r.kind}-${r.id}`}
                  value={`${r.kind} ${r.title} ${r.subtitle ?? ''}`}
                  onSelect={() => goToEntity(r.kind, r.id, r.title)}
                >
                  {r.kind === 'user'
                    ? <User className="mr-2 h-3.5 w-3.5 text-admin-info" aria-hidden />
                    : <FileText className="mr-2 h-3.5 w-3.5 text-admin-accent" aria-hidden />}
                  <span className="truncate">{r.title}</span>
                  {r.subtitle && <span className="ml-2 text-xs text-admin-faint truncate">{r.subtitle}</span>}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        <CommandSeparator />
        <CommandGroup heading="Ações">
          {commands.filter(c => c.group === 'Ações').map(cmd => (
            <CommandItem
              key={cmd.id}
              value={`${cmd.label} ${cmd.keywords.join(' ')}`}
              onSelect={() => runCommand(cmd)}
            >
              <cmd.icon className="mr-2 h-3.5 w-3.5 text-admin-muted" aria-hidden />
              {cmd.label}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
```

- [ ] **Step 8: Ligar o evento `admin:toggle-sidebar` no `AdminApp`**

Em `src/admin/AdminApp.tsx`, dentro do `useEffect` de atalhos, adicionar:

```tsx
    const sidebarHandler = () => toggleSidebar()
    document.addEventListener('admin:toggle-sidebar', sidebarHandler)
```

e no cleanup: `document.removeEventListener('admin:toggle-sidebar', sidebarHandler)`.

- [ ] **Step 9: Testes + build**

Run: `npm run test` e `npm run build`
Expected: PASS. (Se `CommandDialog` do shadcn não aceitar tema admin por padrão, adicionar `className="bg-admin-surface border-admin-line text-admin-text"` no `CommandDialog`/`DialogContent` interno conforme a assinatura do componente em `src/components/ui/command.tsx`.)

- [ ] **Step 10: Commit**

```bash
git add src/admin/lib/commandRegistry.ts src/admin/hooks/useAdminQuickSearch.ts src/admin/components/AdminCommandPalette.tsx src/admin/services/adminApi.ts src/admin/types.ts src/admin/__tests__/commandRegistry.test.ts src/admin/AdminApp.tsx
git commit -m "feat(admin): paleta de comandos Ctrl+K com registry declarativo e busca de entidades"
```

## Task 11: Retema dos componentes `src/admin/components/ui/*` existentes

**Files:**
- Modify: `AdminPanel.tsx`, `AdminStatCard.tsx`, `AdminDataTable.tsx`, `AdminSectionHeader.tsx`, `AdminTrendChart.tsx`, `AdminFunnelChart.tsx`, `AdminLivePanel.tsx` (todos em `src/admin/components/ui/`)

- [ ] **Step 1: Aplicar mapeamento de classes em cada arquivo**

Tabela de conversão (aplicar com Edit, arquivo por arquivo — NUNCA sed global no repo, só nos 7 arquivos desta task):

| De (token global) | Para (token admin) |
|---|---|
| `bg-card` | `bg-admin-surface` |
| `bg-background` | `bg-admin-bg` |
| `bg-muted` (superfície) | `bg-admin-raised` |
| `border-border` | `border-admin-line` |
| `text-foreground` | `text-admin-text` |
| `text-muted-foreground` | `text-admin-muted` |
| `text-primary` | `text-admin-accent` |
| `bg-primary` | `bg-admin-accent` |
| `text-primary-foreground` | `text-admin-accent-contrast` |
| `bg-primary/10` | `bg-admin-accent/10` |
| `border-primary/30` | `border-admin-accent/30` |
| `text-success` | `text-admin-success` |
| `text-destructive` / `text-red-*` | `text-admin-destructive` |
| `hover:bg-muted` | `hover:bg-admin-raised` |
| `ring-ring` | `ring-admin-accent/50` |
| `ring-offset-background` | `ring-offset-admin-bg` |

Onde o componente usa `hsl(var(--border))` etc. inline (charts), já foi coberto pela Task 4 (`adminChartTheme`). Skeletons (`animate-pulse bg-muted`) → `bg-admin-raised`.

- [ ] **Step 2: Testes existentes**

Run: `npm run test`
Os testes `AdminStatCard.test.tsx` e `AdminFunnelChart.test.tsx` testam comportamento (não classes) — devem passar sem mudança. Se algum asserta classe, atualizar o assert para o token novo.
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/admin/components/ui
git commit -m "refactor(admin): componentes base consomem tokens --admin-* (control room dual)"
```

## Task 12: Página `AdminPreviews` + rotas

**Files:**
- Create: `src/admin/pages/AdminPreviews.tsx`
- Modify: `src/App.tsx:150` (rota nova + redirect)

- [ ] **Step 1: Criar `src/admin/pages/AdminPreviews.tsx`**

Antes, ler `src/admin/pages/AdminRankingPreviewPage.tsx` e `src/hooks/useRankingAdminPreview.ts` para confirmar como o conteúdo do ranking preview é renderizado e como `admin_list_simulados_for_ranking_preview` é consumido (hook existente). Estrutura da página:

```tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AdminPageHeader } from '@/admin/components/ui/AdminPageHeader'
import { AdminEmptyState } from '@/admin/components/ui/AdminEmptyState'
import { supabase } from '@/integrations/supabase/client'
import AdminRankingPreviewPage from '@/admin/pages/AdminRankingPreviewPage'

function useSimuladosForPreview() {
  return useQuery({
    queryKey: ['admin', 'previews', 'simulados'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_list_simulados_for_ranking_preview')
      if (error) throw error
      return data ?? []
    },
  })
}

function SimuladoPicker({ onPick, cta }: { onPick: (id: string) => void; cta: string }) {
  const { data: simulados = [], isLoading } = useSimuladosForPreview()
  const [selected, setSelected] = useState('')

  if (isLoading) return <p className="text-xs text-admin-muted py-8 text-center">Carregando simulados…</p>
  if (simulados.length === 0) return <AdminEmptyState title="Nenhum simulado disponível" />

  return (
    <div className="flex items-center gap-2 py-4">
      <select
        value={selected}
        onChange={e => setSelected(e.target.value)}
        className="h-8 rounded-md border border-admin-line bg-admin-surface text-admin-text text-xs px-2"
      >
        <option value="">Selecione um simulado…</option>
        {simulados.map((s: { id: string; title: string }) => (
          <option key={s.id} value={s.id}>{s.title}</option>
        ))}
      </select>
      <button
        type="button"
        disabled={!selected}
        onClick={() => onPick(selected)}
        className="h-8 px-3 rounded-md bg-admin-accent text-admin-accent-contrast text-xs font-medium disabled:opacity-40"
      >
        {cta}
      </button>
    </div>
  )
}

export default function AdminPreviews() {
  const navigate = useNavigate()

  return (
    <div>
      <AdminPageHeader
        title="Previews"
        subtitle="Visualize as telas do aluno (ranking, desempenho e correção) sem precisar de uma conta de teste."
      />
      <Tabs defaultValue="ranking">
        <TabsList className="bg-admin-raised border border-admin-line">
          <TabsTrigger value="ranking">Ranking</TabsTrigger>
          <TabsTrigger value="desempenho">Desempenho</TabsTrigger>
          <TabsTrigger value="correcao">Correção</TabsTrigger>
        </TabsList>
        <TabsContent value="ranking" className="mt-4">
          <AdminRankingPreviewPage />
        </TabsContent>
        <TabsContent value="desempenho" className="mt-4">
          <SimuladoPicker cta="Abrir preview de desempenho"
            onPick={id => navigate(`/admin/preview/simulados/${id}/desempenho`)} />
        </TabsContent>
        <TabsContent value="correcao" className="mt-4">
          <SimuladoPicker cta="Abrir preview de correção"
            onPick={id => navigate(`/admin/preview/simulados/${id}/correcao`)} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
```

Ajuste: se `AdminRankingPreviewPage` renderizar header próprio redundante, extrair o miolo para um componente `RankingPreviewContent` no mesmo arquivo e usar aqui (manter a página antiga funcionando).

- [ ] **Step 2: Rotas em `src/App.tsx`**

Adicionar lazy import junto aos demais:

```tsx
const AdminPreviews = lazy(() => import('./admin/pages/AdminPreviews'))
```

Adicionar a rota dentro do bloco AdminApp e transformar a antiga em redirect:

```tsx
<Route path="previews" element={<Suspense fallback={<PageLoadingSkeleton />}><AdminPreviews /></Suspense>} />
<Route path="ranking-preview" element={<Navigate to="/admin/previews" replace />} />
```

(`Navigate` já é importado em App.tsx? Se não: `import { Navigate } from 'react-router-dom'` — verificar.)

- [ ] **Step 3: Teste manual rápido + suite**

Run: `npm run test` e `npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/admin/pages/AdminPreviews.tsx src/App.tsx
git commit -m "feat(admin): página Previews unificada (ranking, desempenho, correção)"
```

## Task 13: Adaptação das 13 páginas + gestão de roles + limpeza

**Files:**
- Modify: todas em `src/admin/pages/` + `src/admin/AdminLoginPage.tsx` (visual)

- [ ] **Step 1: Sweep de classes (mesma tabela da Task 11) página por página**

Ordem (uma página por vez, rodando a suite após cada grupo): `AdminDashboard`, `AdminSimulados`, `AdminSimuladoForm`, `AdminUploadQuestions`, `AdminUsuarios`, `AdminUsuarioDetail`, `AdminTentativas`, `AdminAnalytics`, `AdminMarketing`, `AdminProduto`, `AdminSimuladoAnalytics`, `AdminRankingPreviewPage`, `AdminDesempenhoPreviewPage`.

Em cada página, além do sweep:
- Substituir header manual (título/subtítulo/ações no topo) por `<AdminPageHeader title=… subtitle=… actions=…/>`.
- Substituir badges de segmento/status ad-hoc por `<AdminBadge kind=… value=…/>` e remover os literais locais (`SEGMENT_CLASSES`, `STATUS_*`).
- Substituir `PERIODS`/`PERIOD_OPTIONS` locais pelo import de `@/admin/lib/constants`.
- Substituir `useDebounce` local pelo import de `@/hooks/useDebounce` (em `AdminUsuarios` e `AdminTentativas`).
- Substituir `getInitials` local pelo import de `@/admin/lib/format`.
- Estados vazios ad-hoc ("Nenhum resultado") → `<AdminEmptyState …/>`.
- Confirmações de delete/cancel via `window.confirm` ou Dialog ad-hoc → `<AdminConfirmDialog …/>`.

- [ ] **Step 2: Remover logs de debug do upload**

Em `src/admin/pages/AdminUploadQuestions.tsx`, remover os 3 blocos `logger.log('[upload-debug] …')` (linhas ~194, ~229, ~290) e em `src/admin/lib/xlsxImageExtractor.ts` o comment DEBUG da linha ~130 se for log ativo (comentário pode ficar).

- [ ] **Step 3: Gestão de roles em `AdminUsuarioDetail`**

Ler a seção atual de role (toggle admin). Substituir por um bloco "Acesso ao painel" gated por `useAdminCan('roles.manage')`:

```tsx
// dentro do componente, com os imports correspondentes
const canManageRoles = useAdminCan('roles.manage')
// user.roles vem de admin_get_user (coluna roles adicionada na Task 3)

{canManageRoles && (
  <section className="bg-admin-surface border border-admin-line rounded-lg p-4">
    <h2 className="text-sm font-semibold text-admin-text mb-1">Acesso ao painel</h2>
    <p className="text-xs text-admin-muted mb-3">Roles controlam o que este usuário pode ver e fazer no admin.</p>
    <div className="flex flex-col gap-2">
      {Object.entries(ROLE_META).map(([role, meta]) => {
        const granted = (user.roles ?? []).includes(role)
        return (
          <label key={role} className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={granted}
              onChange={() => roleMutation.mutate({ role, grant: !granted })}
              className="mt-0.5 accent-[hsl(var(--admin-accent))]"
            />
            <span>
              <span className="text-xs font-medium text-admin-text">{meta.label}</span>
              <span className="block text-[11px] text-admin-muted">{meta.description}</span>
            </span>
          </label>
        )
      })}
    </div>
  </section>
)}
```

com a mutation (padrão React Query da página):

```tsx
const roleMutation = useMutation({
  mutationFn: ({ role, grant }: { role: string; grant: boolean }) =>
    adminApi.setUserRole(userId, role, grant),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'user', userId] })
    toast({ title: 'Acesso atualizado' })
  },
  onError: () => toast({ title: 'Erro ao atualizar acesso', variant: 'destructive' }),
})
```

- [ ] **Step 4: Gates de página (rota direta sem capability)**

Criar wrapper leve em `src/admin/components/AdminCapabilityGate.tsx`:

```tsx
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAdminCan } from '@/admin/contexts/AdminAccessContext'
import { AdminEmptyState } from '@/admin/components/ui/AdminEmptyState'
import { ShieldOff } from 'lucide-react'

export function AdminCapabilityGate({ capability, children }: { capability: string; children: ReactNode }) {
  const can = useAdminCan(capability)
  if (!can) {
    return (
      <AdminEmptyState
        icon={ShieldOff}
        title="Sem acesso a esta área"
        description="Seu perfil não tem permissão para esta seção do painel."
        action={<Link to="/admin" className="text-xs text-admin-accent underline">Voltar ao Dashboard</Link>}
      />
    )
  }
  return <>{children}</>
}
```

Envolver o conteúdo de cada página com a capability correspondente do mapa de navegação (ex.: `AdminUsuarios` → `users.view`; `AdminSimulados`, `AdminSimuladoForm`, `AdminUploadQuestions`, `AdminSimuladoAnalytics` → `content.manage`; `AdminTentativas` → `attempts.view`; Analytics/Marketing/Produto → `intel.view`; Previews → `previews.view`; Dashboard → `dashboard.view`).

- [ ] **Step 5: Suite + lint + build após cada bloco de páginas**

Run: `npm run test` (os testes de página existentes — `AdminUsuarios.test.tsx`, `AdminTentativas.test.tsx`, `AdminUsuarioDetail.test.tsx`, `AdminAnalytics.test.tsx`, `AdminMarketing.test.tsx`, `AdminProduto.test.tsx` — precisarão de provider de acesso; adicionar wrapper `AdminAccessProvider` com capabilities completas nos renders dos testes).
Expected: PASS.

- [ ] **Step 6: Commits granulares**

```bash
git add src/admin/pages/AdminDashboard.tsx ... # por grupo
git commit -m "refactor(admin): adapta páginas de <grupo> ao tema control-room e componentes base"
# último commit do task:
git commit -m "feat(admin): gestão de roles no detalhe de usuário + gates de capability por página"
```

## Task 14: Verificação final

- [ ] **Step 1: Suite completa, lint e build**

Run: `npm run test && npm run lint && npm run build`
Expected: tudo verde, zero warnings novos de lint.

- [ ] **Step 2: Verificação visual via preview**

Subir `npm run dev` (porta 8080) via preview tooling e verificar:
1. `/admin/login` → login → shell novo carrega com sidebar expandida.
2. Toggle de tema: dark (control room) e light (papel quente) — sem texto ilegível em nenhum dos dois.
3. `Ctrl+B` colapsa/expande; preferência persiste após reload.
4. `Ctrl+K` abre paleta; "usu" encontra página Usuários; query com 2+ chars retorna entidades; Enter navega.
5. Cada página das 13 renderiza sem erro de console (`preview_console_logs`).
6. `/admin/previews` mostra as 3 abas; `/admin/ranking-preview` redireciona.
7. Com usuário admin: tudo visível. (Roles novos: smoke real exige criar usuário de teste com role `analyst` — opcional aqui, obrigatório antes de liberar pro time.)

- [ ] **Step 3: Screenshot de prova (dark + light) e relatório final**

- [ ] **Step 4: Commit final (se sobrou ajuste) e resumo**

```bash
git add -A
git commit -m "polish(admin): ajustes finais da fundação (tema/UX)"
```

---

## Riscos e contingências

- **`alter policy` em `storage.objects`**: requer owner adequado; se o MCP falhar por permissão, fazer `drop policy` + `create policy` equivalente na mesma migration.
- **RPCs com variações no bloco de auth**: o sweep da Task 3 sempre parte do `pg_get_functiondef` real — nunca assumir o corpo.
- **`CommandDialog` sem suporte a className**: estilizar via wrapper no `command.tsx` é proibido (pasta shadcn não se edita manualmente) — nesse caso, usar `Dialog` + `Command` compostos direto na `AdminCommandPalette`.
- **Testes de página acoplados ao shell antigo**: atualizar mocks/wrappers, nunca enfraquecer asserts de comportamento.
- **Tipos gerados**: depois de QUALQUER migration de função, regenerar `types.ts`; build quebrado por rpc não tipada = esqueceu este passo.
