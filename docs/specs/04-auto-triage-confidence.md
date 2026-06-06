> Contratos de nomes/enums/eventos/limiares seguem [00-contratos-canonicos.md](00-contratos-canonicos.md) (fonte da verdade).

# Spec 04 — Triagem Automática Pós-Prova e Captura de Confiança

**Produto:** SanarFlix PRO Simulados (ENAMED)
**Pacote:** Caderno de Erros — Fundação (Fase 1)
**Status:** Rascunho para revisão
**Data:** Junho/2026
**Autora:** Gerado a partir da visão definitiva (`docs/caderno-de-erros-visao-definitiva.md`, seções 4.5-C e 5.1 I4)
**Dependência upstream:** Spec 01 (coluna `answers.confidence`)

---

## TL;DR

Esta spec cobre dois mecanismos co-dependentes:

1. **Captura de confiança na prova** — um seletor de 3 níveis (baixa / média / alta) que aparece imediatamente após o aluno marcar uma alternativa, persiste em `answers.confidence` via o mesmo caminho de upsert já existente, e é opcional.
2. **Triagem automática pós-prova** — tela "Transforme seus erros em plano de estudo" que surge logo após o `finalize`, lista as questões candidatas ao caderno (erros + acertos de baixa confiança), exibe uma pré-classificação gerada por uma nova edge function `classify-exam-errors`, e permite ao aluno confirmar/ajustar tudo em lote com 1 toque por questão antes de adicionar ao `error_notebook` via nova RPC `add_to_notebook_bulk_guarded`.

Juntos, estes dois mecanismos eliminam o principal atrito do caderno (G3 da análise comparativa) sem degradar a experiência de prova.

---

## 1. Captura de Confiança na Prova

### 1.1 Onde e quando aparece

O seletor de confiança aparece **imediatamente após o aluno selecionar uma alternativa**, na mesma área inferior do card da questão, como uma expansão animada não bloqueante. Não interrompe a navegação: o aluno pode ir para a próxima questão sem interagir com o seletor. O botão "Próxima" continua disponível e focável com a tecla `→`.

**Posicionamento visual:**
```
[ Enunciado + alternativas ]
──────────────────────────────────────────
Você marcou: (B)  ✓ marcada

Quão certo você está?
  [ Baixa ]  [ Média ]  [ Alta ]   ← seletor inline, 3 chips
──────────────────────────────────────────
```

O seletor NÃO aparece em questões em branco (nenhuma alternativa selecionada). Se o aluno trocar de alternativa, o seletor permanece visível e mantém a seleção anterior de confiança — trocas de alternativa não resetam a confiança (reduz fricção de edição).

### 1.2 É obrigatória?

**Não.** A confiança é **opcional**. `answers.confidence` aceita `null`. Questões sem confiança registrada recebem tratamento de fallback na triagem (seção 5). A omissão não penaliza o aluno nem bloqueia o envio.

Recomendação de microcopy para o placeholder quando o aluno ainda não selecionou nada: sem renderização do seletor. Assim que selecionar, o seletor aparece com todos os três chips no estado neutro (nenhum selecionado).

### 1.3 Microcopy

| Elemento | Texto |
|---|---|
| Rótulo do seletor | "Quão certo você está?" |
| Chip baixa | "Chute" |
| Chip média | "Parcial" |
| Chip alta | "Tenho certeza" |
| Tooltip (hover/acessibilidade) | "Sua certeza ajuda a personalizar o caderno de erros" |
| Atalho de teclado | `1` = Baixa, `2` = Média, `3` = Alta (mapeados no `useKeyboardShortcuts`, coexistem com o mapeamento atual de alternativas apenas enquanto a seleção está feita — sem ambiguidade pois `1-5` mapeia alternativas e `1-3` só está ativo após seleção) |

> **Nota de UX:** o atalho de teclado `1/2/3` para confiança é ativado somente depois de o aluno ter marcado uma alternativa (estado `selectedOption !== null`). O mapeamento de alternativas usa `1-5` e é sempre ativo. Para evitar colisão, o seletor de confiança usa os mesmos números mas registra seu handler com prioridade mais baixa: se o aluno ainda não marcou nada, `1-5` continuam mapeados às alternativas. A separação é naturalmente sequencial — primeiro marca, depois confirma confiança.

### 1.4 Como é persistida: integração com o save existente

A confiança é adicionada à interface `ExamAnswer` (em `src/types/exam.ts`) como campo opcional:

```typescript
// src/types/exam.ts
export interface ExamAnswer {
  questionId: string;
  selectedOption: string | null;
  markedForReview: boolean;
  highConfidence: boolean;        // campo legacy — mantido para compatibilidade
  eliminatedAlternatives: string[];
  confidence: 'baixa' | 'media' | 'alta' | null;  // NOVO — spec 04
}
```

A captura ocorre em `useExamFlow.handleSetConfidence(level)`, análogo a `toggleHighConfidence`, chamando `storage.markAnswerDirty(currentQuestion.id)` e `updateState()`. O estado local é atualizado imediatamente (UI optimista).

A persistência segue o mesmo caminho já existente:
1. `updateState()` → `storage.saveStateDebounced(updated)` → debounce de 2 s → `simuladosApi.bulkUpsertAnswers()`.
2. O upsert em `answers` já usa `on_conflict=attempt_id,question_id` com `resolution=merge-duplicates`. Basta incluir `confidence` na linha do upsert.
3. No `beforeunload`, o `fetch keepalive` também inclui `confidence` no payload (ver `useExamFlow.ts` linhas 437-462 — adicionar o campo ao objeto `rows`).

**Mudanças em `simuladosApi.bulkUpsertAnswers`:**
```typescript
// src/services/simuladosApi.ts — dentro de bulkUpsertAnswers
const rows = Object.entries(answers).map(([questionId, ans]) => ({
  attempt_id: attemptId,
  question_id: questionId,
  selected_option_id: ans.selectedOption,
  marked_for_review: ans.markedForReview,
  high_confidence: ans.highConfidence,
  eliminated_options: ans.eliminatedAlternatives || [],
  confidence: ans.confidence ?? null,          // NOVO
  answered_at: ans.selectedOption ? new Date().toISOString() : null,
}));
```

A mesma adição se aplica a `upsertAnswer` (single answer) e ao `fetch keepalive` no `handleBeforeUnload` de `useExamFlow`.

**Migração de banco:** `ALTER TABLE answers ADD COLUMN confidence text CHECK (confidence IN ('baixa', 'media', 'alta')) DEFAULT NULL;` — definida na spec 01 e referenciada aqui. Esta spec não cria a migração; apenas documenta o contrato.

### 1.5 Impacto em performance e UX

- **Payload:** um campo `text nullable` por row. Sem impacto mensurável em latência ou tamanho de payload considerando o debounce de 2 s já existente.
- **Re-renderização:** `updateState` via `setState` causa re-render do card atual. O seletor é um componente leve (3 chips) — sem custo perceptível.
- **Timer:** nenhum impacto. O `useExamTimer` não é afetado. O seletor é totalmente assíncrono ao timer.
- **sendBeacon / keepalive:** o payload do fallback já serializa todo o `answers` map; adicionar um campo string não altera a lógica de envio.

### 1.6 Simulados antigos (sem confiança)

Entradas criadas antes desta release terão `answers.confidence = null`. O comportamento:
- Na triagem pós-prova de simulados antigos (re-abertura de correção): confiança `null` é tratada como "desconhecida" pelo classificador de IA, que faz inferência só pelo resultado certo/errado.
- Na heurística de fallback (seção 5): `null` é tratado como "não expressou incerteza", ou seja, a ausência não implica baixa confiança — acertos sem confiança registrada **não** entram automaticamente como `guessed_correctly`.
- No dashboard de calibração (I4, Fase 2): os dados históricos sem confiança ficam fora do cálculo de calibração, mas não impedem o funcionamento do painel para dados novos.

**Backfill de `answers.confidence`:** entradas existentes com `high_confidence = true` recebem `confidence = 'alta'`; entradas com `high_confidence = false` ou `NULL` recebem `confidence = NULL` (desconhecida — não inferir `'baixa'` retroativamente).

---

## 2. Tela de Triagem Pós-Prova

### 2.1 Quando aparece

A tela de triagem aparece **imediatamente após o `finalize` bem-sucedido**, substituindo o redirect padrão para a `ResultadoPage`. Mais precisamente:

- Em `useExamFlow.finalize()`, após o `storage.submitAttempt(state)` retornar com sucesso, em vez de navegar para `/simulados/:id/resultado`, o hook navega para `/simulados/:id/triagem`.
- A rota `/simulados/:id/triagem` só é acessível para usuários PRO (`useHasAccess('cadernoErros')`). Para usuários não-PRO, redireciona direto para `/simulados/:id/resultado` (comportamento atual preservado).
- O aluno pode pular a triagem a qualquer momento (botão "Agora não") e ir direto para o resultado. As questões candidatas são guardadas na sessão e podem ser acessadas novamente via link "Adicionar ao caderno" na `CorrecaoPage`.

### 2.2 O que lista: candidatos ao caderno

Um item é candidato se **pelo menos uma** das condições for verdadeira:
1. `attempt_question_results.is_correct = false AND was_answered = true` (errou)
2. `attempt_question_results.is_correct = true AND answers.confidence = 'baixa'` (acertou no chute declarado)
3. `answers.confidence = 'baixa' AND answers.selected_option_id IS NOT NULL` (marcou com baixa confiança, independente do resultado — cobre também os não-corrigidos)

Questões em branco (`was_answered = false`) **não** são candidatas por padrão (sem resposta ativa = sem comportamento para classificar).

**Ordenação:** por `question_number` ascendente (mesma ordem da prova).

### 2.3 Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Transforme seus erros em plano de estudo                   │
│  "X questões para revisar, pré-classificadas pela IA"       │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Q12 · Cardiologia › Insuficiência Cardíaca      [✗]   │  │
│  │ Motivo sugerido: [Lacuna ▾]           [Pular]         │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Q17 · Pneumologia › Pneumonia Adquirida      [✓ chute]│  │
│  │ Motivo sugerido: [Chute ▾]            [Pular]         │  │
│  └───────────────────────────────────────────────────────┘  │
│  ... (demais itens)                                         │
│                                                             │
│  [Adicionar todas as selecionadas]   [Agora não]            │
└─────────────────────────────────────────────────────────────┘
```

Cada card exibe:
- Número e área/tema da questão
- Badge de resultado (errou / chute / marcada para revisão)
- Badge de motivo sugerido pela IA (clicável para alterar — dropdown ou seletor inline)
- Racional curto da classificação da IA (1 frase, expansível)
- Botão "Pular" para excluir da seleção (não adiciona ao caderno)
- Checkbox implícito: por padrão todos os itens estão selecionados

**Cabeçalho do card quando a IA já classificou:**
> `Lacuna · "Provavelmente não conhecia o critério diagnóstico de IAM sem supra."` (racional)

**Cabeçalho quando a IA ainda está classificando (skeleton):**
> Shimmer placeholder no lugar do badge de motivo + racional.

### 2.4 Estados

| Estado | O que renderiza |
|---|---|
| **Carregando candidatos** | Skeleton de 3 cards enquanto `attempt_question_results` carrega |
| **Classificação IA em andamento** | Cards com conteúdo de questão visível, badge de motivo em skeleton, botão "Adicionar todas" desabilitado com spinner |
| **Classificação IA completa** | Cards totalmente preenchidos, botão "Adicionar todas" habilitado |
| **IA indisponível / timeout** | Cards exibem motivo heurístico (seção 5) com label "Sugestão automática" em vez de "Sugerido pela IA". Funcionalidade não degradada |
| **Vazio — gabaritou** | `ZeroPendingState` adaptada: "Parabéns, nenhum erro para revisar! Continue assim." + CTA "Ver resultado" |
| **Vazio — sem candidatos (acertou tudo com alta confiança)** | Mesma tela vazia |
| **Todas as questões puladas** | Feedback inline: "Nenhuma questão selecionada" + CTA "Adicionar mesmo assim" desabilitado |
| **Adicionado com sucesso** | Toast: "X questões adicionadas ao caderno" + navigate para resultado |
| **Erro no bulk add** | Toast destrutivo com retry inline |

### 2.5 Interação "Adicionar todas"

Ao clicar em "Adicionar todas as selecionadas":
1. Chama a RPC `add_to_notebook_bulk_guarded` (seção 6) com os itens selecionados.
2. Exibe loading no botão.
3. On success: toast de confirmação + navigate para `/simulados/:id/resultado`.
4. On error: toast destrutivo com "Tentar novamente" (não navega).

O botão "Agora não" navega diretamente para o resultado sem nenhuma chamada ao banco.

---

## 3. Fluxo de Confirmação em Lote

### 3.1 Pré-classificação e confirmação

Cada item da lista chega pré-classificado com um `suggestedReason` do enum `DbReason`. O aluno vê o motivo sugerido em um chip colorido (herdando as cores de `DB_REASON_META` de `src/lib/errorNotebookReasons.ts`).

Para ajustar o motivo, o aluno toca/clica no chip, que abre um seletor inline (não um modal) com os 5 motivos disponíveis + ícones. A alteração é imediata e local (não persiste até o "Adicionar todas").

**Affordances:**
- Chip de motivo: borda sólida da cor do motivo, fundo suave, label curta (ex: "Lacuna", "Chute")
- Ícone de dropdown (chevron) ao lado do label do chip indica clicabilidade
- Após seleção manual, o chip exibe uma bolinha discreta "Editado por você" para distinguir da sugestão original da IA
- "Pular" é um link textual sem destaque visual, para não competir com "Adicionar todas"

### 3.2 Como evita duplicatas

Antes de exibir a tela de triagem, o frontend carrega as entradas existentes do caderno para o simulado via `simuladosApi.getErrorNotebook(userId)` filtrado por `simulado_id`. Questões já presentes no caderno são identificadas e exibidas com badge "Já no caderno" no lugar do seletor de motivo. Elas podem ser atualizadas (trocar o motivo) ou puladas.

A RPC `add_to_notebook_bulk_guarded` é idempotente (seção 6) e retorna quantas foram adicionadas vs. puladas por duplicata. O frontend usa esse retorno para o toast ("3 adicionadas, 1 já existia").

### 3.3 Microcopy dos CTAs

| CTA | Texto |
|---|---|
| Botão primário (com N selecionadas) | "Adicionar X ao caderno" |
| Botão primário (todas selecionadas) | "Adicionar todas (X) ao caderno" |
| Link secundário | "Agora não — ver resultado" |
| Chip de motivo com sugestão IA | "[motivo] · IA" |
| Chip de motivo editado pelo aluno | "[motivo] · você" |
| Badge de questão já no caderno | "Já no caderno · [motivo atual]" |
| Botão de pular item | "Pular" |
| Racional da IA (expansível) | Exibido como texto em italico sob o chip, cortado em 1 linha, "ver mais" para expandir |

---

## 4. Edge Function `classify-exam-errors`

### 4.1 Visão geral

Nova Deno edge function em `supabase/functions/classify-exam-errors/index.ts`. Classifica em lote os erros de uma tentativa em motivos do enum `DbReason`. Reutiliza a persona Prof. Sanor, a sanitização `stripEmDashes` e `stripOpeningCompliments` de `gemini-error-notebook-review/index.ts`.

**Endpoint:** `POST /functions/v1/classify-exam-errors`
**Auth:** Bearer JWT do usuário (validado pelo Supabase Auth automaticamente)
**Chamada feita por:** `TriagemPage` no cliente, logo após o load dos `attempt_question_results`.

### 4.2 Contrato de entrada

```typescript
interface ClassifyExamErrorsRequest {
  attemptId: string;
  questions: ClassifyQuestionInput[];
}

interface ClassifyQuestionInput {
  questionId: string;
  questionNumber: number;
  questionStem: string;            // texto do enunciado (truncado em 600 chars no cliente)
  options: {
    label: string;
    text: string;
  }[];
  correctOptionLabel: string;      // label da alternativa correta (ex: "C")
  userOptionLabel: string | null;  // label marcada pelo aluno — null se em branco
  isCorrect: boolean;
  confidence: 'baixa' | 'media' | 'alta' | null;
  area: string;
  theme: string;
  explanation: string | null;      // comentário oficial, truncado em 400 chars
}
```

**Limite de batch:** até 15 questões por chamada. Se o simulado tiver mais candidatos, o cliente faz chamadas sequenciais de 15 (não paralelas — evita sobrecarga de cota Gemini). A ordenação por `question_number` é preservada.

### 4.3 Contrato de saída

```typescript
interface ClassifyExamErrorsResponse {
  classifications: QuestionClassification[];
  partial: boolean;  // true se alguma questão não pôde ser classificada
}

interface QuestionClassification {
  questionId: string;
  suggestedReason: DbReason;
  rationale: string;               // 1 frase, max 20 palavras, sem travessão
  aiCertainty: 'alta' | 'baixa';   // certeza da classificação automática (≠ answers.confidence, que é a confiança declarada pelo aluno)
}
```

`DbReason` é o enum já definido em `src/lib/errorNotebookReasons.ts`:
`'did_not_know' | 'did_not_remember' | 'reading_error' | 'confused_alternatives' | 'guessed_correctly'`

O legado `did_not_understand` **não é retornado pela IA** — apenas mantido no frontend para leitura de entradas antigas.

### 4.4 Estratégia de prompt

O prompt reutiliza a estrutura de `gemini-error-notebook-review`:

**Persona:** "Você é o Prof. Sanor, especialista em ensino médico para residência. Analise cada questão e classifique o motivo mais provável do erro do aluno."

**Regras herdadas:**
- `stripEmDashes` aplicado em todo output
- Proibição de elogios, saudações, burocratês (mesmo sistema de guards)
- Ancoragem nos dados clínicos do caso quando disponíveis

**Instrução central:**
```
Para cada questão, retorne:
- suggestedReason: um dos valores exatos do enum [did_not_know, did_not_remember,
  reading_error, confused_alternatives, guessed_correctly]
- rationale: uma frase objetiva explicando por que você classificou assim
- aiCertainty: "alta" se a classificação for clara, "baixa" se ambígua

Critérios de classificação:
- did_not_know: aluno errou e não há sinal de que o conteúdo foi visto antes
  (resposta muito distante do gabarito, área especializada)
- did_not_remember: errou alternativa plausível mas incorreta no mesmo tema
  (confusão de detalhe, não de conceito central)
- reading_error: errou questão simples onde a alternativa correta e a errada
  diferem por uma palavra-chave óbvia no enunciado ("EXCETO", "mais comum",
  doses específicas)
- confused_alternatives: errou entre duas alternativas do mesmo espectro
  diagnóstico ou terapêutico (ex: dois betabloqueadores, dois diuréticos,
  dois diagnósticos sindrômicos)
- guessed_correctly: acertou com confiança declarada "baixa", ou acertou questão
  objetiva difícil sem padrão de conhecimento aparente
```

**Schema de resposta (Gemini structured output):**
```json
{
  "type": "OBJECT",
  "properties": {
    "classifications": {
      "type": "ARRAY",
      "items": {
        "type": "OBJECT",
        "properties": {
          "questionId": { "type": "STRING" },
          "suggestedReason": { "type": "STRING" },
          "rationale": { "type": "STRING" },
          "aiCertainty": { "type": "STRING" }
        },
        "required": ["questionId", "suggestedReason", "rationale", "aiCertainty"]
      }
    }
  },
  "required": ["classifications"]
}
```

**Parâmetros Gemini:** `temperature: 0.3` (mais determinístico que a análise), `maxOutputTokens: 800`, `thinkingBudget: 0`, `responseMimeType: 'application/json'`.

### 4.5 Tratamento de erro e timeout

- **Timeout do fetch Gemini:** 25 s (Deno `AbortController`). Se expirar, a função retorna `{ classifications: [], partial: true }`.
- **Parse error:** se o JSON do Gemini não fizer parse, a função tenta extrair por regex e retorna o que conseguir com `partial: true`.
- **Rate limit (429):** retorna HTTP 429 para o cliente, que exibe a heurística de fallback.
- **Erro genérico:** retorna HTTP 502 com `{ error: "...", partial: true }`. O cliente trata como fallback sem nenhuma mensagem de erro visível ao aluno (a heurística substitui silenciosamente).
- **Questão não classificada:** se uma questão estiver ausente da resposta, o cliente preenche com a heurística de fallback (seção 5) e marca `aiCertainty: 'baixa'`.

---

## 5. Heurística de Fallback (sem IA)

Quando a edge function estiver indisponível, em timeout ou retornar `partial: true`, o cliente aplica regras determinísticas para sugerir o motivo. As regras são executadas em ordem de prioridade — a primeira que casar vence.

```typescript
function heuristicReason(input: ClassifyQuestionInput): DbReason {
  const { isCorrect, confidence, userOptionLabel, correctOptionLabel, options } = input;

  // R1: acertou mas com baixa confiança explícita → tratado como chute
  if (isCorrect && confidence === 'baixa') return 'guessed_correctly';

  // R2: errou e tinha alta confiança → provavelmente confusão de diferencial
  //     (achava que sabia, mas a alternativa escolhida era plausível)
  if (!isCorrect && confidence === 'alta') return 'confused_alternatives';

  // R3: alternativa do aluno e alternativa correta são adjacentes na lista
  //     (ex: B e C, D e E) → trocou alternativas próximas → confused_alternatives
  if (!isCorrect && userOptionLabel && correctOptionLabel) {
    const labels = options.map(o => o.label).sort();
    const userIdx = labels.indexOf(userOptionLabel);
    const correctIdx = labels.indexOf(correctOptionLabel);
    if (Math.abs(userIdx - correctIdx) === 1) return 'confused_alternatives';
  }

  // R4: ficou em branco ou null → não sabia
  if (!userOptionLabel) return 'did_not_know';

  // R5: padrão residual — não sabia
  return 'did_not_know';
}
```

**Nota:** a heurística é intencionalmente simples e conservadora. O objetivo é garantir uma sugestão plausível, não perfeita. O aluno sempre pode alterar com 1 toque.

A heurística também é usada para simulados antigos onde `answers.confidence` é `null` em massa (ver seção 1.6).

---

## 6. RPC `add_to_notebook_bulk_guarded`

### 6.1 Assinatura

```sql
CREATE OR REPLACE FUNCTION add_to_notebook_bulk_guarded(
  p_entries jsonb   -- array de objetos, schema abaixo
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
...
$$;
```

**Schema de cada objeto em `p_entries`:**
```json
{
  "question_id": "uuid",
  "simulado_id": "uuid",
  "reason": "did_not_know | did_not_remember | reading_error | confused_alternatives | guessed_correctly",
  "was_correct": false,
  "learning_text": null,
  "question_number": 12,
  "question_text": "texto truncado em 500 chars",
  "simulado_title": "ENAMED Simulado 3",
  "area": "Cardiologia",
  "theme": "Insuficiência Cardíaca"
}
```

Todos os campos são obrigatórios exceto `learning_text` (nullable) e `question_number` (nullable, default null).

### 6.2 Semântica de idempotência

A RPC verifica a existência de entrada não deletada para o par `(auth.uid(), question_id)` antes de inserir:
- **Não existe:** insere. Conta em `added`.
- **Existe (deleted_at IS NULL):** pula. Conta em `skipped`. Não atualiza o motivo (o aluno pode preferir o motivo que já definiu manualmente — update é responsabilidade do `AddToNotebookModal` individual). A mesma questão errada em simulados diferentes não duplica — conta como `skipped`.
- **Existe com soft-delete (deleted_at IS NOT NULL):** ressuscita a entrada (seta `deleted_at = NULL`), atualiza o `reason` para o novo. Conta em `added`.

### 6.3 Segurança e RLS

- `SECURITY DEFINER`: a função opera sob o role do owner, não do chamador. O `auth.uid()` é obtido por `current_setting('request.jwt.claims')::json->>'sub'` ou equivalente Supabase.
- Cada entry só pode ser inserida para `user_id = auth.uid()`. A função **ignora** qualquer `user_id` passado pelo cliente — o `user_id` é sempre derivado do JWT.
- Limite de 100 entradas por chamada (proteção contra abuso). Se `jsonb_array_length(p_entries) > 100` retorna erro HTTP 400.

### 6.4 Coexistência com o add individual

A RPC `add_to_notebook_bulk_guarded` **não substitui** o `simuladosApi.addToErrorNotebook()` existente. Os dois caminhos coexistem:
- **Add individual** (`AddToNotebookModal`): continua funcionando exatamente como hoje. Não é alterado nesta spec.
- **Add em lote** (`TriagemPage`): usa `add_to_notebook_bulk_guarded` via novo método `simuladosApi.addToNotebookBulk(entries)`.

O frontend deve usar a RPC correta por contexto. Não unificar os dois caminhos agora para não regressar o modal individual.

### 6.5 Método de serviço no cliente

```typescript
// src/services/simuladosApi.ts — novo método
async addToNotebookBulk(entries: BulkNotebookEntry[]): Promise<{ added: number; skipped: number }> {
  const { data, error } = await rpc('add_to_notebook_bulk_guarded', { p_entries: entries });
  if (error) {
    logger.error('[SimuladosApi] Error bulk adding to notebook:', error);
    throw error;
  }
  const result = (data as any) ?? { added: 0, skipped: 0 };
  return { added: result.added, skipped: result.skipped };
}
```

---

## 7. Considerações de Latência, Privacidade e Custo de IA

### 7.1 Classificação assíncrona e estratégia optimista

A `TriagemPage` inicia a chamada à `classify-exam-errors` em paralelo com o carregamento da lista de candidatos. O aluno não espera a IA para ver a lista — os cards aparecem imediatamente com a heurística de fallback, e os motivos da IA substituem os heurísticos quando chegam (update reativo via estado local).

**Diagrama de carregamento:**
```
[finalize] → navigate /triagem
  ↓ (paralelo)
  ├── getAttemptQuestionResults()  ── candidatos disponíveis → exibe cards (heurística)
  └── classify-exam-errors()       ── chegou → substitui motivos nos cards
```

O aluno pode confirmar com a heurística sem esperar a IA. Isso garante que a tela nunca bloqueie.

### 7.2 Cache de classificação

A classificação por IA de uma tentativa é cacheada no cliente (React Query, staleTime de 5 min) e opcionalmente persistida em banco. O campo `attempt_question_results.ai_suggested_reason` (nova coluna, spec 01) serve como cache persistente — evita re-classificar se o aluno reabrir a triagem.

Se `ai_suggested_reason` já estiver preenchido para todas as questões candidatas, a edge function **não é chamada** — o frontend usa o valor do banco diretamente.

### 7.3 Só classificar o que o aluno vai ver

A edge function recebe **apenas as questões candidatas**, não o simulado inteiro. Em um simulado de 100 questões com 30 erros, são enviadas até 30 questões (em 2 batches de 15). Isso reduz custo de tokens em ~70% vs. enviar tudo.

O enunciado é truncado em 600 chars e a explicação em 400 chars no cliente antes do envio. Questões sem enunciado disponível (raro, mas possível) são classificadas apenas pela heurística, sem chamada à IA.

### 7.4 Privacidade

- Enviados à API Gemini: enunciado truncado, alternativas, resultado, confiança, área, tema, explicação oficial. **Não é enviado:** nome do aluno, email, ID de usuário, histórico anterior.
- O `studentName` da `gemini-error-notebook-review` **não é incluído** no prompt de classificação — a classificação é sobre a questão, não sobre o aluno nominalmente.
- Os dados enviados são os mesmos que já aparecem publicamente na correção do simulado (questões são conteúdo da banca, não dados pessoais do aluno).

### 7.5 Estimativa de custo

Gemini 2.5 Flash com `thinkingBudget: 0`:
- ~15 questões por chamada, ~200 tokens de input por questão = ~3.000 tokens de input por chamada
- Output: ~800 tokens por chamada
- Custo por chamada: ~$0,001 (estimativa, sem thinking budget)
- Volume estimado: 1.000 alunos × 2 simulados/mês × 2 chamadas = 4.000 chamadas/mês
- Custo estimado: ~$4/mês — irrelevante. Sem necessidade de rate limiting agressivo.

---

## Apêndice A — Diagrama de Fluxo Completo

```
Prova em andamento
  ↓ aluno marca alternativa
  useExamFlow.handleSelectOption(optionId)
    → markAnswerDirty(questionId)
    → updateState: answers[id].selectedOption = optionId
    → seletor de confiança aparece (UX)

  aluno toca chip "Chute" / "Parcial" / "Tenho certeza"
  useExamFlow.handleSetConfidence('baixa')
    → markAnswerDirty(questionId)
    → updateState: answers[id].confidence = 'baixa'
    → saveStateDebounced → bulkUpsertAnswers (inclui confidence)

  aluno clica "Finalizar"
  useExamFlow.finalize()
    → flushPendingState (garante confidence persistida)
    → submitAttempt → finalize_attempt_with_results
    → [PRO] navigate('/simulados/:id/triagem')
    → [non-PRO] navigate('/simulados/:id/resultado')

TriagemPage monta
  → getAttemptQuestionResults() [candidatos]
  → getErrorNotebook(userId, simuladoId) [duplicatas]
  → classify-exam-errors() [assíncrono, paralelo]
    → heurística imediata nos cards (não bloqueia)
    → quando IA responde: atualiza motivos

aluno confirma / ajusta motivos (1 toque cada)
  → aluno clica "Adicionar X ao caderno"
  → add_to_notebook_bulk_guarded(entries)
    → toast "X adicionadas, Y já existiam"
    → navigate('/simulados/:id/resultado')
```

---

## Apêndice B — Mudanças de Arquivos

| Arquivo | Tipo de mudança | Resumo |
|---|---|---|
| `src/types/exam.ts` | Editar | Adicionar `confidence` em `ExamAnswer` |
| `src/hooks/useExamFlow.ts` | Editar | `handleSetConfidence`, atalhos `1/2/3`, `beforeunload` inclui `confidence` |
| `src/services/simuladosApi.ts` | Editar | `bulkUpsertAnswers` + `upsertAnswer` incluem `confidence`; novo `addToNotebookBulk` |
| `src/pages/TriagemPage.tsx` | Criar | Tela de triagem pós-prova |
| `src/App.tsx` | Editar | Rota `/simulados/:id/triagem` |
| `supabase/functions/classify-exam-errors/index.ts` | Criar | Edge function de classificação em lote |
| `supabase/migrations/YYYYMMDD_add_confidence.sql` | Criar (spec 01 define) | `ALTER TABLE answers ADD COLUMN confidence text ...` |

---

## Premissas que outras specs devem honrar

Listadas ao final para referência cruzada entre specs do pacote.

- **Coluna `answers.confidence`:** `text CHECK (confidence IN ('baixa', 'media', 'alta')) DEFAULT NULL`. Definida na spec 01; esta spec é a consumidora principal.
- **RPC `add_to_notebook_bulk_guarded(p_entries jsonb)`:** retorna `jsonb {added int, skipped int}`, idempotente por `(user_id, question_id)` com ressurreição de soft-delete.
- **Edge function `classify-exam-errors`:** endpoint POST autenticado, input `{ attemptId, questions[] }`, output `{ classifications[], partial }`, máx. 15 questões por chamada.
- **Enum `DbReason`:** `did_not_know | did_not_remember | reading_error | confused_alternatives | guessed_correctly`. A IA de classificação nunca retorna `did_not_understand` (legado). Specs que consomem motivos devem tolerar o valor legado em entradas antigas.
- **Rota `/simulados/:id/triagem`:** exclusiva PRO. Não indexada por `useHasAccess`, redireciona para `/resultado` para não-PRO.
- **Sem `confidence` obrigatório:** nenhuma spec downstream deve assumir `confidence !== null`. Fallback é sempre necessário.
- **`simuladosApi.addToNotebookBulk`:** método novo, não modifica `addToErrorNotebook` existente. Specs que usam o modal individual continuam usando `addToErrorNotebook`.
- **Coluna `attempt_question_results.ai_suggested_reason`:** cache de classificação. Se presente, o cliente não chama a edge function. Specs de banco devem incluir esta coluna ao criar/alterar `attempt_question_results`.
- **Eventos de analytics (namespace `caderno_*`):** `caderno_triage_viewed` (tela montada, payload `{ simulado_id, candidate_count }`), `caderno_triage_item_toggled` (aluno pulou/reincluiu item, payload `{ question_id, toggled_to: 'included'|'skipped' }`), `caderno_triage_batch_added` (confirmação do lote, payload `{ added, skipped, simulado_id }`). Adicionar ao union `AnalyticsEventName` em `src/lib/analytics.ts`.
