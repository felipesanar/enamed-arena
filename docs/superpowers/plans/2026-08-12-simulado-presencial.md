# Aplicação Presencial do Simulado 7 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aluno que faz o Simulado 7 no papel lê um QR na sala, informa nome + e-mail, transcreve o gabarito e vê nota + quebra por área na hora — com a tentativa marcada como `presencial` e sem nunca abrir sessão autenticada.

**Architecture:** Rota pública `/presencial/:codigo` → uma única Edge Function `presencial` (service role, `verify_jwt = false`) roteada por `action` → RPCs `SECURITY DEFINER` restritas a `service_role`. O cliente nunca recebe enunciado de questão, nunca recebe `user_id` e nunca ganha sessão Supabase: só um token HMAC de 2h com escopo de um gabarito.

**Tech Stack:** Postgres/Supabase (RLS + SECURITY DEFINER RPCs), Deno Edge Functions, React 18 + React Router 6, TanStack Query, Tailwind + shadcn/ui, Vitest 3 + Testing Library.

**Spec:** [docs/superpowers/specs/2026-08-12-simulado-presencial-design.md](../specs/2026-08-12-simulado-presencial-design.md)

## Global Constraints

- **Simulado 7:** `id = 6be18ec8-db68-482d-9417-281d66d13ff1`, `slug = simulado-7`. Janela de execução `2026-08-30 12:01Z → 2026-09-06 02:59Z`. `results_release_at = 2026-09-07 12:01Z`.
- **A aplicação presencial acontece dentro da janela de execução.** Nenhuma exceção de ranking é implementada.
- `attempts.attempt_type` CHECK final: `('online','offline','presencial')`. Status novo: `'presencial_pending'`.
- **Toda** RPC nova é `SECURITY DEFINER`, `SET search_path TO 'public'`, e termina com `REVOKE ALL ... FROM public, anon, authenticated;` + `GRANT EXECUTE ... TO service_role;` (exceto as de admin, que vão para `authenticated` e usam `admin_require`).
- Tabelas novas: RLS **habilitada, sem nenhuma policy**. Acesso só via `service_role` e RPC `SECURITY DEFINER`.
- RPCs de admin: primeiro statement é `PERFORM admin_require('<capability>')`. Capabilities existentes usadas: `content.manage` (sessões) e `attempts.manage` (fila de identidade).
- **Edge Functions:** todo import externo com pin completo `major.minor.patch` (`npm run check:edge-pins` falha o build caso contrário — ver `docs/INCIDENTE_2026_05_17.md`). Usar `npm:@supabase/supabase-js@2.49.4`, a mesma versão já pinada em `create-guest-account`.
- **Nunca** `console.log` no `src/`: usar `logger` de `@/lib/logger`. Dentro de Edge Functions, `console.log` é o padrão do projeto e está correto.
- Toasts via `@/hooks/use-toast` — o `sonner` **não está montado** em `App.tsx` e é no-op silencioso.
- Imports com alias `@/`, nunca caminho relativo longo.
- Todo texto de UI em **pt-BR**.
- O fluxo presencial **nunca** transmite `questions.text`, `question_options.text`, `explanation` nem `user_id` ao cliente.
- `npm run test`, `npm run typecheck` e `npm run lint` precisam passar ao fim de cada task.
- Cada task de banco registra uma entrada em `supabase/migrations-log.md` com o racional e o resultado do smoke, seguindo o formato das entradas existentes.

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `supabase/migrations/20260812100000_presencial_schema.sql` | CHECK do `attempt_type`, 3 tabelas novas, tabela de backup, RLS/grants |
| `supabase/migrations/20260812100100_finalize_for_user.sql` | `finalize_attempt_with_results_for_user` + wrapper |
| `supabase/migrations/20260812100200_score_presencial_answers.sql` | Correção agregada sem attempt |
| `supabase/migrations/20260812100300_presencial_attempt_rpcs.sql` | Criar/converter attempt + gravar e finalizar |
| `supabase/migrations/20260812100400_block_online_after_presencial.sql` | Patch no `create_attempt_guarded` |
| `supabase/migrations/20260812100500_link_presencial_submission.sql` | Vínculo tardio + bucket de rate limit |
| `supabase/migrations/20260812100600_presencial_admin_rpcs.sql` | RPCs de admin (sessões, fila, reatribuição) |
| `supabase/migrations/20260812100700_seed_presencial_s7.sql` | Sessão presencial do S7 |
| `supabase/functions/presencial/mask.ts` (+ `.test.ts`) | Mascaramento de e-mail — puro, testado |
| `supabase/functions/presencial/identity.ts` (+ `.test.ts`) | Normalização de nome e corte de candidatos — puro, testado |
| `supabase/functions/presencial/token.ts` (+ `.test.ts`) | HMAC sign/verify — puro (Web Crypto), testado |
| `supabase/functions/presencial/index.ts` | `Deno.serve`, CORS, rate limit, roteamento por `action` |
| `src/types/presencial.ts` | Tipos do domínio presencial |
| `src/services/presencialApi.ts` | Chamadas à Edge Function |
| `src/pages/PresencialPage.tsx` | Orquestra as 3 telas |
| `src/components/presencial/PresencialIdentifyStep.tsx` | Tela 1 |
| `src/components/presencial/PresencialCandidateCard.tsx` | Candidato mascarado + desempate |
| `src/components/presencial/PresencialResultStep.tsx` | Tela 3 |
| `src/components/AttemptModalityBadge.tsx` | Selo "Aplicação presencial" |
| `src/admin/pages/AdminPresencial.tsx` | Sessões + QR + fila de identidade |
| `src/admin/services/adminApi.ts` | Métodos novos de presencial |

---

## Fase 1 — Banco

### Task 1: Schema do presencial

**Files:**
- Create: `supabase/migrations/20260812100000_presencial_schema.sql`
- Modify: `supabase/migrations-log.md`

**Interfaces:**
- Consumes: nada.
- Produces: tabelas `public.presencial_sessions`, `public.presencial_submissions`, `public.presencial_duplicate_candidates`, `backup.presencial_superseded_answers`; valor `'presencial'` aceito em `attempts.attempt_type`.

- [ ] **Step 1: Escrever a migration**

```sql
-- Aplicação presencial: schema base.
-- attempt_type ganha 'presencial'; 3 tabelas novas (sala, submissão, duplicatas)
-- e a tabela de backup das respostas online supersedidas pela conversão.
-- RLS ligada e SEM policy: acesso só por service_role e RPC SECURITY DEFINER.

-- ─── attempts.attempt_type ────────────────────────────────────────────────────
ALTER TABLE public.attempts DROP CONSTRAINT IF EXISTS attempts_attempt_type_check;
ALTER TABLE public.attempts
  ADD CONSTRAINT attempts_attempt_type_check
  CHECK (attempt_type IN ('online', 'offline', 'presencial'));

-- ─── Backup das respostas supersedidas ────────────────────────────────────────
CREATE SCHEMA IF NOT EXISTS backup;

CREATE TABLE IF NOT EXISTS backup.presencial_superseded_answers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id      uuid NOT NULL,
  user_id         uuid NOT NULL,
  simulado_id     uuid NOT NULL,
  answers         jsonb NOT NULL,
  previous_status text,
  previous_score  numeric(5,2),
  superseded_at   timestamptz NOT NULL DEFAULT now()
);

-- ─── Sala presencial (o que o QR aponta) ──────────────────────────────────────
CREATE TABLE public.presencial_sessions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  simulado_id uuid NOT NULL REFERENCES public.simulados(id) ON DELETE CASCADE,
  code        text NOT NULL UNIQUE,
  label       text NOT NULL,
  opens_at    timestamptz NOT NULL,
  closes_at   timestamptz NOT NULL,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT presencial_sessions_window_ck CHECK (closes_at > opens_at),
  CONSTRAINT presencial_sessions_code_ck   CHECK (code ~ '^[a-z0-9-]{3,32}$')
);

-- ─── Submissão do evento (escrita SEMPRE, vinculada ou não) ───────────────────
CREATE TABLE public.presencial_submissions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id          uuid NOT NULL REFERENCES public.presencial_sessions(id),
  simulado_id         uuid NOT NULL REFERENCES public.simulados(id),
  declared_name       text NOT NULL,
  declared_email      text NOT NULL,
  identification_path text NOT NULL
    CHECK (identification_path IN ('email_direct','name_suggestion','new_account','unlinked')),
  answers             jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_correct       integer,
  score_percentage    numeric(5,2),
  linked_user_id      uuid REFERENCES auth.users(id),
  linked_attempt_id   uuid REFERENCES public.attempts(id),
  status              text NOT NULL DEFAULT 'unlinked'
    CHECK (status IN ('linked','unlinked')),
  ip_hash             text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  submitted_at        timestamptz,
  linked_at           timestamptz
);

-- Um envio presencial por conta por simulado. É esta trava que implementa
-- "1 envio por conta, irreversível" da spec.
CREATE UNIQUE INDEX presencial_submissions_one_per_user_simulado
  ON public.presencial_submissions (linked_user_id, simulado_id)
  WHERE linked_user_id IS NOT NULL;

CREATE INDEX presencial_submissions_pending_idx
  ON public.presencial_submissions (status, created_at DESC);

-- ─── Pares de possível duplicata (subproduto do desempate por nome) ───────────
CREATE TABLE public.presencial_duplicate_candidates (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id        uuid NOT NULL REFERENCES public.presencial_sessions(id),
  submission_id     uuid REFERENCES public.presencial_submissions(id) ON DELETE CASCADE,
  candidate_user_id uuid NOT NULL REFERENCES auth.users(id),
  chosen            boolean NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- ─── RLS: ligada, sem policy ──────────────────────────────────────────────────
ALTER TABLE public.presencial_sessions             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presencial_submissions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presencial_duplicate_candidates ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.presencial_sessions             FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.presencial_submissions          FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.presencial_duplicate_candidates FROM PUBLIC, anon, authenticated;
```

- [ ] **Step 2: Aplicar via MCP e rodar o smoke**

Aplicar com `mcp__supabase__apply_migration` (name: `presencial_schema`).

Smoke — rodar via `mcp__supabase__execute_sql`:

```sql
-- 1) CHECK aceita 'presencial'
select pg_get_constraintdef(oid) from pg_constraint
where conname = 'attempts_attempt_type_check';
-- Esperado: CHECK ((attempt_type = ANY (ARRAY['online'::text, 'offline'::text, 'presencial'::text])))

-- 2) Código inválido é rejeitado
do $$ begin
  begin
    insert into public.presencial_sessions (simulado_id, code, label, opens_at, closes_at)
    values ('6be18ec8-db68-482d-9417-281d66d13ff1','CODIGO INVALIDO','x', now(), now() + interval '1 day');
    raise exception 'FALHOU: aceitou code inválido';
  exception when check_violation then
    raise notice 'OK: code inválido rejeitado';
  end;
end $$;

-- 3) RLS ligada nas três, zero policies
select relname, relrowsecurity,
       (select count(*) from pg_policies p where p.tablename = c.relname) as policies
from pg_class c
where relname in ('presencial_sessions','presencial_submissions','presencial_duplicate_candidates');
-- Esperado: relrowsecurity = true e policies = 0 nas três
```

- [ ] **Step 3: Registrar em migrations-log.md**

Adicionar ao fim do arquivo, seguindo o formato das entradas existentes: seção `## 2026-08-12 — presencial_schema`, com o racional (por que RLS sem policy, por que o índice único parcial) e o resultado dos três smokes.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260812100000_presencial_schema.sql supabase/migrations-log.md
git commit -m "feat(db): schema da aplicação presencial (attempt_type, sessões, submissões)"
```

---

### Task 2: `finalize_attempt_with_results_for_user`

O `finalize_attempt_with_results` atual resolve o usuário por `auth.uid()`, então não serve a um fluxo sem sessão. Extraímos a variante com `p_user_id` explícito e a função atual passa a ser um wrapper. **Nenhuma lógica de score duplicada.**

**Files:**
- Create: `supabase/migrations/20260812100100_finalize_for_user.sql`
- Modify: `supabase/migrations-log.md`

**Interfaces:**
- Consumes: Task 1.
- Produces: `finalize_attempt_with_results_for_user(p_attempt_id uuid, p_user_id uuid) RETURNS TABLE(score_percentage numeric, total_correct integer, total_answered integer, total_questions integer, is_within_window boolean)` — `service_role` only.

- [ ] **Step 1: Capturar a definição atual (não confiar em memória)**

```sql
select pg_get_functiondef(p.oid) from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'finalize_attempt_with_results';
```

Guardar a saída. A variante nova é **cópia byte-a-byte do corpo**, com uma única troca: `auth.uid()` → `p_user_id`. Qualquer outra divergência é bug.

- [ ] **Step 2: Escrever a migration**

```sql
-- Extrai a variante com p_user_id explícito, para uso pelo fluxo presencial
-- (que não tem sessão e portanto não tem auth.uid()).
-- A função pública original passa a ser um wrapper: MESMA assinatura e MESMO
-- RETURNS TABLE, para que CREATE OR REPLACE não dê 42P13.

CREATE OR REPLACE FUNCTION public.finalize_attempt_with_results_for_user(
  p_attempt_id uuid,
  p_user_id    uuid
)
RETURNS TABLE(
  score_percentage numeric,
  total_correct    integer,
  total_answered   integer,
  total_questions  integer,
  is_within_window boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_attempt public.attempts%ROWTYPE;
  v_total_questions INTEGER := 0;
  v_total_answered  INTEGER := 0;
  v_total_correct   INTEGER := 0;
  v_score           NUMERIC(5,2) := 0;
  v_finished_at     TIMESTAMPTZ := now();
  v_unanswered      INTEGER := 0;
BEGIN
  SELECT * INTO v_attempt
  FROM public.attempts
  WHERE id = p_attempt_id AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Attempt not found for user';
  END IF;

  IF v_attempt.status = 'submitted' AND v_attempt.score_percentage IS NOT NULL THEN
    RETURN QUERY
    SELECT
      v_attempt.score_percentage,
      COALESCE(v_attempt.total_correct, 0),
      COALESCE(v_attempt.total_answered, 0),
      COALESCE((SELECT COUNT(*)::INTEGER FROM public.questions q
                WHERE q.simulado_id = v_attempt.simulado_id), 0),
      COALESCE(v_attempt.is_within_window, false);
    RETURN;
  END IF;

  SELECT COUNT(*)::INTEGER INTO v_total_questions
  FROM public.questions q WHERE q.simulado_id = v_attempt.simulado_id;

  SELECT COUNT(*)::INTEGER INTO v_unanswered
  FROM public.questions q
  LEFT JOIN public.answers a ON a.question_id = q.id AND a.attempt_id = v_attempt.id
  WHERE q.simulado_id = v_attempt.simulado_id AND a.selected_option_id IS NULL;

  IF v_unanswered > 0 THEN
    RAISE EXCEPTION 'Cannot submit: % question(s) unanswered', v_unanswered;
  END IF;

  INSERT INTO public.attempt_question_results (
    attempt_id, question_id, selected_option_id, correct_option_id, is_correct, was_answered
  )
  SELECT
    v_attempt.id, q.id, a.selected_option_id, qo_correct.id,
    CASE WHEN a.selected_option_id IS NOT NULL
              AND a.selected_option_id = qo_correct.id THEN true ELSE false END,
    (a.selected_option_id IS NOT NULL)
  FROM public.questions q
  LEFT JOIN public.answers a
    ON a.question_id = q.id AND a.attempt_id = v_attempt.id
  LEFT JOIN public.question_options qo_correct
    ON qo_correct.question_id = q.id AND qo_correct.is_correct = true
  WHERE q.simulado_id = v_attempt.simulado_id
  ON CONFLICT (attempt_id, question_id) DO UPDATE
  SET selected_option_id = EXCLUDED.selected_option_id,
      correct_option_id  = EXCLUDED.correct_option_id,
      is_correct         = EXCLUDED.is_correct,
      was_answered       = EXCLUDED.was_answered;

  SELECT COUNT(*)::INTEGER INTO v_total_answered
  FROM public.attempt_question_results aqr
  WHERE aqr.attempt_id = v_attempt.id AND aqr.was_answered = true;

  SELECT COUNT(*)::INTEGER INTO v_total_correct
  FROM public.attempt_question_results aqr
  WHERE aqr.attempt_id = v_attempt.id AND aqr.is_correct = true;

  v_score := CASE WHEN v_total_questions > 0
    THEN ROUND((v_total_correct::NUMERIC * 100) / v_total_questions, 2) ELSE 0 END;

  UPDATE public.attempts SET
    status = 'submitted',
    finished_at = COALESCE(finished_at, v_finished_at),
    score_percentage = v_score,
    total_correct = v_total_correct,
    total_answered = v_total_answered,
    last_saved_at = now()
  WHERE id = v_attempt.id;

  SELECT * INTO v_attempt FROM public.attempts WHERE id = v_attempt.id;

  INSERT INTO public.user_performance_history (
    user_id, attempt_id, simulado_id, score_percentage,
    total_correct, total_answered, total_questions, finished_at
  )
  VALUES (
    v_attempt.user_id, v_attempt.id, v_attempt.simulado_id, v_score,
    v_total_correct, v_total_answered, v_total_questions,
    COALESCE(v_attempt.finished_at, v_finished_at)
  )
  ON CONFLICT (attempt_id) DO UPDATE
  SET score_percentage = EXCLUDED.score_percentage,
      total_correct    = EXCLUDED.total_correct,
      total_answered   = EXCLUDED.total_answered,
      total_questions  = EXCLUDED.total_questions,
      finished_at      = EXCLUDED.finished_at;

  PERFORM public.recalculate_user_performance(v_attempt.user_id);

  DELETE FROM public.attempt_processing_queue WHERE attempt_id = v_attempt.id;

  RETURN QUERY SELECT v_score, v_total_correct, v_total_answered, v_total_questions,
                      COALESCE(v_attempt.is_within_window, false);
END;
$function$;

REVOKE ALL ON FUNCTION public.finalize_attempt_with_results_for_user(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_attempt_with_results_for_user(uuid, uuid)
  TO service_role;

-- Wrapper: mesma assinatura e mesmo RETURNS TABLE da versão em produção.
CREATE OR REPLACE FUNCTION public.finalize_attempt_with_results(p_attempt_id uuid)
RETURNS TABLE(
  score_percentage numeric,
  total_correct    integer,
  total_answered   integer,
  total_questions  integer,
  is_within_window boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT * FROM public.finalize_attempt_with_results_for_user(p_attempt_id, auth.uid());
END;
$function$;

GRANT EXECUTE ON FUNCTION public.finalize_attempt_with_results(uuid) TO authenticated, service_role;
```

> **Se o `CREATE OR REPLACE` do wrapper der `42P13`** ("cannot change return type of existing function"), a versão em produção divergiu do que este plano assume. Nesse caso: `DROP FUNCTION public.finalize_attempt_with_results(uuid);` antes do `CREATE`, e **reconceder** os grants — o `DROP` os leva embora. Conferir também quais outras RPCs chamam a função (`select proname from pg_proc where prosrc ilike '%finalize_attempt_with_results%'`) e revalidá-las.

- [ ] **Step 2b: Verificar quem depende da função antes de aplicar**

```sql
select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prosrc ilike '%finalize_attempt_with_results%'
  and p.proname <> 'finalize_attempt_with_results';
```

Esperado: `submit_offline_answers_guarded` (e nada mais surpreendente). Elas chamam o wrapper, cuja assinatura não muda — nada a alterar.

- [ ] **Step 3: Aplicar e rodar o smoke**

Aplicar com `mcp__supabase__apply_migration` (name: `finalize_for_user`).

```sql
-- 1) Idempotência sobre um attempt já finalizado: mesma nota, sem efeito colateral.
--    Usa um attempt real já submetido do Simulado 6.
with a as (
  select id, user_id, score_percentage from public.attempts
  where simulado_id = '1e802d25-05c8-4849-93ef-33580e9a4908'
    and status = 'submitted' and score_percentage is not null
  limit 1
)
select a.score_percentage as antes, f.score_percentage as depois
from a, public.finalize_attempt_with_results_for_user(a.id, a.user_id) f;
-- Esperado: antes = depois (o early-return devolve sem recalcular)

-- 2) user_id errado é rejeitado
do $$
declare v_id uuid;
begin
  select id into v_id from public.attempts where status='submitted' limit 1;
  begin
    perform * from public.finalize_attempt_with_results_for_user(v_id, gen_random_uuid());
    raise exception 'FALHOU: aceitou user_id errado';
  exception when others then
    raise notice 'OK: rejeitou user_id errado (%)', sqlerrm;
  end;
end $$;

-- 3) Grants
select grantee, privilege_type from information_schema.role_routine_grants
where routine_name = 'finalize_attempt_with_results_for_user';
-- Esperado: apenas service_role (e o owner postgres)
```

- [ ] **Step 4: Registrar em migrations-log.md e commitar**

```bash
git add supabase/migrations/20260812100100_finalize_for_user.sql supabase/migrations-log.md
git commit -m "feat(db): finalize_attempt_with_results_for_user + wrapper com auth.uid()"
```

---

### Task 3: `score_presencial_answers`

Correção agregada **sem attempt** — é a fonte única do que a Tela 3 mostra, nos dois ramos (vinculado e `unlinked`).

**Files:**
- Create: `supabase/migrations/20260812100200_score_presencial_answers.sql`
- Modify: `supabase/migrations-log.md`

**Interfaces:**
- Consumes: Task 1.
- Produces: `score_presencial_answers(p_simulado_id uuid, p_answers jsonb) RETURNS jsonb` — `service_role` only. Formato de retorno:
  ```json
  { "total_questions": 100, "total_correct": 62, "score_percentage": 62.00,
    "by_area": [{ "area": "Clínica Médica", "total": 25, "correct": 15, "percentage": 60.00 }] }
  ```

- [ ] **Step 1: Escrever a migration**

Atenção: a coluna é `questions.question_number` (não `number`) e a área é `questions.area`.

```sql
-- Correção agregada de um gabarito presencial, sem depender de attempt.
-- Fonte única da Tela 3: o finalize devolve totais mas não a quebra por área.

CREATE OR REPLACE FUNCTION public.score_presencial_answers(
  p_simulado_id uuid,
  p_answers     jsonb
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH marked AS (
    SELECT (e->>'question_id')::uuid                     AS question_id,
           NULLIF(e->>'selected_option_id','')::uuid      AS selected_option_id
    FROM jsonb_array_elements(COALESCE(p_answers, '[]'::jsonb)) e
  ),
  graded AS (
    SELECT
      q.id,
      COALESCE(NULLIF(btrim(q.area), ''), 'Sem Especialidade') AS area,
      (m.selected_option_id IS NOT NULL
        AND m.selected_option_id = qo.id) AS is_correct
    FROM public.questions q
    LEFT JOIN marked m ON m.question_id = q.id
    LEFT JOIN public.question_options qo
      ON qo.question_id = q.id AND qo.is_correct = true
    WHERE q.simulado_id = p_simulado_id
  ),
  by_area AS (
    SELECT area,
           COUNT(*)::int                          AS total,
           COUNT(*) FILTER (WHERE is_correct)::int AS correct
    FROM graded GROUP BY area
  )
  SELECT jsonb_build_object(
    'total_questions', (SELECT COUNT(*)::int FROM graded),
    'total_correct',   (SELECT COUNT(*) FILTER (WHERE is_correct)::int FROM graded),
    'score_percentage', (
      SELECT CASE WHEN COUNT(*) > 0
        THEN ROUND(COUNT(*) FILTER (WHERE is_correct)::numeric * 100 / COUNT(*), 2)
        ELSE 0 END
      FROM graded
    ),
    'by_area', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'area', area, 'total', total, 'correct', correct,
        'percentage', CASE WHEN total > 0
          THEN ROUND(correct::numeric * 100 / total, 2) ELSE 0 END
      ) ORDER BY area), '[]'::jsonb)
      FROM by_area
    )
  );
$function$;

REVOKE ALL ON FUNCTION public.score_presencial_answers(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.score_presencial_answers(uuid, jsonb) TO service_role;
```

- [ ] **Step 2: Aplicar e rodar o smoke**

Aplicar com `mcp__supabase__apply_migration` (name: `score_presencial_answers`).

```sql
-- 1) Gabarito 100% correto do Simulado 7 → score 100 e soma das áreas = total
with correct_sheet as (
  select jsonb_agg(jsonb_build_object(
    'question_id', q.id, 'selected_option_id', qo.id)) as answers
  from public.questions q
  join public.question_options qo on qo.question_id = q.id and qo.is_correct
  where q.simulado_id = '6be18ec8-db68-482d-9417-281d66d13ff1'
)
select r->>'total_questions' as total, r->>'total_correct' as correct,
       r->>'score_percentage' as pct,
       (select sum((a->>'total')::int) from jsonb_array_elements(r->'by_area') a) as soma_areas
from correct_sheet, public.score_presencial_answers(
  '6be18ec8-db68-482d-9417-281d66d13ff1', correct_sheet.answers) r;
-- Esperado: total = correct = soma_areas = nº de questões do S7; pct = 100.00

-- 2) Gabarito vazio → 0 acertos, mas total_questions e by_area ainda preenchidos
select r->>'total_correct' as correct, r->>'score_percentage' as pct,
       jsonb_array_length(r->'by_area') as areas
from public.score_presencial_answers('6be18ec8-db68-482d-9417-281d66d13ff1','[]'::jsonb) r;
-- Esperado: correct = 0, pct = 0.00, areas > 0
```

- [ ] **Step 3: Registrar em migrations-log.md e commitar**

```bash
git add supabase/migrations/20260812100200_score_presencial_answers.sql supabase/migrations-log.md
git commit -m "feat(db): score_presencial_answers (correção agregada sem attempt)"
```

---

### Task 4: Criar/converter attempt presencial e gravar respostas

**Files:**
- Create: `supabase/migrations/20260812100300_presencial_attempt_rpcs.sql`
- Modify: `supabase/migrations-log.md`

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces:
  - `create_or_convert_presencial_attempt(p_simulado_id uuid, p_user_id uuid) RETURNS uuid`
  - `submit_presencial_answers(p_attempt_id uuid, p_user_id uuid, p_answers jsonb) RETURNS jsonb` → `{ "attempt_id": uuid, "is_within_window": bool }`
  - Ambas `service_role` only.

- [ ] **Step 1: Escrever a migration**

```sql
-- Criação/conversão do attempt presencial e gravação do gabarito.
--
-- "Presencial ganha" é implementado por CONVERSÃO IN-PLACE: se o aluno já tem
-- attempt online do simulado, o mesmo attempt vira presencial. Motivo: manter
-- UMA linha por aluno por simulado, invariante que as ~30 RPCs de
-- ranking/admin/performance já assumem. As respostas online originais vão para
-- backup.presencial_superseded_answers.

CREATE OR REPLACE FUNCTION public.create_or_convert_presencial_attempt(
  p_simulado_id uuid,
  p_user_id     uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_simulado public.simulados%ROWTYPE;
  v_existing public.attempts%ROWTYPE;
  v_now      timestamptz := now();
  v_new      public.attempts%ROWTYPE;
BEGIN
  SELECT * INTO v_simulado FROM public.simulados
  WHERE id = p_simulado_id AND status IN ('published','test');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Simulado not found or not published';
  END IF;

  -- Já é presencial? Idempotente enquanto pendente; bloqueado depois de enviado.
  SELECT * INTO v_existing FROM public.attempts
  WHERE simulado_id = p_simulado_id AND user_id = p_user_id
    AND attempt_type = 'presencial'
  FOR UPDATE;

  IF FOUND THEN
    IF v_existing.status = 'presencial_pending' THEN
      RETURN v_existing.id;
    END IF;
    RAISE EXCEPTION 'PRESENCIAL_ALREADY_SUBMITTED';
  END IF;

  -- Existe attempt online/offline? Converte in-place, com snapshot.
  SELECT * INTO v_existing FROM public.attempts
  WHERE simulado_id = p_simulado_id AND user_id = p_user_id
    AND attempt_type IN ('online','offline')
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    INSERT INTO backup.presencial_superseded_answers (
      attempt_id, user_id, simulado_id, answers, previous_status, previous_score
    )
    SELECT
      v_existing.id, p_user_id, p_simulado_id,
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'question_id', a.question_id, 'selected_option_id', a.selected_option_id))
        FROM public.answers a WHERE a.attempt_id = v_existing.id
      ), '[]'::jsonb),
      v_existing.status, v_existing.score_percentage;

    -- Zera a nota para que o finalize não caia no early-return.
    UPDATE public.attempts SET
      attempt_type     = 'presencial',
      status           = 'presencial_pending',
      score_percentage = NULL,
      total_correct    = NULL,
      total_answered   = NULL,
      finished_at      = NULL,
      started_at       = v_now,
      last_saved_at    = v_now
    WHERE id = v_existing.id;

    -- A linha de histórico da tentativa antiga é sobrescrita no finalize
    -- (ON CONFLICT (attempt_id)); remover aqui evita nota velha visível
    -- na janela entre a conversão e o envio.
    DELETE FROM public.user_performance_history WHERE attempt_id = v_existing.id;
    PERFORM public.recalculate_user_performance(p_user_id);

    RETURN v_existing.id;
  END IF;

  INSERT INTO public.attempts (
    simulado_id, user_id, status, attempt_type, started_at, effective_deadline,
    current_question_index, tab_exit_count, fullscreen_exit_count, is_within_window
  )
  VALUES (
    p_simulado_id, p_user_id, 'presencial_pending', 'presencial', v_now,
    v_now + (v_simulado.duration_minutes || ' minutes')::interval,
    0, 0, 0, false
  )
  RETURNING * INTO v_new;

  RETURN v_new.id;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_or_convert_presencial_attempt(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_or_convert_presencial_attempt(uuid, uuid)
  TO service_role;

-- ─── Gravação + finalização ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.submit_presencial_answers(
  p_attempt_id uuid,
  p_user_id    uuid,
  p_answers    jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_attempt   public.attempts%ROWTYPE;
  v_simulado  public.simulados%ROWTYPE;
  v_now       timestamptz := now();
  v_is_within boolean;
  v_ans       jsonb;
  v_q_id      uuid;
  v_opt_id    uuid;
BEGIN
  SELECT * INTO v_attempt FROM public.attempts
  WHERE id = p_attempt_id AND user_id = p_user_id
    AND attempt_type = 'presencial' AND status = 'presencial_pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PRESENCIAL_ATTEMPT_NOT_PENDING';
  END IF;

  SELECT * INTO v_simulado FROM public.simulados WHERE id = v_attempt.simulado_id;

  -- Mesma regra do offline: vale para ranking se o envio cai dentro da janela.
  v_is_within := (v_now >= v_simulado.execution_window_start
              AND v_now <= v_simulado.execution_window_end);

  FOR v_ans IN SELECT * FROM jsonb_array_elements(p_answers)
  LOOP
    v_q_id   := (v_ans->>'question_id')::uuid;
    v_opt_id := NULLIF(v_ans->>'selected_option_id','')::uuid;

    INSERT INTO public.answers (
      attempt_id, question_id, selected_option_id,
      marked_for_review, high_confidence, eliminated_options, answered_at
    )
    VALUES (
      p_attempt_id, v_q_id, v_opt_id, false, false, '{}',
      CASE WHEN v_opt_id IS NOT NULL THEN v_now ELSE NULL END
    )
    ON CONFLICT (attempt_id, question_id) DO UPDATE
    SET selected_option_id = EXCLUDED.selected_option_id,
        answered_at        = EXCLUDED.answered_at;
  END LOOP;

  UPDATE public.attempts SET
    finished_at      = v_now,
    is_within_window = v_is_within
  WHERE id = p_attempt_id;

  PERFORM public.finalize_attempt_with_results_for_user(p_attempt_id, p_user_id);

  -- Reafirma is_within_window: o finalize pode sobrescrever.
  UPDATE public.attempts SET is_within_window = v_is_within WHERE id = p_attempt_id;

  RETURN jsonb_build_object('attempt_id', p_attempt_id, 'is_within_window', v_is_within);
END;
$function$;

REVOKE ALL ON FUNCTION public.submit_presencial_answers(uuid, uuid, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_presencial_answers(uuid, uuid, jsonb)
  TO service_role;
```

- [ ] **Step 2: Aplicar e rodar o smoke end-to-end num usuário de teste**

Aplicar com `mcp__supabase__apply_migration` (name: `presencial_attempt_rpcs`).

```sql
-- Ciclo completo num usuário real que NÃO tem attempt do S7.
-- Ao fim, o bloco faz rollback de tudo o que criou.
do $$
declare
  v_user uuid; v_attempt uuid; v_answers jsonb; v_res jsonb; v_score numeric;
begin
  select p.id into v_user from public.profiles p
  where not exists (
    select 1 from public.attempts a
    where a.user_id = p.id and a.simulado_id = '6be18ec8-db68-482d-9417-281d66d13ff1')
  limit 1;

  v_attempt := public.create_or_convert_presencial_attempt(
    '6be18ec8-db68-482d-9417-281d66d13ff1', v_user);
  raise notice 'attempt criado: %', v_attempt;

  select jsonb_agg(jsonb_build_object('question_id', q.id, 'selected_option_id', qo.id))
  into v_answers
  from public.questions q
  join public.question_options qo on qo.question_id = q.id and qo.is_correct
  where q.simulado_id = '6be18ec8-db68-482d-9417-281d66d13ff1';

  v_res := public.submit_presencial_answers(v_attempt, v_user, v_answers);
  raise notice 'submit: %', v_res;

  select score_percentage into v_score from public.attempts where id = v_attempt;
  if v_score <> 100 then raise exception 'FALHOU: score = % (esperado 100)', v_score; end if;

  if not exists (select 1 from public.attempts
    where id = v_attempt and attempt_type = 'presencial' and status = 'submitted') then
    raise exception 'FALHOU: attempt_type/status errados';
  end if;

  raise notice 'OK: ciclo presencial completo, score 100';

  -- Rollback do smoke
  delete from public.user_performance_history where attempt_id = v_attempt;
  delete from public.attempt_question_results where attempt_id = v_attempt;
  delete from public.answers where attempt_id = v_attempt;
  delete from public.attempts where id = v_attempt;
  perform public.recalculate_user_performance(v_user);
  raise notice 'OK: smoke revertido';
end $$;
```

Segundo smoke — a conversão in-place, sobre um attempt online já submetido:

```sql
do $$
declare v_user uuid; v_old uuid; v_conv uuid; v_bkp int;
begin
  select user_id, id into v_user, v_old from public.attempts
  where simulado_id = '1e802d25-05c8-4849-93ef-33580e9a4908'
    and attempt_type = 'online' and status = 'submitted'
  limit 1;

  v_conv := public.create_or_convert_presencial_attempt(
    '1e802d25-05c8-4849-93ef-33580e9a4908', v_user);

  if v_conv <> v_old then raise exception 'FALHOU: criou attempt novo em vez de converter'; end if;

  select count(*) into v_bkp from backup.presencial_superseded_answers where attempt_id = v_old;
  if v_bkp <> 1 then raise exception 'FALHOU: snapshot não gravado'; end if;

  raise notice 'OK: conversão in-place + snapshot';
  raise exception 'ROLLBACK proposital do smoke';
end $$;
```

O `raise exception` final aborta o bloco e desfaz a conversão — confirmar depois que o attempt voltou a `attempt_type='online'`, `status='submitted'` e que o backup está vazio:

```sql
select attempt_type, status, score_percentage is not null as tem_nota
from public.attempts where id = '<v_old do smoke>';
select count(*) from backup.presencial_superseded_answers;
-- Esperado: online / submitted / true, e count = 0
```

- [ ] **Step 3: Registrar em migrations-log.md e commitar**

```bash
git add supabase/migrations/20260812100300_presencial_attempt_rpcs.sql supabase/migrations-log.md
git commit -m "feat(db): create_or_convert_presencial_attempt + submit_presencial_answers"
```

---

### Task 5: Bloquear o online depois do presencial

Hoje o `create_attempt_guarded` só considera attempts `attempt_type='online'` nos checks de "já enviado", então um aluno que fez presencial ainda conseguiria abrir a prova online.

**Files:**
- Create: `supabase/migrations/20260812100400_block_online_after_presencial.sql`
- Modify: `supabase/migrations-log.md`

**Interfaces:**
- Consumes: Task 1.
- Produces: `create_attempt_guarded` levanta `PRESENCIAL_ATTEMPT_EXISTS` quando há attempt presencial.

- [ ] **Step 1: Recapturar a definição atual e escrever a migration**

```sql
select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'create_attempt_guarded';
```

A migration é `CREATE OR REPLACE` da definição atual (retorno `attempts`, inalterado) com **um bloco novo** inserido logo depois do `IF NOT FOUND THEN RAISE EXCEPTION 'Simulado not found or not published'; END IF;`:

```sql
  -- Presencial tem precedência: uma vez enviado o gabarito presencial,
  -- o simulado está feito e a prova online fica fechada.
  SELECT * INTO v_existing
  FROM public.attempts
  WHERE simulado_id = p_simulado_id
    AND user_id = auth.uid()
    AND attempt_type = 'presencial';

  IF FOUND THEN
    RAISE EXCEPTION 'PRESENCIAL_ATTEMPT_EXISTS';
  END IF;
```

O resto do corpo permanece **idêntico** ao capturado. Fechar a migration com:

```sql
GRANT EXECUTE ON FUNCTION public.create_attempt_guarded(uuid) TO authenticated, service_role;
```

- [ ] **Step 2: Tratar a mensagem no cliente**

Localizar onde o erro do `create_attempt_guarded` é tratado:

```bash
grep -rn "create_attempt_guarded\|Attempt already submitted" src/
```

Em `src/hooks/exam/useExamLifecycle.ts`, adicionar o mapeamento da nova mensagem, seguindo o padrão de tratamento de erro que já existe no arquivo. Copy: **"Você já fez este simulado presencialmente. Seu resultado sai em 07/09."**

- [ ] **Step 3: Aplicar e rodar o smoke**

Aplicar com `mcp__supabase__apply_migration` (name: `block_online_after_presencial`).

```sql
-- Com um attempt presencial na base, create_attempt_guarded precisa recusar.
-- Rodar sob o JWT do usuário não é possível aqui; validar o caminho lógico:
select prosrc ilike '%PRESENCIAL_ATTEMPT_EXISTS%' as tem_guard
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname='public' and p.proname='create_attempt_guarded';
-- Esperado: true
```

A validação de comportamento real acontece no smoke end-to-end da Task 17.

- [ ] **Step 4: Rodar os testes, registrar e commitar**

```bash
npm run test && npm run typecheck
```

```bash
git add supabase/migrations/20260812100400_block_online_after_presencial.sql supabase/migrations-log.md src/hooks/exam/useExamLifecycle.ts
git commit -m "feat(db): create_attempt_guarded bloqueia online após presencial"
```

---

### Task 6: Vínculo tardio e bucket de rate limit

**Files:**
- Create: `supabase/migrations/20260812100500_link_presencial_submission.sql`
- Modify: `supabase/migrations-log.md`

**Interfaces:**
- Consumes: Tasks 1–4.
- Produces:
  - `link_presencial_submission(p_submission_id uuid, p_user_id uuid) RETURNS jsonb` → `{ "attempt_id": uuid, "is_within_window": bool }` — `service_role` only.
  - `bump_presencial_bucket(p_bucket_type text, p_bucket_key text, p_window_ms integer) RETURNS integer` — `service_role` only.

- [ ] **Step 1: Inspecionar o bucket existente para copiar o padrão**

```sql
select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname='public' and p.proname='bump_guest_signup_bucket';
```

O `bump_presencial_bucket` reusa a **mesma tabela e a mesma mecânica de janela rolante**; só o `p_bucket_type` muda (`checkin_ip`, `checkin_email`, `name_lookup_ip`). Se o CHECK da tabela restringir `bucket_type`, a migration precisa ampliá-lo — conferir na saída acima e ajustar.

- [ ] **Step 2: Escrever a migration**

```sql
-- Vínculo tardio de submissão presencial (fila de identidade do admin) e
-- bucket de rate limit do fluxo presencial.

CREATE OR REPLACE FUNCTION public.link_presencial_submission(
  p_submission_id uuid,
  p_user_id       uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_sub     public.presencial_submissions%ROWTYPE;
  v_attempt uuid;
  v_res     jsonb;
BEGIN
  SELECT * INTO v_sub FROM public.presencial_submissions
  WHERE id = p_submission_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SUBMISSION_NOT_FOUND';
  END IF;
  IF v_sub.status = 'linked' THEN
    RAISE EXCEPTION 'SUBMISSION_ALREADY_LINKED';
  END IF;
  IF jsonb_array_length(COALESCE(v_sub.answers, '[]'::jsonb)) = 0 THEN
    RAISE EXCEPTION 'SUBMISSION_HAS_NO_ANSWERS';
  END IF;

  v_attempt := public.create_or_convert_presencial_attempt(v_sub.simulado_id, p_user_id);
  v_res     := public.submit_presencial_answers(v_attempt, p_user_id, v_sub.answers);

  UPDATE public.presencial_submissions SET
    linked_user_id    = p_user_id,
    linked_attempt_id = v_attempt,
    status            = 'linked',
    linked_at         = now()
  WHERE id = p_submission_id;

  RETURN v_res;
END;
$function$;

REVOKE ALL ON FUNCTION public.link_presencial_submission(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.link_presencial_submission(uuid, uuid) TO service_role;
```

Somar o `bump_presencial_bucket`, espelhando a mecânica lida no Step 1 (mesma tabela, mesma janela rolante, retorno do contador após o incremento), com `REVOKE ALL ... FROM PUBLIC, anon, authenticated` + `GRANT EXECUTE ... TO service_role`.

- [ ] **Step 3: Aplicar e rodar o smoke**

Aplicar com `mcp__supabase__apply_migration` (name: `link_presencial_submission`).

```sql
-- Rate limit: 3 chamadas no mesmo bucket devolvem 1, 2, 3.
select public.bump_presencial_bucket('checkin_ip','smoke-key-1', 3600000) as c1;
select public.bump_presencial_bucket('checkin_ip','smoke-key-1', 3600000) as c2;
select public.bump_presencial_bucket('checkin_ip','smoke-key-1', 3600000) as c3;
-- Esperado: 1, 2, 3

-- Submissão sem respostas não pode ser vinculada
do $$
declare v_sid uuid; v_sess uuid;
begin
  insert into public.presencial_sessions (simulado_id, code, label, opens_at, closes_at)
  values ('6be18ec8-db68-482d-9417-281d66d13ff1','smoke-link','Smoke',
          now() - interval '1 hour', now() + interval '1 hour')
  returning id into v_sess;

  insert into public.presencial_submissions (
    session_id, simulado_id, declared_name, declared_email, identification_path)
  values (v_sess, '6be18ec8-db68-482d-9417-281d66d13ff1','Smoke','smoke@example.com','unlinked')
  returning id into v_sid;

  begin
    perform public.link_presencial_submission(v_sid, gen_random_uuid());
    raise exception 'FALHOU: vinculou submissão sem respostas';
  exception when others then
    if sqlerrm not like '%SUBMISSION_HAS_NO_ANSWERS%' then raise; end if;
    raise notice 'OK: recusou submissão sem respostas';
  end;

  delete from public.presencial_submissions where id = v_sid;
  delete from public.presencial_sessions where id = v_sess;
end $$;
```

- [ ] **Step 4: Registrar em migrations-log.md e commitar**

```bash
git add supabase/migrations/20260812100500_link_presencial_submission.sql supabase/migrations-log.md
git commit -m "feat(db): link_presencial_submission + bump_presencial_bucket"
```

---

### Task 7: RPCs de admin

**Files:**
- Create: `supabase/migrations/20260812100600_presencial_admin_rpcs.sql`
- Modify: `supabase/migrations-log.md`

**Interfaces:**
- Consumes: Tasks 1–6.
- Produces (todas `SECURITY DEFINER`, `GRANT ... TO authenticated`, guardadas por `admin_require`):
  - `admin_presencial_sessions_list()` → `TABLE(id uuid, simulado_id uuid, simulado_title text, code text, label text, opens_at timestamptz, closes_at timestamptz, is_active boolean, submissions_count integer, linked_count integer)` — `content.manage`
  - `admin_presencial_session_upsert(p_id uuid, p_simulado_id uuid, p_code text, p_label text, p_opens_at timestamptz, p_closes_at timestamptz, p_is_active boolean)` → `uuid` — `content.manage`
  - `admin_presencial_queue(p_status text)` → `TABLE(submission_id uuid, session_label text, declared_name text, declared_email text, identification_path text, total_correct integer, score_percentage numeric, created_at timestamptz, ip_hash text, suggested_user_id uuid, suggested_email text, suggested_name text)` — `attempts.manage`
  - `admin_presencial_link(p_submission_id uuid, p_user_id uuid)` → `jsonb` — `attempts.manage`
  - `admin_presencial_reassign(p_attempt_id uuid, p_to_user_id uuid)` → `jsonb` — `attempts.manage`

- [ ] **Step 1: Inspecionar uma RPC de admin existente para copiar o padrão exato**

```sql
select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname='public' and p.proname='admin_simulado_results_roster';
```

Reproduzir: `PERFORM admin_require('<cap>')` como primeiro statement, `SET search_path TO 'public'`, `REVOKE ALL ... FROM PUBLIC, anon`, `GRANT EXECUTE ... TO authenticated, service_role`.

- [ ] **Step 2: Escrever a migration**

`admin_presencial_queue` é a única com lógica não óbvia — a conta sugerida sai da mesma regra da Tela 1 (e-mail exato primeiro, nome normalizado depois):

```sql
CREATE OR REPLACE FUNCTION public.admin_presencial_queue(p_status text DEFAULT 'unlinked')
RETURNS TABLE(
  submission_id       uuid,
  session_label       text,
  declared_name       text,
  declared_email      text,
  identification_path text,
  total_correct       integer,
  score_percentage    numeric,
  created_at          timestamptz,
  ip_hash             text,
  suggested_user_id   uuid,
  suggested_email     text,
  suggested_name      text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.admin_require('attempts.manage');

  RETURN QUERY
  WITH subs AS (
    SELECT s.*, ps.label AS sess_label
    FROM public.presencial_submissions s
    JOIN public.presencial_sessions ps ON ps.id = s.session_id
    WHERE p_status = 'all' OR s.status = p_status
  ),
  matched AS (
    SELECT
      subs.id AS sub_id,
      COALESCE(pe.id, pn.id)          AS user_id,
      COALESCE(pe.email, pn.email)    AS email,
      COALESCE(pe.full_name, pn.full_name) AS full_name
    FROM subs
    LEFT JOIN public.profiles pe
      ON lower(btrim(pe.email)) = lower(btrim(subs.declared_email))
    LEFT JOIN public.profiles pn
      ON pe.id IS NULL
     AND lower(regexp_replace(unaccent(btrim(pn.full_name)), '\s+', ' ', 'g'))
       = lower(regexp_replace(unaccent(btrim(subs.declared_name)), '\s+', ' ', 'g'))
  )
  SELECT
    subs.id, subs.sess_label, subs.declared_name, subs.declared_email,
    subs.identification_path, subs.total_correct, subs.score_percentage,
    subs.created_at, subs.ip_hash,
    m.user_id, m.email, m.full_name
  FROM subs
  LEFT JOIN matched m ON m.sub_id = subs.id
  ORDER BY subs.created_at DESC;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_presencial_queue(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_presencial_queue(text) TO authenticated, service_role;
```

> O `LEFT JOIN public.profiles pn` pode multiplicar linhas quando o nome colide (até 19 contas na base). Isso é aceitável na fila de admin — cada linha é uma sugestão. Se incomodar na UI, envolver `matched` em `DISTINCT ON (sub_id)` com `ORDER BY sub_id, (pe.id IS NOT NULL) DESC`.

`admin_presencial_link` chama `link_presencial_submission` (que é `service_role` only, mas a chamada acontece dentro de uma função `SECURITY DEFINER` cujo owner é `postgres` — funciona). `admin_presencial_reassign` troca `attempts.user_id` (o trigger `prevent_direct_attempts_update` libera `SECURITY DEFINER`), recalcula `user_performance_history` para as duas contas e chama `recalculate_user_performance` em ambas.

As duas de escrita gravam no audit log do admin — conferir na saída do Step 1 como as RPCs de escrita existentes fazem isso e seguir o mesmo padrão.

- [ ] **Step 3: Aplicar e rodar o smoke**

Aplicar com `mcp__supabase__apply_migration` (name: `presencial_admin_rpcs`).

```sql
-- Guard: sem capability, precisa levantar unauthorized
do $$ begin
  begin
    perform * from public.admin_presencial_queue('unlinked');
    raise notice 'Chamou como postgres (admin_require passa) — OK';
  exception when others then
    raise notice 'Guard ativo: %', sqlerrm;
  end;
end $$;

-- Fila vazia não quebra
select count(*) from public.admin_presencial_queue('all');
-- Esperado: 0 (sem erro)
```

- [ ] **Step 4: Registrar em migrations-log.md e commitar**

```bash
git add supabase/migrations/20260812100600_presencial_admin_rpcs.sql supabase/migrations-log.md
git commit -m "feat(db): RPCs de admin do presencial (sessões, fila de identidade, reatribuição)"
```

---

## Fase 2 — Edge Function

### Task 8: Módulos puros da Edge Function (mask, identity, token)

Tudo o que é lógica pura fica em módulos sem API de Deno, testados por Vitest — o `vitest.config.ts` já inclui `supabase/functions/**/*.{test,spec}.ts`.

**Files:**
- Create: `supabase/functions/presencial/mask.ts`, `supabase/functions/presencial/mask.test.ts`
- Create: `supabase/functions/presencial/identity.ts`, `supabase/functions/presencial/identity.test.ts`
- Create: `supabase/functions/presencial/token.ts`, `supabase/functions/presencial/token.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `maskEmail(email: string): string`
  - `normalizeName(name: string): string`
  - `firstLastKey(name: string): string`
  - `pickCandidates<T>(rows: T[], max?: number): T[]`
  - `signToken(payload: PresencialTokenPayload, secret: string): Promise<string>`
  - `verifyToken(token: string, secret: string, nowMs: number): Promise<PresencialTokenPayload | null>`
  - `interface PresencialTokenPayload { submission_id: string; simulado_id: string; session_id: string; attempt_id: string | null; user_id: string | null; exp: number }`

- [ ] **Step 1: Escrever os testes de `mask.ts` (falhando)**

```ts
// supabase/functions/presencial/mask.test.ts
import { describe, it, expect } from 'vitest'
import { maskEmail } from './mask'

describe('maskEmail', () => {
  it('preserva 2 primeiros e 2 últimos do local-part e a 1ª letra do domínio', () => {
    expect(maskEmail('joao.silva@gmail.com')).toBe('jo••••••va@g••••.com')
  })

  it('mostra só o primeiro caractere quando o local-part tem 4 ou menos', () => {
    expect(maskEmail('ana@gmail.com')).toBe('a••@g••••.com')
    expect(maskEmail('abcd@uol.com.br')).toBe('a•••@u••.com.br')
  })

  it('mantém o TLD composto intacto', () => {
    expect(maskEmail('maria.souza@hotmail.com.br')).toBe('ma•••••••za@h••••••.com.br')
  })

  it('não vaza nada quando a entrada é inválida', () => {
    expect(maskEmail('semarroba')).toBe('•••')
    expect(maskEmail('')).toBe('•••')
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
npx vitest run supabase/functions/presencial/mask.test.ts
```
Esperado: FAIL — "Failed to resolve import './mask'".

- [ ] **Step 3: Implementar `mask.ts`**

```ts
/**
 * Mascaramento de e-mail para a sugestão de conta por nome.
 *
 * Objetivo: o dono reconhece o próprio endereço; um terceiro não consegue
 * reconstruí-lo. Preserva 2 primeiros e 2 últimos caracteres do local-part,
 * a primeira letra do domínio e o TLD inteiro (inclusive composto, .com.br).
 *
 * Módulo puro, sem API de Deno — testado por Vitest.
 */
const DOT = '•'

function maskMiddle(value: string, keepStart: number, keepEnd: number): string {
  if (value.length <= keepStart + keepEnd) {
    return value.slice(0, 1) + DOT.repeat(Math.max(value.length - 1, 1))
  }
  const start = value.slice(0, keepStart)
  const end = value.slice(value.length - keepEnd)
  return start + DOT.repeat(value.length - keepStart - keepEnd) + end
}

export function maskEmail(email: string): string {
  const at = email.lastIndexOf('@')
  if (at <= 0 || at === email.length - 1) return DOT.repeat(3)

  const local = email.slice(0, at)
  const domain = email.slice(at + 1)

  const firstDot = domain.indexOf('.')
  if (firstDot <= 0) return DOT.repeat(3)

  const host = domain.slice(0, firstDot)
  const tld = domain.slice(firstDot) // ".com" ou ".com.br"

  const maskedLocal = local.length <= 4
    ? local.slice(0, 1) + DOT.repeat(Math.max(local.length - 1, 1))
    : maskMiddle(local, 2, 2)

  const maskedHost = host.slice(0, 1) + DOT.repeat(Math.max(host.length - 1, 1))

  return `${maskedLocal}@${maskedHost}${tld}`
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

```bash
npx vitest run supabase/functions/presencial/mask.test.ts
```
Esperado: PASS (4 testes).

- [ ] **Step 5: Escrever os testes de `identity.ts` (falhando)**

```ts
// supabase/functions/presencial/identity.test.ts
import { describe, it, expect } from 'vitest'
import { normalizeName, firstLastKey, pickCandidates } from './identity'

describe('normalizeName', () => {
  it('remove acento, baixa a caixa e colapsa espaços', () => {
    expect(normalizeName('  José   Antônio  DA Silva ')).toBe('jose antonio da silva')
  })
  it('devolve string vazia para entrada vazia', () => {
    expect(normalizeName('   ')).toBe('')
  })
})

describe('firstLastKey', () => {
  it('junta primeiro e último token', () => {
    expect(firstLastKey('Ana Paula Souza Lima')).toBe('ana lima')
  })
  it('com um único token, repete ele', () => {
    expect(firstLastKey('Ana')).toBe('ana ana')
  })
})

describe('pickCandidates', () => {
  it('devolve a lista quando tem até 3', () => {
    expect(pickCandidates([1, 2, 3])).toEqual([1, 2, 3])
  })
  it('devolve vazio com 4 ou mais — nome comum não sugere', () => {
    expect(pickCandidates([1, 2, 3, 4])).toEqual([])
  })
  it('devolve vazio quando não há candidato', () => {
    expect(pickCandidates([])).toEqual([])
  })
})
```

- [ ] **Step 6: Rodar (falha), implementar `identity.ts`, rodar (passa)**

```ts
/**
 * Normalização de nome e regra de corte de candidatos.
 *
 * O corte em 3 é deliberado: na base há 40 nomes com 4+ contas (colisão máxima
 * de 19). Listar candidatos nesses casos só aumenta a chance de o aluno
 * reivindicar a conta de um homônimo. Módulo puro — testado por Vitest.
 */
export const MAX_CANDIDATES = 3

export function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // combining diacritical marks
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
}

export function firstLastKey(name: string): string {
  const parts = normalizeName(name).split(' ').filter(Boolean)
  if (parts.length === 0) return ''
  const first = parts[0]
  const last = parts[parts.length - 1]
  return `${first} ${last}`
}

export function pickCandidates<T>(rows: T[], max: number = MAX_CANDIDATES): T[] {
  if (rows.length === 0 || rows.length > max) return []
  return rows
}
```

```bash
npx vitest run supabase/functions/presencial/identity.test.ts
```
Esperado: PASS (7 testes).

- [ ] **Step 7: Escrever os testes de `token.ts` (falhando)**

```ts
// supabase/functions/presencial/token.test.ts
import { describe, it, expect } from 'vitest'
import { signToken, verifyToken, type PresencialTokenPayload } from './token'

const SECRET = 'segredo-de-teste-nao-usar-em-producao'
const NOW = 1_760_000_000_000

const payload: PresencialTokenPayload = {
  submission_id: 'sub-1',
  simulado_id: 'sim-1',
  session_id: 'sess-1',
  attempt_id: 'att-1',
  user_id: 'user-1',
  exp: NOW + 2 * 60 * 60 * 1000,
}

describe('token', () => {
  it('assina e verifica o mesmo payload', async () => {
    const t = await signToken(payload, SECRET)
    expect(await verifyToken(t, SECRET, NOW)).toEqual(payload)
  })

  it('rejeita assinatura de outro segredo', async () => {
    const t = await signToken(payload, SECRET)
    expect(await verifyToken(t, 'outro-segredo', NOW)).toBeNull()
  })

  it('rejeita payload adulterado', async () => {
    const t = await signToken(payload, SECRET)
    const [body, sig] = t.split('.')
    const tampered = btoa(JSON.stringify({ ...payload, user_id: 'invasor' }))
      .replace(/=+$/, '')
    expect(await verifyToken(`${tampered}.${sig}`, SECRET, NOW)).toBeNull()
    expect(body).not.toBe(tampered)
  })

  it('rejeita token expirado', async () => {
    const t = await signToken({ ...payload, exp: NOW - 1 }, SECRET)
    expect(await verifyToken(t, SECRET, NOW)).toBeNull()
  })

  it('rejeita formato inválido', async () => {
    expect(await verifyToken('sem-ponto', SECRET, NOW)).toBeNull()
    expect(await verifyToken('', SECRET, NOW)).toBeNull()
  })
})
```

- [ ] **Step 8: Rodar (falha), implementar `token.ts`, rodar (passa)**

```ts
/**
 * Token do fluxo presencial: HMAC-SHA256 sobre o payload em base64url.
 *
 * NÃO é sessão Supabase. Escopo é um único gabarito: com ele não se lê caderno
 * de erros, desempenho, ranking nem qualquer dado da conta. TTL de 2h.
 *
 * Usa Web Crypto, disponível tanto no Deno quanto no Node do Vitest.
 */
export interface PresencialTokenPayload {
  submission_id: string
  simulado_id: string
  session_id: string
  attempt_id: string | null
  user_id: string | null
  exp: number
}

const enc = new TextEncoder()

function b64url(input: string): string {
  return btoa(input).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromB64url(input: string): string {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/')
  return atob(padded + '='.repeat((4 - (padded.length % 4)) % 4))
}

async function hmac(body: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(body))
  return b64url(String.fromCharCode(...new Uint8Array(sig)))
}

export async function signToken(
  payload: PresencialTokenPayload,
  secret: string,
): Promise<string> {
  const body = b64url(JSON.stringify(payload))
  return `${body}.${await hmac(body, secret)}`
}

export async function verifyToken(
  token: string,
  secret: string,
  nowMs: number,
): Promise<PresencialTokenPayload | null> {
  const parts = token.split('.')
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null

  const [body, sig] = parts
  const expected = await hmac(body, secret)

  // Comparação de tempo constante.
  if (sig.length !== expected.length) return null
  let diff = 0
  for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i)
  if (diff !== 0) return null

  try {
    const payload = JSON.parse(fromB64url(body)) as PresencialTokenPayload
    if (typeof payload.exp !== 'number' || payload.exp <= nowMs) return null
    return payload
  } catch {
    return null
  }
}
```

```bash
npx vitest run supabase/functions/presencial/token.test.ts
```
Esperado: PASS (5 testes).

- [ ] **Step 9: Verificar os pins e commitar**

```bash
npm run check:edge-pins && npm run test && npm run typecheck
```
Os três módulos não têm import externo, então o check de pins passa trivialmente.

```bash
git add supabase/functions/presencial/
git commit -m "feat(edge): módulos puros do fluxo presencial (mask, identity, token)"
```

---

### Task 9: Edge Function `presencial` — identificação

**Files:**
- Create: `supabase/functions/presencial/index.ts`
- Modify: `supabase/config.toml`

**Interfaces:**
- Consumes: Task 8 (`maskEmail`, `normalizeName`, `firstLastKey`, `pickCandidates`, `signToken`); Tasks 1–4 (tabelas e RPCs).
- Produces contrato HTTP `POST /functions/v1/presencial`:
  - `{ action: 'checkin', code, name, email }` →
    `{ status: 'ready', token, questions: Skeleton[] }`
    | `{ status: 'suggestions', candidates: [{ ref, masked_email, hint }] }`
    | `{ status: 'no_account' }`
    | `{ error: string }`
  - `{ action: 'claim', code, name, email, candidate_ref }` → `{ status: 'ready', token, questions }`
  - `{ action: 'start-unlinked', code, name, email }` → `{ status: 'ready', token, questions }`
  - `Skeleton = { question_id: string; number: number; options: { id: string; label: string }[] }`

- [ ] **Step 1: Registrar `verify_jwt = false`**

Em `supabase/config.toml`, adicionar ao fim:

```toml
# Fluxo presencial: chamado de uma rota pública, sem sessão de usuário.
# O gate é o código da sala + janela + rate limit dentro do handler.
[functions.presencial]
verify_jwt = false
```

- [ ] **Step 2: Escrever `index.ts` com as três actions de identificação**

Copiar de `supabase/functions/create-guest-account/index.ts` o bloco de CORS/`isAllowedOrigin`/`getClientIp`/`sha256Hex`/`json` **verbatim** (mesmo allowlist de origens) e o pin `npm:@supabase/supabase-js@2.49.4`.

```ts
import { createClient } from "npm:@supabase/supabase-js@2.49.4";
import { maskEmail } from "./mask.ts";
import { normalizeName, firstLastKey, pickCandidates } from "./identity.ts";
import { signToken } from "./token.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const PRESENCIAL_TOKEN_SECRET = Deno.env.get("PRESENCIAL_TOKEN_SECRET") ?? "";

const TOKEN_TTL_MS = 2 * 60 * 60 * 1000;
const WINDOW_MS = 60 * 60 * 1000;
const MAX_CHECKIN_PER_IP = 120;      // uma sala inteira cabe folgado
const MAX_CHECKIN_PER_EMAIL = 5;
const MAX_NAME_LOOKUP_PER_IP = 20;   // busca por nome é mais sensível
```

Fluxo de `checkin`:

1. Validar `code`, `name` (não vazio) e formato de `email` com a mesma regex de `create-guest-account`.
2. Carregar a sessão: `presencial_sessions` por `code`, com `is_active = true` e `now()` entre `opens_at` e `closes_at`. Falha → `403 { error: 'Esta sala não está aberta para envio de gabarito.' }`.
3. Rate limit: `bump_presencial_bucket('checkin_ip', sha256(ip), WINDOW_MS)` e `('checkin_email', sha256(email), WINDOW_MS)`. Estourou → `429`.
4. Buscar em `profiles` por `lower(btrim(email))`. Achou → `createSession(path='email_direct', user)`.
5. Não achou → `bump_presencial_bucket('name_lookup_ip', ...)`; estourou → `429`. Buscar por nome normalizado, com fallback de `firstLastKey`; aplicar `pickCandidates`.
6. Zero ou 4+ → `{ status: 'no_account' }`. 1–3 → gravar os pares em `presencial_duplicate_candidates` quando forem 2+ e devolver `{ status: 'suggestions', candidates }`, onde `ref` é um HMAC opaco de `user_id` + `code` (o `user_id` **nunca** sai) e `hint` é `"criada em jun/2026 · fez os Simulados 5 e 6 · Aluno PRO"`, montado a partir de `profiles.created_at`, `profiles.segment` e dos `simulados.title` dos attempts `submitted` — e **só preenchido quando há 2+ candidatos**.

`createSession(path, user | null)`:
- `user` presente → `create_or_convert_presencial_attempt(simulado_id, user.id)`. Erro `PRESENCIAL_ALREADY_SUBMITTED` → `409 { error: 'Esta conta já enviou o gabarito presencial deste simulado.' }`.
- `user` nulo (`unlinked`) → `attempt_id = null`.
- Inserir `presencial_submissions` (`declared_name`, `declared_email`, `identification_path`, `ip_hash`, `linked_user_id`, `linked_attempt_id`, `status`).
- Montar o esqueleto: `questions` do simulado (`id`, `question_number`) + `question_options` (`id`, `label`) filtradas a `A/B/C/D`, ordenadas por `question_number` e por `label`. **Nunca** selecionar `text`, `explanation` nem `image_url`.
- `signToken({...}, PRESENCIAL_TOKEN_SECRET)` com `exp = Date.now() + TOKEN_TTL_MS`.

`claim` repete `checkin` a partir do passo 2, resolve `candidate_ref` recomputando o HMAC de cada candidato do nome informado (não aceita `ref` que não bata), marca `chosen = true` em `presencial_duplicate_candidates` e chama `createSession('name_suggestion', user)`.

`start-unlinked` valida sessão + rate limit e chama `createSession('unlinked', null)`.

- [ ] **Step 3: Gerar o segredo e configurar**

Gerar 32 bytes aleatórios e configurar `PRESENCIAL_TOKEN_SECRET` nos secrets da função. **Não** commitar o valor.

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

- [ ] **Step 4: Deploy e teste manual das três actions**

Deploy com `mcp__supabase__deploy_edge_function` (name: `presencial`, todos os arquivos do diretório).

```bash
curl -s -X POST "https://lljnbysgcwvkhlnaqxtt.supabase.co/functions/v1/presencial" \
  -H "Origin: https://simulados.sanar.com.br" \
  -H "Content-Type: application/json" \
  -d '{"action":"checkin","code":"s7-teste","name":"Fulano de Teste","email":"nao-existe-mesmo@example.com"}'
```
Esperado: `{"status":"no_account"}` (com a sessão `s7-teste` criada e aberta; ela é criada na Task 17 — para este teste, criar uma sessão temporária e removê-la depois).

Repetir com o e-mail de uma conta real → esperado `status: "ready"`, com `token` presente e `questions` com o número de questões do S7.

**Verificar explicitamente que o esqueleto não vaza a prova:**
```bash
# na resposta de checkin, nenhuma das chaves abaixo pode aparecer
echo "$RESPONSE" | grep -o '"text"\|"explanation"\|"image_url"' && echo "VAZOU" || echo "OK: sem conteúdo de questão"
```

- [ ] **Step 5: Rodar as travas do repo e commitar**

```bash
npm run check:edge-pins && npm run test && npm run typecheck
```

```bash
git add supabase/functions/presencial/index.ts supabase/config.toml
git commit -m "feat(edge): presencial — checkin, claim e start-unlinked"
```

---

### Task 10: Edge Function `presencial` — envio

**Files:**
- Modify: `supabase/functions/presencial/index.ts`

**Interfaces:**
- Consumes: Task 9; Tasks 3–4 (`score_presencial_answers`, `submit_presencial_answers`); Task 8 (`verifyToken`).
- Produces: `{ action: 'submit', token, answers }` → `{ total_questions, total_correct, score_percentage, by_area: [{ area, total, correct, percentage }], is_linked, is_within_window }`.

- [ ] **Step 1: Implementar a action `submit`**

1. `verifyToken(token, PRESENCIAL_TOKEN_SECRET, Date.now())`. Nulo → `401 { error: 'Sua sessão de gabarito expirou. Chame o fiscal.' }`.
2. Validar `answers`: array, tamanho igual ao número de questões do simulado, todo `question_id` pertencente ao simulado, todo `selected_option_id` pertencente à sua questão, **nenhum nulo** (a Tela 2 exige as 100). Falha → `400`.
3. `score_presencial_answers(simulado_id, answers)` → é **sempre** a fonte do payload de resposta.
4. Se `payload.attempt_id` e `payload.user_id` → `submit_presencial_answers(attempt_id, user_id, answers)`; guardar `is_within_window`. Erro `PRESENCIAL_ATTEMPT_NOT_PENDING` → `409 { error: 'Este gabarito já foi enviado.' }`.
5. Atualizar a `presencial_submissions`: `answers`, `total_correct`, `score_percentage`, `submitted_at = now()`.
6. Responder com os agregados + `is_linked` + `is_within_window`.

> A validação do passo 2 é o que impede descobrir o gabarito por tentativa e erro: sem ela, um envio parcial repetido revelaria respostas. Combinada com o `status` one-way do attempt e o índice único por conta, o envio é único.

- [ ] **Step 2: Deploy e teste manual do ciclo completo**

Deploy com `mcp__supabase__deploy_edge_function`.

Fazer `checkin` com um e-mail real de conta sem attempt do S7, guardar o `token`, montar um `answers` completo a partir do `questions` devolvido e chamar `submit`. Esperado: `total_questions` igual ao do S7, `by_area` não vazio, `is_linked: true`, `is_within_window` conforme a data corrente.

Conferir no banco e depois limpar:

```sql
select attempt_type, status, score_percentage, is_within_window
from public.attempts where id = '<attempt_id>';
-- Esperado: presencial / submitted / nota / conforme janela

select status, identification_path, total_correct, submitted_at is not null as enviado
from public.presencial_submissions where linked_attempt_id = '<attempt_id>';
-- Esperado: linked / email_direct / nota / true
```

- [ ] **Step 3: Confirmar que o reenvio é recusado**

Repetir o `submit` com o mesmo token. Esperado: `409` com `'Este gabarito já foi enviado.'`

- [ ] **Step 4: Rodar as travas e commitar**

```bash
npm run check:edge-pins && npm run test && npm run typecheck
```

```bash
git add supabase/functions/presencial/index.ts
git commit -m "feat(edge): presencial — envio do gabarito e resultado agregado"
```

---

## Fase 3 — Front público

### Task 11: Tipos e serviço

**Files:**
- Create: `src/types/presencial.ts`
- Create: `src/services/presencialApi.ts`, `src/services/presencialApi.test.ts`

**Interfaces:**
- Consumes: Tasks 9–10 (contrato HTTP).
- Produces:
  ```ts
  presencialApi.checkin(input: PresencialIdentifyInput): Promise<PresencialCheckinResult>
  presencialApi.claim(input: PresencialClaimInput): Promise<PresencialReady>
  presencialApi.startUnlinked(input: PresencialIdentifyInput): Promise<PresencialReady>
  presencialApi.submit(input: { token: string; answers: PresencialAnswer[] }): Promise<PresencialResult>
  ```

- [ ] **Step 1: Escrever os tipos**

```ts
// src/types/presencial.ts
export interface PresencialQuestionSkeleton {
  question_id: string
  number: number
  options: Array<{ id: string; label: string }>
}

export interface PresencialCandidate {
  ref: string
  masked_email: string
  hint: string | null
}

export interface PresencialReady {
  status: 'ready'
  token: string
  questions: PresencialQuestionSkeleton[]
}

export type PresencialCheckinResult =
  | PresencialReady
  | { status: 'suggestions'; candidates: PresencialCandidate[] }
  | { status: 'no_account' }

export interface PresencialAreaResult {
  area: string
  total: number
  correct: number
  percentage: number
}

export interface PresencialResult {
  total_questions: number
  total_correct: number
  score_percentage: number
  by_area: PresencialAreaResult[]
  is_linked: boolean
  is_within_window: boolean
}

export interface PresencialAnswer {
  question_id: string
  selected_option_id: string
}

export interface PresencialIdentifyInput {
  code: string
  name: string
  email: string
}

export interface PresencialClaimInput extends PresencialIdentifyInput {
  candidateRef: string
}
```

- [ ] **Step 2: Escrever o teste do serviço (falhando)**

```ts
// src/services/presencialApi.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const invoke = vi.fn()
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { functions: { invoke: (...a: unknown[]) => invoke(...a) } },
}))
vi.mock('@/lib/analytics', () => ({ trackEvent: vi.fn() }))

import { presencialApi } from './presencialApi'

describe('presencialApi', () => {
  beforeEach(() => { invoke.mockReset() })

  it('checkin envia action e campos normalizados', async () => {
    invoke.mockResolvedValue({ data: { status: 'no_account' }, error: null })
    const res = await presencialApi.checkin({
      code: 'S7-REC', name: '  Fulano  ', email: '  FULANO@GMAIL.COM ',
    })
    expect(invoke).toHaveBeenCalledWith('presencial', {
      body: { action: 'checkin', code: 's7-rec', name: 'Fulano', email: 'fulano@gmail.com' },
    })
    expect(res).toEqual({ status: 'no_account' })
  })

  it('propaga a mensagem de erro devolvida no corpo', async () => {
    invoke.mockResolvedValue({ data: { error: 'Esta sala não está aberta.' }, error: null })
    await expect(
      presencialApi.checkin({ code: 's7-rec', name: 'A', email: 'a@b.com' }),
    ).rejects.toThrow('Esta sala não está aberta.')
  })

  it('submit envia token e respostas', async () => {
    const result = {
      total_questions: 2, total_correct: 1, score_percentage: 50,
      by_area: [], is_linked: true, is_within_window: true,
    }
    invoke.mockResolvedValue({ data: result, error: null })
    const res = await presencialApi.submit({
      token: 'tok', answers: [{ question_id: 'q1', selected_option_id: 'o1' }],
    })
    expect(invoke).toHaveBeenCalledWith('presencial', {
      body: {
        action: 'submit', token: 'tok',
        answers: [{ question_id: 'q1', selected_option_id: 'o1' }],
      },
    })
    expect(res).toEqual(result)
  })
})
```

- [ ] **Step 3: Rodar (falha), implementar `presencialApi.ts`, rodar (passa)**

O serviço normaliza `code` (minúsculas), `name` (trim) e `email` (trim + minúsculas), levanta `Error` quando o corpo traz `error`, e emite os eventos de telemetria (`presencial_checkin_started`, `presencial_identified` com `identification_path`, `presencial_no_account`, `presencial_unlinked_started`, `presencial_submitted`) via `trackEvent` de `@/lib/analytics`. Logs com `logger` de `@/lib/logger`.

```bash
npx vitest run src/services/presencialApi.test.ts
```
Esperado: PASS (3 testes).

- [ ] **Step 4: Commit**

```bash
git add src/types/presencial.ts src/services/presencialApi.ts src/services/presencialApi.test.ts
git commit -m "feat(presencial): tipos e serviço do fluxo presencial"
```

---

### Task 12: Tela 1 — identificação

**Files:**
- Create: `src/components/presencial/PresencialCandidateCard.tsx`
- Create: `src/components/presencial/PresencialIdentifyStep.tsx`, `src/components/presencial/PresencialIdentifyStep.test.tsx`

**Interfaces:**
- Consumes: Task 11.
- Produces: `<PresencialIdentifyStep code={string} onReady={(ready: PresencialReady, declared: { name: string; email: string }) => void} />`

- [ ] **Step 1: Escrever o teste (falhando)**

Seguir o padrão de `src/pages/AnswerSheetPage.test.tsx`: mock de `framer-motion`, de `@/lib/analytics` e de `@/hooks/use-toast`.

```tsx
// src/components/presencial/PresencialIdentifyStep.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('framer-motion', () => ({
  motion: new Proxy({}, {
    get: () => ({ children, ...rest }: any) => <div {...rest}>{children}</div>,
  }),
  AnimatePresence: ({ children }: any) => <>{children}</>,
  useReducedMotion: () => false,
}))
vi.mock('@/lib/analytics', () => ({ trackEvent: vi.fn() }))
vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }))
vi.mock('@/services/presencialApi', () => ({
  presencialApi: { checkin: vi.fn(), claim: vi.fn(), startUnlinked: vi.fn() },
}))

import { presencialApi } from '@/services/presencialApi'
import { PresencialIdentifyStep } from './PresencialIdentifyStep'

const READY = { status: 'ready' as const, token: 'tok', questions: [] }

function renderStep(onReady = vi.fn()) {
  render(<PresencialIdentifyStep code="s7-rec" onReady={onReady} />)
  return onReady
}

function fill(name: string, email: string) {
  fireEvent.change(screen.getByLabelText(/nome completo/i), { target: { value: name } })
  fireEvent.change(screen.getByLabelText(/e-mail/i), { target: { value: email } })
}

describe('PresencialIdentifyStep', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('deixa claro em qual plataforma o aluno está', () => {
    renderStep()
    expect(screen.getByText(/plataforma de simulados/i)).toBeInTheDocument()
  })

  it('não envia com campos vazios', () => {
    renderStep()
    fireEvent.click(screen.getByRole('button', { name: /continuar/i }))
    expect(presencialApi.checkin).not.toHaveBeenCalled()
  })

  it('chama onReady quando o e-mail é encontrado', async () => {
    vi.mocked(presencialApi.checkin).mockResolvedValue(READY)
    const onReady = renderStep()
    fill('Fulano de Teste', 'fulano@gmail.com')
    fireEvent.click(screen.getByRole('button', { name: /continuar/i }))
    await waitFor(() => {
      expect(onReady).toHaveBeenCalledWith(READY, {
        name: 'Fulano de Teste', email: 'fulano@gmail.com',
      })
    })
  })

  it('mostra candidatos mascarados quando o e-mail não é encontrado', async () => {
    vi.mocked(presencialApi.checkin).mockResolvedValue({
      status: 'suggestions',
      candidates: [{ ref: 'r1', masked_email: 'fu••••no@g••••.com', hint: 'fez os Simulados 5 e 6' }],
    })
    renderStep()
    fill('Fulano de Teste', 'errado@gmail.com')
    fireEvent.click(screen.getByRole('button', { name: /continuar/i }))
    await waitFor(() => {
      expect(screen.getByText('fu••••no@g••••.com')).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: /é minha conta/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /nenhuma é minha/i })).toBeInTheDocument()
  })

  it('reivindica o candidato escolhido', async () => {
    vi.mocked(presencialApi.checkin).mockResolvedValue({
      status: 'suggestions',
      candidates: [{ ref: 'r1', masked_email: 'fu••••no@g••••.com', hint: null }],
    })
    vi.mocked(presencialApi.claim).mockResolvedValue(READY)
    const onReady = renderStep()
    fill('Fulano de Teste', 'errado@gmail.com')
    fireEvent.click(screen.getByRole('button', { name: /continuar/i }))
    await waitFor(() => screen.getByRole('button', { name: /é minha conta/i }))
    fireEvent.click(screen.getByRole('button', { name: /é minha conta/i }))
    await waitFor(() => {
      expect(presencialApi.claim).toHaveBeenCalledWith(
        expect.objectContaining({ code: 's7-rec', candidateRef: 'r1' }),
      )
      expect(onReady).toHaveBeenCalled()
    })
  })

  it('oferece "seguir sem vincular" e usa startUnlinked', async () => {
    vi.mocked(presencialApi.checkin).mockResolvedValue({ status: 'no_account' })
    vi.mocked(presencialApi.startUnlinked).mockResolvedValue(READY)
    const onReady = renderStep()
    fill('Fulano de Teste', 'novo@gmail.com')
    fireEvent.click(screen.getByRole('button', { name: /continuar/i }))
    await waitFor(() => screen.getByRole('button', { name: /seguir sem vincular/i }))
    fireEvent.click(screen.getByRole('button', { name: /seguir sem vincular/i }))
    await waitFor(() => { expect(presencialApi.startUnlinked).toHaveBeenCalled() })
    expect(onReady).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
npx vitest run src/components/presencial/PresencialIdentifyStep.test.tsx
```
Esperado: FAIL — "Failed to resolve import './PresencialIdentifyStep'".

- [ ] **Step 3: Implementar os dois componentes**

`PresencialCandidateCard` recebe `candidate` e `onClaim`, renderiza o `masked_email` em `font-mono`, o `hint` em `text-muted-foreground` quando presente, e o botão **"É minha conta"**.

`PresencialIdentifyStep` mantém um estado de sub-etapa (`form` → `suggestions` | `no_account`), com:
- inputs de **nome completo** e **e-mail**, com `<Label htmlFor>` (os testes usam `getByLabelText`);
- cabeçalho: *"Você está na Plataforma de Simulados SanarFlix PRO. Informe o e-mail que você usa aqui — se você já tem conta."*;
- botão primário **"Continuar"**, desabilitado enquanto nome ou e-mail estiverem vazios e enquanto a chamada estiver em voo;
- em `suggestions`: os cards + **"Nenhuma é minha"** (leva a `no_account`);
- em `no_account`: CTA **"Criar minha conta"** (link para `/login` com `redirect` de volta a `/presencial/:codigo`) e o botão secundário **"Seguir sem vincular agora"**, com o aviso *"sua nota só entra no ranking depois que vincularmos sua conta"*;
- botão secundário **"Seguir sem vincular agora"** também disponível na sub-etapa `suggestions`;
- erros da API em `toast({ variant: 'destructive' })`.

- [ ] **Step 4: Rodar e confirmar que passa**

```bash
npx vitest run src/components/presencial/PresencialIdentifyStep.test.tsx
```
Esperado: PASS (6 testes).

- [ ] **Step 5: Commit**

```bash
git add src/components/presencial/
git commit -m "feat(presencial): tela de identificação com sugestão de conta por nome"
```

---

### Task 13: Telas 2 e 3 + rota pública

**Files:**
- Create: `src/components/presencial/PresencialResultStep.tsx`
- Create: `src/pages/PresencialPage.tsx`, `src/pages/PresencialPage.test.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: Tasks 11–12; `AnswerSheetGrid` de `@/components/exam/AnswerSheetGrid`.
- Produces: rota `/presencial/:codigo`.

> `AnswerSheetGrid` já existe e recebe `{ questions: AnswerSheetQuestion[], answers: Record<string,string>, onSelect, focusedQuestionId }`, onde `AnswerSheetQuestion = { id, number, options: {id,label}[] }`. O esqueleto da Edge Function mapeia direto: `{ id: question_id, number, options }`. Apesar do docstring dizer 2 colunas, o componente renderiza **3**.

- [ ] **Step 1: Escrever o teste da página (falhando)**

```tsx
// src/pages/PresencialPage.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

vi.mock('framer-motion', () => ({
  motion: new Proxy({}, {
    get: () => ({ children, ...rest }: any) => <div {...rest}>{children}</div>,
  }),
  AnimatePresence: ({ children }: any) => <>{children}</>,
  useReducedMotion: () => false,
}))
vi.mock('@/lib/analytics', () => ({ trackEvent: vi.fn() }))
vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }))
vi.mock('@/services/presencialApi', () => ({
  presencialApi: {
    checkin: vi.fn(), claim: vi.fn(), startUnlinked: vi.fn(), submit: vi.fn(),
  },
}))

import { presencialApi } from '@/services/presencialApi'
import PresencialPage from './PresencialPage'

const questions = [1, 2].map(n => ({
  question_id: `q${n}`,
  number: n,
  options: ['A', 'B', 'C', 'D'].map(l => ({ id: `q${n}${l}`, label: l })),
}))

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/presencial/s7-rec']}>
      <Routes>
        <Route path="/presencial/:codigo" element={<PresencialPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

async function goToSheet() {
  vi.mocked(presencialApi.checkin).mockResolvedValue({
    status: 'ready', token: 'tok', questions,
  })
  renderPage()
  fireEvent.change(screen.getByLabelText(/nome completo/i), {
    target: { value: 'Fulano de Teste' },
  })
  fireEvent.change(screen.getByLabelText(/e-mail/i), {
    target: { value: 'fulano@gmail.com' },
  })
  fireEvent.click(screen.getByRole('button', { name: /continuar/i }))
  await waitFor(() =>
    screen.getByRole('button', { name: /Questão 1 .*alternativa A/ }),
  )
}

describe('PresencialPage', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('vai da identificação para o gabarito', async () => {
    await goToSheet()
    expect(screen.getByRole('button', { name: /Questão 2 .*alternativa D/ })).toBeInTheDocument()
  })

  it('só habilita o envio com todas as questões marcadas', async () => {
    await goToSheet()
    const enviar = () => screen.getByRole('button', { name: /enviar gabarito/i })
    expect(enviar()).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: /Questão 1 .*alternativa A/ }))
    expect(enviar()).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: /Questão 2 .*alternativa B/ }))
    expect(enviar()).not.toBeDisabled()
  })

  it('envia e mostra nota e áreas', async () => {
    vi.mocked(presencialApi.submit).mockResolvedValue({
      total_questions: 2, total_correct: 1, score_percentage: 50,
      by_area: [{ area: 'Clínica Médica', total: 2, correct: 1, percentage: 50 }],
      is_linked: true, is_within_window: true,
    })
    await goToSheet()
    fireEvent.click(screen.getByRole('button', { name: /Questão 1 .*alternativa A/ }))
    fireEvent.click(screen.getByRole('button', { name: /Questão 2 .*alternativa B/ }))
    fireEvent.click(screen.getByRole('button', { name: /enviar gabarito/i }))
    fireEvent.click(screen.getByRole('button', { name: /confirmar envio/i }))

    await waitFor(() => {
      expect(presencialApi.submit).toHaveBeenCalledWith({
        token: 'tok',
        answers: [
          { question_id: 'q1', selected_option_id: 'q1A' },
          { question_id: 'q2', selected_option_id: 'q2B' },
        ],
      })
    })
    expect(await screen.findByText(/Clínica Médica/)).toBeInTheDocument()
    expect(screen.getByText(/07\/09/)).toBeInTheDocument()
  })

  it('avisa que a nota depende de vínculo quando is_linked é falso', async () => {
    vi.mocked(presencialApi.submit).mockResolvedValue({
      total_questions: 2, total_correct: 2, score_percentage: 100,
      by_area: [], is_linked: false, is_within_window: true,
    })
    await goToSheet()
    fireEvent.click(screen.getByRole('button', { name: /Questão 1 .*alternativa A/ }))
    fireEvent.click(screen.getByRole('button', { name: /Questão 2 .*alternativa B/ }))
    fireEvent.click(screen.getByRole('button', { name: /enviar gabarito/i }))
    fireEvent.click(screen.getByRole('button', { name: /confirmar envio/i }))
    expect(await screen.findByText(/confirmarmos sua conta/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
npx vitest run src/pages/PresencialPage.test.tsx
```
Esperado: FAIL — "Failed to resolve import './PresencialPage'".

- [ ] **Step 3: Implementar `PresencialResultStep` e `PresencialPage`**

`PresencialResultStep` recebe `result: PresencialResult` e mostra:
- acertos como número grande (`text-kpi`) + `score_percentage`;
- lista de áreas, cada uma com nome, `correct/total` e uma barra de progresso;
- quando `is_linked`: *"Gabarito comentado, ranking e caderno de erros liberam em **07/09**. Entre na sua conta em simulados.sanar.com.br."*;
- quando `!is_linked`: além do texto acima, o aviso *"Sua nota entra no ranking quando confirmarmos sua conta."*
- **Sem** correção questão-a-questão e **sem** qual era a alternativa correta.

`PresencialPage`:
- lê `codigo` de `useParams`;
- estado de etapa: `identify` → `sheet` → `result`;
- em `sheet`, mapeia o esqueleto para `AnswerSheetQuestion`, controla `answers` e `focusedQuestionId` com auto-avanço para a próxima em branco, barra de progresso, botão sticky **"Enviar gabarito"** desabilitado até todas marcadas, e modal de confirmação com o botão **"Confirmar envio"** — mesmos textos e mesma mecânica de `AnswerSheetPage`;
- as respostas são enviadas na ordem das questões;
- fora do shell premium: layout próprio de uma coluna, com a marca no topo. Sem cronômetro.

- [ ] **Step 4: Rodar e confirmar que passa**

```bash
npx vitest run src/pages/PresencialPage.test.tsx
```
Esperado: PASS (4 testes).

- [ ] **Step 5: Registrar a rota pública em `App.tsx`**

Adicionar o lazy import junto aos outros (após a linha do `AnswerSheetPage`):

```tsx
const PresencialPage = lazy(() => import("./pages/PresencialPage"));
```

E a rota no bloco **Public**, logo depois da linha do `/auth/sso`:

```tsx
<Route path="/presencial/:codigo" element={<Suspense fallback={<PageShell />}><PresencialPage /></Suspense>} />
```

Fora do `ProtectedRoute` e fora do `DashboardLayout` — é o ponto do desenho: a rota não exige sessão.

- [ ] **Step 6: Verificar no navegador**

Subir o dev server pelo Browser pane (`preview_start`, nunca `npm run dev` via Bash) e abrir `/presencial/s7-teste`. Conferir: a tela 1 renderiza sem sidebar e sem redirect para `/login`; o console não tem erro; a tela funciona no viewport `mobile` (375×812), que é como ela vai ser usada.

- [ ] **Step 7: Rodar tudo e commitar**

```bash
npm run test && npm run typecheck && npm run lint
```

```bash
git add src/pages/PresencialPage.tsx src/pages/PresencialPage.test.tsx src/components/presencial/PresencialResultStep.tsx src/App.tsx
git commit -m "feat(presencial): gabarito, resultado e rota pública /presencial/:codigo"
```

---

## Fase 4 — Selo e admin

### Task 14: Selo "Aplicação presencial"

**Files:**
- Create: `src/components/AttemptModalityBadge.tsx`, `src/components/AttemptModalityBadge.test.tsx`
- Modify: as superfícies onde o aluno vê a tentativa (localizadas no Step 2)

**Interfaces:**
- Consumes: `attempts.attempt_type`.
- Produces: `<AttemptModalityBadge attemptType={string | null | undefined} />` — renderiza `null` para qualquer valor diferente de `'presencial'`.

- [ ] **Step 1: Escrever o teste (falhando)**

```tsx
// src/components/AttemptModalityBadge.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AttemptModalityBadge } from './AttemptModalityBadge'

describe('AttemptModalityBadge', () => {
  it('mostra o selo para tentativa presencial', () => {
    render(<AttemptModalityBadge attemptType="presencial" />)
    expect(screen.getByText(/aplicação presencial/i)).toBeInTheDocument()
  })

  it('não renderiza nada para online, offline, nulo ou indefinido', () => {
    const { container } = render(
      <>
        <AttemptModalityBadge attemptType="online" />
        <AttemptModalityBadge attemptType="offline" />
        <AttemptModalityBadge attemptType={null} />
        <AttemptModalityBadge attemptType={undefined} />
      </>,
    )
    expect(container).toBeEmptyDOMElement()
  })
})
```

- [ ] **Step 2: Rodar (falha), implementar, rodar (passa)**

Usa o `Badge` de `@/components/ui/badge` com tokens semânticos (`info`), ícone `MapPin` de `lucide-react`, texto **"Aplicação presencial"**.

```bash
npx vitest run src/components/AttemptModalityBadge.test.tsx
```
Esperado: PASS (2 testes).

- [ ] **Step 3: Encontrar as superfícies e plugar o selo**

```bash
grep -rln "attempt_type" src/ --include=*.tsx
grep -rln "score_percentage\|userState" src/components/premium src/pages --include=*.tsx | head -20
```

Plugar em: card do simulado, tela de resultado e histórico de desempenho. Onde o `attempt_type` ainda não chega ao componente, incluir a coluna na query correspondente em `src/services/simuladosApi.ts` — **sem** remover campo nenhum já selecionado.

- [ ] **Step 4: Rodar tudo e commitar**

```bash
npm run test && npm run typecheck && npm run lint
```

```bash
git add src/components/AttemptModalityBadge.tsx src/components/AttemptModalityBadge.test.tsx src/services/simuladosApi.ts src/pages src/components
git commit -m "feat(presencial): selo 'Aplicação presencial' nas superfícies do aluno"
```

---

### Task 15: Admin — sessões, QR e fila de identidade

**Files:**
- Create: `src/admin/pages/AdminPresencial.tsx`
- Modify: `src/admin/services/adminApi.ts`, `src/admin/types.ts`, `src/App.tsx`, `src/admin/AdminApp.tsx`, `package.json`
- Modify: `src/admin/utils/exportResultsRoster.ts`

**Interfaces:**
- Consumes: Task 7 (RPCs de admin).
- Produces: rota `/admin/presencial`; métodos `adminApi.presencialSessions()`, `adminApi.presencialSessionUpsert()`, `adminApi.presencialQueue()`, `adminApi.presencialLink()`, `adminApi.presencialReassign()`.

- [ ] **Step 1: Adicionar a dependência de QR**

```bash
npm install qrcode.react@4.2.0
```

Pin exato: a rota do admin é lazy, então o peso não entra no bundle principal.

- [ ] **Step 2: Adicionar os tipos e os métodos no `adminApi`**

Espelhar o retorno das RPCs da Task 7 em `src/admin/types.ts` (`PresencialSessionRow`, `PresencialQueueRow`) e adicionar os cinco métodos em `src/admin/services/adminApi.ts`, seguindo o padrão dos métodos existentes do arquivo.

- [ ] **Step 3: Implementar `AdminPresencial.tsx`**

Duas seções na mesma página:

**Sessões** — tabela das sessões (simulado, código, label, janela, ativa, nº de submissões / vinculadas), formulário de criação/edição, e um painel de impressão por sessão com o `QRCodeSVG` de `qrcode.react` apontando para `https://simulados.sanar.com.br/presencial/<code>`, a URL em texto grande embaixo (para quem não conseguir ler o QR) e um botão "Imprimir" (`window.print()`), com `@media print` escondendo a navegação.

**Fila de identidade** — tabela de `admin_presencial_queue`, com `identification_path`, nome/e-mail declarados, nota, hora, sala e a conta sugerida. Ações: **"Vincular a esta conta"** (chama `presencialLink`), **"Escolher outra conta"** (busca por e-mail e chama `presencialLink` com o `user_id` escolhido) e **"Reatribuir tentativa"** (chama `presencialReassign`). Confirmação antes de cada ação — todas são operações que mexem em nota de aluno.

Filtro padrão da fila: `unlinked`. Um seletor permite ver `all`.

- [ ] **Step 4: Registrar rota e navegação**

Em `src/App.tsx`, junto aos outros lazy de admin:

```tsx
const AdminPresencial = lazy(() => import('./admin/pages/AdminPresencial'))
```

E a rota dentro do bloco `<Route path="/admin" ...>`:

```tsx
<Route path="presencial" element={<Suspense fallback={<PageLoadingSkeleton />}><AdminPresencial /></Suspense>} />
```

Adicionar o item na navegação do `src/admin/AdminApp.tsx`, seguindo o padrão dos itens existentes.

- [ ] **Step 5: Modalidade no export de roster**

Em `src/admin/utils/exportResultsRoster.ts`, adicionar a coluna **Modalidade** (`online` / `offline` / `presencial`). Se `admin_simulado_results_roster` não devolver `attempt_type`, incluir a coluna na RPC via `CREATE OR REPLACE` (mesma assinatura, só um campo novo no `RETURNS TABLE` → isso **muda** o tipo de retorno e exige `DROP FUNCTION` + regrant; registrar em `migrations-log.md`).

- [ ] **Step 6: Verificar no navegador**

Abrir `/admin/presencial` pelo Browser pane. Criar uma sessão de teste, conferir que o QR renderiza e que a URL embaixo dele está correta. Conferir a fila vazia sem erro no console. Testar em `light` e `dark`.

- [ ] **Step 7: Rodar tudo e commitar**

```bash
npm run test && npm run typecheck && npm run lint
```

```bash
git add src/admin package.json package-lock.json src/App.tsx
git commit -m "feat(admin): sessões presenciais com QR e fila de identidade"
```

---

### Task 16: Sessão do Simulado 7 e smoke end-to-end

**Files:**
- Create: `supabase/migrations/20260812100700_seed_presencial_s7.sql`
- Modify: `supabase/migrations-log.md`

**Interfaces:**
- Consumes: todas as tasks anteriores.
- Produces: sessão presencial do S7 pronta para o evento.

- [ ] **Step 1: Confirmar data, hora e label do evento com o Felipe**

`opens_at`/`closes_at` precisam cobrir o dia da aplicação **dentro** da janela do S7 (`2026-08-30 12:01Z → 2026-09-06 02:59Z`). Não inventar: a data e o local vêm dele. Enquanto não vierem, criar a sessão com `is_active = false`.

- [ ] **Step 2: Escrever a migration do seed**

```sql
-- Sessão presencial do Simulado 7.
-- opens_at/closes_at em UTC, cobrindo o dia da aplicação (dentro da janela do S7).
-- is_active = false até a confirmação final do evento.
INSERT INTO public.presencial_sessions (simulado_id, code, label, opens_at, closes_at, is_active)
VALUES (
  '6be18ec8-db68-482d-9417-281d66d13ff1',
  '<code-confirmado>',
  '<label-confirmado>',
  '<opens_at-confirmado>',
  '<closes_at-confirmado>',
  false
)
ON CONFLICT (code) DO UPDATE
SET label = EXCLUDED.label,
    opens_at = EXCLUDED.opens_at,
    closes_at = EXCLUDED.closes_at;
```

- [ ] **Step 3: Smoke end-to-end pela URL real**

Com a sessão temporariamente ativa (`is_active = true` e janela cobrindo o agora), rodar o caminho completo no navegador, em viewport `mobile`, com uma conta de teste sem attempt do S7:

1. `/presencial/<code>` → tela 1 renderiza sem redirect para login;
2. e-mail da conta de teste → cai no gabarito;
3. marcar todas → enviar → resultado com nota e áreas;
4. recarregar e tentar de novo → recusa ("já enviou");
5. logar com a conta de teste → o simulado aparece com o selo **"Aplicação presencial"**;
6. tentar abrir a prova online do S7 → recusa com a copy de presencial;
7. `/presencial/<code>` com e-mail inexistente + "seguir sem vincular" → envia, mostra resultado, e a submissão aparece em `/admin/presencial` na fila;
8. vincular pela fila → a nota entra na conta.

Limpar tudo o que o smoke criou (attempt, answers, attempt_question_results, user_performance_history, presencial_submissions) e voltar `is_active = false`.

- [ ] **Step 4: Registrar em migrations-log.md e commitar**

Incluir na entrada o resultado dos 8 passos do smoke.

```bash
git add supabase/migrations/20260812100700_seed_presencial_s7.sql supabase/migrations-log.md
git commit -m "feat(db): sessão presencial do Simulado 7"
```

- [ ] **Step 5: Checklist de véspera do evento (para o Felipe, não código)**

- [ ] `is_active = true` e janela conferida no fuso certo
- [ ] QR impresso e testado com 2 celulares diferentes (Android e iOS)
- [ ] Plano B de rede (4G / envio em duas ondas)
- [ ] Alguém com acesso a `/admin/presencial` na sala
- [ ] Comunicação decidida sobre a assimetria de resultado (presencial vê nota antes de 07/09)

---

## Self-Review

**Cobertura da spec:**

| Requisito da spec | Task |
|---|---|
| `attempt_type` com `'presencial'`, status `presencial_pending` | 1 |
| `presencial_sessions`, `presencial_submissions`, `presencial_duplicate_candidates` | 1 |
| `backup.presencial_superseded_answers` | 1 |
| RLS sem policy nas tabelas novas | 1 |
| `finalize_attempt_with_results_for_user` + wrapper | 2 |
| `score_presencial_answers` (fonte única da Tela 3) | 3 |
| `create_or_convert_presencial_attempt` (presencial ganha, in-place) | 4 |
| `submit_presencial_answers` (+ `is_within_window` server-side) | 4 |
| `create_attempt_guarded` bloqueia online após presencial | 5 |
| `link_presencial_submission` | 6 |
| Rate limit (IP, e-mail, busca por nome) | 6 (RPC) + 9 (aplicação) |
| RPCs de admin com `admin_require` | 7 |
| Mascaramento de e-mail | 8 |
| Normalização de nome + corte em 3 candidatos | 8 |
| Token HMAC 2h, escopo de um gabarito | 8 |
| `checkin` / `claim` / `start-unlinked` | 9 |
| Esqueleto sem enunciado nem alternativa | 9 |
| `verify_jwt = false` | 9 |
| `submit` + validação que impede reenvio parcial | 10 |
| Tela 1 (nome + e-mail, sugestões, desempate, sem vincular) | 12 |
| Tela 2 (gabarito reusando `AnswerSheetGrid`, sem timer, 100 obrigatórias) | 13 |
| Tela 3 (nota + áreas, sem questão-a-questão, CTA de 07/09) | 13 |
| Rota pública fora do `AuthGuard` | 13 |
| Selo "Aplicação presencial" | 14 |
| Admin: sessões + QR | 15 |
| Admin: fila de identidade (vincular, escolher outra, reatribuir) | 15 |
| Modalidade no export de roster | 15 |
| Telemetria do funil | 11 |
| Seed da sessão do S7 | 16 |

Sem lacunas.

**Consistência de nomes verificada:** `question_number` (não `number`) em `questions`; `AnswerSheetQuestion` usa `id`/`number`/`options`; o esqueleto da Edge Function usa `question_id`/`number`/`options` e é mapeado na Task 13; `identification_path` tem os mesmos 4 valores no CHECK (Task 1), na RPC de fila (Task 7) e no serviço (Task 11); `PresencialReady`/`PresencialResult` são os mesmos das Tasks 11, 12 e 13.

**Riscos de execução sinalizados nas tasks:** `42P13` na Task 2 (wrapper) e na Task 15 (roster), com o procedimento de `DROP` + regrant; multiplicação de linhas por nome colidente na Task 7; recaptura das definições em produção antes de reescrever função existente nas Tasks 2 e 5.
