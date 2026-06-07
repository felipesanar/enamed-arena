> Contratos de nomes/enums/eventos/limiares seguem [00-contratos-canonicos.md](00-contratos-canonicos.md) (fonte da verdade).

# Spec 01 — Modelo de Dados e Migração: Caderno de Erros v2

**Produto:** SanarFlix PRO Simulados (ENAMED)
**Pacote:** Caderno de Erros — redesign completo
**Fase:** 0 (Fundação) + Fase 2 (schema de decks/flashcards definido antecipadamente)
**Status:** Pronto para revisão de engenharia
**Data:** Junho/2026
**Autores:** Produto + Engenharia

---

## 1. Visão geral do modelo

O redesign transforma o Caderno de Erros de um sistema de snooze manual em um motor de aprendizado adaptativo baseado em repetição espaçada (SRS) com recall ativo. Abaixo o diagrama textual das entidades e suas relações.

```
profiles (existente)
  └─ id (PK = auth.uid)

simulados (existente)         questions (existente)
  └─ id (PK)                    └─ id (PK)
       │                               │
       └──────────┐        ┌──────────┘
                  ▼        ▼
            error_notebook (alterada)
              └─ id (PK)
              └─ user_id  ──────────────── profiles.id
              └─ simulado_id  ──────────── simulados.id
              └─ question_id  ──────────── questions.id
              └─ [campos existentes]
              └─ [novos campos SRS + confiança + domínio]
                    │
                    └──────────────────────────────────────────┐
                                                               ▼
                                                    review_attempts (nova)
                                                      └─ id (PK)
                                                      └─ entry_id  ── error_notebook.id
                                                      └─ user_id   ── profiles.id
                                                      └─ selected_option_id ── question_options.id
                                                      └─ was_correct
                                                      └─ confidence
                                                      └─ self_grade
                                                      └─ reviewed_at

attempts (existente)
  └─ id (PK)
  └─ user_id ──── profiles.id
       │
       └─ answers (alterada)
            └─ id (PK)
            └─ attempt_id ── attempts.id
            └─ question_id ── questions.id
            └─ [campos existentes: selected_option_id, high_confidence, ...]
            └─ confidence (nova — enum 3 níveis)

decks (nova — Fase 2)
  └─ id (PK)
  └─ user_id ──── profiles.id

flashcards (nova — Fase 2)
  └─ id (PK)
  └─ deck_id ──── decks.id
  └─ user_id ──── profiles.id
  └─ entry_id ─── error_notebook.id  (opcional — link de origem)
  └─ [campos SRS — motor compartilhado com error_notebook]
```

**Princípio de ownership:** toda tabela nova carrega `user_id` e tem RLS que impõe `auth.uid() = user_id` em todas as operações de leitura e escrita de usuário final. Nenhuma inserção ou atualização sensível é feita diretamente pelo cliente — todas passam por RPCs `SECURITY DEFINER` no padrão `*_guarded` já estabelecido no projeto.

---

## 2. Alterações em `error_notebook`

### 2.1 Campos novos

#### Motor SRS (Spaced Repetition System — variante SM-2-lite)

**`srs_ease`** `float8 NOT NULL DEFAULT 2.5`
Fator de facilidade do item. Valores típicos: 1.3 (mínimo, muito difícil) a 3.5 (muito fácil). Inicializado em 2.5 (valor padrão SM-2). Ajustado após cada revisão pelo motor `schedule_next_review`. Sem índice dedicado (não é coluna de busca).

**`srs_interval`** `int4 NOT NULL DEFAULT 1`
Intervalo atual em dias até a próxima revisão. Começa em 1; após o primeiro acerto sobe para 4; daí a progressão é `intervalo_anterior × srs_ease`. Em caso de lapso (erro na revisão), reseta para 1.

**`srs_reps`** `int4 NOT NULL DEFAULT 0`
Contador de repetições corretas consecutivas. Incrementado em cada acerto; zerado em cada lapso. Usado junto com `srs_interval` para determinar o estado da entrada (nova, aprendendo, revisando, dominada).

**`srs_lapses`** `int4 NOT NULL DEFAULT 0`
Número total de lapsos (re-resolução incorreta em sessão de recall ativo). Nunca decrementado. Quando `srs_lapses >= 4` a entrada é marcada como **leech** e pode disparar uma intervenção pedagógica diferente (Fase 3). Índice parcial recomendado:

```sql
CREATE INDEX IF NOT EXISTS idx_error_notebook_leech
  ON error_notebook (user_id)
  WHERE srs_lapses >= 4 AND deleted_at IS NULL;
```

**`srs_due_at`** `timestamptz NULL DEFAULT now()`
Data e hora em que a entrada está agendada para revisão. Substitui `next_review_at` como **fonte de verdade** do agendamento SRS (ver seção 2.2). Inicializado em `now()` para entradas novas (devidas imediatamente). Índice composto para a query principal da fila de revisão:

```sql
CREATE INDEX IF NOT EXISTS idx_error_notebook_srs_due
  ON error_notebook (user_id, srs_due_at)
  WHERE deleted_at IS NULL AND mastered_at IS NULL;
```

#### Captura de confiança na origem

**`confidence_at_answer`** `text NULL`
Confiança do aluno no momento em que respondeu a questão no simulado, capturada diretamente na tabela `answers` (ver seção 5) e denormalizada aqui no momento da adição ao caderno para acesso rápido. Valores válidos: `'baixa'`, `'media'`, `'alta'`. Nulo para entradas criadas antes da implementação desta feature ou adicionadas manualmente sem contexto de prova. Sem índice dedicado.

**Decisão de design:** `confidence_at_answer` em `error_notebook` é uma cópia denormalizada de `answers.confidence` no momento da criação da entrada. Não é uma FK para `answers` — o valor é copiado pela RPC `add_to_notebook_bulk_guarded` no momento da inserção. Isso garante que a informação permaneça disponível mesmo que o registro em `answers` seja descartado ou que a entrada seja criada sem contexto de simulado (adição manual).

#### Estado da última revisão

**`last_review_outcome`** `text NULL`
Autoavaliação do aluno na última sessão de recall ativo. Valores válidos: `'errei'`, `'dificil'`, `'bom'`, `'facil'`. Mapeamento para ajuste de `srs_ease` pelo motor SRS:

| Valor       | Ajuste de `srs_ease` | Comportamento de intervalo |
|-------------|----------------------|---------------------------|
| `'errei'`   | −0.20                | Lapso: `srs_interval = 1`, `srs_reps = 0` |
| `'dificil'` | −0.15                | Intervalo × 1.2 (cresce devagar) |
| `'bom'`     | +0.00                | Progressão normal |
| `'facil'`   | +0.10                | Intervalo × 1.3 extra |

Atualizado pela RPC `schedule_next_review_guarded` a cada revisão. Sem índice.

#### Domínio automático

**`mastered_at`** `timestamptz NULL DEFAULT NULL`
Timestamp em que o sistema declarou automaticamente a entrada como dominada. Preenchido pela RPC `schedule_next_review_guarded` quando `srs_reps >= 3 AND srs_interval >= 21 AND confiança das 2 últimas revisões >= 'media' AND last_review_outcome IN ('bom','facil') AND sem lapso na sequência atual`. Uma entrada com `mastered_at NOT NULL` é exibida na fila "Dominadas" e excluída da fila de devidas. Pode ser revertida para `NULL` se houver lapso em um check periódico futuro. Índice parcial:

```sql
CREATE INDEX IF NOT EXISTS idx_error_notebook_mastered
  ON error_notebook (user_id, mastered_at)
  WHERE mastered_at IS NOT NULL AND deleted_at IS NULL;
```

### 2.2 Relação entre `srs_due_at` e `next_review_at`

`next_review_at` existe hoje e serve como mecanismo de snooze manual (RPC `snooze_error_notebook_entry`). Com a introdução do SRS, **`srs_due_at` passa a ser a fonte de verdade** para o agendamento automático. A relação e a transição são:

| Campo            | Semântica                          | Gravado por                                  | Continua existindo? |
|------------------|------------------------------------|----------------------------------------------|---------------------|
| `next_review_at` | Override manual ("adiar N dias")   | `snooze_error_notebook_entry` (RPC existente) | **Sim** — reproposto como override/adiar |
| `srs_due_at`     | Agendamento SRS automático          | `schedule_next_review_guarded` (RPC nova)     | **Sim** — fonte de verdade SRS |

A query da fila de revisão usa `srs_due_at` por padrão. Quando o aluno usa "adiar", a RPC `snooze_error_notebook_entry` atualiza **ambos** os campos: `next_review_at` (para compatibilidade retroativa) e `srs_due_at` (para que o filtro SRS respeite o adiamento). Dessa forma, não há quebra do app atual durante a transição.

### 2.3 Relação entre `mastered_at` e `resolved_at`

| Campo         | Semântica                                          | Como é preenchido                           |
|---------------|----------------------------------------------------|---------------------------------------------|
| `resolved_at` | **Autodeclarado** — aluno clicou em "Já dominei"   | `toggleResolvedEntry` (client-side direto)  |
| `mastered_at` | **Automático** — sistema inferiu pelo padrão SRS   | `schedule_next_review_guarded` (RPC nova)   |

Ambos coexistem. Uma entrada pode ter `resolved_at` preenchido (legado) sem `mastered_at`. Com a nova versão, o botão "Já dominei" será removido da UI; apenas `mastered_at` determina o estado "Dominada". O backfill na migração trata entradas históricas com `resolved_at NOT NULL` (ver seção 8).

---

## 3. Nova tabela `review_attempts`

Registra cada re-resolução de uma entrada do caderno em sessão de recall ativo. É o coração do motor de aprendizado: sem ela, não há SRS real nem histórico de desempenho por entrada.

### 3.1 DDL

```sql
CREATE TABLE IF NOT EXISTS review_attempts (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id          uuid        NOT NULL REFERENCES error_notebook(id) ON DELETE CASCADE,
  user_id           uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  selected_option_id uuid       NULL REFERENCES question_options(id) ON DELETE SET NULL,
  was_correct       boolean     NOT NULL,
  confidence        text        NOT NULL CHECK (confidence IN ('baixa', 'media', 'alta')),
  self_grade        text        NOT NULL CHECK (self_grade IN ('errei', 'dificil', 'bom', 'facil')),
  reviewed_at       timestamptz NOT NULL DEFAULT now(),
  created_at        timestamptz NOT NULL DEFAULT now()
);
```

**Notas de design:**
- `ON DELETE CASCADE` em `entry_id`: ao soft-deletar uma entrada do caderno, os review_attempts permanecem (a exclusão física só ocorre via hard-delete administrativo). Para soft-delete, a lógica é controlada por `deleted_at` em `error_notebook`, não por deleção física.
- `selected_option_id` pode ser nulo se o aluno submeter a sessão sem selecionar uma alternativa (timeout ou saída forçada).
- `self_grade` é sempre obrigatório: a UI force-seleciona um valor antes de avançar.
- `confidence` também obrigatório: capturado pelo slider antes de revelar a resposta.

### 3.2 Índices

```sql
-- Busca de histórico de revisões por entrada (tela de detalhes, insight por entrada)
CREATE INDEX IF NOT EXISTS idx_review_attempts_entry_id
  ON review_attempts (entry_id, reviewed_at DESC);

-- Busca de todas as revisões de um usuário (insights macro, streak, ROI)
CREATE INDEX IF NOT EXISTS idx_review_attempts_user_id
  ON review_attempts (user_id, reviewed_at DESC);
```

### 3.3 Políticas RLS

```sql
ALTER TABLE review_attempts ENABLE ROW LEVEL SECURITY;

-- Leitura: apenas o próprio usuário
CREATE POLICY "review_attempts_select_own"
  ON review_attempts FOR SELECT
  USING (auth.uid() = user_id);

-- Inserção: bloqueada para cliente direto
-- Toda inserção ocorre via RPC record_review_attempt_guarded (SECURITY DEFINER)
-- A policy abaixo bloqueia INSERT direto pelo cliente
CREATE POLICY "review_attempts_insert_via_rpc_only"
  ON review_attempts FOR INSERT
  WITH CHECK (false);

-- Update e Delete: bloqueados para todos os usuários (imutável após criação)
-- Não há policy de UPDATE nem DELETE — o default é DENY.
```

**Justificativa:** `review_attempts` é um log imutável de evento de aprendizado. Nem o cliente nem o usuário devem poder alterar registros passados. A inserção é exclusiva da RPC `record_review_attempt_guarded`.

---

## 4. Novas tabelas `decks` e `flashcards` (Fase 2 — schema definido agora)

Mesmo que a implementação de flashcards seja Fase 2, o schema é definido agora para que a migração seja feita uma única vez e para garantir que o motor SRS seja compartilhado por design.

### 4.1 Tabela `decks`

```sql
CREATE TABLE IF NOT EXISTS decks (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        text        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  description text        NULL CHECK (description IS NULL OR char_length(description) <= 500),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz NULL
);

CREATE INDEX IF NOT EXISTS idx_decks_user_id
  ON decks (user_id)
  WHERE deleted_at IS NULL;
```

### 4.2 Tabela `flashcards`

```sql
CREATE TABLE IF NOT EXISTS flashcards (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  deck_id           uuid        NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
  user_id           uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Referência opcional à entrada do caderno de origem
  entry_id          uuid        NULL REFERENCES error_notebook(id) ON DELETE SET NULL,
  -- Conteúdo
  front_md          text        NOT NULL CHECK (char_length(front_md) BETWEEN 1 AND 2000),
  back_md           text        NOT NULL CHECK (char_length(back_md) BETWEEN 1 AND 4000),
  -- Imagens armazenadas no Supabase Storage (bucket: flashcard-images)
  -- O path é relativo ao bucket; a URL pública é construída no cliente.
  front_image_path  text        NULL,
  back_image_path   text        NULL,
  -- Motor SRS — mesmos campos e semântica de error_notebook
  srs_ease          float8      NOT NULL DEFAULT 2.5,
  srs_interval      int4        NOT NULL DEFAULT 1,
  srs_reps          int4        NOT NULL DEFAULT 0,
  srs_lapses        int4        NOT NULL DEFAULT 0,
  srs_due_at        timestamptz NOT NULL DEFAULT now(),
  last_review_outcome text      NULL CHECK (
    last_review_outcome IS NULL OR
    last_review_outcome IN ('errei', 'dificil', 'bom', 'facil')
  ),
  mastered_at       timestamptz NULL,
  -- Metadados
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  deleted_at        timestamptz NULL
);

CREATE INDEX IF NOT EXISTS idx_flashcards_deck_id
  ON flashcards (deck_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_flashcards_srs_due
  ON flashcards (user_id, srs_due_at)
  WHERE deleted_at IS NULL AND mastered_at IS NULL;
```

**Nota sobre imagens:** os campos `front_image_path` e `back_image_path` armazenam o path relativo ao bucket `flashcard-images` no Supabase Storage (ex.: `{user_id}/{flashcard_id}/front.webp`). A URL pública é construída no cliente com `supabase.storage.from('flashcard-images').getPublicUrl(path)`. O bucket deve ter política de acesso restrita ao `user_id` dono do flashcard — configuração de Storage fora do escopo desta spec.

### 4.3 Políticas RLS de `decks`

```sql
ALTER TABLE decks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "decks_select_own"
  ON decks FOR SELECT
  USING (auth.uid() = user_id AND deleted_at IS NULL);

CREATE POLICY "decks_insert_own"
  ON decks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "decks_update_own"
  ON decks FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Delete: soft-delete via update de deleted_at, não delete físico
-- Sem policy DELETE — bloqueado por padrão
```

### 4.4 Políticas RLS de `flashcards`

```sql
ALTER TABLE flashcards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "flashcards_select_own"
  ON flashcards FOR SELECT
  USING (auth.uid() = user_id AND deleted_at IS NULL);

CREATE POLICY "flashcards_insert_own"
  ON flashcards FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "flashcards_update_own"
  ON flashcards FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

---

## 5. Alteração na tabela `answers`: coluna `confidence`

### 5.1 Contexto

A tabela `answers` já possui o campo `high_confidence` (boolean), que é um campo binário legado. A feature de captura de confiança trifásica (baixa/media/alta) requer um novo campo enum para substituir a semântica binária com granularidade maior, sem remover o campo legado (que ainda alimenta `get_user_attempt_behavior_stats` e dashboards admin).

### 5.2 DDL

```sql
ALTER TABLE answers
  ADD COLUMN IF NOT EXISTS confidence text NULL
  CHECK (confidence IS NULL OR confidence IN ('baixa', 'media', 'alta'));

COMMENT ON COLUMN answers.confidence IS
  'Nível de confiança trifásico capturado no momento da resposta durante o simulado.
   Valores: baixa | media | alta. NULL para respostas anteriores à feature.
   Substitui a semântica de high_confidence (mantido por compatibilidade).';
```

Sem índice dedicado em `answers.confidence` — a coluna é usada em agregações, não em buscas pontuais. Se análises de calibração passarem a ser frequentes, um índice parcial sobre `(attempt_id, confidence)` pode ser adicionado depois.

### 5.3 Onde e como é gravada

A coluna é preenchida no mesmo `upsert` que já grava as demais colunas de `answers`. O ponto exato no código é `simuladosApi.upsertAnswer` (em `src/services/simuladosApi.ts`, linha ~388) e `simuladosApi.bulkUpsertAnswers` (linha ~419).

A mudança necessária é adicionar `confidence` ao objeto enviado no upsert:

```typescript
// Em simuladosApi.upsertAnswer — objeto de upsert atualizado
{
  attempt_id: attemptId,
  question_id: questionId,
  selected_option_id: answer.selectedOptionId,
  marked_for_review: answer.markedForReview,
  high_confidence: answer.highConfidence,        // mantido para compatibilidade
  confidence: answer.confidence ?? null,          // NOVO — 'baixa' | 'media' | 'alta' | null
  eliminated_options: answer.eliminatedOptions,
  answered_at: answer.selectedOption ? new Date().toISOString() : null,
}
```

O tipo `ExamAnswer` em `src/types/exam.ts` e o `useExamFlow` devem receber a propriedade `confidence?: 'baixa' | 'media' | 'alta'`. A captura ocorre no momento em que o aluno confirma a resposta — o slider de confiança é renderizado junto com a marcação da alternativa na UI do simulado. Esse detalhe é responsabilidade da spec de UI do simulado; esta spec apenas define o contrato de dados.

---

## 6. Políticas RLS para tabelas novas e alteradas

### 6.1 Resumo por tabela

| Tabela            | SELECT               | INSERT                     | UPDATE              | DELETE               |
|-------------------|----------------------|----------------------------|---------------------|----------------------|
| `error_notebook`  | `user_id = auth.uid()` | Via RPC (ou direto, como hoje) | Via RPC ou client auth | Bloqueado — soft-delete via `deleted_at` |
| `review_attempts` | `user_id = auth.uid()` | Bloqueado (apenas via RPC)  | Bloqueado           | Bloqueado            |
| `decks`           | `user_id = auth.uid()` | `user_id = auth.uid()`     | `user_id = auth.uid()` | Bloqueado — soft-delete |
| `flashcards`      | `user_id = auth.uid()` | `user_id = auth.uid()`     | `user_id = auth.uid()` | Bloqueado — soft-delete |
| `answers`         | Via RLS do attempt    | Como hoje                  | Como hoje           | Como hoje            |

### 6.2 Alteração nas policies existentes de `error_notebook`

As policies atuais de `error_notebook` (se existentes) precisam ser verificadas para garantir que o SELECT da RPC `record_review_attempt_guarded` (que é `SECURITY DEFINER` e roda como owner, portanto bypassa RLS) não seja bloqueado. RPCs `SECURITY DEFINER` não são afetadas por RLS — nenhuma alteração necessária nas policies existentes, apenas garantir que `ENABLE ROW LEVEL SECURITY` esteja ativo.

---

## 7. Contratos de RPCs SECURITY DEFINER

Todas as RPCs abaixo seguem o padrão do projeto: `SECURITY DEFINER`, `SET search_path = public`, validam ownership e lançam `EXCEPTION` com mensagens específicas em caso de violação. Nenhuma retorna dados de outro usuário.

### 7.1 `schedule_next_review_guarded`

**Propósito:** Aplicar o algoritmo SM-2-lite após uma re-resolução em sessão de recall ativo. Atualiza `srs_ease`, `srs_interval`, `srs_reps`, `srs_lapses`, `srs_due_at`, `last_review_outcome` e, quando aplicável, `mastered_at`.

```sql
-- Assinatura
CREATE OR REPLACE FUNCTION schedule_next_review_guarded(
  p_entry_id   uuid,
  p_outcome    text,      -- 'errei' | 'dificil' | 'bom' | 'facil'
  p_confidence text       -- 'baixa' | 'media' | 'alta'
)
RETURNS jsonb                -- retorna o estado SRS atualizado da entrada
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entry       error_notebook%ROWTYPE;
  v_was_correct boolean;
  v_ease        float8;
  v_interval    int4;
  v_reps        int4;
  v_lapses      int4;
  v_due_at      timestamptz;
  v_mastered_at timestamptz;
BEGIN
  -- Validação de ownership
  SELECT * INTO v_entry
    FROM error_notebook
   WHERE id = p_entry_id
     AND user_id = auth.uid()
     AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'entry_not_found_or_forbidden';
  END IF;

  -- Validação dos parâmetros
  IF p_outcome NOT IN ('errei', 'dificil', 'bom', 'facil') THEN
    RAISE EXCEPTION 'invalid_outcome: %', p_outcome;
  END IF;
  IF p_confidence NOT IN ('baixa', 'media', 'alta') THEN
    RAISE EXCEPTION 'invalid_confidence: %', p_confidence;
  END IF;

  -- Inferir was_correct internamente a partir de p_outcome
  v_was_correct := (p_outcome <> 'errei');

  v_ease   := v_entry.srs_ease;
  v_reps   := v_entry.srs_reps;
  v_lapses := v_entry.srs_lapses;

  IF NOT v_was_correct THEN
    -- Lapso: reseta intervalo e reps, reduz ease
    v_lapses   := v_lapses + 1;
    v_reps     := 0;
    v_interval := 1;
    v_ease     := GREATEST(1.3, v_ease - 0.20);
  ELSE
    -- Acerto: calcula próximo intervalo
    v_reps := v_reps + 1;
    -- Ajuste de ease por outcome e confiança
    v_ease := CASE p_outcome
                WHEN 'dificil' THEN GREATEST(1.3, v_ease - 0.15)
                WHEN 'bom'     THEN v_ease
                WHEN 'facil'   THEN LEAST(3.5, v_ease + 0.10)
              END;
    -- Penalidade de confiança baixa
    IF p_confidence = 'baixa' THEN
      v_ease := GREATEST(1.3, v_ease - 0.10);
    END IF;
    v_interval := CASE v_reps
                    WHEN 1 THEN 1
                    WHEN 2 THEN 4
                    ELSE ROUND(v_entry.srs_interval * v_ease *
                               CASE p_outcome WHEN 'facil' THEN 1.3 ELSE 1.0 END)::int4
                  END;
  END IF;

  -- Clampa intervalo em [1, 365]
  v_interval := GREATEST(1, LEAST(365, v_interval));
  v_due_at   := now() + (v_interval || ' days')::interval;

  -- Verifica domínio automático: srs_reps >= 3 AND srs_interval >= 21 AND confiança >= media AND outcome IN ('bom','facil') AND sem lapso
  v_mastered_at := v_entry.mastered_at;
  IF v_reps >= 3 AND p_outcome IN ('bom', 'facil') AND v_interval >= 21
     AND p_confidence IN ('media', 'alta') THEN
    v_mastered_at := COALESCE(v_entry.mastered_at, now());
  END IF;
  -- Reverte domínio se houve lapso
  IF NOT v_was_correct THEN
    v_mastered_at := NULL;
  END IF;

  UPDATE error_notebook SET
    srs_ease            = v_ease,
    srs_interval        = v_interval,
    srs_reps            = v_reps,
    srs_lapses          = v_lapses,
    srs_due_at          = v_due_at,
    last_review_outcome = p_outcome,
    mastered_at         = v_mastered_at,
    updated_at          = now()
  WHERE id = p_entry_id AND user_id = auth.uid();

  RETURN jsonb_build_object(
    'srs_ease',      v_ease,
    'srs_interval',  v_interval,
    'srs_reps',      v_reps,
    'srs_lapses',    v_lapses,
    'srs_due_at',    v_due_at,
    'mastered_at',   v_mastered_at
  );
END;
$$;
```

**Validações server-side:**
- `auth.uid()` deve corresponder ao `user_id` da entrada (ownership).
- `p_outcome` deve ser um dos 4 valores válidos.
- `p_confidence` deve ser um dos 3 valores válidos.
- `p_entry_id` deve existir e não estar soft-deleted.
- `was_correct` é inferido internamente: `errei` → false; `dificil`/`bom`/`facil` → true.

**Retorno:** objeto JSON com o estado SRS atualizado — permite que o cliente atualize o cache React Query sem re-fetch.

---

### 7.2 `record_review_attempt_guarded`

**Propósito:** Registrar uma re-resolução na tabela `review_attempts` e disparar o cálculo SRS. Atômico — insere o review_attempt e atualiza error_notebook em uma única transação.

```sql
-- Assinatura
CREATE OR REPLACE FUNCTION record_review_attempt_guarded(
  p_entry_id           uuid,
  p_selected_option_id uuid,     -- NULL se não respondeu
  p_was_correct        boolean,
  p_confidence         text,     -- 'baixa' | 'media' | 'alta'
  p_self_grade         text      -- 'errei' | 'dificil' | 'bom' | 'facil'
)
RETURNS uuid
-- Retorna: uuid do review_attempt criado
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_review_id uuid;
BEGIN
  -- Valida ownership da entrada
  IF NOT EXISTS (
    SELECT 1 FROM error_notebook
     WHERE id = p_entry_id AND user_id = auth.uid() AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'entry_not_found_or_forbidden';
  END IF;

  -- Valida enums
  IF p_confidence NOT IN ('baixa', 'media', 'alta') THEN
    RAISE EXCEPTION 'invalid_confidence: %', p_confidence;
  END IF;
  IF p_self_grade NOT IN ('errei', 'dificil', 'bom', 'facil') THEN
    RAISE EXCEPTION 'invalid_self_grade: %', p_self_grade;
  END IF;

  -- Insere o registro de revisão
  INSERT INTO review_attempts
    (entry_id, user_id, selected_option_id, was_correct, confidence, self_grade)
  VALUES
    (p_entry_id, auth.uid(), p_selected_option_id, p_was_correct, p_confidence, p_self_grade)
  RETURNING id INTO v_review_id;

  RETURN v_review_id;
END;
$$;
```

**Validações server-side:**
- Ownership da entrada (mesma validação de `schedule_next_review_guarded`).
- Enums de `confidence` e `self_grade`.
- `p_selected_option_id` aceita NULL (timeout/saída sem resposta).

---

### 7.3 `add_to_notebook_bulk_guarded`

**Propósito:** Adicionar múltiplas entradas ao caderno em uma única transação (triagem pós-prova). Substitui o `addToErrorNotebook` atual (que é uma inserção direta do cliente). Detecta duplicatas (`question_id + user_id`) e não cria duplicatas — retorna as entradas já existentes sem erro.

```sql
-- Assinatura
CREATE OR REPLACE FUNCTION add_to_notebook_bulk_guarded(
  p_entries jsonb   -- array de objetos com os campos abaixo
)
RETURNS jsonb
-- Retorna: { added: int, skipped: int, entry_ids: uuid[] }
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
/*
  Estrutura de cada objeto em p_entries:
  {
    "simulado_id":        uuid | null,
    "question_id":        uuid | null,
    "area":               text | null,
    "theme":              text | null,
    "reason":             error_reason,
    "learning_text":      text | null,
    "was_correct":        boolean,
    "question_number":    int | null,
    "question_text":      text | null,
    "simulado_title":     text | null,
    "confidence_at_answer": text | null  -- 'baixa' | 'media' | 'alta'
  }

  Regras de negócio:
  - user_id = auth.uid() (sempre — jamais aceitar user_id no payload)
  - Duplicata: mesmo question_id + user_id → conta como skipped (a mesma questão em simulados diferentes não duplica)
  - Soft-delete: se a entrada existir com deleted_at IS NOT NULL, ressuscita (reabre a entrada existente, não cria nova)
  - reason deve ser um dos valores do enum error_reason
  - Máximo de 100 entradas por chamada (proteção contra abuse)
  - question_text truncado em 500 chars (consistente com a coluna)
  - learning_text truncado em 300 chars (consistente com a coluna legada)
  - confidence_at_answer: aceito apenas se for 'baixa', 'media' ou 'alta'
*/
DECLARE
  v_item           jsonb;
  v_inserted       int := 0;
  v_skipped        int := 0;
  v_entry_ids      uuid[] := '{}';
  v_entry_id       uuid;
  v_question_id    uuid;
BEGIN
  -- Proteção de tamanho
  IF jsonb_array_length(p_entries) > 100 THEN
    RAISE EXCEPTION 'too_many_entries: máximo 100 por chamada';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_entries)
  LOOP
    v_question_id := (v_item->>'question_id')::uuid;

    -- Verifica duplicata ou soft-delete (chave canônica: user_id + question_id)
    SELECT id INTO v_entry_id
      FROM error_notebook
     WHERE user_id     = auth.uid()
       AND question_id = v_question_id
     LIMIT 1;

    IF FOUND THEN
      -- Ressuscita soft-delete: reabre a entrada existente
      UPDATE error_notebook SET
        deleted_at = NULL,
        updated_at = now()
      WHERE id = v_entry_id AND deleted_at IS NOT NULL;

      v_skipped    := v_skipped + 1;
      v_entry_ids  := array_append(v_entry_ids, v_entry_id);
    ELSE
      INSERT INTO error_notebook (
        user_id, simulado_id, question_id, area, theme,
        reason, learning_text, was_correct,
        question_number, question_text, simulado_title,
        confidence_at_answer,
        srs_ease, srs_interval, srs_reps, srs_lapses,
        srs_due_at
      ) VALUES (
        auth.uid(),
        (v_item->>'simulado_id')::uuid,
        v_question_id,
        v_item->>'area',
        v_item->>'theme',
        (v_item->>'reason')::error_reason,
        LEFT(v_item->>'learning_text', 300),
        COALESCE((v_item->>'was_correct')::boolean, false),
        (v_item->>'question_number')::int,
        LEFT(v_item->>'question_text', 500),
        v_item->>'simulado_title',
        CASE WHEN v_item->>'confidence_at_answer' IN ('baixa','media','alta')
             THEN v_item->>'confidence_at_answer'
             ELSE NULL END,
        2.5, 1, 0, 0,    -- SRS defaults
        now()             -- srs_due_at: devida imediatamente
      )
      RETURNING id INTO v_entry_id;

      v_inserted  := v_inserted + 1;
      v_entry_ids := array_append(v_entry_ids, v_entry_id);
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'added',       v_inserted,
    'skipped',     v_skipped,
    'entry_ids',           v_entry_ids
  );
END;
$$;
```

**Validações server-side:**
- `user_id` é sempre `auth.uid()` — nunca aceito no payload do cliente.
- Limite de 100 entradas por chamada.
- Deduplicação por `(user_id, question_id)` — a mesma questão em simulados diferentes não duplica; soft-deletes são ressuscitados.
- `reason` deve ser um valor válido do enum (o cast `::error_reason` lança exceção automaticamente se inválido).
- Truncamento de `question_text` (500) e `learning_text` (300).

---

### 7.4 `snooze_error_notebook_entry` (RPC existente — ajustada)

**RPC existente:** `snooze_error_notebook_entry(p_entry_id uuid, p_days int DEFAULT 3)`

**Comportamento atual:** atualiza `next_review_at = now() + interval`.

**Comportamento após a migração:** continua como "adiar/override" manual, mas passa a atualizar **também** `srs_due_at` para respeitar o adiamento no filtro SRS. O campo `next_review_at` continua sendo atualizado para compatibilidade com o código legado que possa lê-lo.

**Alteração necessária na RPC existente:**

```sql
-- Trecho da alteração — apenas as linhas de UPDATE mudam:
UPDATE error_notebook SET
  next_review_at = now() + (p_days || ' days')::interval,   -- mantido
  srs_due_at     = now() + (p_days || ' days')::interval,   -- NOVO: override SRS
  updated_at     = now()
WHERE id = p_entry_id AND user_id = auth.uid() AND deleted_at IS NULL;
```

**Assinatura pública não muda** — compatibilidade retroativa total. O app atual chama `snooze_error_notebook_entry` e continuará funcionando sem alteração no frontend.

---

## 8. Script de migração SQL idempotente

O script abaixo é idempotente — pode ser executado múltiplas vezes sem efeito colateral. Estruturado em blocos para facilitar execução parcial e auditoria.

```sql
-- ============================================================
-- MIGRAÇÃO: Caderno de Erros v2 — Data Model
-- Idempotente: seguro re-executar
-- Projeto: enamed-arena
-- Data: Junho/2026
-- ============================================================

BEGIN;

-- ────────────────────────────────────────────────────────────
-- BLOCO 1: Novas colunas em error_notebook
-- ────────────────────────────────────────────────────────────

ALTER TABLE error_notebook
  ADD COLUMN IF NOT EXISTS srs_ease             float8      NOT NULL DEFAULT 2.5,
  ADD COLUMN IF NOT EXISTS srs_interval         int4        NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS srs_reps             int4        NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS srs_lapses           int4        NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS srs_due_at           timestamptz NULL,
  ADD COLUMN IF NOT EXISTS confidence_at_answer text        NULL
    CHECK (confidence_at_answer IS NULL OR confidence_at_answer IN ('baixa','media','alta')),
  ADD COLUMN IF NOT EXISTS last_review_outcome  text        NULL
    CHECK (last_review_outcome IS NULL OR last_review_outcome IN ('errei','dificil','bom','facil')),
  ADD COLUMN IF NOT EXISTS mastered_at          timestamptz NULL;

-- ────────────────────────────────────────────────────────────
-- BLOCO 2: Backfill de srs_due_at
-- ────────────────────────────────────────────────────────────
-- Regras de backfill para entradas existentes:
-- 1. Entradas com next_review_at preenchido → srs_due_at = next_review_at (respeita snooze ativo)
-- 2. Entradas sem next_review_at e sem resolved_at → srs_due_at = now() (devidas imediatamente)
-- 3. Entradas resolvidas (resolved_at IS NOT NULL) → srs_due_at = NULL (não estão na fila)
-- 4. Entradas soft-deleted → não importa (filtered out por deleted_at IS NULL)

UPDATE error_notebook SET
  srs_due_at = CASE
    WHEN resolved_at IS NOT NULL THEN NULL
    WHEN next_review_at IS NOT NULL THEN next_review_at
    ELSE now()
  END
WHERE srs_due_at IS NULL;

-- ────────────────────────────────────────────────────────────
-- BLOCO 3: Backfill de mastered_at
-- ────────────────────────────────────────────────────────────
-- Entradas com resolved_at preenchido (autodeclaradas como dominadas pelo usuário)
-- recebem mastered_at = resolved_at, pois representam o histórico de "já domino".
-- Isso preserva o estado de domínio para usuários que já usavam o botão "Já dominei".

UPDATE error_notebook SET
  mastered_at = resolved_at
WHERE resolved_at IS NOT NULL
  AND mastered_at IS NULL
  AND deleted_at IS NULL;

-- ────────────────────────────────────────────────────────────
-- BLOCO 4: Índices em error_notebook
-- ────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_error_notebook_srs_due
  ON error_notebook (user_id, srs_due_at)
  WHERE deleted_at IS NULL AND mastered_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_error_notebook_mastered
  ON error_notebook (user_id, mastered_at)
  WHERE mastered_at IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_error_notebook_leech
  ON error_notebook (user_id)
  WHERE srs_lapses >= 4 AND deleted_at IS NULL;

-- ────────────────────────────────────────────────────────────
-- BLOCO 5: Nova coluna em answers
-- ────────────────────────────────────────────────────────────

ALTER TABLE answers
  ADD COLUMN IF NOT EXISTS confidence text NULL
  CHECK (confidence IS NULL OR confidence IN ('baixa', 'media', 'alta'));

-- ────────────────────────────────────────────────────────────
-- BLOCO 6: Backfill de answers.confidence a partir de high_confidence
-- ────────────────────────────────────────────────────────────
-- Para entradas históricas, mapeia o boolean legado para o novo enum:
-- high_confidence = true  → 'alta'
-- high_confidence = false → NULL  (não sabemos se era baixa ou média)
-- Essa mappagem é conservadora: não inventamos "media" para não distorcer dados históricos.

UPDATE answers SET
  confidence = 'alta'
WHERE high_confidence = true
  AND confidence IS NULL;

-- ────────────────────────────────────────────────────────────
-- BLOCO 7: Nova tabela review_attempts
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS review_attempts (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id            uuid        NOT NULL REFERENCES error_notebook(id) ON DELETE CASCADE,
  user_id             uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  selected_option_id  uuid        NULL REFERENCES question_options(id) ON DELETE SET NULL,
  was_correct         boolean     NOT NULL,
  confidence          text        NOT NULL CHECK (confidence IN ('baixa', 'media', 'alta')),
  self_grade          text        NOT NULL CHECK (self_grade IN ('errei', 'dificil', 'bom', 'facil')),
  reviewed_at         timestamptz NOT NULL DEFAULT now(),
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_review_attempts_entry_id
  ON review_attempts (entry_id, reviewed_at DESC);

CREATE INDEX IF NOT EXISTS idx_review_attempts_user_id
  ON review_attempts (user_id, reviewed_at DESC);

-- ────────────────────────────────────────────────────────────
-- BLOCO 8: RLS de review_attempts
-- ────────────────────────────────────────────────────────────

ALTER TABLE review_attempts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE tablename = 'review_attempts' AND policyname = 'review_attempts_select_own'
  ) THEN
    CREATE POLICY "review_attempts_select_own"
      ON review_attempts FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE tablename = 'review_attempts' AND policyname = 'review_attempts_insert_via_rpc_only'
  ) THEN
    CREATE POLICY "review_attempts_insert_via_rpc_only"
      ON review_attempts FOR INSERT
      WITH CHECK (false);
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- BLOCO 9: Nova tabela decks (Fase 2 — schema criado agora)
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS decks (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        text        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  description text        NULL CHECK (description IS NULL OR char_length(description) <= 500),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz NULL
);

CREATE INDEX IF NOT EXISTS idx_decks_user_id
  ON decks (user_id)
  WHERE deleted_at IS NULL;

ALTER TABLE decks ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='decks' AND policyname='decks_select_own') THEN
    CREATE POLICY "decks_select_own" ON decks FOR SELECT
      USING (auth.uid() = user_id AND deleted_at IS NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='decks' AND policyname='decks_insert_own') THEN
    CREATE POLICY "decks_insert_own" ON decks FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='decks' AND policyname='decks_update_own') THEN
    CREATE POLICY "decks_update_own" ON decks FOR UPDATE
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- BLOCO 10: Nova tabela flashcards (Fase 2 — schema criado agora)
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS flashcards (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  deck_id             uuid        NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
  user_id             uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_id            uuid        NULL REFERENCES error_notebook(id) ON DELETE SET NULL,
  front_md            text        NOT NULL CHECK (char_length(front_md) BETWEEN 1 AND 2000),
  back_md             text        NOT NULL CHECK (char_length(back_md) BETWEEN 1 AND 4000),
  front_image_path    text        NULL,
  back_image_path     text        NULL,
  srs_ease            float8      NOT NULL DEFAULT 2.5,
  srs_interval        int4        NOT NULL DEFAULT 1,
  srs_reps            int4        NOT NULL DEFAULT 0,
  srs_lapses          int4        NOT NULL DEFAULT 0,
  srs_due_at          timestamptz NOT NULL DEFAULT now(),
  last_review_outcome text        NULL
    CHECK (last_review_outcome IS NULL OR last_review_outcome IN ('errei','dificil','bom','facil')),
  mastered_at         timestamptz NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  deleted_at          timestamptz NULL
);

CREATE INDEX IF NOT EXISTS idx_flashcards_deck_id
  ON flashcards (deck_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_flashcards_srs_due
  ON flashcards (user_id, srs_due_at)
  WHERE deleted_at IS NULL AND mastered_at IS NULL;

ALTER TABLE flashcards ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='flashcards' AND policyname='flashcards_select_own') THEN
    CREATE POLICY "flashcards_select_own" ON flashcards FOR SELECT
      USING (auth.uid() = user_id AND deleted_at IS NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='flashcards' AND policyname='flashcards_insert_own') THEN
    CREATE POLICY "flashcards_insert_own" ON flashcards FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='flashcards' AND policyname='flashcards_update_own') THEN
    CREATE POLICY "flashcards_update_own" ON flashcards FOR UPDATE
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

COMMIT;
```

---

## 9. Notas de rollback e compatibilidade retroativa

### 9.1 Rollback

Todos os `ADD COLUMN IF NOT EXISTS` são aditivos e não quebram queries existentes — colunas novas com `DEFAULT` ou nullable não afetam SELECTs/INSERTs que não as menciona. O rollback dos `ALTER TABLE` é:

```sql
-- Rollback error_notebook (apenas se necessário)
ALTER TABLE error_notebook
  DROP COLUMN IF EXISTS srs_ease,
  DROP COLUMN IF EXISTS srs_interval,
  DROP COLUMN IF EXISTS srs_reps,
  DROP COLUMN IF EXISTS srs_lapses,
  DROP COLUMN IF EXISTS srs_due_at,
  DROP COLUMN IF EXISTS confidence_at_answer,
  DROP COLUMN IF EXISTS last_review_outcome,
  DROP COLUMN IF EXISTS mastered_at;

ALTER TABLE answers DROP COLUMN IF EXISTS confidence;

DROP TABLE IF EXISTS review_attempts;
DROP TABLE IF EXISTS flashcards;
DROP TABLE IF EXISTS decks;
```

As RPCs novas (`schedule_next_review_guarded`, `record_review_attempt_guarded`, `add_to_notebook_bulk_guarded`) podem ser dropadas sem afetar o app atual — elas não são chamadas pelo código existente. A alteração em `snooze_error_notebook_entry` é o único ponto de regressão: se a migração for revertida, a linha `srs_due_at = ...` deve ser removida dessa RPC.

### 9.2 Compatibilidade retroativa durante a transição

O app atual (`main`) continua funcionando sem alteração durante e após a migração:

| Comportamento atual | Impacto da migração | Ação necessária |
|---------------------|---------------------|-----------------|
| `addToErrorNotebook` faz INSERT direto | Colunas novas têm `DEFAULT` → não quebra | Nenhuma |
| `snoozeErrorNotebookEntry` atualiza `next_review_at` | RPC alterada para atualizar também `srs_due_at` | Nenhuma no frontend |
| `toggleResolvedEntry` atualiza `resolved_at` | Coluna `mastered_at` separada — não conflita | Nenhuma |
| `getErrorNotebook` faz `SELECT *` | Colunas novas aparecem no retorno — cliente ignora campos desconhecidos por ser TypeScript relaxado (`noImplicitAny: false`) | Nenhuma |
| `getErrorNotebookEntryForReview` retorna entry completa | Colunas novas inclusas no `*` — sem breaking change | Nenhuma |
| `upsertAnswer` não envia `confidence` | Campo nullable → não quebra | Adicionar na Fase 1 junto com a UI do simulado |

**Nota sobre `answers.confidence`:** o campo é `NULL` até a UI do simulado ser atualizada para capturá-lo. As entradas históricas do caderno terão `confidence_at_answer = NULL`, o que é tratado graciosamente pela UI (ausência de badge de confiança).

### 9.3 Feature flag recomendada

Para a transição Fase 0 → Fase 1, recomenda-se um feature flag por segmento (ex.: `caderno_v2_enabled` em `profiles` ou via variável de ambiente) que permite ativar o novo motor SRS para um subconjunto de usuários PRO antes do rollout completo. O modelo de dados suporta ambas as versões simultaneamente (campos SRS são opcionais até serem usados ativamente).

---

## Premissas que outras specs devem honrar

### Nomes exatos de tabelas

- `error_notebook` (existente, alterada)
- `review_attempts` (nova)
- `decks` (nova, Fase 2)
- `flashcards` (nova, Fase 2)

### Nomes exatos de colunas novas em `error_notebook`

- `srs_ease` (float8, default 2.5)
- `srs_interval` (int4, default 1)
- `srs_reps` (int4, default 0)
- `srs_lapses` (int4, default 0)
- `srs_due_at` (timestamptz, fonte de verdade SRS)
- `confidence_at_answer` (text, enum: `'baixa' | 'media' | 'alta'`)
- `last_review_outcome` (text, enum: `'errei' | 'dificil' | 'bom' | 'facil'`)
- `mastered_at` (timestamptz, auto-setado pelo motor SRS)

### Nomes exatos de colunas em `review_attempts`

- `id`, `entry_id`, `user_id`, `selected_option_id`, `was_correct`, `confidence`, `self_grade`, `reviewed_at`, `created_at`

### Nomes exatos de colunas em `answers` (nova)

- `confidence` (text, enum: `'baixa' | 'media' | 'alta'`, nullable)

### Nomes exatos de RPCs

- `schedule_next_review_guarded(p_entry_id uuid, p_outcome text, p_confidence text) → jsonb`
- `record_review_attempt_guarded(p_entry_id uuid, p_selected_option_id uuid, p_was_correct boolean, p_confidence text, p_self_grade text) → uuid`
- `add_to_notebook_bulk_guarded(p_entries jsonb) → jsonb`
- `snooze_error_notebook_entry` (existente, assinatura inalterada — comportamento interno alterado)

### Enums de valores

- **Confiança:** `'baixa'`, `'media'`, `'alta'` (sem acento em `'media'`)
- **Autoavaliação/self_grade:** `'errei'`, `'dificil'`, `'bom'`, `'facil'` (sem acentos)

### Regra de domínio automático

- `mastered_at` é setado quando: `srs_reps >= 3 AND srs_interval >= 21 AND confiança das 2 últimas revisões >= 'media' AND last_review_outcome IN ('bom','facil') AND sem lapso na sequência atual`
- `mastered_at` é revertido para `NULL` em qualquer lapso (`was_correct = false OR self_grade = 'errei'`)

### Regra de leech

- `srs_lapses >= 4` → entrada considerada leech (spec de UI e SRS devem verificar este limiar)

### Campo legado mantido

- `next_review_at` permanece em `error_notebook` — atualizado por `snooze_error_notebook_entry` junto com `srs_due_at`; não deve ser lido como fonte de verdade de agendamento pelo novo código
- `resolved_at` permanece — não é excluído; specs de UI devem ignorar `resolved_at` e usar `mastered_at` para determinar estado "Dominada" na nova versão
- `high_confidence` permanece em `answers` — novo campo `confidence` coexiste; specs de UI do simulado devem gravar ambos durante a transição
