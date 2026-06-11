# Ranking — Paridade de dados + Redesign (Direção B) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrar especialidade/instituições para modelo canônico por ID (consertando o match da nota de corte: 19% → ~100% das instituições selecionáveis com corte ou estado explícito) e redesenhar a página de Ranking na Direção B ("Você passaria?" como protagonista).

**Architecture:** Migrations aditivas no Supabase (colunas `*_id` + FKs, backfill via de-para curado, RPCs novos por ID com fallback texto), depois cutover do frontend: contexto/onboarding selecionam por ID, e a UI do ranking é recomposta com componentes novos baseados nos tokens do design system (sem objeto `t` inline nem `MutationObserver`).

**Tech Stack:** Supabase (Postgres + RPCs SECURITY DEFINER), React 18 + TypeScript, TanStack Query 5, Tailwind (tokens semânticos), Vitest.

**Spec:** `docs/superpowers/specs/2026-06-11-ranking-redesign-design.md`

**Branch:** criar `feat/ranking-redesign` a partir do HEAD atual (que já contém a spec).

**Convenções obrigatórias do projeto (CLAUDE.md):** logger via `@/lib/logger` (nunca console.log); toasts via `@/hooks/use-toast`; alias `@/`; tipos de domínio em `src/types/`; nunca editar `src/integrations/supabase/types.ts` manualmente (regenerar via MCP `generate_typescript_types`).

**Fatos medidos (baseline, 2026-06-11):**
- 197 instituições em `enamed_institutions`; 143 nomes distintos em `enamed_cutoff_scores`; 33 match exato normalizado; 37 match via regra LIKE atual.
- 508 perfis com `specialty = 'Ainda não sei'`; 1.575 elementos `'Ainda não sei'` em `target_institutions`.
- `normalize_text_for_match(text)` já existe (unaccent + lower + trim + colapso de espaços + normaliza travessões/aspas).

---

## Fase A — Banco de dados

### Task 1: Branch + migration de schema (colunas canônicas)

**Files:**
- Create: `supabase/migrations/20260611120000_add_canonical_academic_ids.sql`

- [ ] **Step 1: Criar branch**

```bash
git checkout -b feat/ranking-redesign
```

- [ ] **Step 2: Escrever a migration**

Conteúdo de `supabase/migrations/20260611120000_add_canonical_academic_ids.sql`:

```sql
-- Modelo canônico por ID para perfil acadêmico e nota de corte.
-- Colunas aditivas; texto permanece como coluna derivada durante a transição.

ALTER TABLE public.onboarding_profiles
  ADD COLUMN IF NOT EXISTS specialty_id uuid NULL
    REFERENCES public.enamed_specialties(id),
  ADD COLUMN IF NOT EXISTS target_institution_ids uuid[] NOT NULL DEFAULT '{}';

-- "Ainda não sei" passa a ser representado por NULL
ALTER TABLE public.onboarding_profiles
  ALTER COLUMN specialty DROP NOT NULL;

ALTER TABLE public.enamed_cutoff_scores
  ADD COLUMN IF NOT EXISTS specialty_id uuid NULL
    REFERENCES public.enamed_specialties(id),
  ADD COLUMN IF NOT EXISTS institution_id uuid NULL
    REFERENCES public.enamed_institutions(id);

CREATE INDEX IF NOT EXISTS idx_cutoff_scores_inst_spec
  ON public.enamed_cutoff_scores (institution_id, specialty_id);
```

- [ ] **Step 3: Aplicar via MCP**

Usar `mcp__supabase__apply_migration` com `name: "add_canonical_academic_ids"` e o SQL acima.

- [ ] **Step 4: Verificar**

Via `mcp__supabase__execute_sql`:

```sql
select column_name from information_schema.columns
where table_name in ('onboarding_profiles','enamed_cutoff_scores')
  and column_name in ('specialty_id','institution_id','target_institution_ids');
```

Esperado: 4 linhas (`specialty_id` ×2, `institution_id`, `target_institution_ids`).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260611120000_add_canonical_academic_ids.sql
git commit -m "feat(db): colunas canonicas de especialidade/instituicao (perfil + nota de corte)"
```

---

### Task 2: Gerar de-para curado (CSV) — ⛔ CHECKPOINT HUMANO

**Files:**
- Create: `docs/superpowers/specs/2026-06-11-cutoff-de-para.csv`

- [ ] **Step 1: Extrair os dois lados via `mcp__supabase__execute_sql`**

```sql
-- Lado A: nomes da tabela de corte sem match exato normalizado
select distinct cs.institution_name
from enamed_cutoff_scores cs
where not exists (
  select 1 from enamed_institutions ei
  where normalize_text_for_match(ei.name) = normalize_text_for_match(cs.institution_name)
)
order by 1;
```

```sql
-- Lado B: catálogo canônico completo
select id, name, uf from enamed_institutions order by name;
```

- [ ] **Step 2: Propor o mapeamento**

Para cada nome do Lado A, identificar se corresponde a uma instituição do Lado B
(mesma instituição com grafia/forma diferente — ex.: "Hospital de Clínicas da
UFPR" ↔ a entrada da UFPR; siglas; mantenedoras; sufixos de cidade/UF).
Conhecimento de domínio + UF ajudam. Quando não houver correspondência real
(instituição não participa do ENARE/lista canônica), marcar `sem_correspondencia`.

- [ ] **Step 3: Escrever o CSV**

Formato (header obrigatório, uma linha por nome do Lado A):

```csv
cutoff_institution_name,matched_institution_id,matched_institution_name,confianca,observacao
"Hospital de Clínicas da UFPR","<uuid>","Universidade Federal do Paraná",alta,"HC é o cenário de prática da UFPR"
"GOVERNO DO ESTADO DE RORAIMA",,,sem_correspondencia,"não há entrada canônica"
```

`confianca ∈ {alta, media, sem_correspondencia}`.

- [ ] **Step 4: Commit + PARAR para revisão**

```bash
git add docs/superpowers/specs/2026-06-11-cutoff-de-para.csv
git commit -m "feat(dados): proposta de de-para nota de corte -> instituicoes canonicas"
```

**⛔ PARAR AQUI.** Apresentar resumo ao Felipe (quantos `alta`/`media`/`sem_correspondencia`) e aguardar aprovação/ajustes do CSV antes da Task 3. Ajustes solicitados são editados no CSV e commitados antes de prosseguir.

---

### Task 3: Migration de backfill

**Files:**
- Create: `supabase/migrations/20260611130000_backfill_canonical_academic_ids.sql`

- [ ] **Step 1: Escrever a migration**

A seção (3) é **gerada a partir do CSV aprovado**: uma linha `UPDATE` por linha
do CSV com `confianca != 'sem_correspondencia'`. Template completo:

```sql
-- 1. Cortes: specialty_id por match exato normalizado (cobertura validada: 100%)
UPDATE public.enamed_cutoff_scores cs
SET specialty_id = es.id
FROM public.enamed_specialties es
WHERE cs.specialty_id IS NULL
  AND normalize_text_for_match(es.name) = normalize_text_for_match(cs.specialty_name);

-- 2. Cortes: institution_id por match exato normalizado (~33 nomes)
UPDATE public.enamed_cutoff_scores cs
SET institution_id = ei.id
FROM public.enamed_institutions ei
WHERE cs.institution_id IS NULL
  AND normalize_text_for_match(ei.name) = normalize_text_for_match(cs.institution_name);

-- 3. Cortes: de-para curado e aprovado (gerado do CSV; um UPDATE por linha aprovada)
UPDATE public.enamed_cutoff_scores
SET institution_id = '<matched_institution_id>'
WHERE institution_id IS NULL
  AND institution_name = '<cutoff_institution_name>';
-- ... (repetir para cada linha do CSV com confianca em ('alta','media'))

-- 4. Perfis: specialty_id por match exato ("Ainda não sei" não casa => fica NULL)
UPDATE public.onboarding_profiles op
SET specialty_id = es.id
FROM public.enamed_specialties es
WHERE op.specialty_id IS NULL
  AND op.specialty IS NOT NULL
  AND normalize_text_for_match(es.name) = normalize_text_for_match(op.specialty);

-- 5. Perfis: literal "Ainda não sei" => NULL no texto também
UPDATE public.onboarding_profiles
SET specialty = NULL
WHERE specialty IS NOT NULL
  AND normalize_text_for_match(specialty) = normalize_text_for_match('Ainda não sei')
  AND specialty_id IS NULL;

-- 6. Perfis: instituições => ids (preserva ordem, descarta "Ainda não sei"
--    e nomes sem match) e re-sincroniza o array de nomes canônicos
UPDATE public.onboarding_profiles op
SET target_institution_ids = sub.ids,
    target_institutions    = sub.names
FROM (
  SELECT op2.user_id,
         COALESCE(array_agg(ei.id   ORDER BY t.ord) FILTER (WHERE ei.id IS NOT NULL), '{}') AS ids,
         COALESCE(array_agg(ei.name ORDER BY t.ord) FILTER (WHERE ei.id IS NOT NULL), '{}') AS names
  FROM public.onboarding_profiles op2
  CROSS JOIN LATERAL unnest(op2.target_institutions) WITH ORDINALITY AS t(name, ord)
  LEFT JOIN public.enamed_institutions ei
    ON normalize_text_for_match(ei.name) = normalize_text_for_match(t.name)
  GROUP BY op2.user_id
) sub
WHERE sub.user_id = op.user_id;
```

- [ ] **Step 2: Validar geração do de-para**

Antes de aplicar, conferir que cada `cutoff_institution_name` aparece no máximo
uma vez na seção (3) e que todos os UUIDs existem:

```sql
-- rodar com os UUIDs do CSV
select count(*) from enamed_institutions where id in ('<uuid1>','<uuid2>', ...);
```

Esperado: count = número de UUIDs distintos do CSV.

- [ ] **Step 3: Aplicar via MCP** (`apply_migration`, name: `backfill_canonical_academic_ids`)

- [ ] **Step 4: Verificar (queries de aceite)**

```sql
-- a) Zero "Ainda não sei" literal remanescente
select
  (select count(*) from onboarding_profiles
    where specialty is not null
      and normalize_text_for_match(specialty) = normalize_text_for_match('Ainda não sei')) as spec_literal,
  (select count(*) from onboarding_profiles
    where 'Ainda não sei' = any(target_institutions)) as inst_literal;
-- Esperado: 0, 0

-- b) Cobertura de corte por ID (meta: >= ~120 das 143 com FK; relatar o número)
select count(distinct institution_name) filter (where institution_id is not null) as mapeadas,
       count(distinct institution_name) as total
from enamed_cutoff_scores;

-- c) Instituições selecionáveis com corte (baseline era 37/197; relatar novo número)
select count(*) filter (where exists (
  select 1 from enamed_cutoff_scores cs where cs.institution_id = ei.id)) as com_corte,
  count(*) as total
from enamed_institutions ei;

-- d) Perfis migrados
select count(*) filter (where specialty_id is not null) as com_spec_id,
       count(*) filter (where cardinality(target_institution_ids) > 0) as com_inst_ids,
       count(*) as total
from onboarding_profiles;
```

Registrar os números no commit message.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260611130000_backfill_canonical_academic_ids.sql
git commit -m "feat(db): backfill de IDs canonicos (cortes + perfis); zera 'Ainda nao sei' literal"
```

---

### Task 4: Migration de RPCs (get_cutoff_scores, save por ID, ranking por ID)

**Files:**
- Create: `supabase/migrations/20260611140000_canonical_academic_rpcs.sql`
- Modify (regenerar): `src/integrations/supabase/types.ts`

- [ ] **Step 1: Escrever a migration**

```sql
-- ── 1. Nota de corte por join exato de ID ─────────────────────────────────
-- Uma linha por instituição-alvo (na ordem do array do usuário).
-- Instituições sem corte simplesmente não retornam (frontend deriva "indisponível").
CREATE OR REPLACE FUNCTION public.get_cutoff_scores(
  p_specialty_id uuid,
  p_institution_ids uuid[]
)
RETURNS TABLE(
  institution_id uuid,
  institution_name text,
  practice_scenario text,
  specialty_name text,
  cutoff_score_general numeric,
  cutoff_score_quota numeric
)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT DISTINCT ON (t.ord)
    ei.id,
    ei.name,
    cs.practice_scenario,
    cs.specialty_name,
    cs.cutoff_score_general,
    cs.cutoff_score_quota
  FROM unnest(p_institution_ids) WITH ORDINALITY AS t(id, ord)
  JOIN public.enamed_institutions ei ON ei.id = t.id
  JOIN public.enamed_cutoff_scores cs
    ON cs.institution_id = t.id
   AND cs.specialty_id = p_specialty_id
  ORDER BY t.ord, cs.cutoff_score_general DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_cutoff_scores(uuid, uuid[]) TO authenticated;

-- ── 2. Save de onboarding por ID (nova sobrecarga; nomes derivados) ────────
CREATE OR REPLACE FUNCTION public.save_onboarding_guarded(
  p_specialty_id uuid,
  p_target_institution_ids uuid[]
)
RETURNS public.onboarding_profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_now timestamptz := now();
  v_specialty_name text := NULL;
  v_inst_ids uuid[] := COALESCE(p_target_institution_ids, '{}');
  v_inst_names text[] := '{}';
  v_result public.onboarding_profiles%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado';
  END IF;

  -- specialty_id NULL = "Ainda não sei" (permitido)
  IF p_specialty_id IS NOT NULL THEN
    SELECT name INTO v_specialty_name
    FROM public.enamed_specialties WHERE id = p_specialty_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Especialidade invalida';
    END IF;
  END IF;

  -- valida instituições e deriva nomes na mesma ordem
  IF cardinality(v_inst_ids) > 0 THEN
    SELECT array_agg(ei.name ORDER BY t.ord) INTO v_inst_names
    FROM unnest(v_inst_ids) WITH ORDINALITY AS t(id, ord)
    JOIN public.enamed_institutions ei ON ei.id = t.id;
    IF COALESCE(cardinality(v_inst_names), 0) <> cardinality(v_inst_ids) THEN
      RAISE EXCEPTION 'Instituicao invalida';
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM public.onboarding_profiles o WHERE o.user_id = v_user_id) THEN
    IF public.is_any_simulado_window_open(v_now) THEN
      RAISE EXCEPTION 'Perfil so pode ser editado entre janelas de execucao';
    END IF;
    UPDATE public.onboarding_profiles
    SET specialty_id = p_specialty_id,
        specialty = v_specialty_name,
        target_institution_ids = v_inst_ids,
        target_institutions = v_inst_names,
        status = 'completed',
        completed_at = COALESCE(completed_at, v_now),
        updated_at = v_now
    WHERE user_id = v_user_id
    RETURNING * INTO v_result;
  ELSE
    INSERT INTO public.onboarding_profiles (
      user_id, specialty_id, specialty, target_institution_ids,
      target_institutions, status, completed_at
    ) VALUES (
      v_user_id, p_specialty_id, v_specialty_name, v_inst_ids,
      v_inst_names, 'completed', v_now
    )
    RETURNING * INTO v_result;
  END IF;

  RETURN v_result;
END;
$$;

-- ── 3. Sobrecarga antiga (text) passa a sincronizar os IDs ─────────────────
-- Fecha a janela entre backfill e cutover do frontend: salvar por texto
-- também resolve os IDs por match exato ("Ainda não sei" => NULL/{}).
CREATE OR REPLACE FUNCTION public.save_onboarding_guarded(
  p_specialty text,
  p_target_institutions text[]
)
RETURNS public.onboarding_profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_spec_id uuid;
  v_inst_ids uuid[];
BEGIN
  IF p_specialty IS NULL OR btrim(p_specialty) = '' THEN
    RAISE EXCEPTION 'Especialidade obrigatoria';
  END IF;
  IF COALESCE(array_length(p_target_institutions, 1), 0) < 1 THEN
    RAISE EXCEPTION 'Selecione ao menos uma instituicao ou marque Ainda nao sei';
  END IF;

  SELECT es.id INTO v_spec_id
  FROM public.enamed_specialties es
  WHERE normalize_text_for_match(es.name) = normalize_text_for_match(p_specialty);

  SELECT COALESCE(array_agg(ei.id ORDER BY t.ord) FILTER (WHERE ei.id IS NOT NULL), '{}')
  INTO v_inst_ids
  FROM unnest(p_target_institutions) WITH ORDINALITY AS t(name, ord)
  LEFT JOIN public.enamed_institutions ei
    ON normalize_text_for_match(ei.name) = normalize_text_for_match(t.name);

  RETURN public.save_onboarding_guarded(v_spec_id, v_inst_ids);
END;
$$;

-- ── 4. Ranking deriva nomes canônicos dos IDs (fallback: texto) ────────────
CREATE OR REPLACE FUNCTION public.get_ranking_for_simulado(p_simulado_id uuid)
RETURNS TABLE(user_id uuid, simulado_id uuid, nota_final numeric, total_correct integer, total_answered integer, finished_at timestamptz, full_name text, segment user_segment, especialidade text, instituicoes_alvo text[], posicao bigint, total_candidatos bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    a.user_id,
    a.simulado_id,
    a.score_percentage AS nota_final,
    a.total_correct,
    a.total_answered,
    a.finished_at,
    p.full_name,
    p.segment,
    COALESCE(es.name, op.specialty) AS especialidade,
    COALESCE(
      (SELECT array_agg(ei.name ORDER BY t.ord)
       FROM unnest(op.target_institution_ids) WITH ORDINALITY AS t(id, ord)
       JOIN enamed_institutions ei ON ei.id = t.id),
      op.target_institutions
    ) AS instituicoes_alvo,
    ROW_NUMBER() OVER (
      ORDER BY a.score_percentage DESC NULLS LAST, a.finished_at ASC NULLS LAST
    ) AS posicao,
    COUNT(*) OVER () AS total_candidatos
  FROM attempts a
  JOIN profiles p ON p.id = a.user_id
  LEFT JOIN onboarding_profiles op ON op.user_id = a.user_id
  LEFT JOIN enamed_specialties es ON es.id = op.specialty_id
  WHERE a.simulado_id = p_simulado_id
    AND a.status IN ('submitted', 'expired')
    AND a.score_percentage IS NOT NULL
    AND a.is_within_window = true
  ORDER BY a.score_percentage DESC NULLS LAST, a.finished_at ASC NULLS LAST
$$;

-- ── 5. Mesma derivação no preview admin ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_get_ranking_for_simulado(p_simulado_id uuid, p_include_train boolean DEFAULT false)
RETURNS TABLE(user_id uuid, simulado_id uuid, nota_final numeric, total_correct integer, total_answered integer, finished_at timestamptz, full_name text, segment user_segment, especialidade text, instituicoes_alvo text[], posicao bigint, total_candidatos bigint)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = 'P0003';
  END IF;

  RETURN QUERY
  SELECT
    a.user_id,
    a.simulado_id,
    a.score_percentage AS nota_final,
    a.total_correct,
    a.total_answered,
    a.finished_at,
    p.full_name,
    p.segment,
    COALESCE(es.name, op.specialty) AS especialidade,
    COALESCE(
      (SELECT array_agg(ei.name ORDER BY t.ord)
       FROM unnest(op.target_institution_ids) WITH ORDINALITY AS t(id, ord)
       JOIN public.enamed_institutions ei ON ei.id = t.id),
      op.target_institutions
    ) AS instituicoes_alvo,
    ROW_NUMBER() OVER (
      ORDER BY a.score_percentage DESC NULLS LAST, a.finished_at ASC NULLS LAST
    )::bigint AS posicao,
    COUNT(*) OVER ()::bigint AS total_candidatos
  FROM public.attempts a
  JOIN public.profiles p ON p.id = a.user_id
  LEFT JOIN public.onboarding_profiles op ON op.user_id = a.user_id
  LEFT JOIN public.enamed_specialties es ON es.id = op.specialty_id
  WHERE a.simulado_id = p_simulado_id
    AND a.status IN ('submitted', 'expired')
    AND a.score_percentage IS NOT NULL
    AND (p_include_train OR a.is_within_window = true)
  ORDER BY a.score_percentage DESC NULLS LAST, a.finished_at ASC NULLS LAST;
END;
$$;
```

Nota de segurança: `get_cutoff_scores` NÃO é SECURITY DEFINER (lê tabelas de
referência com RLS de leitura pública, como o `match_cutoff_score` atual).
As sobrecargas de `save_onboarding_guarded` têm nomes de parâmetros distintos
(`p_specialty_id`/`p_target_institution_ids` vs `p_specialty`/`p_target_institutions`),
então o PostgREST resolve sem ambiguidade.

- [ ] **Step 2: Aplicar via MCP** (`apply_migration`, name: `canonical_academic_rpcs`)

- [ ] **Step 3: Smoke test via SQL**

```sql
-- com uma especialidade e instituições reais que tenham corte (pegar ids do banco):
select * from get_cutoff_scores(
  (select id from enamed_specialties where name ilike 'PEDIATRIA' limit 1),
  (select array_agg(id) from (select id from enamed_institutions limit 3) s)
);
-- Esperado: 0..3 linhas, sem erro.

select especialidade, instituicoes_alvo from get_ranking_for_simulado(
  (select id from simulados where status='published' limit 1)
) limit 5;
-- Esperado: nomes canônicos; sem 'Ainda não sei'.
```

- [ ] **Step 4: Regenerar tipos TS**

Usar `mcp__supabase__generate_typescript_types` e sobrescrever
`src/integrations/supabase/types.ts` com o resultado.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260611140000_canonical_academic_rpcs.sql src/integrations/supabase/types.ts
git commit -m "feat(db): RPCs canonicos (get_cutoff_scores, save por ID, ranking por ID)"
```

---

## Fase B — Frontend: dados e onboarding

### Task 5: Tipos de domínio + UserContext por ID

**Files:**
- Modify: `src/types/index.ts` (bloco `OnboardingProfile`, linhas 13-20)
- Create: `src/lib/academic-profile.ts`
- Create: `src/lib/academic-profile.test.ts`
- Modify: `src/contexts/UserContext.tsx` (interface linha 20, mapeamento linhas 102-116, saveOnboarding linhas 170-190)

- [ ] **Step 1: Teste falhando para o helper**

`src/lib/academic-profile.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { UNDECIDED_LABEL, displaySpecialty } from '@/lib/academic-profile';

describe('academic-profile helpers', () => {
  it('UNDECIDED_LABEL é o literal de exibição', () => {
    expect(UNDECIDED_LABEL).toBe('Ainda não sei');
  });

  it('displaySpecialty devolve o nome quando há especialidade', () => {
    expect(displaySpecialty({ specialtyId: 'abc', specialty: 'PEDIATRIA' })).toBe('PEDIATRIA');
  });

  it('displaySpecialty devolve o rótulo indeciso quando specialtyId é null', () => {
    expect(displaySpecialty({ specialtyId: null, specialty: '' })).toBe(UNDECIDED_LABEL);
    expect(displaySpecialty(null)).toBe(UNDECIDED_LABEL);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/academic-profile.test.ts`
Expected: FAIL (módulo não existe).

- [ ] **Step 3: Implementar tipos + helper**

Em `src/types/index.ts`, substituir `OnboardingProfile` e adicionar tipos de seleção:

```ts
export interface OnboardingProfile {
  id?: string;
  userId: string;
  /** Nome canônico da especialidade ('' quando "Ainda não sei"). */
  specialty: string;
  specialtyId: string | null;
  /** Nomes canônicos, mesma ordem de targetInstitutionIds. */
  targetInstitutions: string[];
  targetInstitutionIds: string[];
  status: OnboardingStatus;
  completedAt?: string;
}

/** Seleção de especialidade na UI — id null = "Ainda não sei". */
export interface SpecialtySelection {
  id: string | null;
  name: string;
}

export interface InstitutionSelection {
  id: string;
  name: string;
}
```

`src/lib/academic-profile.ts`:

```ts
/** Rótulo de exibição para perfil sem especialidade definida. */
export const UNDECIDED_LABEL = 'Ainda não sei';

export function displaySpecialty(
  onboarding: { specialtyId: string | null; specialty: string } | null,
): string {
  if (!onboarding || !onboarding.specialtyId) return UNDECIDED_LABEL;
  return onboarding.specialty || UNDECIDED_LABEL;
}
```

- [ ] **Step 4: Atualizar UserContext**

Em `src/contexts/UserContext.tsx`:

1. Interface (linha 20):

```ts
saveOnboarding: (data: { specialtyId: string | null; targetInstitutionIds: string[] }) => Promise<void>;
```

2. Mapeamento do fetch (linhas 102-116) — incluir campos novos:

```ts
const onb: OnboardingProfile = {
  id: o.id,
  userId: o.user_id,
  specialty: o.specialty ?? '',
  specialtyId: o.specialty_id ?? null,
  targetInstitutions: o.target_institutions || [],
  targetInstitutionIds: o.target_institution_ids || [],
  status: o.status as OnboardingStatus,
  completedAt: o.completed_at || undefined,
};
```

3. `saveOnboarding` (linhas 170-190) — chamar a sobrecarga por ID:

```ts
const saveOnboarding = useCallback(async (data: { specialtyId: string | null; targetInstitutionIds: string[] }) => {
  if (!authUser) throw new Error('Not authenticated');
  const { data: savedRow, error } = await supabaseRpc('save_onboarding_guarded', {
    p_specialty_id: data.specialtyId,
    p_target_institution_ids: data.targetInstitutionIds,
  });
  if (error) throw error;

  const row = Array.isArray(savedRow) ? savedRow[0] : savedRow;
  const onboardingData: OnboardingProfile = {
    id: (row as any)?.id,
    userId: (row as any)?.user_id ?? authUser.id,
    specialty: (row as any)?.specialty ?? '',
    specialtyId: (row as any)?.specialty_id ?? data.specialtyId,
    targetInstitutions: (row as any)?.target_institutions ?? [],
    targetInstitutionIds: (row as any)?.target_institution_ids ?? data.targetInstitutionIds,
    status: ((row as any)?.status as OnboardingStatus) ?? 'completed',
    completedAt: (row as any)?.completed_at ?? undefined,
  };
  setOnboarding(onboardingData);
  await fetchOnboardingEditGuard();
  logger.log('[UserContext] Onboarding saved to Supabase');
}, [authUser, fetchOnboardingEditGuard]);
```

- [ ] **Step 5: Rodar testes do helper + typecheck**

Run: `npx vitest run src/lib/academic-profile.test.ts` → PASS.
Run: `npm run build` — vai apontar os call sites quebrados de `saveOnboarding`
(OnboardingPage, ConfiguracoesPage) e usos de `OnboardingProfile`; eles são
corrigidos nas Tasks 7-8. Anotar a lista; não precisa passar ainda.

- [ ] **Step 6: Commit**

```bash
git add src/types/index.ts src/lib/academic-profile.ts src/lib/academic-profile.test.ts src/contexts/UserContext.tsx
git commit -m "feat(perfil): OnboardingProfile e saveOnboarding por IDs canonicos"
```

---

### Task 6: useEnamedData — instituições por specialtyId

**Files:**
- Modify: `src/hooks/useEnamedData.ts:89-128`

- [ ] **Step 1: Trocar assinatura de `useInstitutionsBySpecialty`**

Substituir a função (linhas 89-128) por busca via id (remove o find por nome):

```ts
/**
 * Returns institutions that offer a given specialty (by id), grouped by UF.
 * specialtyId null/'' => "Ainda não sei" => sem lista.
 */
export function useInstitutionsBySpecialty(specialtyId: string | null) {
  const { data: institutions } = useEnamedInstitutions();
  const { data: programs } = useEnamedPrograms();

  return useMemo(() => {
    if (!specialtyId || !institutions || !programs) return { grouped: null, flat: null };

    const relevantPrograms = programs.filter((p) => p.specialty_id === specialtyId);
    const instMap = new Map(institutions.map((i) => [i.id, i]));

    const flat: InstitutionWithProgram[] = relevantPrograms
      .map((p) => {
        const inst = instMap.get(p.institution_id);
        if (!inst) return null;
        return { ...inst, vagas: p.vagas, cenario_pratica: p.cenario_pratica };
      })
      .filter(Boolean) as InstitutionWithProgram[];

    const grouped: Record<string, InstitutionWithProgram[]> = {};
    for (const inst of flat) {
      if (!grouped[inst.uf]) grouped[inst.uf] = [];
      grouped[inst.uf].push(inst);
    }

    const sortedGrouped: Record<string, InstitutionWithProgram[]> = {};
    for (const uf of Object.keys(grouped).sort()) {
      sortedGrouped[uf] = grouped[uf].sort((a, b) => a.name.localeCompare(b.name));
    }

    return { grouped: sortedGrouped, flat };
  }, [institutions, programs, specialtyId]);
}
```

(`useEnamedSpecialties` fica intacto — não é mais necessário aqui.)

- [ ] **Step 2: Commit** (call sites quebrados são corrigidos nas Tasks 7-8 — ver nota da Task 5 Step 5)

```bash
git add src/hooks/useEnamedData.ts
git commit -m "refactor(enamed): useInstitutionsBySpecialty passa a receber specialtyId"
```

---

### Task 7: Onboarding por ID (SpecialtyStep, InstitutionStep, ConfirmationStep, OnboardingPage)

**Files:**
- Modify: `src/components/onboarding/SpecialtyStep.tsx`
- Modify: `src/components/onboarding/InstitutionStep.tsx`
- Modify: `src/components/onboarding/ConfirmationStep.tsx:5-13`
- Modify: `src/pages/OnboardingPage.tsx:100-237, 496-515`
- Modify: `src/components/onboarding/__tests__/InstitutionStep.test.tsx`
- Modify: `src/components/onboarding/__tests__/ConfirmationStep.test.tsx`
- Modify: `src/pages/__tests__/OnboardingPage.test.tsx`

**Modelo de estado (vale para toda a task):** a página guarda
`SpecialtySelection | null` e `InstitutionSelection[]` + flag `undecided` para
instituições. O literal "Ainda não sei" vem só de `UNDECIDED_LABEL`
(`@/lib/academic-profile`) e é exibição, nunca dado salvo.

- [ ] **Step 1: SpecialtyStep**

Mudanças (visual fica idêntico):

```ts
import { UNDECIDED_LABEL } from "@/lib/academic-profile";
import type { SpecialtySelection } from "@/types";

interface Props {
  selection: SpecialtySelection | null;
  onSelect: (s: SpecialtySelection) => void;
}
```

Remover `const AINDA_NAO_SEI = "Ainda não sei";`. Construir opções como objetos:

```ts
const allOptions = useMemo<SpecialtySelection[]>(
  () => [{ id: null, name: UNDECIDED_LABEL }, ...(specialties?.map((s) => ({ id: s.id, name: s.name })) ?? [])],
  [specialties]
);

const filtered = useMemo(() => {
  if (!search.trim()) return allOptions;
  return allOptions.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()));
}, [search, allOptions]);
```

No map dos chips: `key={spec.name}`, `isSelected = selection?.name === spec.name`,
`isUndecided = spec.id === null`, `onClick={() => onSelect(spec)}` e o texto vira `{spec.name}`.

- [ ] **Step 2: InstitutionStep**

Nova interface (remove o sentinel do array `selected`):

```ts
import { UNDECIDED_LABEL } from "@/lib/academic-profile";
import type { InstitutionSelection, SpecialtySelection } from "@/types";

interface Props {
  selected: InstitutionSelection[];
  undecided: boolean;
  onToggleInstitution: (inst: InstitutionSelection) => void;
  onToggleUndecided: () => void;
  selectedSpecialty: SpecialtySelection | null;
}
```

Adaptações no corpo (preservando o JSX/estilos):
- `const isUndecided = undecided;` (apaga `selected.includes(AINDA_NAO_SEI)`).
- `useInstitutionsBySpecialty(selectedSpecialty?.id ?? null)`.
- `isLoading = !grouped && !!selectedSpecialty?.id;`
- `handleToggleUndecided` vira apenas `onToggleUndecided()` — o toast de
  "seleção anterior removida" sobe para a página (Step 4), onde a limpeza acontece.
- `handleToggleInstitution(inst: InstitutionSelection)` — guarda o limite:

```ts
const handleToggleInstitution = (inst: InstitutionSelection) => {
  const alreadySelected = selected.some((s) => s.id === inst.id);
  if (!alreadySelected && selected.length >= MAX_INSTITUTIONS) {
    toast({
      title: `Máximo de ${MAX_INSTITUTIONS} instituições`,
      description: "Remova uma das selecionadas para trocar.",
    });
    return;
  }
  onToggleInstitution(inst);
};
```

- `realSelected` substituído por `selected` direto. Chips selecionados:
  `key={inst.id}`, `onClick={() => onToggleInstitution(inst)}`, texto `{inst.name}`.
- Na lista por UF: `isSelected = selected.some((s) => s.id === inst.id)` e
  `onClick={() => handleToggleInstitution({ id: inst.id, name: inst.name })}`.
- Texto vazio: `selectedSpecialty === AINDA_NAO_SEI` vira `!selectedSpecialty?.id`;
  exibições de `{selectedSpecialty}` viram `{selectedSpecialty?.name ?? UNDECIDED_LABEL}`.

- [ ] **Step 3: ConfirmationStep**

Props ficam por nomes (sem mudança visual):

```ts
interface Props {
  segment: string;
  specialtyName: string;       // já resolvido (ou UNDECIDED_LABEL)
  institutionNames: string[];  // vazio quando indeciso
}
```

`{specialty}` vira `{specialtyName}`; `institutions` vira `institutionNames`.

- [ ] **Step 4: OnboardingPage**

Estado persistido novo (chaves novas — o prefixo `onboarding:` continua sendo
limpo no finish; estado antigo de string é simplesmente ignorado):

```ts
import { UNDECIDED_LABEL } from "@/lib/academic-profile";
import type { SpecialtySelection, InstitutionSelection } from "@/types";

const [selectedSpecialty, setSelectedSpecialty] =
  usePersistedState<SpecialtySelection | null>("onboarding:specialtySel", null);
const [selectedInstitutions, setSelectedInstitutions] =
  usePersistedState<InstitutionSelection[]>("onboarding:institutionSel", []);
const [institutionsUndecided, setInstitutionsUndecided] =
  usePersistedState<boolean>("onboarding:institutionsUndecided", false);
```

`canProceed`:

```ts
case 0: return selectedSpecialty !== null;
case 1: return institutionsUndecided || selectedInstitutions.length >= 1;
```

Handlers:

```ts
// Sem efeitos colaterais dentro de updaters (StrictMode roda updaters 2x):
const handleSelectSpecialty = useCallback((s: SpecialtySelection) => {
  // trocar de especialidade invalida instituições (programas diferentes)
  if (selectedSpecialty && selectedSpecialty.name !== s.name) {
    setSelectedInstitutions([]);
    setInstitutionsUndecided(false);
  }
  setSelectedSpecialty(s);
}, [selectedSpecialty, setSelectedSpecialty, setSelectedInstitutions, setInstitutionsUndecided]);

const toggleInstitution = useCallback((inst: InstitutionSelection) => {
  setInstitutionsUndecided(false);
  setSelectedInstitutions((prev) =>
    prev.some((i) => i.id === inst.id)
      ? prev.filter((i) => i.id !== inst.id)
      : [...prev, inst]
  );
}, [setSelectedInstitutions, setInstitutionsUndecided]);

const toggleUndecided = useCallback(() => {
  const next = !institutionsUndecided;
  if (next && selectedInstitutions.length > 0) {
    toast({
      title: `Seleção anterior removida (${selectedInstitutions.length} instituiç${selectedInstitutions.length === 1 ? "ão" : "ões"})`,
      description: "Você pode selecioná-las de novo a qualquer momento.",
    });
    setSelectedInstitutions([]);
  }
  setInstitutionsUndecided(next);
}, [institutionsUndecided, selectedInstitutions, setSelectedInstitutions, setInstitutionsUndecided]);
```

(importar `toast` de `@/hooks/use-toast` na página.)

`handleFinish`:

```ts
await saveOnboarding({
  specialtyId: selectedSpecialty?.id ?? null,
  targetInstitutionIds: institutionsUndecided ? [] : selectedInstitutions.map((i) => i.id),
});
trackEvent("onboarding_completed", {
  segment,
  specialty: selectedSpecialty?.name ?? UNDECIDED_LABEL,
  institutions_count: institutionsUndecided ? 0 : selectedInstitutions.length,
});
```

JSX dos steps:

```tsx
{step === 0 && (
  <SpecialtyStep selection={selectedSpecialty} onSelect={handleSelectSpecialty} />
)}
{step === 1 && (
  <InstitutionStep
    selected={selectedInstitutions}
    undecided={institutionsUndecided}
    onToggleInstitution={toggleInstitution}
    onToggleUndecided={toggleUndecided}
    selectedSpecialty={selectedSpecialty}
  />
)}
{step === 2 && (
  <ConfirmationStep
    segment={segment}
    specialtyName={selectedSpecialty?.name ?? UNDECIDED_LABEL}
    institutionNames={institutionsUndecided ? [] : selectedInstitutions.map((i) => i.name)}
  />
)}
```

Mensagem de erro do step 1 permanece a mesma.

- [ ] **Step 5: Atualizar os 3 testes existentes**

Ler cada arquivo de teste e adaptar mocks/props ao novo contrato:
- `InstitutionStep.test.tsx`: render com `selected: []`, `undecided: false`,
  `onToggleInstitution`/`onToggleUndecided` (vi.fn) e
  `selectedSpecialty: { id: 'spec-1', name: 'PEDIATRIA' }`; asserts de toggle
  passam a esperar objetos `{ id, name }`.
- `ConfirmationStep.test.tsx`: props `specialtyName`/`institutionNames`.
- `OnboardingPage.test.tsx`: mock de `useUser().saveOnboarding` agora recebe
  `{ specialtyId, targetInstitutionIds }`; fluxos que digitavam strings passam a
  selecionar opções (os mocks de `useEnamedSpecialties` devem devolver
  `{ id, name, slug }` — manter os dados, asserts por id).

- [ ] **Step 6: Rodar testes**

Run: `npx vitest run src/components/onboarding src/pages/__tests__/OnboardingPage.test.tsx src/lib/academic-profile.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/onboarding src/pages/OnboardingPage.tsx
git commit -m "feat(onboarding): selecao de especialidade/instituicoes por ID canonico"
```

---

### Task 8: AcademicProfileEditor + ConfiguracoesPage por ID

**Files:**
- Modify: `src/components/profile/AcademicProfileEditor.tsx`
- Modify: `src/pages/ConfiguracoesPage.tsx` (seção `perfil-academico`: exibição, uso do editor e handler de save)

- [ ] **Step 1: AcademicProfileEditor por ID**

Nova interface:

```ts
import { UNDECIDED_LABEL } from "@/lib/academic-profile";
import type { SpecialtySelection, InstitutionSelection } from "@/types";

interface AcademicProfileEditorProps {
  initialSpecialty: SpecialtySelection | null;
  initialInstitutions: InstitutionSelection[];
  onSave: (data: { specialtyId: string | null; targetInstitutionIds: string[] }) => Promise<void>;
  onCancel: () => void;
  saving?: boolean;
}
```

Estado interno:

```ts
const [specialty, setSpecialty] = useState<SpecialtySelection | null>(initialSpecialty);
const [institutions, setInstitutions] = useState<InstitutionSelection[]>(initialInstitutions);
const [undecidedInst, setUndecidedInst] = useState(
  initialInstitutions.length === 0 && initialSpecialty !== null,
);
```

- Remover `const AINDA_NAO_SEI = ...` (usar `UNDECIDED_LABEL` para exibição).
- `specOptions` vira `SpecialtySelection[]` com `{ id: null, name: UNDECIDED_LABEL }`
  na frente (filtro por `s.name`).
- `useInstitutionsBySpecialty(specialty?.id ?? null)`.
- `toggleInstitution(inst: InstitutionSelection)`:

```ts
const toggleInstitution = useCallback((inst: InstitutionSelection) => {
  setUndecidedInst(false);
  setInstitutions((prev) => {
    if (prev.some((i) => i.id === inst.id)) return prev.filter((i) => i.id !== inst.id);
    if (prev.length >= MAX_INSTITUTIONS) return prev;
    return [...prev, inst];
  });
}, []);
```

- Botão "Ainda não sei" passa a alternar `undecidedInst` (limpando `institutions`).
- `handleSave`:

```ts
const handleSave = async () => {
  if (!specialty || (!undecidedInst && institutions.length === 0)) return;
  await onSave({
    specialtyId: specialty.id,
    targetInstitutionIds: undecidedInst ? [] : institutions.map((i) => i.id),
  });
};
```

- `hasChanges` compara por ids:

```ts
const hasChanges =
  specialty?.id !== initialSpecialty?.id ||
  JSON.stringify(institutions.map((i) => i.id).sort()) !==
    JSON.stringify(initialInstitutions.map((i) => i.id).sort());
```

- `disabled` do botão Salvar: `saving || !specialty || (!undecidedInst && institutions.length === 0) || !hasChanges`.
- Listas/chips renderizam `inst.name` com `key={inst.id}` e selecionam por id.

- [ ] **Step 2: ConfiguracoesPage**

Localizar (a partir da linha ~120) a seção `perfil-academico`:
1. Exibição de especialidade: trocar `onboarding.specialty` por
   `displaySpecialty(onboarding)` (import de `@/lib/academic-profile`).
2. Montagem do editor:

```tsx
<AcademicProfileEditor
  initialSpecialty={
    onboarding.specialtyId
      ? { id: onboarding.specialtyId, name: onboarding.specialty }
      : { id: null, name: UNDECIDED_LABEL }
  }
  initialInstitutions={onboarding.targetInstitutionIds.map((id, i) => ({
    id,
    name: onboarding.targetInstitutions[i] ?? '',
  }))}
  onSave={handleSaveAcademic}
  onCancel={() => setEditingAcademic(false)}
  saving={savingAcademic}
/>
```

3. Handler de save (adaptar o existente — mesma estrutura try/finally/toast):

```ts
const handleSaveAcademic = async (data: { specialtyId: string | null; targetInstitutionIds: string[] }) => {
  setSavingAcademic(true);
  try {
    await saveOnboarding(data);
    setEditingAcademic(false);
    toast({ title: "Perfil acadêmico atualizado" });
  } catch (e) {
    logger.error("[ConfiguracoesPage] Erro ao salvar perfil acadêmico:", e);
    toast({ title: "Erro ao salvar", description: "Tente novamente.", variant: "destructive" });
  } finally {
    setSavingAcademic(false);
  }
};
```

(Se o handler atual tiver tratamento extra — ex.: mensagem de janela aberta —
preservá-lo, mudando apenas o payload.)

- [ ] **Step 3: Build + testes**

Run: `npm run build` → deve compilar sem erros de tipo (todos os call sites de
`saveOnboarding`/`useInstitutionsBySpecialty` migrados).
Run: `npm run test` → PASS (exceto falhas pré-existentes não relacionadas; listar se houver).

- [ ] **Step 4: Commit**

```bash
git add src/components/profile/AcademicProfileEditor.tsx src/pages/ConfiguracoesPage.tsx
git commit -m "feat(perfil): edicao academica por ID canonico nas configuracoes"
```

---

## Fase C — Ranking: dados

### Task 9: fetchCutoffScores + useCutoffScores (substitui o match por LIKE)

**Files:**
- Modify: `src/services/rankingApi.ts:256-289` (substituir `CutoffScoreRow`/`fetchCutoffScore`)
- Create: `src/hooks/useCutoffScores.ts`
- Create: `src/hooks/useCutoffScores.test.ts`
- Delete: `src/hooks/useCutoffScore.ts`, `src/hooks/useCutoffScore.test.ts`

- [ ] **Step 1: Teste falhando do hook**

`src/hooks/useCutoffScores.test.ts`:

```ts
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/services/rankingApi', () => ({
  fetchCutoffScores: vi.fn(),
}));

import { fetchCutoffScores } from '@/services/rankingApi';
import { useCutoffScores } from '@/hooks/useCutoffScores';

const mockFetch = vi.mocked(fetchCutoffScores);

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return React.createElement(QueryClientProvider, { client }, children);
}

const rows = [
  {
    institution_id: 'inst-1',
    institution_name: 'Universidade Federal da Bahia',
    practice_scenario: 'Hospital das Clínicas',
    specialty_name: 'PEDIATRIA',
    cutoff_score_general: 70,
    cutoff_score_quota: 60,
  },
];

describe('useCutoffScores', () => {
  beforeEach(() => mockFetch.mockReset());

  it('query desabilitada sem specialtyId', () => {
    const { result } = renderHook(() => useCutoffScores(null, ['inst-1']), { wrapper });
    expect(result.current.loading).toBe(false);
    expect(result.current.cutoffs).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('query desabilitada sem instituições', () => {
    const { result } = renderHook(() => useCutoffScores('spec-1', []), { wrapper });
    expect(result.current.loading).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('retorna as linhas quando habilitada', async () => {
    mockFetch.mockResolvedValue(rows);
    const { result } = renderHook(() => useCutoffScores('spec-1', ['inst-1']), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.cutoffs).toEqual(rows);
    expect(mockFetch).toHaveBeenCalledWith('spec-1', ['inst-1']);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/hooks/useCutoffScores.test.ts`
Expected: FAIL (módulo/export não existem).

- [ ] **Step 3: Implementar serviço + hook**

Em `src/services/rankingApi.ts`, substituir o bloco Cutoff (linhas 256-289):

```ts
// ─── Cutoff scores ────────────────────────────────────────────────────────────

export interface CutoffScoreRow {
  institution_id: string;
  institution_name: string;
  practice_scenario: string;
  specialty_name: string;
  cutoff_score_general: number;
  cutoff_score_quota: number | null;
}

/**
 * Notas de corte das instituições-alvo do usuário, por join exato de ID
 * (RPC get_cutoff_scores). Instituições sem corte não retornam linha.
 */
export async function fetchCutoffScores(
  specialtyId: string,
  institutionIds: string[],
): Promise<CutoffScoreRow[]> {
  logger.log('[rankingApi] Fetching cutoff scores by id');

  const { data, error } = await (supabase.rpc as any)('get_cutoff_scores', {
    p_specialty_id: specialtyId,
    p_institution_ids: institutionIds,
  });

  if (error) {
    logger.error('[rankingApi] Error fetching cutoff scores:', error);
    throw error;
  }
  return (data || []) as CutoffScoreRow[];
}
```

(`fetchAllCutoffScores` permanece como está — o modal continua usando.)

`src/hooks/useCutoffScores.ts`:

```ts
import { useQuery } from '@tanstack/react-query';
import { fetchCutoffScores, type CutoffScoreRow } from '@/services/rankingApi';

export interface CutoffScoresResult {
  loading: boolean;
  cutoffs: CutoffScoreRow[];
}

/**
 * Notas de corte de todas as instituições-alvo do usuário.
 * Desabilitada sem especialidade definida ou sem instituições.
 */
export function useCutoffScores(
  specialtyId: string | null,
  institutionIds: string[],
): CutoffScoresResult {
  const enabled = Boolean(specialtyId) && institutionIds.length > 0;

  const { isLoading, data } = useQuery({
    queryKey: ['cutoff-scores', specialtyId, institutionIds.join(',')],
    queryFn: () => fetchCutoffScores(specialtyId!, institutionIds),
    staleTime: Infinity,
    enabled,
  });

  return { loading: enabled && isLoading, cutoffs: data ?? [] };
}
```

Apagar `src/hooks/useCutoffScore.ts` e `src/hooks/useCutoffScore.test.ts`
(consumidores são migrados na Task 12/16).

- [ ] **Step 4: Rodar testes**

Run: `npx vitest run src/hooks/useCutoffScores.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A src/hooks src/services/rankingApi.ts
git commit -m "feat(ranking): fetchCutoffScores/useCutoffScores por ID (substitui match por LIKE)"
```

---

### Task 10: Lógica pura do painel de aprovação (TDD)

**Files:**
- Create: `src/lib/ranking-approval.ts`
- Create: `src/lib/ranking-approval.test.ts`

- [ ] **Step 1: Teste falhando**

`src/lib/ranking-approval.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { deriveApprovalEntries } from '@/lib/ranking-approval';
import type { CutoffScoreRow } from '@/services/rankingApi';

const cutoff = (over: Partial<CutoffScoreRow>): CutoffScoreRow => ({
  institution_id: 'i1',
  institution_name: 'UFBA',
  practice_scenario: 'HC',
  specialty_name: 'PEDIATRIA',
  cutoff_score_general: 70,
  cutoff_score_quota: 60,
  ...over,
});

const targets = [
  { id: 'i1', name: 'UFBA' },
  { id: 'i2', name: 'UFPR' },
];

describe('deriveApprovalEntries', () => {
  it('marca pass quando nota >= corte geral', () => {
    const entries = deriveApprovalEntries(targets, [cutoff({ institution_id: 'i1' })], 75);
    expect(entries[0]).toMatchObject({
      institutionId: 'i1',
      status: 'pass',
      cutoffGeneral: 70,
      gap: 5,
    });
  });

  it('marca fail com gap positivo quando nota < corte', () => {
    const entries = deriveApprovalEntries(targets, [cutoff({ institution_id: 'i1' })], 62);
    expect(entries[0]).toMatchObject({ status: 'fail', gap: 8 });
  });

  it('marca unavailable para instituição sem linha de corte', () => {
    const entries = deriveApprovalEntries(targets, [cutoff({ institution_id: 'i1' })], 75);
    expect(entries[1]).toMatchObject({
      institutionId: 'i2',
      institutionName: 'UFPR',
      status: 'unavailable',
      cutoffGeneral: null,
    });
  });

  it('preserva a ordem das instituições-alvo', () => {
    const entries = deriveApprovalEntries(targets, [cutoff({ institution_id: 'i2', institution_name: 'UFPR' })], 75);
    expect(entries.map((e) => e.institutionId)).toEqual(['i1', 'i2']);
  });

  it('sem nota (null) => fail nunca; corte vira unavailable de status com valor', () => {
    const entries = deriveApprovalEntries(targets, [cutoff({ institution_id: 'i1' })], null);
    expect(entries[0]).toMatchObject({ status: 'unknown', cutoffGeneral: 70 });
  });

  it('retorna [] sem instituições', () => {
    expect(deriveApprovalEntries([], [], 75)).toEqual([]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/ranking-approval.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar**

`src/lib/ranking-approval.ts`:

```ts
import type { CutoffScoreRow } from '@/services/rankingApi';
import type { InstitutionSelection } from '@/types';

export type ApprovalStatus = 'pass' | 'fail' | 'unavailable' | 'unknown';

export interface ApprovalEntry {
  institutionId: string;
  institutionName: string;
  cutoffGeneral: number | null;
  cutoffQuota: number | null;
  /** pass: distância acima do corte; fail: distância abaixo. Sempre >= 0. */
  gap: number;
  status: ApprovalStatus;
}

/**
 * Cruza instituições-alvo com as linhas de corte retornadas pelo RPC.
 * - sem linha de corte => 'unavailable'
 * - sem nota do usuário (null) => 'unknown' (corte exibido, sem veredito)
 */
export function deriveApprovalEntries(
  targets: InstitutionSelection[],
  cutoffs: CutoffScoreRow[],
  userScore: number | null,
): ApprovalEntry[] {
  const byId = new Map(cutoffs.map((c) => [c.institution_id, c]));

  return targets.map((t) => {
    const row = byId.get(t.id);
    if (!row) {
      return {
        institutionId: t.id,
        institutionName: t.name,
        cutoffGeneral: null,
        cutoffQuota: null,
        gap: 0,
        status: 'unavailable' as const,
      };
    }
    const general = Number(row.cutoff_score_general);
    if (userScore == null) {
      return {
        institutionId: t.id,
        institutionName: row.institution_name,
        cutoffGeneral: general,
        cutoffQuota: row.cutoff_score_quota,
        gap: 0,
        status: 'unknown' as const,
      };
    }
    const pass = userScore >= general;
    return {
      institutionId: t.id,
      institutionName: row.institution_name,
      cutoffGeneral: general,
      cutoffQuota: row.cutoff_score_quota,
      gap: Math.round(Math.abs(userScore - general)),
      status: pass ? ('pass' as const) : ('fail' as const),
    };
  });
}
```

- [ ] **Step 4: Rodar testes** → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ranking-approval.ts src/lib/ranking-approval.test.ts
git commit -m "feat(ranking): deriveApprovalEntries (status por instituicao-alvo)"
```

---

### Task 11: useRanking expõe IDs do perfil

**Files:**
- Modify: `src/hooks/useRanking.ts:35-64, 100-105, 221-239`

- [ ] **Step 1: Adicionar campos**

Na interface `UseRankingReturn` (após `userInstitutions`):

```ts
userSpecialtyId: string | null;
userInstitutionIds: string[];
```

No corpo (após linha 105):

```ts
const userSpecialtyId = onboarding?.specialtyId ?? null;
const userInstitutionIds = useMemo(
  () => onboarding?.targetInstitutionIds || [],
  [onboarding?.targetInstitutionIds],
);
```

E no return: `userSpecialtyId, userInstitutionIds,`.

- [ ] **Step 2: Build** — `npm run build` → sem novos erros.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useRanking.ts
git commit -m "feat(ranking): useRanking expoe specialtyId/institutionIds do perfil"
```

---

## Fase D — Ranking: UI (Direção B)

> Diretriz para TODAS as tasks de UI: usar tokens semânticos do design system
> (`bg-card`, `border-border`, `text-foreground`, `text-muted-foreground`,
> `text-success`, `text-destructive`, `bg-primary`, etc.) com variantes `dark:`
> quando necessário — sem objetos de estilo inline calculados por `isDark`,
> sem `MutationObserver`. Superfícies wine de destaque (sticky bar) seguem o
> padrão always-dark do projeto (texto branco fixo é correto).
> ATENÇÃO ao gotcha do projeto: nunca usar `bg-[var(--x)]/40` (opacity sobre
> var é descartada pelo Tailwind v3) — usar tokens prontos ou `color-mix`.

### Task 12: RankingApprovalPanel (régua "Você passaria?")

**Files:**
- Create: `src/components/ranking/RankingApprovalPanel.tsx`

- [ ] **Step 1: Implementar o componente**

```tsx
import React from 'react';
import { Link } from 'react-router-dom';
import { Target, ChevronRight, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ApprovalEntry } from '@/lib/ranking-approval';

export type ApprovalPanelState = 'no_profile' | 'loading' | 'ready';

interface Props {
  state: ApprovalPanelState;
  entries: ApprovalEntry[];
  userScore: number | null;
  /** Abre o CutoffScoreModal (tabela completa). */
  onOpenCutoffTable: () => void;
}

/** Posição (0-100%) na régua, com folga nas bordas para os labels. */
function clampPct(v: number): number {
  return Math.max(3, Math.min(97, v));
}

export function RankingApprovalPanel({ state, entries, userScore, onOpenCutoffTable }: Props) {
  if (state === 'loading') {
    return (
      <div className="rounded-2xl border border-border bg-card p-5 mb-5">
        <div className="h-4 w-48 rounded bg-muted animate-pulse mb-6" />
        <div className="h-2 rounded-full bg-muted animate-pulse mb-6" />
        <div className="space-y-2">
          <div className="h-9 rounded-lg bg-muted animate-pulse" />
          <div className="h-9 rounded-lg bg-muted animate-pulse" />
        </div>
      </div>
    );
  }

  if (state === 'no_profile') {
    return (
      <div className="rounded-2xl border border-border bg-card p-5 mb-5 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-accent flex items-center justify-center shrink-0">
          <Target className="h-5 w-5 text-primary" aria-hidden />
        </div>
        <div className="flex-1">
          <p className="text-body font-semibold text-foreground">Você passaria?</p>
          <p className="text-caption text-muted-foreground">
            Defina sua especialidade e instituições-alvo para comparar sua nota com as notas de corte.
          </p>
        </div>
        <Link
          to="/configuracoes"
          className="inline-flex items-center gap-1 rounded-xl bg-primary px-4 py-2 text-caption font-semibold text-white hover:bg-wine-hover transition-colors shrink-0"
        >
          Completar perfil
          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>
    );
  }

  const withCutoff = entries.filter((e) => e.cutoffGeneral != null);
  const reached = entries.filter((e) => e.status === 'pass').length;
  const verdictAvailable = userScore != null && withCutoff.length > 0;

  return (
    <section
      className="rounded-2xl border border-border bg-card p-5 mb-5"
      aria-label="Sua nota comparada às notas de corte"
    >
      <div className="flex items-start justify-between gap-3 mb-1">
        <div>
          <p className="text-overline uppercase text-muted-foreground">Você passaria?</p>
          <p className="text-heading-3 font-bold text-foreground">
            Sua nota vs. notas de corte
          </p>
        </div>
        {verdictAvailable && (
          <span
            className={cn(
              'rounded-full px-3 py-1 text-caption font-semibold shrink-0',
              reached > 0 ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive',
            )}
          >
            {reached} de {withCutoff.length} instituiç{withCutoff.length === 1 ? 'ão' : 'ões'} alcançada{reached === 1 ? '' : 's'}
          </span>
        )}
      </div>

      {/* Régua 0–100 */}
      {verdictAvailable && (
        <div className="relative mx-1 mt-10 mb-12" aria-hidden>
          <div className="h-2 rounded-full bg-muted relative overflow-visible">
            <div
              className="absolute left-0 top-0 h-2 rounded-full bg-primary"
              style={{ width: `${clampPct(userScore!)}%` }}
            />
            {/* Marcador do usuário */}
            <div
              className="absolute -top-1 h-4 w-1 rounded-full bg-primary"
              style={{ left: `${clampPct(userScore!)}%` }}
            />
            <span
              className="absolute -top-7 -translate-x-1/2 whitespace-nowrap text-caption font-semibold text-primary"
              style={{ left: `${clampPct(userScore!)}%` }}
            >
              Você · {userScore}%
            </span>
            {/* Marcadores de corte */}
            {withCutoff.map((e, i) => (
              <React.Fragment key={e.institutionId}>
                <div
                  className={cn(
                    'absolute top-2 w-px h-3',
                    e.status === 'pass' ? 'bg-success' : 'bg-destructive',
                  )}
                  style={{ left: `${clampPct(e.cutoffGeneral!)}%` }}
                />
                <span
                  className={cn(
                    'absolute -translate-x-1/2 whitespace-nowrap text-micro-label',
                    e.status === 'pass' ? 'text-success' : 'text-destructive',
                    // alterna o nível vertical para evitar colisão de labels
                    i % 2 === 0 ? 'top-6' : 'top-10',
                  )}
                  style={{ left: `${clampPct(e.cutoffGeneral!)}%` }}
                >
                  {shortName(e.institutionName)} {e.cutoffGeneral}
                </span>
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      {/* Lista por instituição */}
      <ul className="divide-y divide-border rounded-xl border border-border overflow-hidden">
        {entries.map((e) => (
          <li key={e.institutionId} className="flex items-center justify-between gap-3 px-4 py-2.5 bg-background">
            <span className="text-body-sm text-foreground truncate min-w-0">{e.institutionName}</span>
            {e.status === 'unavailable' ? (
              <span className="inline-flex items-center gap-1 text-caption text-muted-foreground shrink-0">
                <HelpCircle className="h-3.5 w-3.5" aria-hidden />
                corte indisponível
              </span>
            ) : (
              <span className="flex items-center gap-3 shrink-0">
                <span className="text-caption text-muted-foreground tabular-nums">
                  corte {e.cutoffGeneral}%
                  {e.cutoffQuota != null && <> · cotas {e.cutoffQuota}%</>}
                </span>
                {e.status === 'pass' && (
                  <span className="rounded-full bg-success/10 px-2 py-0.5 text-caption font-semibold text-success tabular-nums">
                    +{e.gap} acima ✓
                  </span>
                )}
                {e.status === 'fail' && (
                  <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-caption font-semibold text-destructive tabular-nums">
                    faltam {e.gap}
                  </span>
                )}
              </span>
            )}
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={onOpenCutoffTable}
        className="mt-3 text-caption font-semibold text-primary hover:underline underline-offset-2"
      >
        Ver tabela completa de notas de corte →
      </button>
    </section>
  );
}

/** Nome curto para o label da régua (evita estourar em mobile). */
function shortName(name: string): string {
  if (name.length <= 18) return name;
  const acronymMatch = name.match(/\(([^)]+)\)/);
  if (acronymMatch) return acronymMatch[1];
  return `${name.slice(0, 16)}…`;
}
```

Notas:
- Se `text-body-sm` não existir no Tailwind config do projeto, usar `text-sm`
  (conferir em `tailwind.config.ts`; `AcademicProfileEditor` usa `text-body-sm`,
  então deve existir).
- Mensagem de incentivo no fail mais próximo (mantida da UI atual): abaixo da
  lista, quando `verdictAvailable` e `reached === 0`, renderizar:

```tsx
{verdictAvailable && reached === 0 && (
  <p className="mt-3 text-caption italic text-muted-foreground">
    {closestGap(entries) <= 5
      ? 'Você está muito perto do corte. Mais uma rodada focada e você chega lá!'
      : closestGap(entries) <= 15
        ? 'Você está no caminho certo. Cada simulado te aproxima do corte — continue com consistência.'
        : 'Toda aprovação começa exatamente aqui. A distância de hoje é o combustível de amanhã.'}
  </p>
)}
```

com o helper no mesmo arquivo:

```ts
function closestGap(entries: ApprovalEntry[]): number {
  const gaps = entries.filter((e) => e.status === 'fail').map((e) => e.gap);
  return gaps.length ? Math.min(...gaps) : 0;
}
```

- [ ] **Step 2: Build** — `npm run build` → compila.

- [ ] **Step 3: Commit**

```bash
git add src/components/ranking/RankingApprovalPanel.tsx
git commit -m "feat(ranking): RankingApprovalPanel (regua nota vs cortes, direcao B)"
```

---

### Task 13: RankingStatsRow

**Files:**
- Create: `src/components/ranking/RankingStatsRow.tsx`

- [ ] **Step 1: Implementar**

```tsx
import React from 'react';
import type { RankingParticipant, RankingStats } from '@/services/rankingApi';

interface Props {
  currentUser: RankingParticipant;
  totalParticipants: number;
  stats: RankingStats;
}

export function RankingStatsRow({ currentUser, totalParticipants, stats }: Props) {
  const percentil = Math.min(
    99,
    Math.round((currentUser.position / Math.max(1, totalParticipants)) * 100),
  );
  const delta = currentUser.score - stats.notaMedia;

  return (
    <div className="grid grid-cols-3 gap-2.5 mb-5">
      <div className="rounded-xl border border-border bg-card px-4 py-3">
        <p className="text-overline uppercase text-muted-foreground">Posição</p>
        <p className="text-heading-3 font-bold text-foreground tabular-nums">
          #{currentUser.position}
          <span className="text-caption font-medium text-muted-foreground"> de {totalParticipants}</span>
        </p>
      </div>
      <div className="rounded-xl border border-border bg-card px-4 py-3">
        <p className="text-overline uppercase text-muted-foreground">Percentil</p>
        <p className="text-heading-3 font-bold text-foreground tabular-nums">Top {percentil}%</p>
      </div>
      <div className="rounded-xl border border-border bg-card px-4 py-3">
        <p className="text-overline uppercase text-muted-foreground">Vs. média ({stats.notaMedia}%)</p>
        <p
          className={
            'text-heading-3 font-bold tabular-nums ' +
            (delta >= 0 ? 'text-success' : 'text-destructive')
          }
        >
          {delta >= 0 ? '+' : ''}
          {delta}%
        </p>
      </div>
    </div>
  );
}
```

(Mobile: `grid-cols-3` com `px-4` cabe em 360px; se apertar na verificação
visual, ajustar para `grid-cols-1 sm:grid-cols-3`.)

- [ ] **Step 2: Commit**

```bash
git add src/components/ranking/RankingStatsRow.tsx
git commit -m "feat(ranking): RankingStatsRow (posicao/percentil/vs media)"
```

---

### Task 14: Rebuild RankingFilterBar (auto-contido, tokens semânticos)

**Files:**
- Rewrite: `src/components/ranking/RankingFilterBar.tsx`

- [ ] **Step 1: Reescrever**

Mesmo comportamento (Todos / pill da especialidade / pill da instituição quando
especialidade ativa / segmentos / resumo), sem style-props vindas do pai:

```tsx
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Stethoscope, Building } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SegmentFilter, RankingComparisonSelection } from '@/services/rankingApi';

type SegmentOption = { key: SegmentFilter; label: string; icon: React.ElementType };

interface Props {
  rankingComparison: RankingComparisonSelection;
  segmentFilter: SegmentFilter;
  userSpecialty: string;
  userInstitutions: string[];
  visibleSegmentOptions: SegmentOption[];
  onSelectAllComparison: () => void;
  onToggleSpecialtyComparison: () => void;
  onToggleInstitutionComparison: () => void;
  onSegmentFilterChange: (f: SegmentFilter) => void;
}

const pillBase =
  'inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-caption font-medium transition-colors';
const pillOn = 'bg-primary text-white shadow-sm';
const pillOff = 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground border border-border';

export function RankingFilterBar({
  rankingComparison,
  segmentFilter,
  userSpecialty,
  userInstitutions,
  visibleSegmentOptions,
  onSelectAllComparison,
  onToggleSpecialtyComparison,
  onToggleInstitutionComparison,
  onSegmentFilterChange,
}: Props) {
  const allActive = !rankingComparison.bySpecialty && !rankingComparison.byInstitution;

  return (
    <div className="rounded-2xl border border-border bg-card px-5 py-4 mb-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="text-micro-label uppercase tracking-wider font-bold text-muted-foreground shrink-0">
          Comparar
        </span>

        <motion.button
          type="button"
          onClick={onSelectAllComparison}
          aria-pressed={allActive}
          aria-label="Todos os candidatos"
          className={cn(pillBase, allActive ? pillOn : pillOff)}
          whileTap={{ scale: 0.95 }}
        >
          <Users className="h-4 w-4" aria-hidden />
          Todos
        </motion.button>

        {userSpecialty && (
          <motion.button
            type="button"
            onClick={onToggleSpecialtyComparison}
            aria-pressed={rankingComparison.bySpecialty}
            aria-label={`Filtrar por especialidade: ${userSpecialty}`}
            className={cn(pillBase, rankingComparison.bySpecialty ? pillOn : pillOff)}
            whileTap={{ scale: 0.95 }}
          >
            <Stethoscope className="h-4 w-4" aria-hidden />
            {userSpecialty}
          </motion.button>
        )}

        <AnimatePresence>
          {rankingComparison.bySpecialty && userInstitutions.length > 0 && (
            <motion.button
              key="institution-pill"
              type="button"
              onClick={onToggleInstitutionComparison}
              aria-pressed={rankingComparison.byInstitution}
              aria-label={`Filtrar também por instituição: ${userInstitutions[0]}`}
              className={cn(pillBase, 'max-w-[14rem]', rankingComparison.byInstitution ? pillOn : pillOff)}
              initial={{ opacity: 0, x: -8, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -8, scale: 0.9 }}
              whileTap={{ scale: 0.95 }}
            >
              <Building className="h-4 w-4 shrink-0" aria-hidden />
              <span className="truncate">{userInstitutions[0]}</span>
            </motion.button>
          )}
        </AnimatePresence>

        <div className="h-6 w-px bg-border shrink-0" aria-hidden />

        <span className="text-micro-label uppercase tracking-wider font-bold text-muted-foreground shrink-0">
          Segmento
        </span>

        {visibleSegmentOptions.map((f) => (
          <motion.button
            key={f.key}
            type="button"
            onClick={() => onSegmentFilterChange(f.key)}
            aria-pressed={segmentFilter === f.key}
            aria-label={f.label}
            className={cn(pillBase, segmentFilter === f.key ? pillOn : pillOff)}
            whileTap={{ scale: 0.95 }}
          >
            <f.icon className="h-4 w-4" aria-hidden />
            <span className="hidden sm:inline">{f.label}</span>
          </motion.button>
        ))}
      </div>

      {rankingComparison.bySpecialty && (
        <p className="text-caption text-muted-foreground mt-2.5 leading-snug">
          <span className="text-primary mr-1">●</span>
          Comparando com candidatos de <span className="text-foreground">{userSpecialty}</span>
          {rankingComparison.byInstitution && userInstitutions[0] ? (
            <> · <span className="text-foreground">{userInstitutions[0]}</span></>
          ) : (
            <span> (todas as instituições)</span>
          )}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit** (RankingView ainda usa a API antiga; quebra é resolvida na Task 16 — se preferir manter build verde, fazer commit junto com a Task 16)

```bash
git add src/components/ranking/RankingFilterBar.tsx
git commit -m "refactor(ranking): RankingFilterBar auto-contido com tokens semanticos"
```

---

### Task 15: Rebuild RankingTable + PositionBadge

**Files:**
- Rewrite: `src/components/ranking/RankingTable.tsx`
- Modify: `src/components/ranking/PositionBadge.tsx`

- [ ] **Step 1: PositionBadge sem isDark**

```tsx
import React from 'react';
import { cn } from '@/lib/utils';

interface Props {
  position: number;
  isCurrentUser?: boolean;
}

const medals: Record<number, { cls: string; label: string }> = {
  1: { cls: 'bg-warning/15 text-warning', label: '1º lugar' },
  2: { cls: 'bg-muted text-muted-foreground', label: '2º lugar' },
  3: { cls: 'bg-warning/10 text-warning/80', label: '3º lugar' },
};

export function PositionBadge({ position, isCurrentUser }: Props) {
  const medal = medals[position];
  return (
    <div
      className={cn(
        'h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
        isCurrentUser ? 'bg-primary/15 text-primary' : medal ? medal.cls : 'bg-muted text-muted-foreground',
      )}
      aria-label={isCurrentUser ? `${position}ª posição (você)` : medal?.label}
    >
      {position}
    </div>
  );
}
```

(Se `text-warning`/`bg-warning` não existirem como utilitários, usar
`text-amber-600 dark:text-amber-400` / `bg-amber-500/15` — conferir tailwind.config.)

- [ ] **Step 2: RankingTable com tokens**

```tsx
import React from 'react';
import { Users } from 'lucide-react';
import type { RankingParticipant } from '@/services/rankingApi';
import { PositionBadge } from './PositionBadge';

type SeparatorRow = { type: 'separator'; from: number; to: number };
type TableRow = RankingParticipant | SeparatorRow;

function isSeparator(row: TableRow): row is SeparatorRow {
  return 'type' in row && (row as SeparatorRow).type === 'separator';
}

interface Props {
  tableRows: TableRow[];
  filteredParticipants: RankingParticipant[];
  currentUser: RankingParticipant | undefined;
  participantLabel: (item: RankingParticipant) => string;
  handleClearAllFilters: () => void;
}

const th = 'px-2 py-3 text-micro-label font-bold uppercase tracking-wider text-muted-foreground';

export function RankingTable({
  tableRows,
  filteredParticipants,
  currentUser,
  participantLabel,
  handleClearAllFilters,
}: Props) {
  if (filteredParticipants.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card flex flex-col items-center text-center px-5 py-8">
        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center mb-3" aria-hidden>
          <Users className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="text-body font-semibold text-foreground mb-1">Nenhum participante neste recorte</p>
        <p className="text-caption text-muted-foreground leading-snug mb-4 max-w-sm">
          Os filtros aplicados não retornaram candidatos. Ajuste ou limpe os filtros para ver o ranking completo.
        </p>
        <button
          type="button"
          onClick={handleClearAllFilters}
          className="rounded-full bg-primary px-4 py-1.5 text-caption font-semibold text-white hover:bg-wine-hover transition-colors"
        >
          Limpar filtros
        </button>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border">
            <th className={`${th} text-left w-10 pl-4`}>#</th>
            <th className={`${th} text-left`}>Candidato</th>
            <th className={`${th} text-left hidden md:table-cell`}>Especialidade</th>
            <th className={`${th} text-left hidden md:table-cell`}>Instituição</th>
            <th className={`${th} text-right pr-4`}>Nota</th>
          </tr>
        </thead>
        <tbody>
          {tableRows.map((row, i) => {
            if (isSeparator(row)) {
              return (
                <tr key={`sep-${i}`} className="border-b border-border">
                  <td colSpan={5} className="px-4 py-2 text-center">
                    <span className="text-micro-label text-muted-foreground">
                      posições {row.from} – {row.to}
                    </span>
                  </td>
                </tr>
              );
            }
            return (
              <tr
                key={`${row.userId}-${row.position}`}
                className={
                  (row.isCurrentUser ? 'bg-primary/5 dark:bg-primary/15 ' : '') +
                  (i < tableRows.length - 1 ? 'border-b border-border' : '')
                }
              >
                <td className="w-10 pl-4 py-3">
                  <PositionBadge position={row.position} isCurrentUser={row.isCurrentUser} />
                </td>
                <td className="pr-2 py-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={
                        'text-sm truncate ' +
                        (row.isCurrentUser ? 'font-semibold text-foreground' : 'text-foreground/80')
                      }
                    >
                      {participantLabel(row)}
                    </span>
                    {row.isCurrentUser && (
                      <span className="rounded bg-primary px-1.5 py-0.5 text-[0.6rem] font-bold text-white shrink-0">
                        Você
                      </span>
                    )}
                  </div>
                </td>
                <td className="pr-2 py-3 hidden md:table-cell text-caption text-muted-foreground">
                  {row.specialty}
                </td>
                <td className="pr-2 py-3 hidden md:table-cell text-caption text-muted-foreground">
                  {row.institution}
                </td>
                <td className="pr-4 py-3 text-right">
                  <span
                    className={
                      'text-sm font-semibold tabular-nums ' +
                      (row.isCurrentUser ? 'text-primary' : 'text-foreground/80')
                    }
                  >
                    {row.score}%
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Sticky bar — superfície wine always-dark (padrão do projeto) */}
      {currentUser && (
        <div
          className="sticky bottom-0 flex items-center justify-between px-4 py-2.5 bg-wine text-white"
          style={{ background: 'linear-gradient(135deg, hsl(345 65% 32%), hsl(345 70% 18%))' }}
          aria-hidden
        >
          <span className="text-xs text-white/60">Sua posição</span>
          <span className="text-sm font-bold">#{currentUser.position} de {filteredParticipants.length}</span>
          <span className="text-sm font-semibold text-white/85">{currentUser.score}%</span>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit** (junto com a Task 16 se preferir build verde por commit)

```bash
git add src/components/ranking/RankingTable.tsx src/components/ranking/PositionBadge.tsx
git commit -m "refactor(ranking): tabela e badge com tokens semanticos (sem isDark)"
```

---

### Task 16: RankingView recomposto (Direção B) + páginas

**Files:**
- Rewrite: `src/components/ranking/RankingView.tsx`
- Delete: `src/components/ranking/RankingHeroStats.tsx`
- Modify: `src/components/ranking/RankingSkeleton.tsx` (ajustar blocos ao novo layout)
- Modify: `src/components/ranking/RankingSimuladoSelector.tsx` (remover props de estilo, usar tokens)
- Modify: `src/components/ranking/RankingLowConfidenceBanner.tsx` (remover props `bannerText`/`text1`, usar `text-muted-foreground`/`text-foreground`)
- Modify: `src/pages/RankingPage.tsx:101-118`
- Modify: `src/admin/pages/AdminRankingPreviewPage.tsx` (props do RankingView)
- Modify: `src/components/ranking/RankingView.test.tsx`

- [ ] **Step 1: Reescrever RankingView**

Estrutura mantida do atual: analytics (`ranking_viewed`, `ranking_filter_changed`,
`ranking_engagement_time`), `buildTableRows` (exportado, inalterado — copiar do
arquivo atual linhas 40-84), low-confidence banner, empty state, modal.
Removidos: objeto `t`, `isDark` + MutationObserver, `getPillStyle`, shimmer,
`RankingHeroStats`. Novos imports: `RankingApprovalPanel`, `RankingStatsRow`,
`useCutoffScores`, `deriveApprovalEntries`.

Props novas (adicionar a `RankingViewProps`):

```ts
userSpecialtyId: string | null;
userInstitutionIds: string[];
```

Corpo (substitui o miolo do componente; assinaturas dos handlers de filtro
permanecem as mesmas, só sem `triggerShimmer`):

```tsx
const { loading: cutoffLoading, cutoffs } = useCutoffScores(
  userSpecialtyId,
  userInstitutionIds,
);

const userInstitutionSelections = userInstitutionIds.map((id, i) => ({
  id,
  name: userInstitutions[i] ?? '',
}));

const approvalEntries = deriveApprovalEntries(
  userInstitutionSelections,
  cutoffs,
  currentUser ? currentUser.score : null,
);

const approvalState: ApprovalPanelState =
  !userSpecialtyId || userInstitutionIds.length === 0
    ? 'no_profile'
    : cutoffLoading
      ? 'loading'
      : 'ready';
```

JSX (depois do selector de simulado):

```tsx
<RankingApprovalPanel
  state={approvalState}
  entries={approvalEntries}
  userScore={currentUser ? currentUser.score : null}
  onOpenCutoffTable={() => setCutoffModalOpen(true)}
/>

{currentUser && (
  <RankingStatsRow
    currentUser={currentUser}
    totalParticipants={filteredParticipants.length}
    stats={stats}
  />
)}
```

Container externo: trocar `style={{ background: t.containerBg }}` por
`className="rounded-2xl bg-background p-5"` (ou remover o wrapper de cor e deixar
o fundo da página). FilterBar/Table recebem as novas props (handlers diretos).
`RankingLowConfidenceBanner`: remover as props de cor, estilizar internamente.
`CutoffScoreModal`: NESTA task manter a prop atual
(`userInstitution={userInstitutions[0]}`) para o build ficar verde — a troca
para multi-instituição acontece na Task 17.

- [ ] **Step 2: RankingSimuladoSelector com tokens**

Remover as props `chipActive`/`chipInactive`; estilizar internamente com as
mesmas classes de pill da FilterBar (`bg-primary text-white` ativo,
`bg-muted text-muted-foreground border border-border` inativo).

- [ ] **Step 3: RankingSkeleton**

Ajustar para: bloco do painel (h-40), grid de 3 stats (h-16), barra de filtros
(h-12), tabela (h-64) — todos `rounded-2xl bg-muted animate-pulse`.

- [ ] **Step 4: Atualizar páginas**

`src/pages/RankingPage.tsx` — adicionar às props do `<RankingView>`:

```tsx
userSpecialtyId={userSpecialtyId}
userInstitutionIds={userInstitutionIds}
```

(desestruturar os dois do `useRanking()`).

`src/admin/pages/AdminRankingPreviewPage.tsx` — ler o arquivo; ele monta
RankingView com dados próprios. Passar `userSpecialtyId={null}` e
`userInstitutionIds={[]}` **a menos que** a página já passe
specialty/institutions do admin — nesse caso espelhar com os ids do
`onboarding` via `useUser()`. O painel em estado `no_profile` no admin é
aceitável (preview foca na tabela).

- [ ] **Step 5: Atualizar RankingView.test.tsx**

Ler o teste atual; adaptar:
- mocks: `vi.mock('@/hooks/useCutoffScores', () => ({ useCutoffScores: vi.fn(() => ({ loading: false, cutoffs: [] })) }))`
  no lugar do mock de `useCutoffScore`;
- props obrigatórias novas nos renders: `userSpecialtyId: 'spec-1'` (ou null nos
  casos sem perfil) e `userInstitutionIds: []`;
- asserts que dependiam de `RankingHeroStats` passam a verificar o painel
  (`Você passaria?` / `Sua nota vs. notas de corte`) e a StatsRow (`Percentil`).
- `buildTableRows` continua exportado — testes dele permanecem.

- [ ] **Step 6: Rodar testes + build**

Run: `npx vitest run src/components/ranking` → PASS.
Run: `npm run build` → sem erros.

- [ ] **Step 7: Commit**

```bash
git add -A src/components/ranking src/pages/RankingPage.tsx src/admin/pages/AdminRankingPreviewPage.tsx
git commit -m "feat(ranking): RankingView direcao B (painel de aprovacao + stats row, tokens semanticos)"
```

---

### Task 17: CutoffScoreModal multi-instituição

**Files:**
- Modify: `src/components/ranking/CutoffScoreModal.tsx`

- [ ] **Step 1: Props e pinned rows**

1. Trocar `userInstitution?: string` por `userInstitutions?: string[]` (nomes
   canônicos, ordem do perfil). Atualizar o call site em `RankingView`:
   `userInstitutions={userInstitutions}`.
2. `userRow` (linhas 104-113) vira `userRows` — pin de TODAS as instituições-alvo:

```ts
const userRows = useMemo(() => {
  if (!userSpecialty || !userInstitutions?.length) return [];
  const targets = userInstitutions.map((n) => n.toLowerCase().trim());
  return rows.filter(
    (r) =>
      r.specialty_name.toLowerCase() === userSpecialty.toLowerCase() &&
      targets.includes(r.institution_name.toLowerCase().trim()),
  );
}, [rows, userSpecialty, userInstitutions]);
```

(Match exato por nome agora é confiável: ambos vêm do catálogo canônico.)

3. `filteredRows` exclui qualquer linha presente em `userRows`.
4. Seção pinned: título "Suas instituições"; renderizar `userRows.map(...)` com
   badge pass/fail por linha quando `currentUserScore != null`
   (`currentUserScore >= r.cutoff_score_general`). Remover o hero card de
   instituição única (heroState/userRow) — o veredito agora vive no painel da
   página; o modal foca na tabela completa.

- [ ] **Step 2: Tokens (mesma passada)**

Substituir `getThemeAwareColors()` + `isDark` MutationObserver por classes
semânticas (`bg-card`, `border-border`, `text-foreground`,
`text-muted-foreground`, `bg-muted`, linha do usuário `bg-primary/10`).
Manter o drawer/motion/escape/focus como estão.

- [ ] **Step 3: Build + smoke test manual via preview (Task 18 cobre).**

- [ ] **Step 4: Commit**

```bash
git add src/components/ranking/CutoffScoreModal.tsx src/components/ranking/RankingView.tsx
git commit -m "feat(ranking): CutoffScoreModal multi-instituicao com tokens semanticos"
```

---

### Task 18: Verificação integrada

- [ ] **Step 1: Suíte completa**

Run: `npm run test`
Expected: PASS (zero falhas novas; comparar com baseline da main se houver falha pré-existente).

- [ ] **Step 2: Lint + build**

Run: `npm run lint` e `npm run build`
Expected: sem erros (warnings pré-existentes ok).

- [ ] **Step 3: Verificação visual via preview tools**

1. `preview_start` (porta 8080).
2. Navegar para `/ranking` logado (usar conta de teste com onboarding completo).
3. Checar com `preview_snapshot`/`preview_screenshot`:
   - painel "Você passaria?" com régua e lista por instituição (estados pass/fail/indisponível);
   - stats row; filtros (toggles funcionam — `preview_click`); tabela top10+vizinhança; sticky bar;
   - modal de cortes (abrir via link do painel) com seção "Suas instituições";
   - dark mode (`preview_eval` para alternar classe `dark`) — contraste ok;
   - mobile 390px (`preview_resize`) — régua legível, labels alternados sem colisão.
4. `/onboarding`: fluxo completo com "Ainda não sei" e com seleção real — salvar e conferir
   no banco (`select specialty_id, target_institution_ids from onboarding_profiles where user_id = '...'`).
5. `/configuracoes`: editar perfil acadêmico, salvar, conferir update.
6. Screenshot final para o usuário.

- [ ] **Step 4: Commit de ajustes da verificação (se houver)**

```bash
git add -A
git commit -m "fix(ranking): ajustes de verificacao visual (dark mode/mobile)"
```

---

## Fase E — Cleanup (⛔ somente após deploy do frontend em produção)

### Task 19: Remover legado

**Files:**
- Create: `supabase/migrations/<timestamp>_drop_legacy_cutoff_match.sql`

- [ ] **Step 1: Confirmar com Felipe que o frontend novo está em produção e estável.**

- [ ] **Step 2: Migration**

```sql
DROP FUNCTION IF EXISTS public.match_cutoff_score(text, text);
-- A sobrecarga text de save_onboarding_guarded permanece até confirmação de que
-- nenhum cliente antigo (cache/app) ainda a chama; remover numa segunda passada:
-- DROP FUNCTION IF EXISTS public.save_onboarding_guarded(text, text[]);
```

- [ ] **Step 3: Aplicar, regenerar types.ts, commit.**

```bash
git add supabase/migrations src/integrations/supabase/types.ts
git commit -m "chore(db): remove match_cutoff_score legado"
```

---

## Riscos & decisões registradas

- **Ordem nomes×ids em `onboarding_profiles`:** o RPC novo grava os dois arrays
  na mesma ordem; o backfill também. Frontend zipa por índice.
- **Sobrecarga text continua funcional** e sincroniza ids — não há janela de
  dados órfãos entre backfill e cutover.
- **`get_cutoff_scores` retorna no máximo 1 linha por instituição**
  (`DISTINCT ON (ord)`, maior corte geral em caso de cenários múltiplos).
- **Estado persistido antigo do onboarding** (strings) é ignorado pelas chaves
  novas; `clearPersistedStateByPrefix("onboarding:")` segue limpando tudo.
- **PositionBadge/medals:** cores de medalha usam tokens; conferir nomes exatos
  no tailwind.config na execução (warning vs amber).
