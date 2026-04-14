

# Melhorar matching de nota de corte: especialidade + instituição

## Problema

A busca de nota de corte usa `ilike` simples, mas existem diferenças reais entre as tabelas:

```text
enamed_cutoff_scores:  "...AFECC - HSRC"       (hífen simples)
enamed_institutions:   "...AFECC – HSRC"        (en-dash)
onboarding_profiles:   armazena o nome vindo de enamed_institutions
```

O usuário seleciona a instituição do catálogo (`enamed_institutions`), mas a nota de corte vem de outra tabela (`enamed_cutoff_scores`) importada de fonte diferente. Além de hífens vs en-dashes, há diferenças de acentuação, espaços extras e caixa.

## Solução

Criar uma função SQL de normalização e usá-la na query de busca.

### 1. Migration: função `normalize_text_for_match`

```sql
CREATE OR REPLACE FUNCTION normalize_text_for_match(input text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT lower(
    regexp_replace(
      translate(
        -- Remove diacritics via unaccent, normalize dashes
        translate(
          unaccent(trim(input)),
          '–—―', '---'   -- en-dash, em-dash, horizontal bar → hyphen
        ),
        '"''', ''         -- Remove quotes
      ),
      '\s+', ' ', 'g'    -- Collapse whitespace
    )
  )
$$;
```

Requer a extensão `unaccent` (já habilitada ou a migration a habilita com `CREATE EXTENSION IF NOT EXISTS unaccent`).

### 2. Atualizar `fetchCutoffScore` em `rankingApi.ts`

Em vez de `ilike`, usar um RPC ou uma query com `filter` textual que aplique a normalização em ambos os lados:

```typescript
const { data } = await supabase.rpc('match_cutoff_score', {
  p_specialty: specialty.trim(),
  p_institution: institution.trim(),
});
```

Novo RPC `match_cutoff_score`:
```sql
CREATE OR REPLACE FUNCTION match_cutoff_score(
  p_specialty text,
  p_institution text
) RETURNS TABLE(...) AS $$
  SELECT institution_name, practice_scenario, specialty_name,
         cutoff_score_general, cutoff_score_quota
  FROM enamed_cutoff_scores
  WHERE normalize_text_for_match(specialty_name) 
      = normalize_text_for_match(p_specialty)
    AND normalize_text_for_match(institution_name) 
      LIKE '%' || normalize_text_for_match(p_institution) || '%'
  LIMIT 1;
$$;
```

Isso garante que "AFECC – HSRC" e "AFECC - HSRC" sejam idênticos após normalização, assim como diferenças de acento e caixa.

### 3. Atualizar tipos gerados

O RPC retorna a mesma shape de `CutoffScoreRow`, sem mudanças no frontend além de trocar a chamada em `fetchCutoffScore`.

## Arquivos

| Arquivo | Mudanca |
|---------|---------|
| `supabase/migrations/...` | `CREATE EXTENSION unaccent`, `normalize_text_for_match`, `match_cutoff_score` RPC |
| `src/services/rankingApi.ts` | `fetchCutoffScore` passa a chamar o RPC |
| `src/integrations/supabase/types.ts` | Regenerar com novo RPC |

