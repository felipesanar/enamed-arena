# Flashcards UX v2 — Design

**Data:** 2026-06-11
**Status:** Aprovado
**Escopo:** `/caderno/flashcards` (gate PRO, hoje restrito a admins)

## Problema

1. Clicar em um flashcard na listagem abre o modo de edição (mesmo comportamento do lápis) e expõe a resposta no preview da lista — o aluno não consegue "ver" o card como flashcard.
2. Os itens da listagem parecem linhas de tabela, não cartas de estudo.
3. Existe um único modo de revisão (SRS dos devidos).
4. "Gerar em lote" e "Novo flashcard" são botões pequenos no canto do header — baixa descoberta.

## Decisões de produto (validadas com o usuário)

- Clique no card abre **preview com flip** em modal (frente → revelar verso). Edição só pelo lápis ou por botão dentro do modal.
- Listagem vira **grid de cards verticais** (2–3 colunas), sem preview da resposta.
- **5 novos modos de revisão:** estudo livre por deck, só difíceis/errados, aleatório (shuffle), invertido (verso→frente) e sessão cronometrada.
- Novos modos são **treino puro**: não gravam SRS. Só "Revisar devidos" chama `scheduleFlashcardReview`.
- CTAs de criação viram **cards de ação grandes no corpo da página** (não mais botões no header).

## Abordagem escolhida

**A — sessão parametrizada.** `FlashcardReviewSession` ganha prop `mode: ReviewMode` que controla pool, direção, timer e persistência SRS. Um único motor de sessão reusa flip 3D, atalhos de teclado, summary e analytics. Zero mudança de backend.

Alternativas descartadas: (B) um componente de sessão por modo — duplicação 6×; (C) query builder de sessão — fricção de UX, esconde os modos como atalhos de 1 clique.

## Design

### 1. Estrutura da página (`CadernoFlashcardsPage`)

Ordem das seções:

1. **Header premium** — título + stats (Total / Decks / Para hoje). `primaryAction` removido.
2. **Hub de revisão** (`ReviewModesHub`, substitui `ReviewBanner`) — card principal "Revisar devidos" em destaque (gradiente wine, contador, Iniciar) + fileira de cards menores com os 5 modos de treino, cada um com ícone, nome e descrição de 1 linha. Modos respeitam o deck selecionado nos chips (pool = deck atual ou "Todos"). Modo desabilitado com tooltip quando pool vazio.
3. **Cards de ação de criação** (`CreateActionsRow`) — 2 cards grandes clicáveis: "Gerar com Prof. San" (sparkles, borda âmbar, badge "IA") → `BulkGenerateModal`; "Criar flashcard" (wine outline, ícone +) → `FlashcardEditor`. Mobile: empilhados. Botão "+" do `SectionHeader` mobile também sai.
4. **DeckList chips** — inalterado.
5. **Grid de flashcards** — ver §3.

### 2. Modos de revisão (`FlashcardReviewSession` parametrizada)

Nova prop `mode: ReviewMode = 'due' | 'free' | 'hard' | 'shuffle' | 'reversed' | 'timed'`.

| Modo | Pool | Direção | SRS grava? | Extra |
|---|---|---|---|---|
| `due` (atual) | `getDueFlashcards()` | F→V | ✅ | — |
| `free` | deck selecionado (ou todos), não-dominados | F→V | ❌ | — |
| `hard` | `srs_reps > 0` e `srs_ease ≤ 2.1` | F→V | ❌ | — |
| `shuffle` | 10 aleatórios do pool | F→V | ❌ | embaralha |
| `reversed` | igual `free` | **V→F** | ❌ | labels Frente/Verso trocados |
| `timed` | pool embaralhado | F→V | ❌ | timer 5 min; sessão acaba ao zerar |

- Modos de treino mantêm os 4 botões de avaliação (errei/difícil/bom/fácil) para feedback e summary, mas alimentam apenas estado local + `trackEvent` — sem `scheduleFlashcardReview`.
- Summary final mostra o nome do modo; no `timed`, "X cards em 5:00".
- Banner discreto no topo da sessão de treino: "Modo treino — não altera seu agendamento".
- Critério de "difícil" é proxy client-side via `srs_ease` (SM-2: errei/difícil abaixam o ease). Sem campo de último resultado no banco; aceito como aproximação.

### 3. Grid + novo `FlashcardItem`

- Grade `grid-cols-1 sm:grid-cols-2 xl:grid-cols-3`, cards verticais com cara de carta: imagem da frente como capa (quando houver), pergunta em destaque (`line-clamp-3`), **sem preview da resposta**, rodapé com badge SRS (Devida / Em Xd / Nova / Dominado) + contagem de revisões.
- Hover: lift leve + sombra + ações (lápis/lixeira) no canto. Mobile: ações sempre visíveis.
- **Clique → `FlashcardPreviewModal`**: reusa `CardFace` + flip 3D da sessão; abre na frente, "Mostrar resposta"/espaço vira; botões Editar (abre `FlashcardEditor`) e Excluir dentro do modal. `AdaptiveModal` (dialog desktop / bottom sheet mobile).

### 4. Invariantes (não mudam)

- API: `listDecks`, `createDeck`, `listFlashcards`, `createFlashcard`, `updateFlashcard`, `softDeleteFlashcard`, `getDueFlashcards`, `scheduleFlashcardReview`, `generateFlashcard`, `uploadFlashcardImage`.
- Query keys, staleTime e invalidations existentes.
- Undo de exclusão (toast 5s), eventos analytics existentes, gates PRO/admin.
- `BulkGenerateModal` e `FlashcardEditor` internamente.

## Arquivos

**Novos:**
- `src/components/caderno/flashcards/FlashcardPreviewModal.tsx`
- `src/components/caderno/flashcards/ReviewModesHub.tsx`
- `src/components/caderno/flashcards/CreateActionsRow.tsx`
- `src/lib/flashcardReviewModes.ts` — config dos modos + filtros de pool (funções puras)
- `src/lib/flashcardReviewModes.test.ts` — testes unitários dos filtros

**Modificados:**
- `src/pages/CadernoFlashcardsPage.tsx`
- `src/components/caderno/flashcards/FlashcardItem.tsx`
- `src/components/caderno/flashcards/FlashcardReviewSession.tsx`
- `src/types/caderno.ts` — tipo `ReviewMode`

## Tratamento de erros

- Pool vazio ao clicar em modo: não acontece (modo fica desabilitado com tooltip), mas a sessão valida `cards.length > 0` defensivamente.
- Falha em `scheduleFlashcardReview` (modo `due`): comportamento atual mantido (toast destructive, não avança).
- `CardFace` extraído/exportado deve manter render idêntico na sessão atual.

## Testes

- Unitários (Vitest) para `flashcardReviewModes.ts`: filtro de difíceis (ease/reps), pool por deck, exclusão de dominados, shuffle com tamanho N, mapeamento de direção do modo invertido.
- Verificação manual via preview: clique→preview/flip, cada modo inicia com pool correto, treino não altera "Para hoje", CTAs visíveis, grid responsivo, dark mode.
