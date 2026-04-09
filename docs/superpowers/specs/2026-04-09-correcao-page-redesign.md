# Redesign — Tela de Correção (Gabarito Comentado)

**Data:** 2026-04-09  
**Escopo:** `src/pages/CorrecaoPage.tsx` + reflexo automático em `/admin/preview/simulados/:id/correcao` (via `adminPreview` prop)  
**Status:** aprovado para implementação

---

## Contexto e Motivação

A tela de Correção é onde o aluno faz o debriefing emocional da prova. Ela precisa:
1. Reforçar imediatamente o resultado (score sempre visível)
2. Facilitar navegação entre questões — especialmente para ir direto às erradas
3. Manter continuidade visual com a experiência da prova em si

O estado atual tem score enterrado no subtitle do `PageHeader` (some ao rolar), sidebar não-sticky, botão de Caderno de Erros enterrado no fim da questão, e mobile com navegação por grade escondida atrás de um ícone opaco.

---

## Decisões de Design

### Layout geral
**Opção B — Header sticky tipo prova**, com sidebar sticky de grade de questões no desktop e bottom sheet no mobile.

Razão: continuidade emocional com a tela de prova, score sempre visível durante scroll, grade de navegação permanentemente acessível.

### Comentário do professor
**Opção C — Sempre visível, com "Ver mais" se ultrapassar altura máxima.**

Razão: o comentário é o principal valor da correção; escondê-lo por padrão reduziria engajamento. O "Ver mais" resolve comentários muito longos sem quebrar o layout.

---

## Arquitetura de Componentes

Nenhum arquivo novo além do que já existe. Todas as mudanças ficam em `CorrecaoPage.tsx`. O componente é autocontido e já cobre as duas rotas (pública e admin preview) via prop `adminPreview`.

---

## Spec Detalhada

### 1. Header sticky

**Estrutura:**
```
┌─────────────────────────────────────────────────────────────┐
│ Gabarito — {simulado.title}          ✓ 6  ✗ 3  — 1  │ 60% │ 4/10 │
│▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ (40%)    │
└─────────────────────────────────────────────────────────────┘
```

- `position: sticky; top: 0; z-index: 40` — fica abaixo do topbar do premium layout (z-index ~50)
- Linha 1: título do simulado à esquerda; chips de score à direita
  - Chip verde `✓ {totalCorrect}` — bg `success/10`, text `success`
  - Chip vermelho `✗ {totalIncorrect}` — bg `destructive/10`, text `destructive`  
  - Chip amarelo `— {totalUnanswered}` — bg `warning/10`, text `warning`
  - Separador visual `|`
  - Score % grande — bg `primary/10`, text `primary`, font `text-heading-3`
  - Posição `{currentIndex+1}/{totalQuestions}` — text `muted-foreground`
- Linha 2: barra de progresso fina (3–4px), cor `primary`, fundo `muted`, sem border-radius quebrado — representa `(currentIndex+1)/totalQuestions`
- Abaixo do sticky header: nav tabs `SimuladoResultNav` (não sticky — rola com a página)

**Remoção:** `PageHeader` e `PageBreadcrumb` são removidos da rota de estado happy path. Ficam apenas nos estados de erro/empty (onde o header sticky não faz sentido).

### 2. Nav tabs (`SimuladoResultNav`)

Sem mudanças no componente. Posicionado logo abaixo do sticky header, antes do layout de 2 colunas. Rola com o conteúdo normalmente.

### 3. Layout de 2 colunas

```
┌─────────────────────────────────┬──────────────────┐
│  Questão (flex-1, min-w-0)      │  Sidebar (w-56)  │
│                                 │  sticky top-[...] │
└─────────────────────────────────┴──────────────────┘
```

- Sidebar: `position: sticky`, `top` calculado para ficar abaixo do sticky header (aprox. `top-[calc(header-height+1rem)]` — usar valor fixo em px após medir)
- Sidebar oculta em mobile (`hidden md:flex`)

### 4. Card da questão

**Header do card:**
```
Questão 4  de 10
[Clínica Médica] [Cardiologia]          [📓 Caderno de Erros]  [✗ Errou]
```

- Número da questão + total
- Tags de área e tema (`bg-muted text-muted-foreground`)
- Tags de flag de revisão (`bg-info/10 text-info`) e alta certeza (`bg-success/10 text-success`) — se aplicável
- **Botão "Caderno de Erros"** movido para cá (antes ficava após o comentário)
  - Para usuários `canUseNotebook`: botão ativo
  - Para demais: pill `✦ PRO: ENAMED` (mantém o upsell, mas posição de maior visibilidade)
- Badge de resultado `✓ Acertou` / `✗ Errou` / `Em branco` — mesmo visual de hoje, mantido

**Corpo:** sem mudanças no enunciado e nas alternativas.

### 5. Alternativas

Sem mudanças visuais nas alternativas. Manter o padrão atual de:
- Correta: `bg-success/5 border-success/30`
- Errada (selecionada): `bg-destructive/5 border-destructive/30`
- Neutras: `bg-card border-transparent`

### 6. Comentário do professor (Opção C)

```tsx
const EXPLANATION_MAX_H = 160 // px — aprox. 4–5 linhas
```

- Se `question.explanation` tem altura renderizada ≤ `EXPLANATION_MAX_H`: exibe completo, sem botão
- Se altura > `EXPLANATION_MAX_H`: trunca com `max-h-[160px] overflow-hidden` + gradiente de fade na borda inferior + botão "Ver mais ▾" abaixo
  - Ao clicar: remove o `max-h`, exibe "Ver menos ▴"
  - Estado por questão (`expandedExplanation: Set<number>`) — resetar ao navegar de questão
- Card mantém borda `border-primary/10 bg-primary/[0.02]` atual
- Imagem de explicação: sempre visível, fora do truncamento (vem depois do texto)

### 7. Sidebar (desktop)

**Estrutura:**
```
Questões                    ← label overline
[1][2][3][4][5]             ← grid 5 colunas
[6][7][8][9][10]

────────────────
✓ Acertou
✗ Errou  
— Em branco
⚑ Flag revisão             ← novo item na legenda
```

- Quadradinhos: mesma lógica de cor atual (`success/15`, `destructive/15`, `warning/15`)
- **Flag de revisão:** dot badge `absolute -top-1 -right-1` de cor `warning` nos quadradinhos onde `answer?.markedForReview === true`
- Quadradinho ativo: `ring-2 ring-primary bg-primary text-primary-foreground`
- Legenda expandida com item "Flag revisão"

### 8. Navegação Prev/Next

Mantida no rodapé da coluna principal (sem mudanças funcionais).

No mobile: a barra `flex items-center justify-between` ganha um botão central explícito **"⊞ Grade"** (texto visível, não só ícone) que abre o bottom sheet existente. O `Grid3X3` icon sozinho é removido.

### 9. Mobile — Bottom sheet

Sem mudanças estruturais no bottom sheet. Único ajuste: o trigger muda de ícone opaco para botão nomeado "⊞ Grade" na barra de navegação.

---

## Estados de borda (sem mudanças)

- Loading: skeleton cards existentes
- Simulado não encontrado: `EmptyState` com `PageHeader`
- `!resultsAllowed` (admin sem tentativa): `EmptyState` com back link
- `!examState || !score`: `EmptyState` com back link

---

## Acessibilidade

- Sticky header: `role="banner"` ou `<header>` semântico com `aria-label="Resultado da correção"`
- Barra de progresso: `role="progressbar" aria-valuenow={currentIndex+1} aria-valuemax={totalQuestions}`
- Botão "Ver mais": `aria-expanded` toggle
- Grid de questões: cada botão mantém `aria-label` existente (ex: "Questão 4, errou, marcada para revisão")

---

## O que NÃO muda

- Lógica de dados: `useSimuladoDetail`, `useExamResult`, `computeSimuladoScore` — sem alterações
- `AddToNotebookModal` — sem alterações
- `SimuladoResultNav` — sem alterações
- Rotas — sem alterações
- Prop `adminPreview` e seus estados de empty — sem alterações (exceto remoção de `PageHeader` no happy path)

---

## Arquivos a modificar

| Arquivo | Natureza da mudança |
|---------|---------------------|
| `src/pages/CorrecaoPage.tsx` | Todas as mudanças visuais e de estrutura descritas acima |

Nenhum outro arquivo precisa ser alterado.
