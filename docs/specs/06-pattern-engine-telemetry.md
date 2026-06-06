# Spec 06 — Motor de Padrões (Prof. San macro) + Telemetria

> Contratos de nomes/enums/eventos/limiares seguem [00-contratos-canonicos.md](00-contratos-canonicos.md) (fonte da verdade).

**Produto:** SanarFlix PRO Simulados (ENAMED)  
**Feature:** Caderno de Erros — aba Insights + Painel de ROI + Funil completo de telemetria  
**Status:** Rascunho v1 — para revisão de Design e Engenharia  
**Data:** Junho/2026  
**Dependências upstream:** Spec 01 (modelo de dados / SRS), Spec 02 (recall ativo), Spec 03 (triagem pós-prova)

---

## Contexto e premissa estratégica

Hoje, tanto o SanarFlix quanto a Medway operam no nível do item: explicam UMA questão por vez. Nenhum dos dois olha *entre* os erros.

O Motor de Padrões (Prof. San macro) é o diferencial que transforma o caderno de lista de pendências em diagnóstico pessoal. Ele responde:

- *"Qual é o meu padrão de erro, não só minha última questão errada?"*
- *"Esse caderno está me ajudando de verdade?"*

Essas duas perguntas mapeiam para dois entregáveis desta spec:

1. **Aba Insights** — diagnóstico entre erros (I1 da visão definitiva).
2. **Painel de ROI** — prova de que o caderno funciona (I6 da visão definitiva).

A telemetria associada fecha o ciclo: mede se o aluno usa, se revisita, e se o caderno de fato melhora o desempenho.

---

## PARTE A — Motor de Padrões e aba Insights

### A.1 Tipos de insight a gerar

Cinco categorias de insight, em ordem de prioridade de renderização:

---

#### INSIGHT-1: Área/tema fraco ("Calcanhar")

**Critério de ativação:** área com taxa de acerto < 40 % OU razão erros/total ≥ 0,6, com mínimo de 5 entradas no caderno para aquela área.

**Copy de exemplo:**
> "Seu calcanhar é Nefrologia: você acertou 1 em 7 questões do caderno. Isso representa 14% — bem abaixo da sua média geral de 48%. Sugiro 3 aulas-chave + 20 questões filtradas antes do próximo simulado."

**Copy sem dados suficientes (3–4 entradas):**
> "Nefrologia está emergindo como ponto de atenção: 1/4 questões dominadas. Revise mais 2–3 para confirmar o padrão."

**CTA:** `[Ver questões de Nefrologia no caderno]` → `/caderno?area=Nefrologia`  
**Severidade:** `critical`

---

#### INSIGHT-2: Causa dominante por área

**Critério de ativação:** em uma área com ≥ 5 entradas, uma causa do erro representa > 50 % das ocorrências.

**Copy de exemplo (causa "desatenção"):**
> "62 % dos seus erros em Cardiologia são por desatenção — você marcou a opção sem ler até o detalhe ('EXCETO', 'sem febre'). O conteúdo você sabe. Treine técnica de prova: sublinhe mentalmente a palavra-chave antes de marcar."

**Copy de exemplo (causa "lacuna"):**
> "Em Endocrinologia, 71 % dos erros indicam lacuna de conteúdo — você não tinha visto o conceito cobrado. Isso é diferente de desatenção: vale assistir às aulas antes de fazer mais questões."

**CTA variável por causa:**
- `lacuna` → `[Ver aulas de Endocrinologia no SanarFlix]`
- `desatencao` / `reading_error` → `[Iniciar sessão de revisão — técnica de prova]`
- `diferencial` / `confused_alternatives` → `[Revisar questões de diferencial desta área]`
- `memoria` / `did_not_remember` → `[Criar flashcards desta área]`

**Severidade:** `attention`

---

#### INSIGHT-3: Confusão recorrente entre condições

**Critério de ativação:** mesmo par (área + tema + causa `confused_alternatives`) aparece em ≥ 3 entradas distintas no caderno, OU o campo `question_text` de ≥ 3 entradas menciona os mesmos dois diagnósticos/condições (heurística baseada em NLP leve via IA).

**Este insight exige IA** para identificar o par de condições pelo texto; o SQL apenas sinaliza os candidatos.

**Copy de exemplo:**
> "Você confundiu IAM com Angina Instável em 4 questões diferentes. A diferença que separa as duas na prova é um detalhe de biomarcador e de ECG — e ela cai com frequência. Aqui está a tabela diferencial que o Prof. San montou para você."

**Output adicional:** a IA retorna um bloco `comparison_table` em markdown (≤ 12 linhas) com os critérios diferenciais lado a lado.

**CTA:** `[Ver tabela diferencial + questões relacionadas]` → abre modal de comparação dentro da aba Insights  
**Severidade:** `critical` (quando ≥ 4 ocorrências), `attention` (3 ocorrências)

---

#### INSIGHT-4: Calibração / overconfidence

**Critério de ativação:** combinação de `answers.high_confidence = true` (capturado no simulado) com `attempt_question_results.is_correct = false`, em entradas do caderno. Ativa quando: ≥ 5 questões com alta confiança + erradas, ou taxa overconfidence > 30 % para uma área específica.

**Copy de exemplo (overconfidence geral):**
> "Você marcou 38 % das suas questões com alta certeza — e errou 9 dessas. Isso é um sinal de overconfidence. As áreas mais afetadas são Cardiologia e Endocrinologia. Revise esses temas com atenção redobrada antes de declarar que os domina."

**Copy de exemplo (por área):**
> "Em Cardiologia, você acerta mais quando tem baixa confiança do que quando tem alta. Isso é raro e merece atenção: pode ser que você esteja mais inseguro em casos que na verdade domina, e seguro demais nos que te enganam."

**Nota técnica:** `answers.high_confidence` já existe na tabela `answers` (boolean). Após a Fase 0, será complementado por `error_notebook.confidence_at_answer` (texto `baixa|media|alta`) capturado no recall ativo.

**CTA:** `[Revisar questões de alta confiança que errei]` → filtro pré-aplicado no caderno  
**Severidade:** `attention`

---

#### INSIGHT-5: ROI — temas dominados × desempenho posterior

**Critério de ativação:** usuário tem ≥ 2 simulados com resultado **após** ter dominado pelo menos 3 entradas de uma área.

**Lógica:** Para cada área A onde o usuário tem entradas com `mastered_at IS NOT NULL`:

1. Calcular `score_area_antes` = média de acerto nessa área em simulados anteriores à primeira `mastered_at` da área.
2. Calcular `score_area_depois` = média de acerto nessa área em simulados posteriores à última `mastered_at`.
3. Delta = `score_area_depois` − `score_area_antes` (em pp).

**Copy de exemplo (ROI positivo):**
> "Os temas que você dominou no caderno estão funcionando: em Cardiologia, seu acerto subiu de 41 % para 59 % nos dois simulados depois que dominou as 6 questões do caderno. Isso é +18 pp. O caderno está fazendo efeito."

**Copy de exemplo (ROI neutro / sem dados suficientes):**
> "Ainda não temos dados suficientes para calcular o impacto do caderno no seu desempenho. Domine mais questões e complete pelo menos um simulado depois — o painel vai atualizar."

**Severidade:** `positive` (ROI ≥ +5 pp), `info` (ROI entre −5 e +5 pp ou dados insuficientes), `attention` (ROI < −5 pp, ou seja, área dominada mas desempenho piorou — raro, mas sinaliza revisão necessária).

---

### A.2 Dados necessários: queries e divisão SQL × IA

#### Query base (SQL / RPC): `get_caderno_pattern_data(p_user_id)`

Retorna um objeto agregado para alimentar tanto a renderização direta quanto a edge function de IA. Rodada uma única vez por sessão (cacheada — ver A.3).

```sql
-- Pseudo-código da RPC (SECURITY DEFINER, acessa apenas dados do próprio usuário)

WITH notebook_entries AS (
  SELECT
    en.id,
    en.area,
    en.theme,
    en.reason,
    en.was_correct,
    en.resolved_at,
    en.mastered_at,        -- novo campo (Fase 0)
    en.created_at,
    en.question_id,
    en.simulado_id,
    a.high_confidence      -- JOIN com answers via question_id + attempt implícito
  FROM error_notebook en
  LEFT JOIN answers a
    ON a.question_id = en.question_id
    AND a.attempt_id IN (
      SELECT id FROM attempts WHERE user_id = p_user_id
    )
  WHERE en.user_id = p_user_id
    AND en.deleted_at IS NULL
),

-- 1) Distribuição por área e causa
area_cause_dist AS (
  SELECT
    area,
    reason,
    COUNT(*)          AS cnt,
    SUM(CASE WHEN mastered_at IS NOT NULL THEN 1 ELSE 0 END) AS mastered_cnt
  FROM notebook_entries
  GROUP BY area, reason
),

-- 2) Overconfidence: questões high_confidence=true + erradas (no simulado original)
overconf AS (
  SELECT
    en.area,
    COUNT(*) FILTER (WHERE a.high_confidence = true AND aqr.is_correct = false) AS high_conf_wrong,
    COUNT(*) FILTER (WHERE a.high_confidence = true)                             AS high_conf_total
  FROM notebook_entries en
  JOIN attempt_question_results aqr ON aqr.question_id = en.question_id
  JOIN answers a ON a.question_id = en.question_id
    AND a.attempt_id = aqr.attempt_id
  GROUP BY en.area
),

-- 3) ROI: score por área antes e depois de mastered_at
-- (requer user_performance_history + área-level score — ver nota abaixo)
roi_data AS (
  -- Agregado fora do SQL se user_performance_history não tiver score por área;
  -- neste caso, usa attempt_question_results para calcular score por área por attempt
  SELECT
    en.area,
    MIN(en.mastered_at)                                                              AS first_mastered_at,
    AVG(aqr.is_correct::int) FILTER (WHERE uph.finished_at < MIN(en.mastered_at))   AS score_before,
    AVG(aqr.is_correct::int) FILTER (WHERE uph.finished_at > MIN(en.mastered_at))   AS score_after
  FROM notebook_entries en
  JOIN attempt_question_results aqr ON aqr.question_id = en.question_id
  JOIN user_performance_history uph ON uph.attempt_id = aqr.attempt_id
  WHERE en.mastered_at IS NOT NULL
  GROUP BY en.area
  HAVING COUNT(DISTINCT uph.attempt_id) >= 2
)

SELECT
  json_build_object(
    'area_cause_dist', (SELECT json_agg(row_to_json(t)) FROM area_cause_dist t),
    'overconf',        (SELECT json_agg(row_to_json(t)) FROM overconf t),
    'roi_data',        (SELECT json_agg(row_to_json(t)) FROM roi_data t),
    'total_entries',   (SELECT COUNT(*) FROM notebook_entries),
    'total_mastered',  (SELECT COUNT(*) FROM notebook_entries WHERE mastered_at IS NOT NULL)
  );
```

**Nota sobre score por área:** `user_performance_history` armazena apenas score global. Para ROI por área, a query usa `attempt_question_results JOIN questions.area` diretamente. Isso é mais custoso — cache obrigatório.

**Nota sobre `mastered_at`:** campo novo a ser adicionado em `error_notebook` na Fase 0 (ver Apêndice A da visão definitiva). Antes de sua existência, usar `resolved_at` como proxy (com ressalva).

#### O que é puro SQL (sem IA)

| Insight | Componente SQL | Componente IA |
|---------|---------------|---------------|
| INSIGHT-1 (área fraca) | Taxa de acerto por área, ranking | Geração do copy personalizado |
| INSIGHT-2 (causa dominante) | Distribuição de `reason` por área | Geração do copy + dica estratégica |
| INSIGHT-3 (confusão recorrente) | Candidatos: área + tema + cause=`confused_alternatives` com count ≥ 3 | Identificar o par de condições + gerar tabela diferencial |
| INSIGHT-4 (overconfidence) | `high_confidence AND NOT is_correct` agrupado por área | Geração do copy + interpretação do padrão |
| INSIGHT-5 (ROI) | Delta de score antes/depois de `mastered_at` | Geração do copy + narrativa de progresso |

---

### A.3 Edge function `caderno-pattern-insights`

#### Contrato

**Nome:** `caderno-pattern-insights`  
**Método:** POST  
**Autenticação:** JWT do usuário (via `Authorization: Bearer <token>`)

**Input:**

```typescript
interface PatternInsightsRequest {
  // Dados pré-agregados pelo cliente (resultado de get_caderno_pattern_data)
  aggregated: {
    area_cause_dist: Array<{
      area: string;
      reason: string;      // enum error_reason
      cnt: number;
      mastered_cnt: number;
    }>;
    overconf: Array<{
      area: string;
      high_conf_wrong: number;
      high_conf_total: number;
    }>;
    roi_data: Array<{
      area: string;
      first_mastered_at: string;  // ISO
      score_before: number | null; // 0–1
      score_after: number | null;  // 0–1
    }>;
    total_entries: number;
    total_mastered: number;
  };
  // Amostra de textos de questões para INSIGHT-3 (confusão)
  // Máximo 30 entradas; apenas question_text e area/theme — sem dados pessoais
  question_samples: Array<{
    area: string;
    theme: string;
    question_text: string; // primeiros 300 caracteres
    reason: string;
  }>;
  student_first_name: string;
}
```

**Output:**

```typescript
interface PatternInsightsResponse {
  insights: PatternInsight[];
  generated_at: string;  // ISO — para cache
  has_sufficient_data: boolean; // false se total_entries < 5
}

interface PatternInsight {
  id: string;                     // 'weak-area' | 'dominant-cause' | 'recurring-confusion' | 'overconfidence' | 'roi'
  type: InsightType;
  severity: 'critical' | 'attention' | 'positive' | 'info';
  title: string;                  // 1 linha
  body: string;                   // 2–4 frases, markdown permitido
  metric?: string;                // número de destaque (ex: "1/7", "+18pp", "62%")
  comparison_table?: string;      // markdown table — apenas em INSIGHT-3
  cta: {
    label: string;
    href: string;
  } | null;
  data: Record<string, unknown>;  // dados brutos que geraram o insight — para debug e rastreio
}

type InsightType =
  | 'weak_area'
  | 'dominant_cause'
  | 'recurring_confusion'
  | 'overconfidence'
  | 'roi';
```

#### Cache

A edge function NÃO é chamada a cada load da aba Insights.

**Estratégia de cache:**

1. Antes de chamar a edge function, o cliente verifica `caderno_pattern_insights_cache` (nova tabela simples):
   ```
   caderno_pattern_insights_cache
     user_id       text  PK
     payload       jsonb
     generated_at  timestamptz
     entry_count   int  -- invalidar se error_notebook count mudou
   ```
2. **TTL:** 24 horas OU se `entry_count` do cache ≠ contagem atual de entradas no caderno (nova entrada adicionada ou domínio confirmado invalida o cache).
3. Se o cache for válido: renderiza direto, sem chamar a function.
4. Se expirado: chama a edge function em background, mostra dados do cache enquanto carrega, atualiza ao receber resposta.
5. O botão "Atualizar diagnóstico" (visível na aba Insights) força invalidação manual — dispara evento `caderno_insights_refreshed`.

**React Query:** `useQuery(['caderno-pattern-insights', userId], fetcher, { staleTime: 1000 * 60 * 60 * 24 })` — staleTime de 24 horas para honrar o TTL.

#### Persona Prof. Sanor (reuso)

A edge function reutiliza exatamente a mesma persona da `gemini-error-notebook-review`:

- **Mesmas regras:** sem travessão, sem elogio, sem saudação, sem burocratês.
- **Diferença de contexto:** Prof. Sanor agora olha para o PADRÃO, não para uma questão isolada. O prompt instrui: "Você está analisando o caderno de erros completo de {firstName}, não uma questão específica."
- **Mesmas funções de sanitização:** `stripEmDashes()` e `stripOpeningCompliments()` reutilizadas.
- **Modelo:** `gemini-2.5-flash`, `temperature: 0.55`, `thinkingBudget: 0`.
- **responseSchema:** objeto com array `insights` (cada item com os campos de `PatternInsight`).

```typescript
// Fragmento do prompt — seção QUEM VOCÊ É
`Você é o **Prof. Sanor**, mentor de ${firstName} para o ENAMED.
Agora você não está analisando uma questão — está lendo o caderno de erros completo
e fazendo um diagnóstico do padrão de estudo.

Tom: profissional, empático, direto. Fala como R3 que leu os dados e está dando
um feedback honesto num café, não como relatório de sistema.

🚫 REGRA ABSOLUTA: NÃO USE TRAVESSÃO (— ou –) EM HIPÓTESE NENHUMA.`
```

---

### A.4 UX da aba Insights e do painel de ROI

#### Hierarquia visual da aba Insights

```
/caderno → aba "Insights"
│
├── [Estado: sem dados suficientes — < 5 entradas]
│     IllustrationEmptyInsights
│     "Insights disponíveis a partir de 5 erros no caderno."
│     CTA: [Adicionar questões ao caderno]
│
├── [Estado: dados suficientes, cache válido OU carregando em background]
│     ┌─────────────────────────────────────────────────────────────┐
│     │  DIAGNÓSTICO DO SEU CADERNO              [Atualizar ↻]     │
│     │  Gerado em {data relativa}  ·  {N} entradas analisadas     │
│     └─────────────────────────────────────────────────────────────┘
│
│     ── Blocos de Insight (ordenados por severidade: critical > attention > positive > info) ──
│
│     [INSIGHT-1: Área fraca]  ← severidade: barra vermelha lateral
│     ┌────────────────────────────────────────────────────┐
│     │  🎯  Seu calcanhar é Nefrologia        [1/7]       │
│     │  "Você acertou 1 em 7 questões... [texto]"         │
│     │  [Ver questões de Nefrologia]                      │
│     └────────────────────────────────────────────────────┘
│
│     [INSIGHT-3: Confusão recorrente]  ← severidade: barra vermelha
│     ┌────────────────────────────────────────────────────┐
│     │  ⚠️  Confusão recorrente: IAM × Angina  [4×]      │
│     │  "Você confundiu IAM com Angina Instável..."       │
│     │  ▾ Ver tabela diferencial  (expansível inline)     │
│     │  [Revisar estas 4 questões]                        │
│     └────────────────────────────────────────────────────┘
│
│     [INSIGHT-2: Causa dominante]  ← severidade: barra amarela
│     ...
│
│     [INSIGHT-4: Overconfidence]  ← severidade: barra amarela
│     ...
│
│     ── Painel de ROI ──────────────────────────────────────
│
│     [INSIGHT-5: ROI do caderno]  ← severidade: barra verde
│     ┌────────────────────────────────────────────────────┐
│     │  📈  O caderno está funcionando        [+18pp]     │
│     │  "Em Cardiologia, seu acerto subiu de 41% para..." │
│     │  Gráfico sparkline: acerto por área antes × depois │
│     │  [Ver meu histórico de simulados]                  │
│     └────────────────────────────────────────────────────┘
```

#### Painel de ROI — detalhamento

O painel de ROI é a última seção da aba Insights e pode também aparecer como widget colapsável no Hero da aba Revisar quando o resultado for positivo (ROI ≥ +5 pp em pelo menos uma área).

**Elementos do painel:**

1. **Headline com métrica de destaque:** "+18 pp em Cardiologia desde que você dominou 6 questões."
2. **Tabela por área:** colunas — Área / Questões dominadas / Acerto antes / Acerto depois / Delta (colorido: verde se ≥ +5 pp, cinza se neutro, vermelho se negativo).
3. **Sparkline de evolução global:** score geral nos últimos N simulados, com marcação de quando cada entrada foi dominada. (Componente `<ScoreSparkline>` — pode reusar lógica de `comparativeInsights.ts`.)
4. **Nota metodológica colapsável:** "Como calculamos: comparamos seu acerto em cada área nos simulados antes e depois de cada domínio registrado no caderno."

**Estado sem dados suficientes:**

- Mostrar o painel de ROI com estado vazio informativo, nunca esconder a seção.
- Copy: "Dominar questões do caderno e completar novos simulados vai gerar dados aqui. Você está a {N} domínios e {M} simulados de ver seu ROI."

#### CTAs que viram ação — mapeamento completo

| Insight | CTA label | Destino | Ação no app |
|---------|-----------|---------|-------------|
| INSIGHT-1 | "Ver questões de {área}" | `/caderno?area={área}` | Filtro pré-aplicado |
| INSIGHT-2 (lacuna) | "Ver aulas de {área}" | `/cursos?area={área}` | Deep-link para catálogo |
| INSIGHT-2 (memória) | "Criar flashcards desta área" | `/caderno?aba=flashcards&area={área}` | Aba Flashcards pré-filtrada |
| INSIGHT-2 (desatenção) | "Iniciar sessão — técnica" | `/caderno/revisao?reason=reading_error` | Sessão filtrada por causa |
| INSIGHT-2 (diferencial) | "Revisar diferenciais desta área" | `/caderno?reason=confused_alternatives&area={área}` | Filtro combinado |
| INSIGHT-3 | "Revisar estas {N} questões" | `/caderno/revisao?ids=[...]` | Sessão com fila específica |
| INSIGHT-4 | "Revisar questões de alta certeza" | `/caderno?high_confidence=true&resolved=false` | Filtro overconfidence |
| INSIGHT-5 | "Ver histórico de simulados" | `/desempenho` | Página de desempenho |

#### Estados da aba Insights

| Estado | Condição | O que mostrar |
|--------|----------|---------------|
| Insuficiente | total_entries < 5 | Ilustração + copy de estímulo + CTA para adicionar |
| Carregando (primeira vez) | Sem cache | Skeleton com 3 cards de insight |
| Carregando (background) | Cache expirado, chamada em andamento | Mostra cache antigo + spinner discreto no header "Atualizando..." |
| Pronto | Cache válido | Blocos de insight + painel ROI |
| Erro | Edge function falhou | "Diagnóstico temporariamente indisponível. Os dados do caderno estão íntegros." + botão Tentar novamente |
| ROI sem dados | total_mastered < 3 OU sem simulados pós-domínio | Painel ROI com estado vazio informativo |

---

## PARTE B — Telemetria

### B.1 Funil de eventos ponta a ponta

```
[Simulado finalizado]
       │
       ▼ caderno_triage_viewed          ← tela "Transforme seus erros"
       │
       ▼ caderno_triage_item_toggled    ← confirmar/rejeitar questão individual
       │
       ▼ caderno_triage_batch_added     ← "Adicionar N questões" confirmado
       │
       ▼ error_added_to_notebook        ← existente; agora também dispara no lote
       │
[Caderno aberto]
       │
       ▼ caderno_erros_viewed           ← existente
       │
       ▼ caderno_erros_filtered         ← existente
       │
       ▼ caderno_revisao_cta_clicked    ← existente
       │
       ▼ caderno_revisao_started        ← existente
       │
[Sessão de revisão — por questão]
       │
       ▼ caderno_recall_answer_selected ← marcar alternativa no recall ativo
       │
       ▼ caderno_recall_confidence_set  ← slider de confiança (baixa/media/alta)
       │
       ▼ caderno_recall_revealed        ← botão "Revelar" pressionado
       │
       ▼ caderno_recall_self_graded     ← autoavaliação (errei/difícil/bom/fácil)
       │
       ▼ caderno_revisao_ai_generated   ← existente; dispara quando Prof. San carrega
       │
       ▼ caderno_revisao_marked_resolved ← existente; agora = mastered (após SRS)
       │
       ▼ caderno_entry_snoozed          ← substituição do caderno_revisao_snoozed (mais específico)
       │
[Fim de sessão]
       │
       ▼ caderno_revisao_session_ended  ← tela de resumo exibida
       │
[Aba Insights]
       │
       ▼ caderno_insights_viewed        ← aba Insights aberta
       │
       ▼ caderno_insight_expanded       ← bloco de insight expandido/lido
       │
       ▼ caderno_insight_cta_clicked    ← CTA de um insight acionado
       │
       ▼ caderno_insights_refreshed     ← botão "Atualizar diagnóstico" clicado
       │
[Painel de ROI]
       │
       ▼ caderno_roi_viewed             ← painel de ROI visível (scroll até seção)
       │
       ▼ caderno_roi_area_expanded      ← usuário expande tabela por área
```

---

### B.2 Tabela de eventos

> Convenção de nomenclatura seguida: `snake_case`, domínio como prefixo (`caderno_`), substantivo + verbo no passado. Segue exatamente o padrão de `AnalyticsEventName` em `src/lib/analytics.ts`.

> **Mapeamento de eventos `srs_*` (spec 02 → canônico):** os eventos propostos na spec 02 com prefixo `srs_` foram absorvidos no namespace `caderno_*` conforme tabela de mapeamento em `00-contratos-canonicos.md` (seção 5). Os nomes canônicos são: `caderno_recall_self_graded` (era `srs_review_completed`), `caderno_entry_mastered` com `{ via_srs: true }` (era `srs_entry_mastered`), `caderno_entry_leech_triggered` (era `srs_leech_triggered`) e `caderno_lesson_accessed` (era `lesson_accessed`). Não usar os nomes `srs_*` em nenhum ponto do código ou de outras specs.

#### Eventos existentes (manter e complementar)

| Nome | Quando dispara | Propriedades existentes | Propriedades a adicionar |
|------|---------------|------------------------|--------------------------|
| `caderno_erros_viewed` | Página `/caderno` montada | `user_segment` | `entry_count`, `pending_count`, `tab` (aba inicial) |
| `caderno_erros_filtered` | Filtro aplicado | `filter_type`, `filter_value` | `result_count` |
| `caderno_revisao_cta_clicked` | CTA "Modo Revisão" clicado | — | `entry_count`, `due_count` |
| `caderno_revisao_started` | Sessão iniciada (1ª questão) | — | `session_entry_count`, `has_srs_entries` |
| `caderno_revisao_ai_generated` | Prof. San carregado | — | `entry_id`, `from_cache` (bool) |
| `caderno_revisao_marked_resolved` | Entrada marcada como dominada | — | `via_srs` (bool), `srs_interval_days`, `entry_age_days` |
| `caderno_revisao_snoozed` | **Deprecar em favor de** `caderno_entry_snoozed` | — | — |
| `caderno_revisao_chat_opened` | Chat com Prof. San aberto | — | `entry_id` |
| `caderno_revisao_chat_message_sent` | Mensagem enviada no chat | — | `chat_count` |
| `caderno_revisao_train_more_clicked` | CTA "Treinar mais" no resumo | — | — |
| `error_added_to_notebook` | Entrada criada (individual ou lote) | `reason`, `area` | `via_triage` (bool), `was_batch` (bool), `batch_size` |

#### Eventos novos

| Nome | Quando dispara | Propriedades | Componente |
|------|---------------|--------------|------------|
| `caderno_triage_viewed` | Tela de triagem pós-prova aberta | `attempt_id`, `candidate_count` (erros + baixa confiança), `simulado_id` | `CadernoTriagePage` |
| `caderno_triage_item_toggled` | Aluno confirma ou rejeita um item da triagem | `question_id`, `action` (`accepted`\|`rejected`), `reason` (causa sugerida pela IA), `reason_changed` (bool) | `TriageItemCard` |
| `caderno_triage_batch_added` | Confirmar lote na triagem | `added_count`, `rejected_count`, `attempt_id` | `CadernoTriagePage` |
| `caderno_recall_answer_selected` | Aluno marca uma alternativa no recall ativo | `entry_id`, `was_correct` (bool), `option_label` | `RecallQuestionCard` |
| `caderno_recall_confidence_set` | Aluno define confiança após marcar | `entry_id`, `confidence` (`baixa`\|`media`\|`alta`) | `RecallConfidenceSlider` |
| `caderno_recall_revealed` | Botão "Revelar" pressionado | `entry_id`, `was_correct` (bool) | `RecallRevealButton` |
| `caderno_recall_self_graded` | Autoavaliação do esforço preenchida | `entry_id`, `grade` (`errei`\|`dificil`\|`bom`\|`facil`), `was_correct` (bool), `srs_next_interval_days` | `RecallSelfGrade` |
| `caderno_entry_snoozed` | Entrada adiada manualmente (override do SRS) | `entry_id`, `days_snoozed`, `reason` (`manual_override`) | `CadernoEntryActions` |
| `caderno_revisao_session_ended` | Tela de resumo da sessão exibida | `session_duration_seconds`, `entries_reviewed`, `entries_mastered`, `entries_snoozed`, `top_area` | `CadernoResumoPage` |
| `caderno_insights_viewed` | Aba Insights aberta | `from_cache` (bool), `cache_age_hours`, `insight_count`, `has_sufficient_data` (bool) | `CadernoInsightsTab` |
| `caderno_insight_expanded` | Bloco de insight expandido | `insight_id`, `insight_type`, `severity` | `InsightCard` |
| `caderno_insight_cta_clicked` | CTA de um insight clicado | `insight_id`, `insight_type`, `cta_label`, `cta_href` | `InsightCard` |
| `caderno_insights_refreshed` | Botão "Atualizar diagnóstico" clicado | `previous_cache_age_hours`, `entry_count` | `CadernoInsightsTab` |
| `caderno_roi_viewed` | Painel de ROI ficou visível (IntersectionObserver) | `areas_with_roi`, `best_delta_pp`, `has_positive_roi` (bool) | `CadernoRoiPanel` |
| `caderno_roi_area_expanded` | Linha de área expandida no painel ROI | `area`, `mastered_count`, `delta_pp` | `CadernoRoiPanel` |

#### Adições ao tipo `AnalyticsEventName` em `src/lib/analytics.ts`

```typescript
// Bloco a acrescentar no union type, sob o grupo "Error notebook"
| "caderno_triage_viewed"
| "caderno_triage_item_toggled"
| "caderno_triage_batch_added"
| "caderno_recall_answer_selected"
| "caderno_recall_confidence_set"
| "caderno_recall_revealed"
| "caderno_recall_self_graded"
| "caderno_entry_snoozed"
| "caderno_revisao_session_ended"
| "caderno_insights_viewed"
| "caderno_insight_expanded"
| "caderno_insight_cta_clicked"
| "caderno_insights_refreshed"
| "caderno_roi_viewed"
| "caderno_roi_area_expanded"
```

**Todos os eventos de caderno devem incluir como super-properties** (via `setSuperProperties` ao montar a página):
- `user_segment`: `'pro'` (esta feature é exclusiva PRO — mas registrar para auditoria)
- `caderno_total_entries`: contagem atual de entradas (sem filtros, sem excluídas)

---

### B.3 Métricas de sucesso da feature

As métricas abaixo são deriváveis dos eventos acima e devem alimentar o PRD de priorização e as revisões de produto pós-lançamento.

#### M1 — Ativação (semana 1)

> "O aluno que ganhou acesso PRO usa o caderno na primeira semana?"

- **Fórmula:** `% de usuários PRO que disparam caderno_erros_viewed nos primeiros 7 dias de acesso PRO`
- **Meta sugerida:** ≥ 50 % de ativação
- **Proxy de adição:** `% que disparam error_added_to_notebook nos primeiros 7 dias`

#### M2 — Retenção de revisão (semanal)

> "Quem usa o caderno volta a usar na semana seguinte?"

- **Fórmula:** `% de usuários com caderno_revisao_started na semana N que também disparam na semana N+1`
- **Meta sugerida:** ≥ 40 % semana-sobre-semana
- **Profundidade:** `sessões por usuário ativo por semana` (ideal: ≥ 2)

#### M3 — Taxa de recall completo (engajamento pedagógico)

> "Quem inicia o recall ativo completa o ciclo (revelar + autoavaliar)?"

- **Fórmula:** `% de caderno_recall_answer_selected que chegam a caderno_recall_self_graded na mesma sessão`
- **Meta sugerida:** ≥ 70 % de completude do ciclo
- **Degradação:** se cair abaixo de 50 %, revisar o UX da autoavaliação (friction alto)

#### M4 — Taxa de domínio

> "As entradas no caderno chegam a ser dominadas?"

- **Fórmula:** `% de entradas com caderno_revisao_marked_resolved (via_srs=true) ÷ total de entradas com ≥ 30 dias no caderno`
- **Meta sugerida:** ≥ 30 % de domínio após 30 dias
- **Segmentação:** por causa do erro (lacuna leva mais tempo; desatenção deve dominar mais rápido)

#### M5 — Engajamento com Insights

> "O diagnóstico entre erros é consumido?"

- **Fórmula:** `% de usuários com caderno_insights_viewed que disparam caderno_insight_expanded`
- **Meta sugerida:** ≥ 60 % (pelo menos 1 insight expandido)
- **Conversão para ação:** `% de caderno_insight_expanded que chegam a caderno_insight_cta_clicked`

#### M6 — ROI medido (impacto real)

> "Usuários que dominam questões do caderno melhoram nos simulados?"

- **Fórmula (produto):** delta médio de score por área entre simulados pré e pós domínio, computado via `caderno_roi_viewed.best_delta_pp` + `user_performance_history`
- **Fórmula (funil):** `% de caderno_roi_viewed com has_positive_roi=true`
- **Meta sugerida:** ≥ 60 % dos usuários com dados de ROI apresentam delta positivo (≥ +3 pp)
- **Norte estratégico:** este número é o argumento de renovação PRO. Se ROI > +10 pp em qualquer área para ≥ 40 % dos usuários com dados, é um case de marketing.

#### M7 — Triagem pós-prova (redução de atrito)

> "A triagem automática vira adições no caderno?"

- **Fórmula:** `% de caderno_triage_viewed que chegam a caderno_triage_batch_added`
- **Meta sugerida:** ≥ 65 % de conversão triagem → adição
- **Taxa de rejeição de itens:** `caderno_triage_item_toggled com action=rejected ÷ total de itens` — se > 50 %, a IA está sugerindo mal

#### Dashboard sugerido (Metabase / analytics)

| Métrica | Granularidade | Segmento |
|---------|--------------|---------|
| Funil triagem → adição → sessão | Cohort semanal | PRO |
| Recall: completude do ciclo | Diário | PRO |
| Taxa de domínio por causa de erro | Mensal | PRO |
| Engajamento Insights (viewed → expanded → CTA) | Semanal | PRO |
| ROI médio por área (delta pp) | Por usuário, por área | PRO com ≥ 2 simulados pós-domínio |
| NPS implícito: recadência de sessão | Semanal | PRO |

---

## Premissas técnicas e dependências

1. **`mastered_at` em `error_notebook`** é campo crítico para ROI. Deve ser adicionado na Fase 0 junto com os demais campos SRS.
2. **`caderno_pattern_insights_cache`** (nova tabela) deve ter RLS: usuário lê e escreve apenas a própria linha. Sem acesso anônimo.
3. **`answers.high_confidence`** (boolean, já existe) é a fonte de overconfidence para entradas anteriores à Fase 0. O campo `error_notebook.confidence_at_answer` (texto, novo na Fase 0) complementa com granularidade por entrada.
4. **ROI por área** requer join entre `attempt_question_results`, `questions.area` e `user_performance_history`. Não existe RPC pronta para isso — criar `get_area_score_history(p_user_id)` na Fase 2.
5. **Recall ativo** (`caderno_recall_*`) grava em `review_attempts` (nova tabela, Fase 0). Os eventos de telemetria devem incluir o `entry_id` que é FK para `error_notebook`.
6. **`caderno_revisao_snoozed` está deprecado** nesta spec em favor de `caderno_entry_snoozed` (mais granular). Manter compatibilidade reversa no handler de analytics até migração completa.
7. **Edge function `caderno-pattern-insights`** deve ter timeout estendido (30 s) por conta do volume de dados agregados + geração de texto. Usar `Deno.env.get('GEMINI_API_KEY')` igual à função existente.
8. **Score por área em `user_performance_history`** não existe hoje (apenas score global). O cálculo de ROI por área faz join direto em `attempt_question_results` — aceitar que é uma query mais custosa e proteger com cache obrigatório.

---

## Apêndice — Diagrama de fluxo de dados (Insights)

```
Cliente (CadernoInsightsTab)
  │
  ├─ 1. React Query: usePatternInsights(userId)
  │       │
  │       ├─ HIT: renderiza cache (<24h, entry_count igual)
  │       │
  │       └─ MISS: chama /caderno-pattern-insights (edge fn)
  │                  │
  │                  ├─ a. RPC get_caderno_pattern_data(user_id) → JSON agregado
  │                  ├─ b. Gemini 2.5-flash → array de PatternInsight
  │                  ├─ c. Sanitiza (stripEmDashes, stripOpeningCompliments)
  │                  └─ d. Salva em caderno_pattern_insights_cache
  │
  └─ 2. Renderiza InsightCard[] + CadernoRoiPanel
           │
           └─ CTA clicado → trackEvent('caderno_insight_cta_clicked', ...)
                           → navegação (React Router)
```
