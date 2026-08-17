# Blindagem de gabarito — design

Data: 2026-08-17
Branch: `feat/gabarito-guard`

## Problema

Três gabaritos errados chegaram a produção com a mesma causa raiz:

| Incidente | Sintoma | Como foi descoberto |
|---|---|---|
| S5 Q35 (corrigido 29/07) | corpo do comentário diz "Alternativa B: CORRETA", a última linha diz "Resposta: Alternativa C"; o banco ficou em C | queixa de aluno |
| S5 Q46 (corrigido 29/07) | gabarito em C (aloimunização), comentário justifica cardiopatias congênitas = D; parágrafos C/D do comentário também trocados em relação ao texto das alternativas | queixa de aluno |
| S6 Q49 (corrigido 17/08) | `is_correct` em B, comentário diz "Alternativa C: CORRETA"; 228 de 265 alunos marcaram C (6,8% de acerto oficial) | ticket #30458, 1h25 **depois** da liberação dos resultados |

### Correção de premissa

O importador **não** lê a linha "Resposta: Alternativa X". Ele lê a coluna `Gabarito` da planilha:

- `src/admin/pages/AdminUploadQuestions.tsx` → `normalizeRow()`: `correta: (row.Gabarito || '').toUpperCase()`
- `supabase/functions/admin-upload-questions/index.ts` → `is_correct: correta === label`
- A coluna `Comentário` vira `questions.explanation` e **nunca é cruzada com nada**.

A cadeia real é: quem monta a planilha transcreve a linha "Resposta:" para a coluna `Gabarito`; quando essa linha discorda do corpo do comentário, a coluna carrega a letra errada e o comentário certo entra no banco ao lado de um `is_correct` errado.

Consequência de projeto: **o cruzamento é 100% determinístico** (texto × texto, no parse client-side). Não precisa de IA para o caso principal.

### O que já existe e é reaproveitado

- `admin_simulado_question_stats` (RPC) já devolve `correct_rate`, `most_common_wrong_label`, `most_common_wrong_pct`, `total_responses`, `discrimination_index`. **A frente de distribuição não precisa de SQL novo.**
- `AdminSimuladoAnalytics` já tem a seção "Qualidade por questão" consumindo esse RPC.
- `VerifyFindingsPanel` + `QuestionVerifyFinding` já são o canal de exibição de achados no upload.
- `buildRowIssues` (em `AdminUploadQuestions.tsx`) é o validador que de fato **bloqueia** a linha; `validateQuestions.ts` alimenta o painel informativo. Os dois continuam existindo, com papéis distintos.
- `novu-email` (relay interno com `x-internal-secret` + allowlist de host) e o padrão de edge function agendada por pg_cron + pg_net + Vault (`caderno-reminders` + `20260607140000_caderno_reminders_cron.sql`).

### O que NÃO é tocado

- O prompt do `admin-verify-questions` (recalibrado no v6, de 48 achados/1 real para precisão aceitável). A checagem de gabarito por IA vive em **edge function nova e separada**.
- `admin-upload-questions` (edge function). Linha bloqueada não chega lá.
- Qualquer coisa no fluxo do aluno.

---

## Arquitetura

Um módulo puro no centro, vários consumidores. O módulo não sabe se os dados vieram da planilha ou do banco — o import passa linhas da planilha, o gate de publicação passa linhas do banco. Sem essa unificação as duas frentes divergem com o tempo.

```
                       ┌─────────────────────────────┐
  planilha (parse) ───►│  gabaritoCheck.ts (puro)    │
  banco (select)  ───►│  comentário × gabarito       │
                       └──────────┬──────────────────┘
                                  │ GabaritoFinding[]
              ┌───────────────────┼───────────────────┐
              ▼                   ▼                   ▼
     import: bloqueia    publish: modal      (opcional) IA
     a linha             bloqueante          admin-verify-gabarito

                       ┌─────────────────────────────┐
  admin_simulado_ ────►│  suspectKey.ts (puro)       │
  question_stats       │  distribuição de respostas   │
                       └──────────┬──────────────────┘
                    ┌─────────────┼─────────────┬──────────────┐
                    ▼             ▼             ▼              ▼
              seção em       banner no      badge na     e-mail agendado
              Analytics      Dashboard      lista        (pg_cron + Novu)
```

---

## Componente 1 — `src/admin/lib/gabaritoCheck.ts` (puro)

### Interface (contrato fixo; outros componentes constroem contra ela)

```ts
export type OptionLabel = 'A' | 'B' | 'C' | 'D';

export interface GabaritoCheckInput {
  questionNumber: number;
  /** Letra apontada como correta pela fonte (coluna Gabarito, ou is_correct no banco). */
  gabarito: string;
  options: Array<{ label: string; text: string }>;
  /** Coluna Comentário / questions.explanation. Pode conter HTML e markdown. */
  comentario: string;
}

export type GabaritoCheckType =
  | 'key_comment_conflict'      // error  — comentário marca outra letra como CORRETA
  | 'key_answer_line_conflict'  // error  — linha "Resposta:" aponta outra letra
  | 'comment_internal_conflict' // error  — corpo e linha "Resposta:" discordam entre si
  | 'multiple_correct_marked'   // error  — mais de uma letra marcada CORRETA
  | 'option_letter_misalignment'// warning— parágrafo do comentário casa melhor com outra alternativa
  | 'key_unverifiable';         // info   — comentário sem marcação legível (só agregado)

export interface GabaritoFinding {
  questionNumber: number;
  checkType: GabaritoCheckType;
  severity: 'error' | 'warning' | 'info';
  /** Letra que a evidência sugere, quando há uma. */
  proposedLabel?: OptionLabel;
  /** Texto curto em pt-BR: o que está errado. */
  what: string;
  /** Texto curto em pt-BR: como corrigir. */
  how: string;
  /** Trecho literal do comentário que sustenta o achado (≤ 200 chars). */
  evidence: string;
}

export function checkGabarito(input: GabaritoCheckInput): GabaritoFinding[];

/** Agrega uma lista de findings: erros por questão + contagem de `key_unverifiable`. */
export function summarizeGabaritoFindings(findings: GabaritoFinding[]): {
  errors: GabaritoFinding[];
  warnings: GabaritoFinding[];
  unverifiableCount: number;
  blockedQuestionNumbers: number[];
};
```

### Extração — três fontes de verdade

Antes de qualquer regex: `stripMarkup()` remove tags HTML, decodifica as entidades comuns (`&nbsp; &amp; &lt; &gt; &quot; &#39;`), tira `*`/`_` de markdown e normaliza whitespace. Sem isso `<strong>Alternativa C:</strong> CORRETA` não casa.

| Fonte | Como sai | Regex base |
|---|---|---|
| `S1` = letras marcadas CORRETA | conjunto | `/alternativa\s+([a-d])\s*[):\-–—]?\s*(?:é\s+)?(correta|incorreta)/gi` — coleta só as `correta`. Variantes adicionais: `/alternativa\s+correta\s*[:\-]?\s*([a-d])/i`, `/gabarito\s*[:\-]?\s*(?:alternativa\s*|letra\s*)?([a-d])\b/i`, `/resposta\s+correta\s*[:\-]?\s*(?:alternativa\s*|letra\s*)?([a-d])\b/i` |
| `S2` = linha final "Resposta:" | letra ou `null` | `/resposta\s*[:\-]?\s*(?:alternativa\s*|letra\s*)?([a-d])\b/gi` → **última** ocorrência |
| `G` = gabarito informado | letra | normalização de `input.gabarito` |

Cuidado obrigatório: `resposta correta: C` casa nos dois padrões. A extração de `S1` roda primeiro e as posições consumidas por ela são excluídas da varredura de `S2`, senão a mesma frase gera um conflito fantasma consigo mesma.

### Regras

1. **`key_comment_conflict`** (error) — `S1` não vazio e `G ∉ S1`.
   `what`: "Comentário marca a alternativa {S1} como CORRETA, mas o gabarito está em {G}".
   Pega **S6 Q49**.

2. **`key_answer_line_conflict`** (error) — `S2` existe e `S2 ≠ G`.

3. **`comment_internal_conflict`** (error) — `S1` e `S2` ambos presentes e discordam. **Bloqueia mesmo quando `G` concorda com um dos dois lados**: o documento de origem se contradiz e só um humano decide qual lado vale. Pega **S5 Q35**.
   Decisão consciente: é a regra de maior custo operacional (uma planilha com muitos comentários auto-contraditórios trava várias linhas de uma vez). Aprovada assim mesmo porque é literalmente o incidente da S5 Q35.

4. **`multiple_correct_marked`** (error) — `|S1| > 1`.

5. **`option_letter_misalignment`** (warning) — pega **S5 Q46**, o caso que auditoria por letra não pega (as letras batiam, os textos estavam trocados).
   - `segmentByLetter()` fatia o comentário: de cada marcador `Alternativa X` até o próximo marcador.
   - Para cada letra `L` com segmento, calcula similaridade entre o segmento e o texto de **todas** as alternativas.
   - Similaridade = overlap de tokens "raros": normaliza (NFD, sem acento, minúsculas), tokeniza em palavras de **≥ 5 caracteres**, descarta uma stoplist pt-BR curta (`sobre, porque, quando, entao, portanto, alternativa, correta, incorreta, paciente, questao, ...`), e pontua `|interseção| / |tokens do texto da alternativa|` (Jaccard assimétrico — o segmento é sempre mais longo que a alternativa, então Jaccard simétrico penaliza demais).
   - Flag quando: `argmax ≠ L` **e** `score(argmax) − score(L) ≥ 0.25` **e** `score(argmax) ≥ 0.34`. Piso + margem mantêm precisão alta; comentário que parafraseia sem citar simplesmente não atinge o piso e fica quieto.
   - `proposedLabel` = `argmax`.

6. **`key_unverifiable`** (info) — `S1` e `S2` ambos vazios. **Nunca** vira um finding por questão no painel: `summarizeGabaritoFindings` devolve só a contagem, exibida como uma linha ("12 questões sem marcação verificável"). 100 avisos idênticos matam o painel.

### Testes (`gabaritoCheck.test.ts`)

Fixtures dos três incidentes reais, mais negativos:

- S6 Q49 → exatamente um `key_comment_conflict` com `proposedLabel: 'C'`.
- S5 Q35 → `comment_internal_conflict` (corpo B × linha C).
- S5 Q46 → `option_letter_misalignment` com `proposedLabel: 'D'`.
- Comentário coerente com o gabarito → zero findings.
- Comentário sem nenhuma marcação → só `key_unverifiable`.
- `<strong>Alternativa C:</strong> CORRETA` → casa (prova o `stripMarkup`).
- "resposta correta: C" com `G = 'C'` → zero findings (prova que a frase não conflita consigo mesma).
- Alternativas parafraseadas sem citação literal → zero `option_letter_misalignment` (prova o piso).

---

## Componente 2 — Frente 1: blindagem do import

`AdminUploadQuestions.tsx`:

- `buildRowIssues()` chama `checkGabarito()` por linha. Qualquer finding `severity: 'error'` vira um `RowIssue` → a linha entra em "Com erro" e **não é importada**, mesma mecânica de gabarito inválido / alternativa vazia que já existe. `what`/`how` vêm prontos do finding.
- `RowIssue` hoje guarda **um** problema por linha ("a primeira falha manda"). As checagens de gabarito entram **depois** das estruturais nessa cadeia: se a linha já não tem enunciado, o gabarito é o menor dos problemas.
- Warnings (`option_letter_misalignment`) e o agregado `key_unverifiable` vão para `validateQuestions()` → `VerifyFindingsPanel`, sem bloquear.

`validateQuestions.ts`:
- `QuestionRow` ganha `comentario: string`.
- O call site em `ingestFile` passa `comentario: r['Comentário'] || ''`.

`adminApi.ts` / `verifyFindings.ts`:
- `FindingCheckType` ganha os novos tipos; `findingLabel()` ganha os rótulos pt-BR.

---

## Componente 3 — Frente 2a: gate de publicação

`adminApi.getQuestionsForGabaritoAudit(simuladoId)` — select simples (RLS de admin já cobre):

```ts
export interface GabaritoAuditQuestion {
  questionNumber: number;
  enunciado: string;
  comentario: string;
  options: Array<{ label: string; text: string; isCorrect: boolean }>;
}
```

Deriva `gabarito` da opção com `isCorrect`. Se nenhuma ou mais de uma opção estiver marcada, emite finding próprio (`multiple_correct_marked` / gabarito ausente) — estado impossível pelo import, possível por edição manual no banco.

`useGabaritoAudit(simuladoId)` — hook `useQuery` sob demanda (`enabled: false`, disparado no clique).

`GabaritoAuditDialog.tsx` — modal listando questão por questão: número, `what`, `how`, `evidence` em mono, e a letra proposta quando houver. Ações: **"Voltar e corrigir"** (primária) e **"Publicar mesmo assim"** (destrutiva, ghost). Um terceiro botão **"Conferir também com a IA"** dispara o Componente 4 e injeta os achados na mesma lista.

`AdminSimuladoForm.tsx` — em `persist('published')`, antes de gravar: roda a auditoria; havendo achados, abre o modal e **aborta** o save; o "Publicar mesmo assim" re-chama `persist` com um flag `skipGabaritoAudit`. Sem achados: publica e mostra toast "Gabaritos conferidos: nenhuma divergência". `persist('draft')` **não** passa pelo gate. Simulado sem questões cadastradas também não (nada a conferir).

A IA é botão dentro do modal, não automática: publicar não fica preso a latência/custo de 100 chamadas.

---

## Componente 4 — IA como 2ª opinião

`supabase/functions/admin-verify-gabarito/` — nova, separada da de imagem.

- `gabaritoPrompt.ts` com `SYSTEM_PROMPT`, `RESPONSE_SCHEMA`, `buildContents()`, `parseFindings()`, `filterAiFindings()` — mesmo split de `verifyHelpers.ts`, para os testes importarem os helpers direto (precedente: `src/admin/__tests__/verifyHelpers.test.ts`).
- 1 questão por chamada + `thinkingBudget` (mesma calibração do verify de imagem v6). **Sem imagens** no payload.
- Único `check_type` permitido: `key_semantic_mismatch`. `proposed_label` é **obrigatório** no schema.
- Filtro determinístico pós-IA, que é o que segura o falso positivo:
  - descarta se `proposed_label` não é A–D;
  - descarta se `proposed_label === gabarito` (achado que se autocontradiz);
  - descarta se `proposed_label` não corresponde a nenhuma alternativa existente;
  - severidade fica em `warning` quando o determinístico não corrobora, `error` quando corrobora.
- Prompt diz explicitamente: julgue **só** se o raciocínio do comentário fecha em outra alternativa; não opine sobre mérito clínico da questão; na dúvida, não reporte.

`adminApi.verifyGabarito(inputs)` espelha `verifyQuestions`.

---

## Componente 5 — Frente 2b: sinal de distribuição

### `src/admin/lib/suspectKey.ts` (puro)

```ts
export interface SuspectKey {
  questionNumber: number;
  correctRate: number;
  topWrongLabel: string;
  topWrongPct: number;
  totalResponses: number;
  discriminationIndex: number;
  severity: 'high' | 'medium';
  reason: string; // pt-BR, pronto para a UI
}

export function findSuspectKeys(
  stats: SimuladoQuestionStat[],
  opts?: { minResponses?: number; maxCorrectRate?: number; minTopWrongPct?: number },
): SuspectKey[];
```

Regra (defaults): `totalResponses ≥ 30 && correctRate ≤ 20 && topWrongPct ≥ 45`.
`severity: 'high'` quando `topWrongPct ≥ 3 × correctRate`; `medium` caso contrário.
`discriminationIndex < 0` entra no `reason` como reforço — assinatura clássica de chave errada é quem vai bem "errar" a questão. Não é gate porque com poucas tentativas o índice fica ruidoso.

Calibração contra os casos reais:

| Caso | correct_rate | top wrong | respostas | pega? |
|---|---|---|---|---|
| S6 Q49 | 6,8% | C, 86% | 265 | ✅ high |
| S5 Q46 | 6,8% | D, 93% | 220 | ✅ high |
| questão difícil legítima | ~20% | espalhado, ~30% | — | ❌ (é isso que queremos) |

O discriminante é a **concentração**, não a dificuldade: questão difícil de verdade espalha os erros entre três alternativas.

### Superfícies

1. **Seção em `AdminSimuladoAnalytics`**, dentro de "Qualidade por questão": lista as suspeitas com distribuição, nº de respostas e a letra dominante.
2. **Banner em `AdminDashboard`** (`GabaritoSuspicionBanner.tsx`) para simulados no estado "janela fechada, resultados ainda não liberados" — a janela de ouro. No S6 foram 33h (janela fechou 15/08 23:59, resultados 17/08 09:01) com o sinal já pronto e ninguém olhando.
3. **Badge em `AdminSimulados`** na linha do simulado.

Tudo client-side sobre o RPC existente. Zero migration para esta parte.

### Escalonamento por e-mail

`supabase/functions/gabarito-key-alerts/` (agendada) + migration de cron, no padrão `caderno-reminders`:

- Varre simulados com janela fechada e `results_release_at` no futuro (ou liberado nas últimas 48h), roda a mesma regra em SQL/TS e dispara via relay `novu-email` com um `type: "ops_gabarito_alert"` novo. `actionUrl` aponta para `/admin/simulados/:id/analytics` num host já na allowlist.
- Tabela `gabarito_key_alerts` (`simulado_id`, `question_number`, `alerted_at`, `resolved_at`) para dedup — sem ela o cron reenvia o mesmo alerta todo dia.
- Destinatários por env var (`GABARITO_ALERT_EMAILS`), não hardcoded.
- **No-op gracioso** quando o env do Novu/Vault não está configurado: loga o que faria e retorna 200.

**Ressalva registrada:** o scaffold equivalente do `caderno-reminders` foi mergeado e **nunca configurado** (pg_cron/Vault/workflow do Novu pendentes até hoje). Este e-mail nasce no mesmo estado — não dispara nada até alguém ligar o env. As superfícies 1–3 funcionam com zero configuração e são a linha de frente real; o e-mail é escalonamento, não a defesa principal.

---

## Divisão em tracks paralelos

Contratos fixados neste spec permitem paralelismo real. Para evitar conflito, os arquivos compartilhados (`adminApi.ts` tipos + métodos, `verifyFindings.ts`) são editados **uma vez, antes** dos tracks.

| Track | Arquivos exclusivos | Depende de |
|---|---|---|
| **0** (serial, antes) | tipos em `adminApi.ts`, métodos `getQuestionsForGabaritoAudit` / `verifyGabarito`, rótulos em `verifyFindings.ts` | — |
| **A** | `gabaritoCheck.ts`, `gabaritoCheck.test.ts` | contrato do spec |
| **B** | `validateQuestions.ts(+test)`, `AdminUploadQuestions.tsx` | interface A |
| **C** | `GabaritoAuditDialog.tsx`, `useGabaritoAudit.ts`, `AdminSimuladoForm.tsx` | interface A + track 0 |
| **D** | `supabase/functions/admin-verify-gabarito/*`, teste dos helpers | track 0 |
| **E** | `suspectKey.ts(+test)`, `useGabaritoSuspicion.ts`, `GabaritoSuspicionBanner.tsx`, seção em `AdminSimuladoAnalytics.tsx`, badge em `AdminSimulados.tsx` | — |
| **F** | `gabarito-key-alerts/*`, migration da tabela + cron, novo `type` em `novu-email` | interface E |

## Verificação

- `npm run test` verde (suíte admin inclusa), `npx tsc --noEmit` sem erros.
- Os três incidentes reais cobertos por teste unitário, cada um pela regra que o pega.
- Preview manual: upload de planilha com divergência plantada bloqueia a linha; publicar simulado com divergência abre o modal.
