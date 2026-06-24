# Verificação de questões expandida — Design

**Data:** 2026-06-23
**Contexto:** Admin → Upload de Questões (`/admin/simulados/{id}/questoes`)
**Status:** Aprovado (aguardando review do spec → plano de implementação)

## Problema

A verificação de questões hoje (`supabase/functions/admin-verify-questions`) tem **uma única
checagem**: `missing_image`. Ela só recebe texto + três booleanos (`has_image`, `has_image_2`,
`has_explanation_image`) e infere, pelo texto, se uma figura citada está faltando. Limitações:

- A IA **nunca vê a imagem** — não detecta imagem errada, ilegível ou trocada de coluna.
- Não há nenhuma checagem estrutural (gabarito inválido, campo vazio, duplicata).
- O painel (`VerifyFindingsPanel`) hardcoda o texto "ausente" e conhece só os 3 slots.

## Objetivo

Ampliar a cobertura para: (1) IA multimodal que olha a imagem de verdade nas três colunas;
(2) checagem reversa de imagem órfã; (3) checagens estruturais além de imagem (gabarito,
campos vazios, duplicatas); (4) relatório que cobre todas as imagens, não só as citadas no texto.

## Decisões de produto (confirmadas)

- **Escala:** simulado pode ter ~100 questões com muitas imagens. Verificação multimodal **pode
  demorar** (lotes, dezenas de segundos a minutos). Completude > velocidade.
- **Disparo:** checagens estruturais (baratas) rodam **automaticamente** ao carregar o arquivo;
  a verificação por IA (multimodal) continua **sob o botão "Verificar com IA"**.
- **Downscale** das imagens no cliente antes de enviar (≤1024px, JPEG) — configurável.
- **"Questão duplicada"** = match de texto normalizado (não semântico por IA), para não gastar tokens.

## Arquitetura

Duas camadas que produzem o **mesmo formato de achado** e alimentam o **mesmo painel**.

### Modelo unificado de achado

Estende `QuestionVerifyFinding` (em `src/admin/services/adminApi.ts` e na edge function):

```ts
interface QuestionVerifyFinding {
  question_number: number;
  source: 'structural' | 'ai';
  check_type:
    | 'missing_image' | 'orphan_image' | 'image_mismatch' | 'illegible_image'  // imagem
    | 'invalid_gabarito' | 'empty_enunciado' | 'empty_option'                   // estrutural
    | 'duplicate_options' | 'duplicate_question' | 'bad_numbering';
  slot?: 'enunciado' | 'enunciado2' | 'comentario';
  severity: 'error' | 'warning';
  evidence: string;
}
```

`slot` passa a ser opcional (checagens estruturais não têm slot). `source` permite a tag de
origem no painel. Campos novos têm default para não quebrar achados existentes.

### Camada A — Estrutural (local, sem IA, automática)

Módulo puro novo **`src/admin/lib/validateQuestions.ts`**, desenvolvido com TDD
(`validateQuestions.test.ts`). Recebe as linhas já parseadas/normalizadas (em memória, antes do
upload) e retorna `QuestionVerifyFinding[]` com `source: 'structural'`.

Checagens por questão:

| check_type | Severidade | Regra |
|---|---|---|
| `empty_enunciado` | error | Enunciado vazio/só espaços |
| `empty_option` | error | Alguma das alternativas A–D vazia (`slot` não usado; evidence diz qual) |
| `invalid_gabarito` | error | Gabarito normalizado ∉ {A,B,C,D} |
| `bad_numbering` | error/warning | `numero` ausente/`NaN` (error); repetido ou fora de sequência (warning) |
| `duplicate_options` | warning | Duas alternativas com texto normalizado idêntico |

Checagem entre questões:

| check_type | Severidade | Regra |
|---|---|---|
| `duplicate_question` | warning | Enunciado normalizado idêntico ao de outra questão (reporta os dois números) |

Normalização de texto: trim + lowercase + colapso de espaços (reusar/expandir o helper de
normalização já usado no parser, sem acoplar ao DOM).

**Integração:** chamada em `handleFile` (em `AdminUploadQuestions.tsx`), logo após `canonicalizeRows`.
Resultado vai para um estado separado (`structuralFindings`) e é mesclado com os achados de IA na
exibição. Recalcula sempre que um novo arquivo é carregado.

### Camada B — IA multimodal (edge function, sob o botão)

Upgrade de **`admin-verify-questions`** para visão.

**Entrada (nova).** Por questão, além do texto, os bytes das imagens presentes:

```ts
interface QuestionInput {
  question_number: number;
  enunciado_text: string;
  comentario_text?: string;
  images: Array<{ slot: 'enunciado' | 'enunciado2' | 'comentario'; mime: string; base64: string }>;
}
```

(Os booleanos `has_*` saem; a presença/ausência é derivada de `images`.)

**Batching (no front).** ~100 questões × até 3 imagens não cabe num único request (limite de
payload da invoke e do Gemini). O front:

1. Faz downscale das imagens (≤1024px, JPEG q~0.8) — helper novo `src/admin/utils/downscaleImage.ts`.
2. Quebra as questões em lotes de ~6–8.
3. Invoca `adminApi.verifyQuestions` por lote com **concorrência limitada (4)** — mesmo padrão do
   `worker()` de upload de imagens em `handleUpload`.
4. Agrega os `findings` e atualiza progresso (lote X/Y) reusando o `uploadProgress`-like state.

**Gemini.** `gemini-2.5-flash` (suporta visão), mesma `GEMINI_API_KEY` (formato `AIza…`, ver
memória). Cada questão vira um bloco com `inline_data` por imagem + texto. `responseSchema`
expandido para os novos `check_type` e `source: 'ai'`.

**Checagens por IA** (cobrindo coluna 1 = enunciado, coluna 2 = enunciado2 e comentário):

| check_type | O quê |
|---|---|
| `missing_image` | (mantém) texto cita figura, slot sem imagem |
| `orphan_image` | imagem presente no slot, mas nenhum texto cita figura |
| `image_mismatch` | imagem presente e citada, mas o conteúdo não corresponde (ex.: texto "RX de tórax" × imagem de ECG) |
| `illegible_image` | imagem ilegível, em branco, cortada ou corrompida |

Severidade `error` quando inequívoco, `warning` quando ambíguo. `evidence` = trecho curto do
texto e/ou descrição do que foi visto na imagem.

**Helpers puros testáveis:** extrair `buildPrompt(questions)` e `parseFindings(rawJson)` para
funções puras (testáveis em isolamento); manter a camada de rede fina.

### UI — `VerifyFindingsPanel`

- Substituir o texto hardcoded `{SLOT_LABEL[...]} ausente` por um **mapa rótulo-por-check_type**
  (ex.: `missing_image` → "{slot} ausente", `image_mismatch` → "imagem não corresponde ao texto",
  `invalid_gabarito` → "gabarito inválido", etc.).
- Lista unificada agrupada por questão; cada achado mostra uma **tag de origem** (⚙️ estrutural /
  🤖 IA) e o rótulo do problema. Mantém a borda esquerda colorida por severidade e a contagem
  "N erros · M avisos".
- Estruturais aparecem assim que o arquivo é lido (mesmo antes de clicar no botão); achados de IA
  entram após "Verificar com IA". O contador combina as duas origens.
- `summarizeFindings` (em `src/admin/lib/verifyFindings.ts`) é ajustado para o modelo novo e ganha
  cobertura de teste para os novos tipos.

## Componentes / arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/admin/lib/validateQuestions.ts` | **novo** — camada estrutural pura |
| `src/admin/lib/validateQuestions.test.ts` | **novo** — TDD da camada A |
| `src/admin/utils/downscaleImage.ts` | **novo** — downscale client-side |
| `src/admin/services/adminApi.ts` | tipos novos; `verifyQuestions` passa a aceitar imagens e (opcionalmente) lotear |
| `src/admin/pages/AdminUploadQuestions.tsx` | roda Camada A no `handleFile`; loteia/concorre a Camada B; progresso |
| `src/admin/components/VerifyFindingsPanel.tsx` | rótulos por check_type, tag de origem, merge das origens |
| `src/admin/lib/verifyFindings.ts` (+test) | summarize ajustado ao modelo novo |
| `supabase/functions/admin-verify-questions/index.ts` | entrada multimodal, prompt/schema novos, helpers puros |

## Testes

- `validateQuestions.test.ts` — cobertura completa da Camada A (todos os check_types, casos de
  borda: gabarito minúsculo, alternativa só com espaços, numeração com buraco, duplicatas).
- `verifyFindings.test.ts` — summarize com modelo expandido (mistura de origens e severidades).
- `downscaleImage` — teste leve do contrato (entrada/saída de mime/dimensão) onde viável em jsdom.
- Edge function: testar `buildPrompt`/`parseFindings` puros; a parte de rede fica fina e fora do teste.

## Fora de escopo / decisões

- Não há detecção semântica de questão duplicada (só match normalizado).
- Não persiste achados no banco — verificação é pré-upload, efêmera, como hoje.
- A correção dos problemas continua manual (editar a planilha e re-subir).

## Passo final — documentação

Atualizar o tutorial no Notion ("Como inserir um simulado…") para refletir a verificação
expandida: estruturais automáticas + IA multimodal, e os novos tipos de achado.

## Notas de implementação

- Trabalho de admin deve ocorrer em **worktree** (ver memória `worktree-sempre-em-sessoes-paralelas`
  e `admin-central-programa`), não direto no working dir compartilhado.
- `GEMINI_API_KEY` precisa ser chave Google (`AIza…`), nunca access token (ver memória
  `gemini-api-key-deve-ser-aiza`).
