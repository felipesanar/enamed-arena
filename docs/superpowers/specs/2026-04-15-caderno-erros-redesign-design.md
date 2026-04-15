# Caderno de Erros — Redesign Spec

**Date:** 2026-04-15
**Scope:** Sandbox redesign (Option B — standalone, não integrado ao projeto existente imediatamente)
**Stack:** React + Vite + Tailwind CSS + Framer Motion (sem shadcn, componentes próprios)
**Status:** Design aprovado, pronto para implementação

---

## 1. Contexto e Objetivo

### Problema central

O Caderno de Erros atual funciona como um **arquivo** — você guarda coisas e pode filtrá-las. O produto precisa ser uma **ferramenta de revisão ativa**: orientada a progresso, com clareza de "o que faço agora?", feedback de avanço e motivação.

### Usuário

Médico em formação (26–32 anos), preparando o ENAMED. Altamente analítico, sob pressão intensa, tempo escasso. Não quer gamificação infantil — quer sentir **competência e controle**. Errar questões tem peso emocional específico nesse contexto.

### Referências de design

- **Readwise** — modelo mental certo: revisão ativa de conhecimento sério, sem infantilização
- **Linear × Notion** — DNA visual: precisão tipográfica + espaço em branco generoso
- **Posição no espectro:** ~38% do eixo frio→lúdico. Preciso como base, expressivo em momentos pontuais.

---

## 2. Princípios de Design

| # | Princípio | Tradução concreta |
|---|-----------|-------------------|
| P1 | **Diagnóstico, não arquivo** | Página abre respondendo "o que revisar agora?" antes de mostrar inventário |
| P2 | **Expressão ganha, não decora** | Cor/animação reservadas para momentos de significado real (caderno zerado, primeiro resolve) |
| P3 | **Respeita o especialista** | Densidade de informação é OK. Simplificar fluxo, não informação. Sem copy condescendente |
| P4 | **Progresso honesto** | Métricas existem para orientar. "3 de 7 resolvidas esta semana" > qualquer badge |
| P5 | **Zero-clique até o primeiro item** | Da entrada na página até revisar a primeira questão: zero cliques extras |

---

## 3. Taxonomia de Motivos de Erro (revisada)

**Princípio:** cada motivo mapeia para uma estratégia de revisão diferente.

### Para respostas erradas (`wasCorrect = false`) — 4 opções

| Motivo UI | DB key | Tag | Estratégia de revisão |
|-----------|--------|-----|-----------------------|
| Não sei o conceito | `did_not_know` | Lacuna | Estudar do zero — Harrison, diretriz, questões comentadas |
| Sabia mas esqueci | `did_not_remember` | Memória | Revisão espaçada — revisitar em 1, 3 e 7 dias |
| Erro de leitura | `reading_error` *(novo)* | Atenção | Técnica de prova, não conteúdo — sublinhar palavras-chave |
| Confundi com outra condição | `confused_alternatives` *(novo)* | Diferencial | Estudo comparativo — tabela de diagnóstico diferencial |

### Para respostas certas (`wasCorrect = true`) — 1 opção

| Motivo UI | DB key | Tag | Estratégia |
|-----------|--------|-----|-----------|
| Acertei sem certeza | `guessed_correctly` | Chute | Tratar como lacuna — estudar para confirmar o porquê |

### Migração de banco (para integração futura — não faz parte do sandbox)

- `did_not_understand` (antigo) → mapear para `confused_alternatives` como default
- Adicionar `reading_error` e `confused_alternatives` ao enum `error_notebook.reason`
- Migration: `UPDATE error_notebook SET reason = 'confused_alternatives' WHERE reason = 'did_not_understand'`
- No sandbox, `errorTypes.ts` define os 5 tipos com chaves string simples — sem acoplamento ao enum do Supabase.

### Cores dos tipos

| Tipo | Cor base | Background chip | Borda | Texto |
|------|----------|-----------------|-------|-------|
| Lacuna | `#f43f5e` | `#fff1f2` | `#fecdd3` | `#be123c` |
| Memória | `#8b5cf6` | `#f5f3ff` | `#ddd6fe` | `#6d28d9` |
| Diferencial | `#3b82f6` | `#eff6ff` | `#bfdbfe` | `#1d4ed8` |
| Atenção | `#f59e0b` | `#fffbeb` | `#fde68a` | `#854d0e` |
| Chute | `#eab308` | `#fefce8` | `#fde047` | `#854d0e` |

---

## 4. Design Tokens

### Cores

```css
--wine:       #a03050;   /* primary brand */
--wine-mid:   #7c2d44;   /* hover / accents */
--wine-dark:  #4a1628;   /* deep variant */
--wine-glow:  rgba(160,48,80,.22);

--ink:        #0f0a0d;   /* darkest bg */
--ink-2:      #1a1018;   /* page header bg */
--ink-3:      #261720;   /* cards sobre ink */

--surface:    #ffffff;
--s2:         #f8f9fb;
--s3:         #f1f3f6;   /* page body bg */
--border:     #e5e7eb;
--border-strong: #d1d5db;

--t1: #111827;  --t2: #374151;
--t3: #6b7280;  --t4: #9ca3af;

--success: #10b981;
--warn:    #f59e0b;
```

### Tipografia

```css
/* Headers editoriais */
.page-title   { font-size: 26px; font-weight: 900; letter-spacing: -.03em; }
.stat-val     { font-size: 30px; font-weight: 900; letter-spacing: -.04em; font-variant-numeric: tabular-nums; }

/* Corpo */
.body-strong  { font-size: 13px; font-weight: 700; }
.body         { font-size: 12.5px; font-weight: 500; }
.caption      { font-size: 11px; font-weight: 500; }
.overline     { font-size: 10px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
```

### Border radius

```css
--radius-sm:  8px;
--radius-md:  11px;
--radius-lg:  14px;
--radius-xl:  18px;
--radius-2xl: 20px;  /* modal */
--radius-pill: 99px;
```

---

## 5. Modal de Adição — `AddToNotebookModal`

### Estrutura

2 etapas em sequência. Etapa 2 é opcional (pode pular).

```
[Header] ← título + meta contextual (Q{n} · {área} · {tema})
[Step indicator] ← pips 1/2 com estado done/active/idle
──────────────────────────────────────────────
[Etapa 1] Selecionar motivo
  → 4 reason cards (wasCorrect=false) ou 1 (wasCorrect=true)
  → Ao selecionar: card expande com dica de estratégia
  → CTA: "Continuar →"
──────────────────────────────────────────────
[Etapa 2] Anotação (opcional)
  → Highlight preview (se selectedHighlight presente)
  → Textarea: 300 chars max, contador visível
  → Link "Pular →" para salvar sem nota
  → CTA: "Salvar no Caderno"
```

### Reason card — anatomy

```
┌─────────────────────────────────────────────────┐
│  [icon 28px] [label 12.5px/700]      [badge pill] │
│  [hint 11px, color: t3, pl: 37px]                 │  ← sempre visível
│  [strategy 11px/600, pl: 37px, color: type]       │  ← só quando selected
└─────────────────────────────────────────────────┘
```

Ícones (SVG Lucide-style, `stroke-width: 1.8`):
- Lacuna: `BookOpen`
- Memória: `RotateCcw`
- Atenção: `EyeOff`
- Diferencial: `Shuffle` (ou scales / compare)
- Chute: `Crosshair`

### Estados especiais

**`wasCorrect = true`:**
- Header: "Acertou, mas quer revisar?"
- Banner amarelo: "Acertou por exclusão ou intuição? Acertar sem domínio é um risco na prova real."
- Apenas 1 reason card (Chute)

**Duplicata detectada:**
- Banner `#fffbeb` no topo do passo 1: "Já está no Caderno — adicionada em {data} como '{motivo}'. Selecione outro para atualizar."
- Motivo atual pré-selecionado
- CTA muda para "Atualizar" (desabilitado até trocar o motivo)

**Salvando:**
- Body dimma (`opacity: 0.4`)
- Botão: spinner + "Salvando…" + `pointer-events: none`
- Botão X desabilitado

**Sucesso:**
- Modal fecha imediatamente
- Toast aparece no canto inferior direito:
  ```
  [✓ icon]  Salvo no Caderno de Erros        [tag colorida do tipo]
             Q{n} · {área} adicionada à fila.
  ```
- `role="status" aria-live="polite"` · auto-dismiss 3000ms

### Props interface

```typescript
interface AddToNotebookModalProps {
  open: boolean;
  onClose: () => void;
  questionId: string;
  simuladoId: string;
  simuladoTitle: string;
  area: string;
  theme: string;
  questionNumber: number;
  questionText: string;
  wasCorrect: boolean;
  userId: string;
  onAdded?: () => void;
  selectedHighlight?: string;
  // novo: para detecção de duplicata
  existingEntry?: { reason: string; addedAt: string } | null;
}
```

---

## 6. Página — `CadernoErrosPage`

### Arquitetura de informação

```
[Dark Header Zone]
  ├── PRO badge + título + subtítulo
  ├── Streak de dias revisando
  ├── 4 big stats (pendentes / resolvidas / total / especialidades)
  └── Progress band (barra + "3 / 7")

[Filter Bar — surface branca]
  ├── Filtro primário: chips por tipo de erro (Todos / Lacuna / Memória / Diferencial / Atenção)
  └── Filtro secundário: chips por especialidade (scroll horizontal em mobile)

[Page Body — surface-3]
  ├── Hero card "Próxima para revisar" (questão mais antiga pendente)
  ├── Seção "Na fila" (pendentes restantes, sem hero)
  └── Seção "Resolvidas" (itens com strikethrough + check verde)
```

### Dark header zone

- Background: `--ink-2` (`#1a1018`)
- Radial glow decorativo atrás dos stats: `rgba(160,48,80,.22)` vindo do canto superior esquerdo
- Stats com números 30px/900, tabular-nums: pendentes em `#fb923c`, resolvidas em `#10b981`
- Progress band: track `rgba(255,255,255,.08)` + fill `linear-gradient(wine-mid → wine)`
- Streak: card com `rgba(255,255,255,.04)` + border `rgba(255,255,255,.08)`

### Filter chips (primários)

```
[Todos 7]  [● Lacuna 2]  [● Memória 1]  [● Diferencial 3]  [● Atenção 1]
```

- Dot colorido (6px) substituindo ícone SVG — mais compacto
- Estado ativo: background + border da cor do tipo, texto escuro
- `role="radiogroup"` + cada chip `role="radio"`

### Hero card (próxima para revisar)

- Background: `--ink` (`#0f0a0d`) com gradiente overlay sutil
- Acento lateral: 3px vertical, `linear-gradient(wine → wine-mid)`
- Conteúdo: Q{n} · {área} — {título}, meta (simulado + data), tag de tipo, bloco de anotação (se existir), botão "Marcar como resolvida" + link "Ver questão completa"
- **Prioridade:** questão pendente mais antiga dentro do filtro ativo (por `created_at` ASC). Se filtro ativo não tiver pendentes, o hero card some e a seção "Na fila" mostra empty state de filtro ("Nenhuma questão desse tipo pendente").

### Entry card (fila)

```
[barra 3px colorida]  [Q{n} · {área} — {tema truncado}]  [tag]  [check button 28px]
                      [{simulado} · {data}]
```

- Barra lateral: cor sólida do tipo (`#f43f5e` Lacuna, `#8b5cf6` Memória, etc.)
- Check button: hover → background verde `#dcfce7`, border `#a7f3d0`, stroke `#10b981`
- `min-height: 44px` para touch

### Entry card (resolvida)

- `opacity: 0.45`
- `text-decoration: line-through` no título
- Check button com estado done permanente

### Empty states

**Caderno vazio (primeiro acesso):**
- Ícone `BookOpen` em container rounded (background `--s3`, border `--border`)
- Título: "Seu Caderno está vazio"
- Desc: "Na correção do simulado, toque em 'Salvar no Caderno' para adicionar questões que quer dominar."
- CTA: "Ver simulados disponíveis" → `/simulados`

**Zero pendentes (tudo resolvido):**
- Background: `--ink` (dark) — contraste visual com estado normal
- Anel verde: `border: 2px solid rgba(16,185,129,.3)` + `background: rgba(16,185,129,.08)`
- Título: "Caderno zerado 🎯" ← único emoji na página, momento de expressão permitido
- Stats: questões resolvidas + streak de dias
- CTA ghost: "Ver questões resolvidas" (lista as resolvidas)

---

## 7. Animações — Spec Completo

Todas respeitam `useReducedMotion()` (Framer Motion hook já presente no projeto).

| Interação | Tipo | Parâmetros | Duração | Reduced motion |
|-----------|------|-----------|---------|----------------|
| Modal entra | spring | `damping:25 stiffness:300 scale:0.95→1 y:16→0` | ~280ms | fade 150ms |
| Modal sai | spring | `damping:25 stiffness:300 scale:1→0.95 y:0→16` | ~220ms | fade 100ms |
| Step 1 → 2 | ease | `[.4,0,.2,1] x:-30%→out / 100%→0 + opacity` | 320ms | instant |
| Resolver questão | spring | `damping:22 stiffness:280 x:0→12 opacity:1→0.4` | ~250ms | opacity jump |
| Checkmark SVG | ease | `stroke-dashoffset:20→0 delay:100ms ease-out` | 300ms | instant fill |
| Hero → próximo | spring | `AnimatePresence mode:wait slideOut/In scale+y` | ~350ms | instant swap |
| Filter chip | ease | `background/border/color .15s` | 150ms | ≤50ms |
| List stagger | spring | `opacity:0→1 y:8→0 staggerChildren:0.04s` | max 300ms | 0ms stagger |
| Toast entra | spring | `damping:20 stiffness:260 y:40→0` | ~300ms | fade 150ms |
| Toast sai | ease | `opacity:1→0 y:0→10 auto-dismiss 3000ms` | 200ms | instant |
| Counter stats | ease | `countUp 600ms ease-out on mount` | 600ms | skip |
| Progress fill | ease | `width:0→N% 800ms ease-out delay:200ms` | 800ms | skip |

---

## 8. Mobile

| Elemento | Desktop | Mobile (< 640px) |
|----------|---------|-----------------|
| Stats | 4 em linha | Grade 2×2 |
| Filter chips | flex-wrap | scroll horizontal (`overflow-x: auto`, sem scrollbar) |
| Filtro especialidade | chips visíveis | oculto, abre via botão "Área ▼" |
| Hero card | botão full label | botão compacto ("Resolver") |
| Modal | centered dialog | bottom sheet (`border-radius: 20px 20px 0 0`, max-height: 90vh) |
| Toast | bottom-right | bottom-center |
| Touch targets | — | mínimo 44×44px em todos os interativos |

---

## 9. Acessibilidade

### Semântica

- Reason cards: `role="radiogroup"` no container, `role="radio" aria-checked` em cada card. Navegação por setas via `onKeyDown`.
- Filter chips: mesma estrutura `radiogroup` / `radio`.
- Progress bar: `role="progressbar" aria-valuenow={resolved} aria-valuemax={total} aria-label="N de M questões resolvidas"`.
- Toast: `role="status" aria-live="polite"`.
- Ícones decorativos: `aria-hidden="true"`.
- Entry check button: `aria-label="Marcar questão {n} como resolvida"`.

### Foco

- Modal: focus trap. Foco inicial no primeiro reason card.
- Escape: fecha modal em qualquer etapa.
- Focus ring: `focus-visible:ring-2 ring-offset-2 ring-wine/50` em todos os interativos.

### Contraste

- Texto sobre `--ink-2`: ratio ≥ 7:1 (WCAG AAA).
- Tags de tipo: não dependem só de cor — sempre têm label texto.

---

## 10. Arquivos a criar (sandbox)

```
src/
├── design-system/
│   ├── tokens.css            # CSS custom properties
│   └── typography.css        # classes tipográficas
├── components/
│   ├── AddToNotebookModal/
│   │   ├── index.tsx
│   │   ├── ReasonCard.tsx
│   │   ├── StepIndicator.tsx
│   │   └── DuplicateBanner.tsx
│   ├── CadernoPage/
│   │   ├── PageHero.tsx       # dark header zone
│   │   ├── FilterBar.tsx      # chips primários + secundários
│   │   ├── HeroNextCard.tsx   # próxima questão destacada
│   │   ├── EntryCard.tsx      # item da fila
│   │   ├── EmptyState.tsx     # primeiro acesso
│   │   └── ZeroPendingState.tsx
│   └── ui/
│       ├── Toast.tsx
│       ├── Chip.tsx
│       └── ProgressBar.tsx
├── hooks/
│   ├── useNotebookEntries.ts  # fetch + filter + sort
│   └── useReviewStreak.ts     # streak de dias
├── data/
│   └── mockEntries.ts         # dados mockados realistas
├── lib/
│   └── errorTypes.ts          # taxonomia revisada (5 tipos)
└── App.tsx                    # monta a página + modal demo
```

### Dados mockados

Mínimo 12 entradas com:
- Distribuição realista de tipos (Lacuna 4x, Diferencial 4x, Memória 2x, Atenção 1x, Chute 1x)
- 2 especialidades (Cardiologia, Infectologia)
- Mix de pendentes (8) e resolvidas (4)
- Algumas com anotação, algumas sem
- Datas espalhadas nos últimos 10 dias

### Interfaces dos hooks

```typescript
// useNotebookEntries.ts
interface UseNotebookEntriesReturn {
  entries: NotebookEntry[];           // todas as entradas
  filtered: NotebookEntry[];          // após filtros ativos
  pending: NotebookEntry[];           // filtered && !resolvedAt
  resolved: NotebookEntry[];          // filtered && resolvedAt
  heroEntry: NotebookEntry | null;    // pending[0] (mais antiga)
  activeTypeFilter: ErrorType | 'all';
  activeSpecFilter: string | null;
  setTypeFilter: (t: ErrorType | 'all') => void;
  setSpecFilter: (s: string | null) => void;
  markResolved: (id: string) => void;
  remove: (id: string) => void;
}

// useReviewStreak.ts
// Streak = nº de dias consecutivos em que ao menos 1 entrada foi marcada como resolvida.
// No sandbox: calculado a partir de resolvedAt nos mockEntries.
// Na integração: persiste em localStorage com fallback para profiles.last_review_date.
interface UseReviewStreakReturn {
  streak: number;  // dias consecutivos
}
```

---

## 11. O que preservar do código existente

- Lógica de `wasCorrect` condicional nos motivos ✓
- `selectedHighlight` pré-preenchido na nota ✓
- Link direto para correção (`/simulados/{id}/correcao?q={n}`) ✓
- Filtro 3-níveis de especialidade (lógica) — UI vai mudar, lógica permanece ✓
- `useReducedMotion()` do Framer Motion ✓
- Enum `DbReason` / mapeamento local→DB (adicionar 2 novos valores) ✓
