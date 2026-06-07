# Criar flashcards em lote com o Prof. San — Design

**Data:** 2026-06-06
**Branch alvo:** `claude/busy-swirles-62271e` (onde os flashcards já existem)
**Status:** Aprovado para implementação (entrega em fases)

## Problema

Hoje só dá para criar flashcards um a um (`FlashcardEditor`), com geração de um único card via `generate-flashcard`. Para montar um deck o usuário precisa repetir o fluxo dezenas de vezes. Queremos gerar **vários flashcards de uma vez** com o Prof. San, a partir de fontes que o app já conhece (tema/área, Caderno de Erros, anotações, pontos fracos, simulado concluído, favoritas).

## Princípio pedagógico

O usuário **não vê o verso antes de salvar** — ver a resposta estraga o recall ativo. Por isso o lote é salvo direto no deck e a curadoria acontece **durante a revisão** (remover / "não gostei"), não num preview.

## Arquitetura

### Motor: 3 primitivas, 6 fontes

Toda fonte normaliza seu input para uma de três requisições de geração:

| Primitiva | Input | Alimentada por |
|-----------|-------|----------------|
| `topic` | `area`, `theme`, `count` | Tema/área · Pontos fracos |
| `questions` | array de `{ stem, options?, correctLabel?, area?, theme?, aiReviewMd?, learningNote?, sourceRef }` → 1 card por item | Caderno de Erros · Simulado concluído · Favoritas |
| `text` | `rawText`, `count` | Colar anotações/resumo |

`sourceRef` carrega `{ entryId?, questionId? }` para que o card salvo aponte para a origem.

### Edge Function `generate-flashcards-batch`

Clonada de `generate-flashcard` (mesmo Gemini 2.5 Flash, mesma sanitização: sem travessões, sem elogios de abertura, limites de caracteres).

**Entrada:**
```ts
{
  mode: 'topic' | 'questions' | 'text',
  count?: number,            // topic/text — clamp 1..20
  area?: string,
  theme?: string,
  rawText?: string,          // text
  questions?: Array<{        // questions
    sourceRef: { entryId?: string; questionId?: string };
    questionStem: string;
    options?: { label: string; text: string }[];
    correctOptionLabel?: string;
    area?: string;
    theme?: string;
    aiReviewMd?: string;
    learningNote?: string;
  }>,
}
```

**Saída:**
```ts
{ cards: Array<{ front_md: string; back_md: string; sourceRef?: { entryId?: string; questionId?: string } }> }
```

- `front_md` ≤ 500 chars, `back_md` ≤ 1200 chars (igual ao single).
- Modo `questions`: 1 card por questão, preservando ordem e devolvendo o `sourceRef` recebido.
- Modos `topic`/`text`: `count` cards (clamp 1..20).
- Timeout ~25s (igual ao existente). Os caps de UI mantêm o lote dentro de uma chamada só.
- Reaproveita o tratamento de erro do single: 401 / 404 / 429 / 502.

### Camada de serviço (`src/services/simuladosApi.ts`)

- `generateFlashcardsBatch(input): Promise<{ cards: GeneratedCard[] }>` — invoca a edge function.
- `createFlashcardsBulk(payloads: CreateFlashcardPayload[]): Promise<Flashcard[]>` — **um único insert multi-linha** via RLS (segue o padrão de insert direto já usado em `createFlashcard`; RLS garante posse). Mapeia `sourceRef` → `entry_id` / `question_id`.
- Data fetchers das fontes (fase 2, exceto Caderno que já existe):
  - Pontos fracos: lê `user_performance_summary`.
  - Simulado concluído: lê `attempt_question_results` / `answers` do attempt para pegar as questões erradas.
  - Favoritas: lê `question_favorites`.
  - Caderno de Erros: usa a listagem de `error_notebook` já existente.

## UI: `BulkGenerateModal` (wizard)

Entry point: botão **"Gerar em lote ✨"** no header de `CadernoFlashcardsPage`, ao lado de "Novo flashcard". Usa `AdaptiveModal` (Dialog no desktop / Drawer no mobile), como o `FlashcardEditor`.

Passos:
1. **Fonte** — tiles das fontes disponíveis (fase 1: Tema/área e Caderno de erros).
2. **Configurar** (varia por modo):
   - `topic`: campos área + tema + seletor de quantidade (5 / 10 / 15, default 10).
   - `text`: textarea + seletor de quantidade.
   - `questions` (Caderno): lista de entradas com checkbox, filtros por área/motivo.
   - (fase 2) Pontos fracos: top temas fracos do `user_performance_summary` + quantidade. Simulado: escolher simulado concluído, questões erradas pré-marcadas. Favoritas: lista com checkbox.
3. **Destino** — escolher deck existente **ou** criar novo, com nome sugerido pré-preenchido (o tema, ou ex. "Cardiologia — erros").
4. **Gerar** — chama a função com `ProfSanorAvatar` animado; no sucesso faz o bulk insert → fecha → toast *"N flashcards criados em [deck]"* com **Undo** (5s; soft-delete do lote). Sem preview do verso.

**Caps (para caber no timeout ~25s):** `count` ≤ 20 nos modos topic/text; ≤ 30 itens selecionados no modo questions. Acima do cap, botão Gerar desabilitado com aviso.

## Curadoria na revisão

Adicionar à `FlashcardReviewSession` uma ação secundária **"Remover / não gostei"** (soft-delete do card atual + toast com undo). É o caminho de curadoria que substitui o preview pré-save. Os botões de nota (errei / difícil / bom / fácil) continuam primários.

## Transversais

- **Acesso:** herda o gate PRO já existente na página de Flashcards — sem novo gate.
- **Analytics:** evento `caderno_flashcards_bulk_generated { mode, count, deck_id }` (espelha `caderno_flashcard_ai_generated`).
- **Erros:** falha da função → toast, modal permanece aberto para retry. Zero cards devolvidos → toast de erro, nada salvo.
- **Logging:** `logger.log('[BulkGenerate] ...')`, nunca `console.log`.

## Fases

### Fase 1 (este spec/plano)
- Edge function `generate-flashcards-batch` com os 3 modos (`topic`, `questions`, `text`).
- `generateFlashcardsBatch` + `createFlashcardsBulk` no `simuladosApi`.
- `BulkGenerateModal` com as fontes **Tema/área** e **Caderno de erros**.
- Botão de entry point no header da página.
- Ação "Remover / não gostei" na `FlashcardReviewSession`.

### Fase 2 (spec/plano separado)
- Fontes adicionais: **Anotações** (modo `text`), **Pontos fracos**, **Simulado concluído**, **Favoritas** — mesma engine, só novos pickers + data fetchers.

## Testes

- Unit: normalização fonte → requisição; mapeamento do payload do bulk insert (incl. `sourceRef` → `entry_id`/`question_id`); seleção de temas fracos (fase 2).
- Edge function: teste leve de validação se houver padrão de teste para `generate-flashcard`.

## Decisões registradas

- Abordagem A (uma edge function de lote) escolhida sobre loop por item (B) e RPC dedicada de insert (C).
- Salvar direto, sem preview do verso, por integridade do recall.
- Deck escolhido/criado na hora, com nome sugerido.
- Quantidade default 10 (topic/text); questions = 1 card por questão.
