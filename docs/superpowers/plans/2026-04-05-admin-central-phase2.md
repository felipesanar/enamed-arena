# Admin Central — Fase 2: Usuários + Simulados Analítica

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar Central de Usuários (lista + detalhe + gestão completa) e Simulados Analítica (lista aprimorada + drill-down por questão) sobre o shell da Fase 1.

**Architecture:** 8 novas RPCs SECURITY DEFINER + 1 Edge Function para deleção de conta. Frontend em React Query com hooks dedicados por módulo. Dois novos módulos de página (`/admin/usuarios` e `/admin/simulados/:id/analytics`). CRUD existente de simulados não é tocado.

**Tech Stack:** React 18, React Router 6, TanStack Query 5, Supabase (RPCs plpgsql + Edge Function Deno), Tailwind CSS 3.4, shadcn/ui, Lucide React, Vitest 3.

---

> **Nota crítica:** `attempt_status` enum = `in_progress | submitted | expired | offline_pending`. Usar `status IN ('submitted', 'expired')` para tentativas finalizadas. Campo de tempo: `attempts.finished_at` (não `submitted_at`). Nomes reais: `questions.text`, `questions.question_number`.

---

## Mapa de arquivos

| Arquivo | Ação |
|---------|------|
| `supabase/migrations/20260405230000_admin_phase2_rpcs.sql` | Criar — 5 RPCs leitura + 3 RPCs ação |
| `supabase/functions/admin-delete-user/index.ts` | Criar — Edge Function deleção de conta |
| `src/admin/types.ts` | Modificar — +5 interfaces |
| `src/admin/services/adminApi.ts` | Modificar — +9 métodos |
| `src/admin/hooks/useAdminUsuarios.ts` | Criar — hooks React Query para usuários |
| `src/admin/hooks/useAdminSimuladosAnalytics.ts` | Criar — hooks React Query para analytics |
| `src/admin/__tests__/AdminUsuarios.test.tsx` | Criar — testes da lista de usuários |
| `src/admin/pages/AdminUsuarios.tsx` | Criar — substitui stub |
| `src/admin/__tests__/AdminUsuarioDetail.test.tsx` | Criar — testes do detalhe |
| `src/admin/pages/AdminUsuarioDetail.tsx` | Criar — página de detalhe + ações |
| `src/admin/pages/AdminSimuladoAnalytics.tsx` | Criar — drill-down analítico |
| `src/admin/pages/AdminSimulados.tsx` | Modificar — +colunas analíticas + botão 📊 |
| `src/App.tsx` | Modificar — +2 rotas lazy |

---

## Task 1: Tipos

**Files:**
- Modify: `src/admin/types.ts`

- [ ] **Adicionar as 5 novas interfaces ao final do arquivo**

```typescript
// Adicionar ao final de src/admin/types.ts

export interface UserListRow {
  user_id: string
  full_name: string | null
  email: string
  avatar_url: string | null
  segment: 'guest' | 'standard' | 'pro'
  specialty: string | null
  created_at: string
  avg_score: number
  total_attempts: number
  total_count: number
}

export interface UserDetail {
  user_id: string
  full_name: string | null
  email: string
  avatar_url: string | null
  segment: 'guest' | 'standard' | 'pro'
  created_at: string
  last_sign_in_at: string | null
  specialty: string | null
  target_institutions: string[] | null
  avg_score: number
  best_score: number
  last_score: number
  total_attempts: number
  last_finished_at: string | null
  is_admin: boolean
}

export interface UserAttemptRow {
  attempt_id: string
  simulado_id: string
  sequence_number: number
  simulado_title: string
  created_at: string
  status: string
  score_percentage: number | null
  ranking_position: number
}

export interface SimuladoDetailStats {
  simulado_id: string
  sequence_number: number
  title: string
  participants: number
  completion_rate: number
  avg_score: number
  abandonment_rate: number
  avg_time_minutes: number
}

export interface SimuladoQuestionStat {
  question_number: number
  text: string
  correct_rate: number
  discrimination_index: number
  most_common_wrong_label: string | null
  most_common_wrong_pct: number | null
}
```

- [ ] **Commit**

```bash
git add src/admin/types.ts
git commit -m "feat(admin): add Phase 2 domain types (users + question stats)"
```

---

## Task 2: Migration — 8 RPCs

**Files:**
- Create: `supabase/migrations/20260405230000_admin_phase2_rpcs.sql`

- [ ] **Criar o arquivo de migration**

```sql
-- =====================================================================
-- Admin Phase 2 RPCs — Usuários + Simulados Analítica
-- Todas as funções são SECURITY DEFINER com verificação de role admin.
-- =====================================================================

-- ─── 1. admin_list_users ──────────────────────────────────────────────
create or replace function admin_list_users(
  p_search  text    default '',
  p_segment text    default 'all',
  p_limit   int     default 25,
  p_offset  int     default 0
)
returns table (
  user_id        uuid,
  full_name      text,
  email          text,
  avatar_url     text,
  segment        text,
  specialty      text,
  created_at     timestamptz,
  avg_score      numeric,
  total_attempts bigint,
  total_count    bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from user_roles where user_id = auth.uid() and role = 'admin'
  ) then
    raise exception 'unauthorized' using errcode = 'P0003';
  end if;

  return query
  select
    p.id                                    as user_id,
    p.full_name::text,
    u.email::text,
    p.avatar_url::text,
    p.segment::text,
    op.specialty::text,
    p.created_at,
    coalesce(ps.avg_score, 0)              as avg_score,
    coalesce(ps.total_attempts, 0)::bigint as total_attempts,
    count(*) over ()                        as total_count
  from profiles p
  join auth.users u on u.id = p.id
  left join onboarding_profiles op on op.user_id = p.id
  left join user_performance_summary ps on ps.user_id = p.id
  where (
    p_search = ''
    or p.full_name ilike '%' || p_search || '%'
    or u.email ilike '%' || p_search || '%'
  )
  and (p_segment = 'all' or p.segment::text = p_segment)
  order by p.created_at desc
  limit p_limit offset p_offset;
end;
$$;

grant execute on function admin_list_users(text, text, int, int) to authenticated;

-- ─── 2. admin_get_user ────────────────────────────────────────────────
create or replace function admin_get_user(p_user_id uuid)
returns table (
  user_id           uuid,
  full_name         text,
  email             text,
  avatar_url        text,
  segment           text,
  created_at        timestamptz,
  last_sign_in_at   timestamptz,
  specialty         text,
  target_institutions text[],
  avg_score         numeric,
  best_score        numeric,
  last_score        numeric,
  total_attempts    bigint,
  last_finished_at  timestamptz,
  is_admin          boolean
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from user_roles where user_id = auth.uid() and role = 'admin'
  ) then
    raise exception 'unauthorized' using errcode = 'P0003';
  end if;

  return query
  select
    p.id                                           as user_id,
    p.full_name::text,
    u.email::text,
    p.avatar_url::text,
    p.segment::text,
    p.created_at,
    u.last_sign_in_at,
    op.specialty::text,
    op.target_institutions,
    coalesce(ps.avg_score, 0)                     as avg_score,
    coalesce(ps.best_score, 0)                    as best_score,
    coalesce(ps.last_score, 0)                    as last_score,
    coalesce(ps.total_attempts, 0)::bigint        as total_attempts,
    ps.last_finished_at,
    exists(
      select 1 from user_roles ur2
      where ur2.user_id = p.id and ur2.role = 'admin'
    )                                              as is_admin
  from profiles p
  join auth.users u on u.id = p.id
  left join onboarding_profiles op on op.user_id = p.id
  left join user_performance_summary ps on ps.user_id = p.id
  where p.id = p_user_id;
end;
$$;

grant execute on function admin_get_user(uuid) to authenticated;

-- ─── 3. admin_get_user_attempts ───────────────────────────────────────
create or replace function admin_get_user_attempts(
  p_user_id uuid,
  p_limit   int default 10
)
returns table (
  attempt_id       uuid,
  simulado_id      uuid,
  sequence_number  int,
  simulado_title   text,
  created_at       timestamptz,
  status           text,
  score_percentage numeric,
  ranking_position bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from user_roles where user_id = auth.uid() and role = 'admin'
  ) then
    raise exception 'unauthorized' using errcode = 'P0003';
  end if;

  return query
  select
    a.id                                   as attempt_id,
    a.simulado_id,
    s.sequence_number,
    s.title::text                          as simulado_title,
    a.created_at,
    a.status::text,
    uph.score_percentage,
    coalesce(
      (
        select count(*) + 1
        from user_performance_history uph2
        where uph2.simulado_id = a.simulado_id
          and uph2.is_within_window = true
          and uph2.score_percentage > coalesce(uph.score_percentage, -1)
      ),
      0
    )::bigint                              as ranking_position
  from attempts a
  join simulados s on s.id = a.simulado_id
  left join user_performance_history uph on uph.attempt_id = a.id
  where a.user_id = p_user_id
  order by a.created_at desc
  limit p_limit;
end;
$$;

grant execute on function admin_get_user_attempts(uuid, int) to authenticated;

-- ─── 4. admin_simulado_detail_stats ──────────────────────────────────
create or replace function admin_simulado_detail_stats(p_simulado_id uuid)
returns table (
  simulado_id      uuid,
  sequence_number  int,
  title            text,
  participants     bigint,
  completion_rate  numeric,
  avg_score        numeric,
  abandonment_rate numeric,
  avg_time_minutes numeric
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from user_roles where user_id = auth.uid() and role = 'admin'
  ) then
    raise exception 'unauthorized' using errcode = 'P0003';
  end if;

  return query
  select
    s.id                                                as simulado_id,
    s.sequence_number,
    s.title::text,
    count(*)::bigint                                    as participants,
    coalesce(round(
      count(*) filter (where a.status in ('submitted', 'expired'))::numeric
      / nullif(count(*), 0) * 100, 1), 0)              as completion_rate,
    coalesce(round((
      select avg(uph.score_percentage)
      from user_performance_history uph
      join attempts a2 on a2.id = uph.attempt_id
      where a2.simulado_id = p_simulado_id
    )::numeric, 1), 0)                                  as avg_score,
    coalesce(round(
      count(*) filter (where a.status = 'in_progress')::numeric
      / nullif(count(*), 0) * 100, 1), 0)              as abandonment_rate,
    coalesce(round(
      avg(
        extract(epoch from (a.finished_at - a.started_at)) / 60.0
      ) filter (
        where a.status in ('submitted', 'expired')
          and a.finished_at is not null
      )::numeric, 1), 0)                                as avg_time_minutes
  from simulados s
  left join attempts a on a.simulado_id = s.id
  where s.id = p_simulado_id
  group by s.id, s.sequence_number, s.title;
end;
$$;

grant execute on function admin_simulado_detail_stats(uuid) to authenticated;

-- ─── 5. admin_simulado_question_stats ────────────────────────────────
create or replace function admin_simulado_question_stats(p_simulado_id uuid)
returns table (
  question_number          int,
  text                     text,
  correct_rate             numeric,
  discrimination_index     numeric,
  most_common_wrong_label  text,
  most_common_wrong_pct    numeric
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from user_roles where user_id = auth.uid() and role = 'admin'
  ) then
    raise exception 'unauthorized' using errcode = 'P0003';
  end if;

  return query
  with scored_attempts as (
    select a.id as attempt_id, uph.score_percentage
    from attempts a
    join user_performance_history uph on uph.attempt_id = a.id
    where a.simulado_id = p_simulado_id
      and a.status in ('submitted', 'expired')
  ),
  percentiles as (
    select
      percentile_cont(0.73) within group (order by score_percentage) as p73,
      percentile_cont(0.27) within group (order by score_percentage) as p27
    from scored_attempts
  ),
  question_stats as (
    select
      aqr.question_id,
      round(avg(case when aqr.is_correct then 1.0 else 0.0 end) * 100, 1) as correct_rate,
      round(
        (
          avg(case when sa.score_percentage >= pe.p73 and aqr.is_correct then 1.0
                   when sa.score_percentage >= pe.p73 then 0.0
                   else null end)
          -
          avg(case when sa.score_percentage <= pe.p27 and aqr.is_correct then 1.0
                   when sa.score_percentage <= pe.p27 then 0.0
                   else null end)
        ) * 100, 1
      ) as discrimination_index
    from attempt_question_results aqr
    join scored_attempts sa on sa.attempt_id = aqr.attempt_id
    cross join percentiles pe
    where aqr.was_answered = true
    group by aqr.question_id
  ),
  wrong_answers as (
    select distinct on (aqr.question_id)
      aqr.question_id,
      qo.label::text as most_common_wrong_label,
      round(
        count(*)::numeric
        / nullif(
            (select count(*) from attempt_question_results aqr2
             where aqr2.question_id = aqr.question_id and aqr2.was_answered = true),
            0
          ) * 100, 1
      ) as most_common_wrong_pct
    from attempt_question_results aqr
    join question_options qo on qo.id = aqr.selected_option_id
    join scored_attempts sa on sa.attempt_id = aqr.attempt_id
    where aqr.is_correct = false
      and aqr.was_answered = true
      and qo.is_correct = false
    group by aqr.question_id, qo.label
    order by aqr.question_id, count(*) desc
  )
  select
    q.question_number,
    q.text::text,
    coalesce(qs.correct_rate, 0)            as correct_rate,
    coalesce(qs.discrimination_index, 0)    as discrimination_index,
    wa.most_common_wrong_label,
    wa.most_common_wrong_pct
  from questions q
  join question_stats qs on qs.question_id = q.id
  left join wrong_answers wa on wa.question_id = q.id
  where q.simulado_id = p_simulado_id
  order by qs.correct_rate asc;
end;
$$;

grant execute on function admin_simulado_question_stats(uuid) to authenticated;

-- ─── 6. admin_set_user_segment ────────────────────────────────────────
create or replace function admin_set_user_segment(
  p_user_id uuid,
  p_segment text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from user_roles where user_id = auth.uid() and role = 'admin'
  ) then
    raise exception 'unauthorized' using errcode = 'P0003';
  end if;

  update profiles
  set segment = p_segment::user_segment
  where id = p_user_id;
end;
$$;

grant execute on function admin_set_user_segment(uuid, text) to authenticated;

-- ─── 7. admin_set_user_role ──────────────────────────────────────────
create or replace function admin_set_user_role(
  p_user_id uuid,
  p_role    text,
  p_grant   boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from user_roles where user_id = auth.uid() and role = 'admin'
  ) then
    raise exception 'unauthorized' using errcode = 'P0003';
  end if;

  if p_grant then
    insert into user_roles (user_id, role)
    values (p_user_id, p_role)
    on conflict do nothing;
  else
    delete from user_roles
    where user_id = p_user_id and role = p_role;
  end if;
end;
$$;

grant execute on function admin_set_user_role(uuid, text, boolean) to authenticated;

-- ─── 8. admin_reset_user_onboarding ──────────────────────────────────
create or replace function admin_reset_user_onboarding(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from user_roles where user_id = auth.uid() and role = 'admin'
  ) then
    raise exception 'unauthorized' using errcode = 'P0003';
  end if;

  delete from onboarding_profiles where user_id = p_user_id;
end;
$$;

grant execute on function admin_reset_user_onboarding(uuid) to authenticated;
```

- [ ] **Commit**

```bash
git add supabase/migrations/20260405230000_admin_phase2_rpcs.sql
git commit -m "feat(admin): add Phase 2 RPCs — user management + simulado question stats"
```

---

## Task 3: Edge Function — admin-delete-user

**Files:**
- Create: `supabase/functions/admin-delete-user/index.ts`

- [ ] **Criar a Edge Function**

```typescript
// supabase/functions/admin-delete-user/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verificar autenticação do chamador
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cliente com a chave anon para verificar quem está chamando
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: caller }, error: authError } = await callerClient.auth.getUser();
    if (authError || !caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verificar se o chamador é admin
    const { data: roleRow } = await callerClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extrair user_id do body
    const { user_id } = await req.json();
    if (!user_id) {
      return new Response(JSON.stringify({ error: "Missing user_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Não permitir auto-deleção
    if (user_id === caller.id) {
      return new Response(JSON.stringify({ error: "Cannot delete your own account" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Deletar com service_role
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(user_id);

    if (deleteError) {
      return new Response(JSON.stringify({ error: deleteError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
```

- [ ] **Commit**

```bash
git add supabase/functions/admin-delete-user/index.ts
git commit -m "feat(admin): add admin-delete-user Edge Function"
```

---

## Task 4: adminApi — 9 novos métodos

**Files:**
- Modify: `src/admin/services/adminApi.ts`

- [ ] **Adicionar os 9 métodos ao objeto `adminApi` (antes do fechamento `}`)**

```typescript
  // ─── Usuários ───
  async listUsers(
    search = '',
    segment = 'all',
    limit = 25,
    offset = 0
  ): Promise<UserListRow[]> {
    const { data, error } = await supabase.rpc('admin_list_users', {
      p_search: search,
      p_segment: segment,
      p_limit: limit,
      p_offset: offset,
    })
    if (error) throw error
    return (data as any[]).map(r => ({
      user_id: r.user_id as string,
      full_name: r.full_name as string | null,
      email: r.email as string,
      avatar_url: r.avatar_url as string | null,
      segment: r.segment as 'guest' | 'standard' | 'pro',
      specialty: r.specialty as string | null,
      created_at: r.created_at as string,
      avg_score: Number(r.avg_score),
      total_attempts: Number(r.total_attempts),
      total_count: Number(r.total_count),
    }))
  },

  async getUser(userId: string): Promise<UserDetail> {
    const { data, error } = await supabase.rpc('admin_get_user', { p_user_id: userId })
    if (error) throw error
    const r = (data as any[])[0]
    return {
      user_id: r.user_id as string,
      full_name: r.full_name as string | null,
      email: r.email as string,
      avatar_url: r.avatar_url as string | null,
      segment: r.segment as 'guest' | 'standard' | 'pro',
      created_at: r.created_at as string,
      last_sign_in_at: r.last_sign_in_at as string | null,
      specialty: r.specialty as string | null,
      target_institutions: r.target_institutions as string[] | null,
      avg_score: Number(r.avg_score),
      best_score: Number(r.best_score),
      last_score: Number(r.last_score),
      total_attempts: Number(r.total_attempts),
      last_finished_at: r.last_finished_at as string | null,
      is_admin: Boolean(r.is_admin),
    }
  },

  async getUserAttempts(userId: string, limit = 10): Promise<UserAttemptRow[]> {
    const { data, error } = await supabase.rpc('admin_get_user_attempts', {
      p_user_id: userId,
      p_limit: limit,
    })
    if (error) throw error
    return (data as any[]).map(r => ({
      attempt_id: r.attempt_id as string,
      simulado_id: r.simulado_id as string,
      sequence_number: Number(r.sequence_number),
      simulado_title: r.simulado_title as string,
      created_at: r.created_at as string,
      status: r.status as string,
      score_percentage: r.score_percentage != null ? Number(r.score_percentage) : null,
      ranking_position: Number(r.ranking_position),
    }))
  },

  async setUserSegment(userId: string, segment: 'guest' | 'standard' | 'pro'): Promise<void> {
    const { error } = await supabase.rpc('admin_set_user_segment', {
      p_user_id: userId,
      p_segment: segment,
    })
    if (error) throw error
  },

  async setUserRole(userId: string, role: string, grant: boolean): Promise<void> {
    const { error } = await supabase.rpc('admin_set_user_role', {
      p_user_id: userId,
      p_role: role,
      p_grant: grant,
    })
    if (error) throw error
  },

  async resetUserOnboarding(userId: string): Promise<void> {
    const { error } = await supabase.rpc('admin_reset_user_onboarding', { p_user_id: userId })
    if (error) throw error
  },

  async deleteUser(userId: string): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    if (!token) throw new Error('Not authenticated')

    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-delete-user`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ user_id: userId }),
      }
    )
    const json = await res.json()
    if (!res.ok) throw new Error(json.error ?? 'Delete failed')
  },

  // ─── Simulados Analytics ───
  async getSimuladoDetailStats(simuladoId: string): Promise<SimuladoDetailStats> {
    const { data, error } = await supabase.rpc('admin_simulado_detail_stats', {
      p_simulado_id: simuladoId,
    })
    if (error) throw error
    const r = (data as any[])[0]
    return {
      simulado_id: r.simulado_id as string,
      sequence_number: Number(r.sequence_number),
      title: r.title as string,
      participants: Number(r.participants),
      completion_rate: Number(r.completion_rate),
      avg_score: Number(r.avg_score),
      abandonment_rate: Number(r.abandonment_rate),
      avg_time_minutes: Number(r.avg_time_minutes),
    }
  },

  async getSimuladoQuestionStats(simuladoId: string): Promise<SimuladoQuestionStat[]> {
    const { data, error } = await supabase.rpc('admin_simulado_question_stats', {
      p_simulado_id: simuladoId,
    })
    if (error) throw error
    return (data as any[]).map(r => ({
      question_number: Number(r.question_number),
      text: r.text as string,
      correct_rate: Number(r.correct_rate),
      discrimination_index: Number(r.discrimination_index),
      most_common_wrong_label: r.most_common_wrong_label as string | null,
      most_common_wrong_pct: r.most_common_wrong_pct != null ? Number(r.most_common_wrong_pct) : null,
    }))
  },
```

- [ ] **Adicionar os imports de tipos novos no topo do arquivo** (logo após o import existente de tipos)

```typescript
import type {
  DashboardKpis,
  TimeseriesRow,
  FunnelStep,
  SimuladoEngagementRow,
  LiveSignals,
  UserListRow,
  UserDetail,
  UserAttemptRow,
  SimuladoDetailStats,
  SimuladoQuestionStat,
} from '@/admin/types'
```

- [ ] **Commit**

```bash
git add src/admin/services/adminApi.ts
git commit -m "feat(admin): add 9 Phase 2 methods to adminApi"
```

---

## Task 5: useAdminUsuarios hooks

**Files:**
- Create: `src/admin/hooks/useAdminUsuarios.ts`

- [ ] **Criar o arquivo de hooks**

```typescript
// src/admin/hooks/useAdminUsuarios.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '@/admin/services/adminApi'

export function useAdminUserList(search: string, segment: string, page: number) {
  return useQuery({
    queryKey: ['admin', 'users', search, segment, page],
    queryFn: () => adminApi.listUsers(search, segment, 25, (page - 1) * 25),
    staleTime: 2 * 60 * 1000,
    placeholderData: (prev) => prev,
  })
}

export function useAdminUser(userId: string) {
  return useQuery({
    queryKey: ['admin', 'user', userId],
    queryFn: () => adminApi.getUser(userId),
    staleTime: 2 * 60 * 1000,
    enabled: !!userId,
  })
}

export function useAdminUserAttempts(userId: string) {
  return useQuery({
    queryKey: ['admin', 'user-attempts', userId],
    queryFn: () => adminApi.getUserAttempts(userId, 10),
    staleTime: 5 * 60 * 1000,
    enabled: !!userId,
  })
}

export function useAdminSetUserSegment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, segment }: { userId: string; segment: 'guest' | 'standard' | 'pro' }) =>
      adminApi.setUserSegment(userId, segment),
    onSuccess: (_data, { userId }) => {
      qc.invalidateQueries({ queryKey: ['admin', 'user', userId] })
      qc.invalidateQueries({ queryKey: ['admin', 'users'] })
    },
  })
}

export function useAdminSetUserRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, role, grant }: { userId: string; role: string; grant: boolean }) =>
      adminApi.setUserRole(userId, role, grant),
    onSuccess: (_data, { userId }) => {
      qc.invalidateQueries({ queryKey: ['admin', 'user', userId] })
    },
  })
}

export function useAdminResetUserOnboarding() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (userId: string) => adminApi.resetUserOnboarding(userId),
    onSuccess: (_data, userId) => {
      qc.invalidateQueries({ queryKey: ['admin', 'user', userId] })
    },
  })
}

export function useAdminDeleteUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (userId: string) => adminApi.deleteUser(userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'users'] })
    },
  })
}
```

- [ ] **Commit**

```bash
git add src/admin/hooks/useAdminUsuarios.ts
git commit -m "feat(admin): add useAdminUsuarios React Query hooks"
```

---

## Task 6: useAdminSimuladosAnalytics hooks

**Files:**
- Create: `src/admin/hooks/useAdminSimuladosAnalytics.ts`

- [ ] **Criar o arquivo de hooks**

```typescript
// src/admin/hooks/useAdminSimuladosAnalytics.ts
import { useQuery } from '@tanstack/react-query'
import { adminApi } from '@/admin/services/adminApi'

export function useAdminSimuladoDetailStats(simuladoId: string) {
  return useQuery({
    queryKey: ['admin', 'simulado-detail-stats', simuladoId],
    queryFn: () => adminApi.getSimuladoDetailStats(simuladoId),
    staleTime: 5 * 60 * 1000,
    enabled: !!simuladoId,
  })
}

export function useAdminSimuladoQuestionStats(simuladoId: string) {
  return useQuery({
    queryKey: ['admin', 'simulado-question-stats', simuladoId],
    queryFn: () => adminApi.getSimuladoQuestionStats(simuladoId),
    staleTime: 5 * 60 * 1000,
    enabled: !!simuladoId,
  })
}
```

- [ ] **Commit**

```bash
git add src/admin/hooks/useAdminSimuladosAnalytics.ts
git commit -m "feat(admin): add useAdminSimuladosAnalytics React Query hooks"
```

---

## Task 7: AdminUsuarios — TDD

**Files:**
- Create: `src/admin/__tests__/AdminUsuarios.test.tsx`
- Create: `src/admin/pages/AdminUsuarios.tsx`

- [ ] **Escrever os testes primeiro**

```typescript
// src/admin/__tests__/AdminUsuarios.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('@/admin/hooks/useAdminUsuarios')
import { useAdminUserList } from '@/admin/hooks/useAdminUsuarios'

const mockUsers = [
  {
    user_id: 'u1', full_name: 'Felipe Matos', email: 'felipe@sanar.com',
    avatar_url: null, segment: 'pro' as const, specialty: 'Clínica Médica',
    created_at: '2026-03-12T10:00:00Z', avg_score: 74.2, total_attempts: 8, total_count: 2,
  },
  {
    user_id: 'u2', full_name: 'Ana Silva', email: 'ana@gmail.com',
    avatar_url: null, segment: 'standard' as const, specialty: 'Pediatria',
    created_at: '2026-03-28T10:00:00Z', avg_score: 61.8, total_attempts: 3, total_count: 2,
  },
]

function renderList() {
  return render(
    <MemoryRouter>
      <AdminUsuarios />
    </MemoryRouter>
  )
}

import AdminUsuarios from '@/admin/pages/AdminUsuarios'

describe('AdminUsuarios', () => {
  beforeEach(() => {
    vi.mocked(useAdminUserList).mockReturnValue({
      data: mockUsers, isLoading: false, isError: false,
    } as any)
  })

  it('renders user names and emails', () => {
    renderList()
    expect(screen.getByText('Felipe Matos')).toBeInTheDocument()
    expect(screen.getByText('felipe@sanar.com')).toBeInTheDocument()
    expect(screen.getByText('Ana Silva')).toBeInTheDocument()
  })

  it('shows segment badges', () => {
    renderList()
    expect(screen.getByText('PRO')).toBeInTheDocument()
    expect(screen.getByText('Standard')).toBeInTheDocument()
  })

  it('shows loading skeleton when isLoading', () => {
    vi.mocked(useAdminUserList).mockReturnValue({
      data: undefined, isLoading: true, isError: false,
    } as any)
    const { container } = renderList()
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument()
  })

  it('filter pills call hook with correct segment', () => {
    renderList()
    fireEvent.click(screen.getByRole('button', { name: 'PRO' }))
    expect(vi.mocked(useAdminUserList)).toHaveBeenCalledWith(
      expect.anything(), 'pro', expect.anything()
    )
  })
})
```

- [ ] **Rodar o teste para confirmar que falha**

```bash
cd "C:\Users\Felipe Souza\Documents\enamed-arena"
npm run test -- src/admin/__tests__/AdminUsuarios.test.tsx --run
```

Esperado: FAIL — `AdminUsuarios` não existe.

- [ ] **Criar o componente**

```typescript
// src/admin/pages/AdminUsuarios.tsx
import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useAdminUserList } from '@/admin/hooks/useAdminUsuarios'
import type { UserListRow } from '@/admin/types'

const SEGMENTS = [
  { label: 'Todos', value: 'all' },
  { label: 'Guest', value: 'guest' },
  { label: 'Standard', value: 'standard' },
  { label: 'PRO', value: 'pro' },
] as const

const SEGMENT_LABELS: Record<string, string> = {
  pro: 'PRO', standard: 'Standard', guest: 'Guest',
}

const SEGMENT_CLASSES: Record<string, string> = {
  pro: 'bg-primary/10 text-primary border border-primary/20',
  standard: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
  guest: 'bg-muted text-muted-foreground border border-border',
}

function getInitials(name: string | null): string {
  if (!name) return '?'
  return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useState(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  })
  return debounced
}

export default function AdminUsuarios() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [segment, setSegment] = useState('all')
  const [page, setPage] = useState(1)
  const debouncedSearch = useDebounce(search, 300)

  const { data, isLoading, isError } = useAdminUserList(debouncedSearch, segment, page)
  const users = data ?? []
  const totalCount = users[0]?.total_count ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / 25))

  const handleSegment = useCallback((val: string) => {
    setSegment(val)
    setPage(1)
  }, [])

  const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value)
    setPage(1)
  }, [])

  if (isLoading) {
    return (
      <div className="space-y-3 animate-pulse">
        <div className="h-8 bg-muted rounded w-1/3" />
        <div className="h-10 bg-muted rounded" />
        {[1,2,3,4,5].map(i => (
          <div key={i} className="h-12 bg-muted/60 rounded" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4 max-w-[1400px]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-heading-1 text-foreground">Usuários</h1>
          <p className="text-caption text-muted-foreground">{totalCount.toLocaleString('pt-BR')} cadastrados</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <input
          type="text"
          value={search}
          onChange={handleSearch}
          placeholder="Buscar por nome ou e-mail..."
          className="flex-1 min-w-[200px] bg-card border border-border rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
        {SEGMENTS.map(s => (
          <button
            key={s.value}
            onClick={() => handleSegment(s.value)}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
              segment === s.value
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-card text-muted-foreground border-border hover:text-foreground hover:bg-muted',
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      {isError && (
        <p className="text-xs text-destructive">Erro ao carregar usuários.</p>
      )}

      {/* Table */}
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <div className="grid text-[9px] font-bold text-muted-foreground/60 uppercase tracking-wide border-b border-border"
          style={{ gridTemplateColumns: '2fr 80px 120px 100px 120px 40px' }}>
          {['Usuário', 'Segmento', 'Especialidade', 'Cadastro', 'Média / Provas', ''].map(h => (
            <div key={h} className="px-4 py-2">{h}</div>
          ))}
        </div>

        {users.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            Nenhum usuário encontrado.
          </div>
        ) : (
          users.map((user: UserListRow) => (
            <div
              key={user.user_id}
              className="grid border-b border-border/40 last:border-0 hover:bg-muted/30 transition-colors items-center"
              style={{ gridTemplateColumns: '2fr 80px 120px 100px 120px 40px' }}
            >
              {/* Avatar + nome */}
              <div className="px-4 py-2.5 flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold shrink-0">
                  {getInitials(user.full_name)}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{user.full_name ?? '—'}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{user.email}</p>
                </div>
              </div>
              {/* Segmento */}
              <div className="px-4 py-2.5">
                <span className={cn('inline-flex px-2 py-0.5 rounded text-[10px] font-semibold', SEGMENT_CLASSES[user.segment])}>
                  {SEGMENT_LABELS[user.segment]}
                </span>
              </div>
              {/* Especialidade */}
              <div className="px-4 py-2.5 text-[11px] text-muted-foreground truncate">
                {user.specialty ?? '—'}
              </div>
              {/* Cadastro */}
              <div className="px-4 py-2.5 text-[10px] text-muted-foreground">
                {new Date(user.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
              </div>
              {/* Média / Provas */}
              <div className="px-4 py-2.5">
                <p className="text-xs font-semibold text-foreground">{user.avg_score.toFixed(1)}%</p>
                <p className="text-[10px] text-muted-foreground">{user.total_attempts} provas</p>
              </div>
              {/* Ação */}
              <div className="px-2 py-2.5">
                <button
                  onClick={() => navigate(`/admin/usuarios/${user.user_id}`)}
                  className="w-7 h-7 rounded flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors text-sm"
                  title="Ver detalhes"
                >
                  →
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {((page - 1) * 25) + 1}–{Math.min(page * 25, totalCount)} de {totalCount.toLocaleString('pt-BR')}
          </p>
          <div className="flex gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="w-7 h-7 rounded border border-border text-xs text-muted-foreground disabled:opacity-30 hover:bg-muted transition-colors"
            >‹</button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const p = Math.max(1, Math.min(page - 2, totalPages - 4)) + i
              return (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={cn(
                    'w-7 h-7 rounded border text-xs transition-colors',
                    page === p
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border text-muted-foreground hover:bg-muted',
                  )}
                >{p}</button>
              )
            })}
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="w-7 h-7 rounded border border-border text-xs text-muted-foreground disabled:opacity-30 hover:bg-muted transition-colors"
            >›</button>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Rodar o teste para confirmar que passa**

```bash
npm run test -- src/admin/__tests__/AdminUsuarios.test.tsx --run
```

Esperado: PASS (4 testes).

- [ ] **Commit**

```bash
git add src/admin/pages/AdminUsuarios.tsx src/admin/__tests__/AdminUsuarios.test.tsx
git commit -m "feat(admin): add AdminUsuarios list with search, filter, pagination (TDD)"
```

---

## Task 8: AdminUsuarioDetail — TDD

**Files:**
- Create: `src/admin/__tests__/AdminUsuarioDetail.test.tsx`
- Create: `src/admin/pages/AdminUsuarioDetail.tsx`

- [ ] **Escrever os testes primeiro**

```typescript
// src/admin/__tests__/AdminUsuarioDetail.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

vi.mock('@/admin/hooks/useAdminUsuarios')
vi.mock('@/admin/services/adminApi')

import { useAdminUser, useAdminUserAttempts } from '@/admin/hooks/useAdminUsuarios'
import { adminApi } from '@/admin/services/adminApi'

const mockUser = {
  user_id: 'u1',
  full_name: 'Felipe Matos',
  email: 'felipe@sanar.com',
  avatar_url: null,
  segment: 'pro' as const,
  created_at: '2026-03-12T10:00:00Z',
  last_sign_in_at: '2026-04-04T08:00:00Z',
  specialty: 'Clínica Médica',
  target_institutions: ['USP', 'UNIFESP'],
  avg_score: 74.2,
  best_score: 88.0,
  last_score: 71.5,
  total_attempts: 8,
  last_finished_at: '2026-04-04T12:00:00Z',
  is_admin: false,
}

const mockAttempts = [
  {
    attempt_id: 'a1', simulado_id: 's1', sequence_number: 12,
    simulado_title: 'ENAMED Abril 2026', created_at: '2026-04-04T10:00:00Z',
    status: 'submitted', score_percentage: 71.5, ranking_position: 23,
  },
]

function renderDetail(userId = 'u1') {
  return render(
    <MemoryRouter initialEntries={[`/admin/usuarios/${userId}`]}>
      <Routes>
        <Route path="/admin/usuarios/:id" element={<AdminUsuarioDetail />} />
      </Routes>
    </MemoryRouter>
  )
}

import AdminUsuarioDetail from '@/admin/pages/AdminUsuarioDetail'

describe('AdminUsuarioDetail', () => {
  beforeEach(() => {
    vi.mocked(useAdminUser).mockReturnValue({
      data: mockUser, isLoading: false, isError: false,
    } as any)
    vi.mocked(useAdminUserAttempts).mockReturnValue({
      data: mockAttempts, isLoading: false, isError: false,
    } as any)
    vi.mocked(adminApi.setUserSegment).mockResolvedValue(undefined)
    vi.mocked(adminApi.setUserRole).mockResolvedValue(undefined)
    vi.mocked(adminApi.resetUserOnboarding).mockResolvedValue(undefined)
  })

  it('renders user name, email and segment', () => {
    renderDetail()
    expect(screen.getByText('Felipe Matos')).toBeInTheDocument()
    expect(screen.getByText('felipe@sanar.com')).toBeInTheDocument()
    expect(screen.getByText('PRO')).toBeInTheDocument()
  })

  it('renders performance KPIs', () => {
    renderDetail()
    expect(screen.getByText('74.2%')).toBeInTheDocument()
    expect(screen.getByText('88.0%')).toBeInTheDocument()
    expect(screen.getByText('8')).toBeInTheDocument()
  })

  it('renders onboarding specialty and institutions', () => {
    renderDetail()
    expect(screen.getByText('Clínica Médica')).toBeInTheDocument()
    expect(screen.getByText('USP')).toBeInTheDocument()
    expect(screen.getByText('UNIFESP')).toBeInTheDocument()
  })

  it('renders attempt history', () => {
    renderDetail()
    expect(screen.getByText('ENAMED Abril 2026')).toBeInTheDocument()
    expect(screen.getByText('71.5%')).toBeInTheDocument()
    expect(screen.getByText('23º')).toBeInTheDocument()
  })

  it('shows delete confirmation modal before deleting', () => {
    renderDetail()
    fireEvent.click(screen.getByRole('button', { name: /excluir/i }))
    expect(screen.getByText(/confirmar exclusão/i)).toBeInTheDocument()
  })
})
```

- [ ] **Rodar o teste para confirmar que falha**

```bash
npm run test -- src/admin/__tests__/AdminUsuarioDetail.test.tsx --run
```

Esperado: FAIL — `AdminUsuarioDetail` não existe.

- [ ] **Criar o componente**

```typescript
// src/admin/pages/AdminUsuarioDetail.tsx
import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { toast } from '@/hooks/use-toast'
import {
  useAdminUser,
  useAdminUserAttempts,
  useAdminSetUserSegment,
  useAdminSetUserRole,
  useAdminResetUserOnboarding,
  useAdminDeleteUser,
} from '@/admin/hooks/useAdminUsuarios'
import { AdminStatCard } from '@/admin/components/ui/AdminStatCard'
import type { UserAttemptRow } from '@/admin/types'

function getInitials(name: string | null): string {
  if (!name) return '?'
  return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
}

const SEGMENT_CLASSES: Record<string, string> = {
  pro: 'bg-primary/10 text-primary border border-primary/20',
  standard: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
  guest: 'bg-muted text-muted-foreground border border-border',
}
const SEGMENT_LABELS: Record<string, string> = { pro: 'PRO', standard: 'Standard', guest: 'Guest' }

const STATUS_CLASSES: Record<string, string> = {
  submitted: 'bg-success/10 text-success border border-success/20',
  expired: 'bg-warning/10 text-warning border border-warning/20',
  in_progress: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
}
const STATUS_LABELS: Record<string, string> = {
  submitted: 'Concluído', expired: 'Expirado', in_progress: 'Em andamento',
}

export default function AdminUsuarioDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  const { data: user, isLoading } = useAdminUser(id!)
  const { data: attempts = [] } = useAdminUserAttempts(id!)
  const setSegment = useAdminSetUserSegment()
  const setRole = useAdminSetUserRole()
  const resetOnboarding = useAdminResetUserOnboarding()
  const deleteUser = useAdminDeleteUser()

  const handleSegmentChange = async (segment: 'guest' | 'standard' | 'pro') => {
    try {
      await setSegment.mutateAsync({ userId: id!, segment })
      toast({ title: 'Segmento atualizado' })
    } catch {
      toast({ title: 'Erro ao atualizar segmento', variant: 'destructive' })
    }
  }

  const handleRoleToggle = async () => {
    if (!user) return
    try {
      await setRole.mutateAsync({ userId: id!, role: 'admin', grant: !user.is_admin })
      toast({ title: user.is_admin ? 'Papel admin revogado' : 'Papel admin concedido' })
    } catch {
      toast({ title: 'Erro ao alterar papel', variant: 'destructive' })
    }
  }

  const handleResetOnboarding = async () => {
    try {
      await resetOnboarding.mutateAsync(id!)
      toast({ title: 'Onboarding resetado' })
    } catch {
      toast({ title: 'Erro ao resetar onboarding', variant: 'destructive' })
    }
  }

  const handleDelete = async () => {
    try {
      await deleteUser.mutateAsync(id!)
      toast({ title: 'Conta excluída' })
      navigate('/admin/usuarios')
    } catch {
      toast({ title: 'Erro ao excluir conta', variant: 'destructive' })
    }
  }

  const handleExportCsv = () => {
    if (!attempts.length) return
    const rows = [
      ['Simulado', 'Sequência', 'Data', 'Status', 'Nota (%)', 'Posição'],
      ...attempts.map((a: UserAttemptRow) => [
        a.simulado_title,
        a.sequence_number,
        new Date(a.created_at).toLocaleDateString('pt-BR'),
        a.status,
        a.score_percentage ?? '—',
        a.ranking_position,
      ]),
    ]
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `usuario-${id}-tentativas.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (isLoading || !user) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-muted rounded w-1/4" />
        <div className="grid grid-cols-[280px_1fr] gap-4">
          <div className="h-64 bg-muted rounded-lg" />
          <div className="h-64 bg-muted rounded-lg" />
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-[1200px]">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
        <Link to="/admin/usuarios" className="hover:text-foreground transition-colors">Usuários</Link>
        <span>›</span>
        <span className="text-foreground font-medium">{user.full_name ?? user.email}</span>
      </div>

      <div className="grid grid-cols-[280px_1fr] gap-4">

        {/* LEFT: Perfil + Ações */}
        <div className="space-y-3">
          {/* Perfil */}
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="w-14 h-14 rounded-xl bg-primary flex items-center justify-center text-primary-foreground text-2xl font-bold mb-3">
              {getInitials(user.full_name)}
            </div>
            <p className="text-base font-semibold text-foreground">{user.full_name ?? '—'}</p>
            <p className="text-xs text-muted-foreground mb-3">{user.email}</p>
            <span className={cn('inline-flex px-2 py-1 rounded text-xs font-semibold', SEGMENT_CLASSES[user.segment])}>
              {SEGMENT_LABELS[user.segment]}
            </span>

            <div className="border-t border-border mt-4 pt-4 mb-3">
              <p className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest mb-3">Performance</p>
              <div className="grid grid-cols-2 gap-1.5">
                <AdminStatCard label="Média geral" value={`${user.avg_score.toFixed(1)}%`} />
                <AdminStatCard label="Melhor nota" value={`${user.best_score.toFixed(1)}%`} />
                <AdminStatCard label="Provas feitas" value={user.total_attempts} />
                <AdminStatCard label="Última nota" value={`${user.last_score.toFixed(1)}%`} />
              </div>
            </div>

            <div className="border-t border-border pt-3 space-y-1.5">
              <p className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest mb-2">Cadastro</p>
              <div className="flex justify-between text-[10px]">
                <span className="text-muted-foreground">Cadastrado em</span>
                <span className="text-foreground">{new Date(user.created_at).toLocaleDateString('pt-BR')}</span>
              </div>
              {user.last_sign_in_at && (
                <div className="flex justify-between text-[10px]">
                  <span className="text-muted-foreground">Último acesso</span>
                  <span className="text-foreground">{new Date(user.last_sign_in_at).toLocaleDateString('pt-BR')}</span>
                </div>
              )}
              <div className="flex justify-between text-[10px]">
                <span className="text-muted-foreground">User ID</span>
                <span className="text-muted-foreground/60 font-mono text-[9px]">{user.user_id.slice(0, 8)}…</span>
              </div>
            </div>
          </div>

          {/* Ações */}
          <div className="bg-card border border-border rounded-lg p-4">
            <p className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest mb-3">Ações</p>

            {/* Alterar segmento */}
            <div className="flex items-start justify-between py-2.5 border-b border-border">
              <div>
                <p className="text-xs text-foreground">Segmento</p>
                <p className="text-[9px] text-muted-foreground">Alterar acesso do usuário</p>
              </div>
              <select
                value={user.segment}
                onChange={e => handleSegmentChange(e.target.value as any)}
                className="bg-card border border-border rounded text-[10px] text-primary px-2 py-1 cursor-pointer"
              >
                <option value="guest">Guest</option>
                <option value="standard">Standard</option>
                <option value="pro">PRO</option>
              </select>
            </div>

            {/* Admin */}
            <div className="flex items-start justify-between py-2.5 border-b border-border">
              <div>
                <p className="text-xs text-foreground">Papel admin</p>
                <p className="text-[9px] text-muted-foreground">Acesso ao painel admin</p>
              </div>
              <button
                onClick={handleRoleToggle}
                className="text-[10px] px-2 py-1 rounded border border-warning/30 text-warning bg-warning/5 hover:bg-warning/10 transition-colors"
              >
                {user.is_admin ? 'Revogar' : 'Conceder'}
              </button>
            </div>

            {/* Reset onboarding */}
            <div className="flex items-start justify-between py-2.5 border-b border-border">
              <div>
                <p className="text-xs text-foreground">Reset onboarding</p>
                <p className="text-[9px] text-muted-foreground">Força reconfiguração de perfil</p>
              </div>
              <button
                onClick={handleResetOnboarding}
                className="text-[10px] px-2 py-1 rounded border border-border text-muted-foreground bg-card hover:bg-muted transition-colors"
              >
                Resetar
              </button>
            </div>

            {/* Exportar */}
            <div className="flex items-start justify-between py-2.5 border-b border-border">
              <div>
                <p className="text-xs text-foreground">Exportar dados</p>
                <p className="text-[9px] text-muted-foreground">CSV com tentativas</p>
              </div>
              <button
                onClick={handleExportCsv}
                className="text-[10px] px-2 py-1 rounded border border-border text-muted-foreground bg-card hover:bg-muted transition-colors"
              >
                📤 Exportar
              </button>
            </div>

            {/* Excluir */}
            <div className="flex items-start justify-between py-2.5">
              <div>
                <p className="text-xs text-foreground">Excluir conta</p>
                <p className="text-[9px] text-muted-foreground">Ação irreversível</p>
              </div>
              <button
                onClick={() => setShowDeleteModal(true)}
                className="text-[10px] px-2 py-1 rounded border border-destructive/30 text-destructive bg-destructive/5 hover:bg-destructive/10 transition-colors"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT: Onboarding + Histórico */}
        <div className="space-y-3">
          {/* Onboarding */}
          <div className="bg-card border border-border rounded-lg p-4">
            <p className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest mb-3">Onboarding</p>
            {user.specialty ? (
              <>
                <p className="text-[10px] text-muted-foreground uppercase mb-2">Especialidade alvo</p>
                <div className="flex flex-wrap gap-1.5 mb-4">
                  <span className="px-2 py-1 bg-primary/10 border border-primary/20 text-primary text-[10px] rounded">
                    {user.specialty}
                  </span>
                </div>
                {user.target_institutions?.length ? (
                  <>
                    <p className="text-[10px] text-muted-foreground uppercase mb-2">Instituições alvo</p>
                    <div className="flex flex-wrap gap-1.5">
                      {user.target_institutions.map(inst => (
                        <span key={inst} className="px-2 py-1 bg-card border border-border text-muted-foreground text-[10px] rounded">
                          {inst}
                        </span>
                      ))}
                    </div>
                  </>
                ) : null}
              </>
            ) : (
              <p className="text-xs text-muted-foreground">Onboarding não realizado.</p>
            )}
          </div>

          {/* Histórico de tentativas */}
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <p className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest">Histórico de tentativas</p>
              <span className="text-[9px] text-muted-foreground">últimas 10</span>
            </div>
            {attempts.length === 0 ? (
              <p className="px-4 py-6 text-xs text-muted-foreground text-center">Nenhuma tentativa encontrada.</p>
            ) : (
              <table className="w-full">
                <thead>
                  <tr>
                    {['Simulado', 'Data', 'Status', 'Nota', 'Posição'].map(h => (
                      <th key={h} className="px-4 py-2 text-[9px] font-bold text-muted-foreground/60 uppercase tracking-wide text-left border-b border-border">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {attempts.map((a: UserAttemptRow) => (
                    <tr key={a.attempt_id} className="border-b border-border/40 last:border-0 hover:bg-muted/20">
                      <td className="px-4 py-2.5 text-xs text-foreground">#{a.sequence_number} — {a.simulado_title}</td>
                      <td className="px-4 py-2.5 text-[10px] text-muted-foreground">
                        {new Date(a.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={cn('inline-flex px-1.5 py-0.5 rounded text-[9px] font-semibold', STATUS_CLASSES[a.status] ?? 'bg-muted text-muted-foreground border border-border')}>
                          {STATUS_LABELS[a.status] ?? a.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-xs font-semibold text-foreground">
                        {a.score_percentage != null ? `${a.score_percentage.toFixed(1)}%` : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">
                        {a.score_percentage != null ? `${a.ranking_position}º` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Modal de confirmação de exclusão */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl">
            <h3 className="text-sm font-semibold text-foreground mb-2">Confirmar exclusão</h3>
            <p className="text-xs text-muted-foreground mb-4">
              Tem certeza que deseja excluir a conta de <strong>{user.full_name ?? user.email}</strong>? Esta ação é irreversível.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 text-xs border border-border rounded-md text-muted-foreground hover:bg-muted transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteUser.isPending}
                className="px-4 py-2 text-xs bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90 disabled:opacity-50 transition-colors"
              >
                {deleteUser.isPending ? 'Excluindo...' : 'Excluir conta'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Rodar o teste para confirmar que passa**

```bash
npm run test -- src/admin/__tests__/AdminUsuarioDetail.test.tsx --run
```

Esperado: PASS (5 testes).

- [ ] **Commit**

```bash
git add src/admin/pages/AdminUsuarioDetail.tsx src/admin/__tests__/AdminUsuarioDetail.test.tsx
git commit -m "feat(admin): add AdminUsuarioDetail with full user management (TDD)"
```

---

## Task 9: AdminSimuladoAnalytics

**Files:**
- Create: `src/admin/pages/AdminSimuladoAnalytics.tsx`

- [ ] **Criar a página de analytics por simulado**

```typescript
// src/admin/pages/AdminSimuladoAnalytics.tsx
import { useParams, Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import {
  useAdminSimuladoDetailStats,
  useAdminSimuladoQuestionStats,
} from '@/admin/hooks/useAdminSimuladosAnalytics'
import { AdminStatCard } from '@/admin/components/ui/AdminStatCard'
import { AdminSectionHeader } from '@/admin/components/ui/AdminSectionHeader'
import type { SimuladoQuestionStat } from '@/admin/types'

function discriminationLabel(index: number): { label: string; cls: string } {
  if (index >= 30) return { label: 'Alta ↑', cls: 'text-success' }
  if (index >= 10) return { label: 'Média', cls: 'text-warning' }
  return { label: 'Baixa ↓', cls: 'text-destructive' }
}

export default function AdminSimuladoAnalytics() {
  const { id } = useParams<{ id: string }>()

  const { data: stats, isLoading: statsLoading } = useAdminSimuladoDetailStats(id!)
  const { data: questions = [], isLoading: qLoading } = useAdminSimuladoQuestionStats(id!)

  return (
    <div className="max-w-[1200px] space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/admin/simulados" className="hover:text-foreground transition-colors">Simulados</Link>
        <span>›</span>
        <span className="text-foreground font-medium">
          {stats ? `#${stats.sequence_number} — ${stats.title}` : 'Analytics'}
        </span>
        <Link to={`/admin/simulados/${id}`} className="ml-auto text-xs text-muted-foreground hover:text-foreground transition-colors">
          ← Editar simulado
        </Link>
      </div>

      {/* KPIs */}
      <section>
        <AdminSectionHeader title="Métricas gerais" />
        {statsLoading ? (
          <div className="grid grid-cols-5 gap-3">
            {[1,2,3,4,5].map(i => <AdminStatCard key={i} label="..." value="..." isLoading />)}
          </div>
        ) : stats ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <AdminStatCard label="Participantes" value={stats.participants.toLocaleString('pt-BR')} />
            <AdminStatCard label="Taxa de conclusão" value={`${stats.completion_rate.toFixed(1)}%`} />
            <AdminStatCard label="Média geral" value={`${stats.avg_score.toFixed(1)}%`} />
            <AdminStatCard label="Abandono" value={`${stats.abandonment_rate.toFixed(1)}%`} />
            <AdminStatCard label="Tempo médio" value={`${stats.avg_time_minutes.toFixed(0)} min`} />
          </div>
        ) : null}
      </section>

      {/* Por questão */}
      <section>
        <AdminSectionHeader title="Analytics por questão" hook={`${questions.length} questões`} />
        {qLoading ? (
          <div className="bg-card border border-border rounded-lg animate-pulse h-32" />
        ) : questions.length === 0 ? (
          <p className="text-xs text-muted-foreground">Sem dados suficientes para esta análise.</p>
        ) : (
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            {/* Header */}
            <div className="grid border-b border-border text-[9px] font-bold text-muted-foreground/60 uppercase tracking-wide"
              style={{ gridTemplateColumns: '40px 1fr 160px 100px 120px' }}>
              {['Q', 'Enunciado', 'Taxa de acerto', 'Discriminação', 'Erro mais comum'].map(h => (
                <div key={h} className="px-3 py-2">{h}</div>
              ))}
            </div>

            {questions.map((q: SimuladoQuestionStat) => {
              const barPct = Math.min(100, Math.max(0, q.correct_rate))
              const barColor = barPct >= 70 ? 'bg-success' : barPct >= 40 ? 'bg-warning' : 'bg-destructive'
              const disc = discriminationLabel(q.discrimination_index)

              return (
                <div
                  key={q.question_number}
                  className="grid border-b border-border/40 last:border-0 hover:bg-muted/20 items-center"
                  style={{ gridTemplateColumns: '40px 1fr 160px 100px 120px' }}
                >
                  <div className="px-3 py-2.5 text-xs font-bold text-muted-foreground">
                    Q{q.question_number}
                  </div>
                  <div className="px-3 py-2.5 text-[11px] text-foreground truncate max-w-xs" title={q.text}>
                    {q.text.length > 70 ? q.text.slice(0, 70) + '…' : q.text}
                  </div>
                  <div className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-muted rounded-full">
                        <div className={cn('h-1.5 rounded-full', barColor)} style={{ width: `${barPct}%` }} />
                      </div>
                      <span className="text-xs font-semibold text-foreground w-10 text-right">
                        {q.correct_rate.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <div className="px-3 py-2.5">
                    <span className={cn('text-[11px] font-semibold', disc.cls)}>{disc.label}</span>
                    <p className="text-[9px] text-muted-foreground">{q.discrimination_index.toFixed(1)}pp</p>
                  </div>
                  <div className="px-3 py-2.5">
                    {q.most_common_wrong_label ? (
                      <>
                        <span className="text-[10px] bg-muted/60 border border-border text-muted-foreground px-1.5 py-0.5 rounded">
                          Alt. {q.most_common_wrong_label}
                        </span>
                        <span className="text-[9px] text-muted-foreground ml-1">({q.most_common_wrong_pct?.toFixed(1)}%)</span>
                      </>
                    ) : (
                      <span className="text-[10px] text-muted-foreground/40">—</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
```

- [ ] **Commit**

```bash
git add src/admin/pages/AdminSimuladoAnalytics.tsx
git commit -m "feat(admin): add AdminSimuladoAnalytics drill-down page"
```

---

## Task 10: Aprimorar AdminSimulados

**Files:**
- Modify: `src/admin/pages/AdminSimulados.tsx`

- [ ] **Ler o arquivo atual para ter contexto antes de editar**

```bash
cat src/admin/pages/AdminSimulados.tsx
```

- [ ] **Adicionar import do `useAdminUserList` e do hook de analytics**

Adicionar logo após os imports existentes:

```typescript
import { useAdminSimuladoEngagementMap } from '@/admin/hooks/useAdminSimuladosAnalytics'
```

- [ ] **Criar o hook `useAdminSimuladoEngagementMap` em `useAdminSimuladosAnalytics.ts`**

Adicionar ao final de `src/admin/hooks/useAdminSimuladosAnalytics.ts`:

```typescript
import { adminApi } from '@/admin/services/adminApi'
import type { SimuladoEngagementRow } from '@/admin/types'

export function useAdminSimuladoEngagementMap() {
  return useQuery({
    queryKey: ['admin', 'simulado-engagement-map'],
    queryFn: async () => {
      const rows = await adminApi.getSimuladoEngagement(100)
      const map = new Map<string, SimuladoEngagementRow>()
      rows.forEach(r => map.set(r.simulado_id, r))
      return map
    },
    staleTime: 5 * 60 * 1000,
  })
}
```

- [ ] **Adicionar as colunas analíticas e o botão 📊 na tabela**

Localizar o `<TableHead>` existente e adicionar após as colunas existentes (antes do `<TableHead>` vazio de ações):

```typescript
<TableHead className="text-right">Participantes</TableHead>
<TableHead className="text-right">Conclusão</TableHead>
<TableHead className="text-right">Média</TableHead>
<TableHead className="text-right">Abandono</TableHead>
```

E nas linhas (`<TableRow>`), adicionar as células correspondentes antes da célula de ações:

```typescript
{/* Analytics columns — inserir antes das colunas de ações */}
{(() => {
  const eng = engagementMap?.get(s.id)
  if (!eng) return (
    <>
      <TableCell className="text-right text-muted-foreground/40 text-xs">—</TableCell>
      <TableCell className="text-right text-muted-foreground/40 text-xs">—</TableCell>
      <TableCell className="text-right text-muted-foreground/40 text-xs">—</TableCell>
      <TableCell className="text-right text-muted-foreground/40 text-xs">—</TableCell>
    </>
  )
  return (
    <>
      <TableCell className="text-right text-xs font-medium">{eng.participants.toLocaleString('pt-BR')}</TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1.5">
          <div className="w-12 h-1 bg-muted rounded-full overflow-hidden">
            <div className="h-1 bg-success rounded-full" style={{ width: `${Math.min(100, eng.completion_rate)}%` }} />
          </div>
          <span className="text-xs font-medium">{eng.completion_rate.toFixed(1)}%</span>
        </div>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1.5">
          <div className="w-12 h-1 bg-muted rounded-full overflow-hidden">
            <div className="h-1 bg-primary rounded-full" style={{ width: `${Math.min(100, eng.avg_score)}%` }} />
          </div>
          <span className="text-xs font-medium">{eng.avg_score.toFixed(1)}%</span>
        </div>
      </TableCell>
      <TableCell className="text-right text-xs font-medium">{eng.abandonment_rate.toFixed(1)}%</TableCell>
    </>
  )
})()}
```

- [ ] **Adicionar botão de analytics nas ações de cada simulado**

Localizar os botões de ação existentes (Editar, Upload, Deletar) e adicionar antes deles:

```typescript
<Button
  variant="ghost"
  size="sm"
  title="Analytics"
  disabled={!engagementMap?.get(s.id)?.participants}
  onClick={() => navigate(`/admin/simulados/${s.id}/analytics`)}
>
  📊
</Button>
```

- [ ] **Confirmar que o build compila**

```bash
npm run build 2>&1 | tail -5
```

Esperado: sem erros.

- [ ] **Commit**

```bash
git add src/admin/pages/AdminSimulados.tsx src/admin/hooks/useAdminSimuladosAnalytics.ts
git commit -m "feat(admin): add analytics columns and drill-down button to AdminSimulados"
```

---

## Task 11: Rotas em App.tsx + smoke test final

**Files:**
- Modify: `src/App.tsx`

- [ ] **Adicionar lazy imports após os imports de stubs existentes**

```typescript
// Adicionar após os imports de stubs de usuários/suporte:
const AdminUsuarioDetail  = lazy(() => import('./admin/pages/AdminUsuarioDetail'))
const AdminSimuladoAnalytics = lazy(() => import('./admin/pages/AdminSimuladoAnalytics'))
```

- [ ] **Substituir a rota do stub de usuários e adicionar a rota de detalhe**

Localizar a linha:
```typescript
<Route path="usuarios"   element={<Suspense fallback={<PageLoadingSkeleton />}><AdminUsuarios /></Suspense>} />
```

Substituir por:
```typescript
<Route path="usuarios"   element={<Suspense fallback={<PageLoadingSkeleton />}><AdminUsuarios /></Suspense>} />
<Route path="usuarios/:id" element={<Suspense fallback={<PageLoadingSkeleton />}><AdminUsuarioDetail /></Suspense>} />
<Route path="simulados/:id/analytics" element={<Suspense fallback={<PageLoadingSkeleton />}><AdminSimuladoAnalytics /></Suspense>} />
```

- [ ] **Confirmar build limpo**

```bash
npm run build 2>&1 | tail -10
```

Esperado: `✓ built in` sem erros de TypeScript.

- [ ] **Rodar todos os testes**

```bash
npm run test -- --run 2>&1 | tail -10
```

Esperado: todos os testes passando (incluindo os novos de AdminUsuarios e AdminUsuarioDetail).

- [ ] **Commit final**

```bash
git add src/App.tsx
git commit -m "$(cat <<'EOF'
feat(admin): complete Phase 2 — Central de Usuários + Simulados Analítica

- admin_list_users, admin_get_user, admin_get_user_attempts RPCs
- admin_simulado_detail_stats, admin_simulado_question_stats RPCs
- admin_set_user_segment, admin_set_user_role, admin_reset_user_onboarding RPCs
- admin-delete-user Edge Function (service_role)
- AdminUsuarios: lista com busca, filtro por segmento, paginação
- AdminUsuarioDetail: perfil + KPIs + ações + histórico de tentativas
- AdminSimuladoAnalytics: 5 KPIs + tabela por questão com discriminação
- AdminSimulados: +colunas analíticas + botão de drill-down

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```
