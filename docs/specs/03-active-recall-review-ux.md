> Contratos de nomes/enums/eventos/limiares seguem [00-contratos-canonicos.md](00-contratos-canonicos.md) (fonte da verdade).

# Spec 03 — Sessão de Revisão com Recall Ativo

**Produto:** SanarFlix PRO Simulados (ENAMED)
**Feature:** Caderno de Erros — Modo Revisão redesenhado
**Status:** Pronto para Design e Engenharia
**Data:** Junho/2026
**Referências:** `docs/caderno-de-erros-visao-definitiva.md` §§ 4.3, 4.5, 4.6, 4.7; `src/pages/CadernoRevisaoPage.tsx`; `src/sandbox/caderno/`

---

## 0. Contexto e premissa central

O Modo Revisão atual mostra o gabarito imediatamente — o aluno lê, não re-resolve. Esta spec redesenha a sessão para **recall ativo**: o aluno primeiro responde às cegas, depois vê o gabarito, depois autoavalia. A "Dominada" deixa de ser botão autodeclarado e passa a emergir do SRS após acertos espaçados.

A tela de revisão é acionada pelo card hero "Para revisar agora" da página principal (`/caderno-erros`) ou pelo CTA de sessão completa. A URL permanece `/caderno-erros/revisao` (page dedicada com URL, sem modal).

---

## 1. Fluxo da sessão de recall ativo — passo a passo

A sessão é uma máquina de estados linear por questão. Cada questão passa por **5 fases** antes de avançar.

### Fase 0 — Carregamento da sessão

1. Ao entrar em `/caderno-erros/revisao`, `useActiveRecallSession` filtra entradas com `srs_due_at <= now()` e `resolved_at IS NULL`.
2. Ordena por: devidas mais antigas primeiro, depois por `srs_ease` ascendente (mais difíceis primeiro).
3. Carrega `question`, `options`, e metadados da entrada atual. O campo `ai_review_md` é buscado em paralelo (cache hit não bloqueia a UI).
4. Não carrega `correctOptionId` no front até a Fase 3 (a query pode retornar o campo, mas o componente não o lê/exibe antes da revelação). O correto é não expor o gabarito até o momento certo — o componente `RecallQuestionCard` recebe `revealCorrect: boolean` e só destaca quando `true`.

### Fase 1 — Enunciado sem gabarito (pré-resposta)

**O que aparece:** enunciado completo, imagem (se houver), alternativas A–E sem nenhum destaque de cor (todas neutras, borda `border-border`, fundo `bg-card`). Nenhum badge "Sua resposta anterior" visível ainda. Nenhum bloco do Prof. San visível ainda.

**O que o aluno faz:** ler o enunciado e escolher uma alternativa. Pode usar teclado `A`–`E`.

**Estado:** `phase === 'answering'`

**CTA primário:** nenhum botão de confirmação explícito no rodapé — o clique na alternativa já avança para a Fase 2 (com confirmação inline). Atalho: pressionar `A`–`E` seleciona e aguarda confirmação por `Enter` ou segundo clique (ver seção 3).

### Fase 2 — Seleção feita + captura de confiança

Imediatamente após selecionar a alternativa, **antes** de revelar o gabarito, o sistema solicita o nível de confiança da resposta.

**O que aparece:** a alternativa selecionada fica com borda highlight `ring-2 ring-primary/60` (ainda sem verde/vermelho). Abaixo das alternativas surge um bloco inline:

```
┌─────────────────────────────────────────────────────────┐
│  Qual o seu nível de confiança nessa resposta?          │
│                                                         │
│  [Baixa]   [Média]   [Alta]                             │
│   1           2        3                                │
└─────────────────────────────────────────────────────────┘
```

Microcopy: "Seja honesto — isso ajusta sua agenda de revisão."

**Estado:** `phase === 'confidence'`

**Teclas:** `1` = Baixa, `2` = Média, `3` = Alta. Clicar no botão também avança. Nenhum botão de voltar — se o aluno quiser trocar a alternativa, pode clicar em outra alternativa antes de confirmar a confiança (a seleção troca, a confiança ainda não foi gravada).

Ao selecionar a confiança → avança automaticamente para Fase 3.

### Fase 3 — Revelação + análise do Prof. San

**Gatilho:** `confidence` selecionada → sistema chama `record_review_attempt_guarded` (RPC) com `{ entry_id, selected_option_id, was_correct, confidence, self_grade }`. Simultaneamente, o frontend revela o gabarito na UI (não aguarda o RPC; a resposta já está no cliente).

**O que aparece:**
- Alternativas ganham cores: correta → `bg-success/[0.06] border-success/40`; errada escolhida → `bg-destructive/[0.06] border-destructive/40`; demais → neutras.
- Badge "Sua resposta" na alternativa escolhida; badge "Resposta correta" na correta (quando diferentes).
- Racionais por alternativa (de `ai_option_rationales`) aparecem abaixo de cada opção errada.
- Bloco do Prof. San aparece: análise em markdown (`ai_review_md`) com os 3 blocos (🎯 o que cobra / 🧠 por que o gabarito / 📌 pra não repetir) + CTA "Treinar N questões de {tema}". Se `ai_review_md` ainda está carregando, mostra skeleton pulsante (linhas de 3/4, 5/6, 2/3 larguras). Se não há cache, `generateAiReview()` é disparado automaticamente.
- Link "Tirar uma dúvida com o Prof. San" (chat, limite 10/entrada, já implementado).

**Estado:** `phase === 'revealed'`

### Fase 4 — Autoavaliação (4 níveis)

Logo abaixo do bloco do Prof. San, aparece o bloco de autoavaliação:

```
┌─────────────────────────────────────────────────────────┐
│  Como foi?                                              │
│                                                         │
│  [Errei]   [Difícil]   [Bom]   [Fácil]                 │
│    1           2          3       4                     │
└─────────────────────────────────────────────────────────┘
```

Microcopy curto abaixo de cada botão:
- **Errei** — "Não lembrei / errei a resposta"
- **Difícil** — "Acertei com esforço"
- **Bom** — "Acertei com segurança"
- **Fácil** — "Muito fácil, dominado"

Se o aluno errou na Fase 1 (`was_correct === false`), o botão "Fácil" fica desabilitado (disabled + tooltip: "Só disponível quando você acerta"). Isso evita autoavaliações inconsistentes.

**Estado:** `phase === 'self_grade'`

**Teclas:** `1`–`4` mapeiam para Errei/Difícil/Bom/Fácil.

**Nota sobre colisão de teclas:** As teclas `1`–`4` só ficam ativas na Fase 4 (autoavaliação) e as teclas `1`–`3` só ficam ativas na Fase 2 (confiança). O handler de teclado verifica `currentPhase` antes de agir. Não há colisão com `A`–`E` (marcação de alternativa, ativa apenas na Fase 1).

### Fase 5 — SRS agenda + transição para próxima

**Gatilho:** autoavaliação selecionada → sistema chama `schedule_next_review_guarded` (RPC) com `{ entry_id, outcome: self_grade, confidence }`. O RPC atualiza `srs_ease`, `srs_interval`, `srs_reps`, `srs_lapses`, `srs_due_at` e, quando os limiares de domínio são atingidos, seta `mastered_at`.

A entrada some da fila da sessão (atualização otimista). Animação de saída (`exit: { opacity: 0, y: -8 }`, 250ms, respeitando `prefers-reduced-motion`). A próxima questão entra com `initial: { opacity: 0, y: 8 }`.

Se `mastered_at` foi setado pelo RPC (resposta inclui `{ mastered: true }`), o contador "Dominadas" na barra de progresso incrementa com animação de spring. Toast: "Questão dominada! Vai sair da fila por um bom tempo."

Se não dominada: sem toast. O aluno não precisa saber o intervalo exato — só que será agendado.

---

## 2. Mockups textuais de cada estado

### 2.1 Estado: Pré-resposta (Fase 1)

```
┌─ sticky header ──────────────────────────────────────────────────────────┐
│ ← Sair   [🔥 2 dominadas]         3 / 12   ████░░░░░░░░ 25%             │
└──────────────────────────────────────────────────────────────────────────┘

┌─ card questão ───────────────────────────────────────────────────────────┐
│ [● Lacuna]  [Cardiologia › IAM]  [há 3 dias]  ENAMED Simulado #3        │
│                                                                          │
│ Q47                                                                      │
│                                                                          │
│ Sua anotação: "confundi com angina instável"                             │
│                                                                          │
│ [ENUNCIADO COMPLETO DA QUESTÃO]                                          │
│ [imagem se houver]                                                       │
│                                                                          │
│ ○ A  [texto da alternativa A]                                            │
│ ○ B  [texto da alternativa B]                                            │
│ ○ C  [texto da alternativa C]                                            │
│ ○ D  [texto da alternativa D]                                            │
│ ○ E  [texto da alternativa E]                                            │
│                                                                          │
│ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│ Prof. San [avatar oculto / placeholder] — aparece após revelar          │
└──────────────────────────────────────────────────────────────────────────┘

                  [painel fila desktop — ver § 7]

┌─ sticky rodapé ──────────────────────────────────────────────────────────┐
│ [← Anterior]  [🗑]     ←→ A-E navegar e marcar   [Pular →]              │
│          ←  →  A–E marcar   R remover                                   │
└──────────────────────────────────────────────────────────────────────────┘
```

**Notas:** O botão "Já dominei" (D) não existe mais neste estado. O CTA primário emergirá ao selecionar alternativa. "Pular →" navega para a próxima sem registrar — entrada permanece na fila.

---

### 2.2 Estado: Confiança (Fase 2)

```
┌─ card questão — mesma estrutura, alternativa C marcada ──────────────────┐
│ ...enunciado...                                                          │
│                                                                          │
│ ○ A  [texto]                                                             │
│ ○ B  [texto]                                                             │
│ ◉ C  [texto]  ← ring highlight (sem verde/vermelho ainda)               │
│ ○ D  [texto]                                                             │
│ ○ E  [texto]                                                             │
│                                                                          │
│ ┌── Qual o seu nível de confiança nessa resposta? ────────────────────┐  │
│ │  Seja honesto — isso ajusta sua agenda de revisão.                  │  │
│ │                                                                     │  │
│ │  [  Baixa  ]   [  Média  ]   [  Alta  ]                            │  │
│ │      1              2             3                                 │  │
│ └─────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘

┌─ sticky rodapé ──────────────────────────────────────────────────────────┐
│ [← Anterior]  [🗑]     1-3 confiança                                    │
└──────────────────────────────────────────────────────────────────────────┘
```

---

### 2.3 Estado: Revelação + Prof. San (Fase 3)

```
┌─ card questão ───────────────────────────────────────────────────────────┐
│ ...meta / enunciado...                                                   │
│                                                                          │
│ ✗ A  [texto]  — "Por que não: ..."  (rationale da IA)                   │
│ ✗ B  [texto]  — "Por que não: ..."                                       │
│ ✗ C  [texto]  ← [Sua resposta ✗]                                        │
│ ✓ D  [texto]  ← [Resposta correta ✓]                                    │
│ ✗ E  [texto]  — "Por que não: ..."                                       │
│                                                                          │
│ ● Você marcou C. Vamos entender por que a resposta era D.               │
└──────────────────────────────────────────────────────────────────────────┘

┌─ card Prof. San ─────────────────────────────────────────────────────────┐
│ [avatar Prof. San]  Prof. San                                            │
│                     Análise personalizada dessa questão.                │
│                                                    [Gerar de novo]      │
│                                                                          │
│  🎯 O que essa questão cobra                                             │
│  [conteúdo markdown]                                                     │
│                                                                          │
│  🧠 Por que D é o gabarito                                               │
│  [conteúdo markdown]                                                     │
│                                                                          │
│  📌 Para não repetir esse erro                                           │
│  [conteúdo markdown]                                                     │
│                                                                          │
│  → Treinar 5 questões de IAM com supra de ST                            │
│                                                                          │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─    │
│  [Tirar uma dúvida com o Prof. San]                                      │
│                                                                          │
│  ┌── Como foi? ──────────────────────────────────────────────────────┐   │
│  │  [  Errei  ]  [  Difícil  ]  [  Bom  ]  [  Fácil  ]             │   │
│  │      1             2             3           4                   │   │
│  └───────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────┘

┌─ sticky rodapé ──────────────────────────────────────────────────────────┐
│ [← Anterior]  [🗑]     1-4 autoavaliação   [Pular sem avaliar →]        │
└──────────────────────────────────────────────────────────────────────────┘
```

**Microcopy do rodapé enquanto autoavaliação não ocorreu:** "Avalie para continuar" (o botão Próxima fica cinza até a autoavaliação ser feita). "Pular sem avaliar" sempre disponível como escape — não bloqueia fluxo.

---

### 2.4 Estado: Transição entre questões

Duração: 250ms. `AnimatePresence mode="wait"`. Questão saindo: `{ opacity: 0, y: -8 }`. Questão entrando: `{ opacity: 0, y: 8 }` → `{ opacity: 1, y: 0 }`. Com `prefers-reduced-motion`: apenas opacity, sem y.

Barra de progresso no header anima `width` suavemente (`transition-[width] duration-500 ease-out`).

Se `mastered_at` foi setado:
```
[toast] "Dominada! Q47 sai da fila por um bom tempo."  ← aparece 500ms após a transição
```

---

### 2.5 Estado: Fim de sessão (SessionSummary revisado)

```
┌── Sessão concluída ──────────────────────────────────────────────────────┐
│  ✓ Sessão concluída                                                      │
│                                                                          │
│  Mandou bem!                                                             │
│  Você dominou 4 questões em 18 minutos.                                  │
│                                                                          │
│  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐                                │
│  │  4   │  │  3   │  │  5   │  │  18m │                                │
│  │ Dom. │  │ Agend│  │ Rest.│  │ Tempo│                                │
│  └──────┘  └──────┘  └──────┘  └──────┘                                │
│                                                                          │
│  [barra de progresso]  33% da meta da sessão  4/12                     │
└──────────────────────────────────────────────────────────────────────────┘

┌── Áreas trabalhadas ──────────────────────────────────────────────────────┐
│  Cardiologia       ✓ 2                                                    │
│  Clínica Médica    ✓ 1                                                    │
│  Pneumologia       ✓ 1                                                    │
└──────────────────────────────────────────────────────────────────────────┘

┌── Prof. San — insight da sessão ─────────────────────────────────────────┐
│  [avatar]  "Hoje você dominou 4 lacunas em Cardiologia. Se continuar     │
│             nesse ritmo, essas áreas vão aparecer bem mais fáceis na     │
│             prova. Próxima sessão: 3 questões vencerão amanhã."          │
└──────────────────────────────────────────────────────────────────────────┘
<!-- NOTA: bloco acima é (Fase 2) — ver nota abaixo -->

[← Voltar ao caderno]          [⚡ Treinar mais um simulado →]
```

**Nota sobre o insight do Prof. San no resumo (Fase 2):** na **Fase 1**, este bloco não aparece. O `SessionSummary` exibe apenas estatísticas locais da sessão (dominadas / agendadas / restantes / tempo / top-áreas), sem chamada de IA. Na **Fase 2**, o bloco será gerado via edge function `gemini-caderno-session-insight` com os dados da sessão (`dominated_count`, `top_areas`, `mastered_ids`, `next_due_date`). Deve ser leve (< 2 frases), encorajador e com uma informação concreta ("Próxima sessão: N questões vencem em X"). Se a geração falhar, o bloco é omitido silenciosamente (sem erro na UI).

**Label "Revisar depois" → "Agendadas":** o campo `snoozed` passa a se chamar `scheduled` na nova versão. O SRS agenda automaticamente; o aluno não escolhe o intervalo manualmente. "Agendadas" = entradas que saíram desta sessão com novo `srs_due_at`.

---

## 3. Mapa completo de atalhos de teclado

### Tabela resolvida (sem colisões)

| Tecla | Fase ativa | Ação |
|-------|-----------|------|
| `A` | 1 (answering) | Seleciona alternativa A |
| `B` | 1 (answering) | Seleciona alternativa B |
| `C` | 1 (answering) | Seleciona alternativa C |
| `D` | 1 (answering) | Seleciona alternativa D |
| `E` | 1 (answering) | Seleciona alternativa E |
| `Enter` | 1 (após seleção) | Confirma e avança para confiança |
| `1` | 2 (confidence) | Confiança Baixa |
| `2` | 2 (confidence) | Confiança Média |
| `3` | 2 (confidence) | Confiança Alta |
| `1` | 4 (self_grade) | Autoavaliação: Errei |
| `2` | 4 (self_grade) | Autoavaliação: Difícil |
| `3` | 4 (self_grade) | Autoavaliação: Bom |
| `4` | 4 (self_grade) | Autoavaliação: Fácil |
| `→` | Todas | Pular/próxima (sem gravar autoavaliação se fase < 4) |
| `←` | Todas | Voltar à questão anterior |
| `R` | Todas (fora de input) | Remover do caderno (com undo) |
| `Esc` | 3 (chat aberto) | Fechar chat do Prof. San |
| `Enter` (chat) | 3 (chat aberto) | Enviar mensagem (sem Shift) |

**Conflito resolvido:** `D` era "Já dominei" — esta função não existe mais como atalho. A tecla `D` passa a marcar alternativa D (Fase 1). Não há risco de ambiguidade porque a lógica só ativa `A`–`E` quando `phase === 'answering'` e nenhum input/textarea está focado.

**Conflito resolvido:** `1`–`3` servem tanto para confiança quanto para autoavaliação (que vai até `4`). O handler verifica `currentPhase` antes de agir. Nunca há duas fases ativas simultaneamente.

**`J` (snooze antigo):** removido — o SRS agenda automaticamente. O dropdown de snooze manual some. Fica disponível apenas no menu "..." como opção de override ("Adiar manualmente").

**Legenda visível no rodapé** (desktop, md+): mostra teclas ativas na fase atual dinamicamente.

```
Fase 1:  A–E selecionar    →  pular    R remover
Fase 2:  1–3 confiança     ← →  anterior/pular
Fase 3:  1–4 autoavaliar   Esc fechar chat
```

---

## 4. Card hero "Para revisar agora" e início de sessão

### 4.1 Posicionamento na página principal

Na página `/caderno-erros` (aba Revisar), imediatamente abaixo do `PageHero` (stats + streak) e acima dos filtros, aparece o `HeroNextCard` quando existem entradas com `srs_due_at <= now()`.

**Layout do card reformulado:**

```
┌─ HeroNextCard ───────────────────────────────────────────────────────────┐
│  PARA REVISAR AGORA · 7 questões vencidas                               │
│  ─────────────────────────────────────────────────────────────────────  │
│  Q47 · Cardiologia — IAM com supra de ST        [● Lacuna]              │
│  ENAMED Simulado #3 · vence hoje                                        │
│                                                                          │
│  "confundi com angina instável"  ← nota do aluno (itálico)              │
│                                                                          │
│  [⚡ Iniciar sessão de revisão (7)]        [Ver questão →]              │
└──────────────────────────────────────────────────────────────────────────┘
```

**Variação quando há apenas 1 questão vencida:** botão primário é "Revisar esta questão". Quando 2–5: "Iniciar sessão ({N})". Quando >5: "Iniciar sessão ({N} questões para hoje)".

### 4.2 O que acontece ao clicar "Iniciar sessão"

1. Navega para `/caderno-erros/revisao`.
2. `useActiveRecallSession` carrega todas as entradas com `srs_due_at <= now()` + `resolved_at IS NULL`, ordenadas conforme descrito no §1.
3. Dispara `trackEvent('caderno_recall_session_started', { due_count, total_pending })`.

### 4.3 Sessão completa vs. sessão das devidas

O botão no hero inicia sessão apenas com as **devidas hoje** (`srs_due_at <= now()`). O CTA secundário "Modo revisão completo" (abaixo do hero, próximo aos filtros) inicia sessão com todas as entradas pendentes, independente do `srs_due_at`. A URL é a mesma (`/caderno-erros/revisao`); a diferença é um query param `?mode=due` vs. `?mode=all`. Padrão (sem param): modo `due`.

---

## 5. SessionSummary revisado

Além do que já existe em `CadernoRevisaoPage.tsx` (`SessionSummary` atual), as mudanças são:

| Campo atual | Campo novo | Mudança |
|-------------|-----------|---------|
| `dominated` | `dominated` | sem alteração (agora emergido do SRS, não autodeclarado) |
| `snoozed` | `scheduled` | renomeado — SRS agendou automaticamente |
| `remaining` | `remaining` | sem alteração |
| `elapsedMs` / minutos | sem alteração | |
| `topAreas` (3 áreas) | `topAreas` + por erro/domínio | acrescenta quantas foram dominadas vs. apenas revisadas por área |
| — | `nextDueDate` | "Próxima revisão: amanhã / em 2 dias / etc." |
| — | `insight` (string) | frase do Prof. San (gerada por edge fn) — **(Fase 2)** |

**Estrutura do bloco de insight (Fase 2):**

> **Na Fase 1, o bloco de insight do Prof. San não é renderizado.** O `SessionSummary` da Fase 1 exibe apenas estatísticas locais da sessão (dominadas / agendadas / restantes / tempo / top-áreas), sem nenhuma chamada de IA. O bloco abaixo e a edge function `gemini-caderno-session-insight` entram na **Fase 2**.

```tsx
// (Fase 2) Novo bloco após topAreas, antes dos CTAs
{insight && (
  <div className="rounded-2xl border border-primary/15 bg-primary/[0.04] p-4 flex items-start gap-3">
    <ProfSanorAvatar size={36} />
    <p className="text-body-sm text-foreground/85 italic leading-relaxed">
      "{insight}"
    </p>
  </div>
)}
```

**CTAs do resumo:**

- Primário: "Treinar mais um simulado →" (`/simulados`)
- Secundário: "← Voltar ao caderno" (`/caderno-erros`)
- Terciário (se `remaining > 0`): "Continuar revisão (N restantes)" — reinicia a sessão

---

## 6. Estados gerais

### 6.1 Loading (skeleton)

Antes de `loadingList` resolver:

```
[header skeleton  ████████████████████████████ h-12]
[card skeleton    ████████████████████████████ h-64]
[card skeleton    ████████████████████████████ h-32]
```

Usa `SkeletonCard` existente. Classe `animate-pulse`. Três cards com alturas h-12, h-64, h-32 (simulam header de progresso + questão + Prof. San). Tempo máximo esperado: < 800ms (dados já estão em cache via React Query).

### 6.2 Vazio — nunca adicionou (`EmptyState`)

Condição: `entries.length === 0` e nenhuma atividade anterior. Reusa `EmptyState` do sandbox.

```
[ícone livro aberto]
Seu Caderno está vazio

Na correção do simulado, toque em "Salvar no Caderno"
para adicionar questões que quer dominar.

[Ver simulados disponíveis →]
```

### 6.3 Zero pendentes — Caderno zerado (`ZeroPendingState`)

Condição: `entries.length > 0` mas todas com `srs_due_at > now()` ou `mastered_at IS NOT NULL`.

```
[ícone check círculo verde]
Caderno zerado 🎯

{N} questões dominadas. {streak} dias seguidos revisando.
Próxima revisão: amanhã / em {N} dias ({data}).

[Ver questões resolvidas]   [Treinar um simulado →]
```

O campo "Próxima revisão" é calculado como o menor `srs_due_at` entre todas as entradas com `mastered_at IS NULL`. Se todas forem dominadas: "Todas as questões estão dominadas. Que honra."

### 6.4 Filtro sem resultado

Condição: filtros ativos mas nenhuma entrada corresponde.

```
[ícone lupa]
Nenhuma questão com esse filtro.

Mostrando: Lacuna · Cardiologia · Pendentes

[Limpar filtros]
```

Botão "Limpar filtros" reseta `activeTypeFilter` e `activeSpecFilter` para `'all'` / `null`.

### 6.5 Erro de carregamento

```
[ícone triângulo de aviso]
Não foi possível carregar o caderno.

Verifique sua conexão e tente novamente.

[Tentar novamente]   [← Voltar]
```

Reusa `EmptyState variant="error"` existente. `onRetry` dispara novo `fetchPending()`.

---

## 7. Paridade mobile

### 7.1 Painel de fila (desktop-only → mobile)

**Desktop (lg+):** painel lateral sticky `SessionPanel` em coluna direita de 288px, fixo com `lg:sticky lg:top-16`.

**Mobile/tablet (< lg):** o painel de fila **não aparece lateralmente**. Em vez disso:
- No header sticky, ao lado do contador "3/12", um botão "Fila ▾" (ícone `List`) abre um **bottom sheet** com a lista de questões da sessão.
- Bottom sheet: slide-up de 60vh, handle de arraste, scroll interno, mesmo conteúdo do `SessionPanel`.
- Implementação: `Sheet` do shadcn/ui (side="bottom"). Pode ser composto sobre o `SessionPanel` existente.

```
┌─ mobile header ──────────────────────────────┐
│ ← Sair   [🔥2]   3/12  [Lista ▾]  ████░ 25% │
└──────────────────────────────────────────────┘
```

### 7.2 Action bar mobile

No mobile, a action bar do rodapé é reorganizada para caber em tela estreita:

```
[← Ant]  [🗑]           [Pular →]
         [CTA principal: varia por fase]
```

CTA principal por fase:
- Fase 1 (nenhuma alternativa selecionada): desabilitado (visualmente cinza), texto "Selecione uma alternativa"
- Fase 1 (alternativa selecionada): "Confirmar resposta" (entra na Fase 2)
- Fase 2 (confiança): os 3 botões de confiança substituem o CTA primário (layout 3 colunas)
- Fase 3 (revelação): nenhum CTA forçado; o aluno rola para ver autoavaliação
- Fase 4 (autoavaliação): os 4 botões substituem o CTA (2+2 em grid 2×2)

### 7.3 Gestos mobile

| Gesto | Ação | Fase |
|-------|------|------|
| Swipe horizontal direita | Próxima questão (equivale a →) | Fase 1 |
| Swipe horizontal esquerda | Questão anterior (equivale a ←) | Todas |
| Tap na alternativa | Seleciona (mesmo que clique) | Fase 1 |
| Tap nos botões de confiança | Seleciona e avança | Fase 2 |
| Tap nos botões de autoavaliação | Seleciona e avança | Fase 4 |

Swipe é detectado via `onTouchStart`/`onTouchEnd` com threshold de 60px horizontal, 30px máximo vertical (evita scroll acidental). Com `prefers-reduced-motion`, swipe ainda funciona mas sem animação de deslize.

### 7.4 Enunciado longo no mobile

O card da questão usa `max-h-[50vh] overflow-y-auto` no mobile para que enunciados longos não empurrem a action bar para fora da viewport. No desktop, a rolagem é da página inteira (sem altura máxima no card).

---

## 8. Integração do Prof. San no novo fluxo

### 8.1 Quando o Prof. San aparece

| Momento | O que aparece | Estado do avatar |
|---------|--------------|-----------------|
| Fase 1 (pré-resposta) | Não aparece — nem placeholder | — |
| Fase 2 (confiança) | Não aparece | — |
| Fase 3 (revelação), IA em cache | Bloco completo instantâneo | Avatar estático (`animated=false`) |
| Fase 3 (revelação), IA gerando | Skeleton pulsante de 4 linhas | Avatar animado (`animated=true`, halo pulsante) |
| Fase 3, IA pronta | Conteúdo markdown com fade-in | Avatar estático |
| Fase 3, chat aberto | Chat abaixo da análise | Avatar estático |
| Chat, aguardando resposta | "Prof. San pensando…" + spinner | — (não duplicar avatar) |
| SessionSummary | Bloco de insight (1–2 frases) — **(Fase 2)** | Avatar 36px estático |

### 8.2 Estado "pensando" (geração da IA)

```tsx
// Skeleton da análise do Prof. San
<div className="mt-5 space-y-3 animate-pulse">
  <div className="h-3 w-3/4 rounded bg-primary/10" />
  <div className="h-3 w-full rounded bg-primary/10" />
  <div className="h-3 w-5/6 rounded bg-primary/10" />
  <div className="h-3 w-2/3 rounded bg-primary/10" />
</div>
```

O texto "Prof. San pensando…" aparece no topo do bloco, abaixo do header nome/avatar:

```
Prof. San  [Análise personalizada dessa questão.]
           [            Prof. San pensando…  ⟳ ]
           [████████████████████ animate-pulse   ]
           [███████████████████████████████████  ]
```

### 8.3 Chat — comportamento existente mantido

- Limite 10 mensagens por entrada (`CHAT_LIMIT_PER_ENTRY = 10`).
- Guard-rail: respostas off-topic são redirecionadas ("Só posso responder sobre essa questão ou sobre medicina clínica relacionada.").
- Histórico em memória por questão (reset ao trocar).
- Badge contador `{usado}/{10}` com cor: verde → laranja (≥8) → vermelho (=10).
- Tecla `Esc` fecha o chat; `Enter` sem Shift envia a mensagem.
- O chat só aparece após `ai_review_md` estar disponível (não há chat sem análise base).

### 8.4 Insight macro no SessionSummary **(Fase 2)**

> **Na Fase 1, esta seção não se aplica.** O `SessionSummary` da Fase 1 não chama nenhuma edge function de insight; exibe apenas dados locais da sessão.

Edge function `gemini-caderno-session-insight` (nova, lightweight) — **Fase 2**. Payload: `{ student_name, dominated_count, scheduled_count, top_areas, session_minutes, next_due_date }`. Retorna `{ insight: string }`. Chamada dispara após `setFinished(true)`. Falha silenciosa: bloco omitido.

---

## 9. Decomposição de componentes

### 9.1 Tabela de componentes

| Componente | Origem | Status na fusão | O que muda |
|-----------|--------|-----------------|------------|
| `PageHero` | sandbox | **Migrar para produção** | Adicionar `nextDueCount` prop; conectar a dados reais via `useNotebookEntries` de produção; substituir tokens CSS por variáveis Tailwind do design system (`var(--wine)` → `text-wine bg-wine/10` etc.) |
| `HeroNextCard` | sandbox | **Migrar + reformular** | Adicionar CTA "Iniciar sessão (N)"; mostrar nota do aluno; conectar a dados reais; migrar tokens CSS para Tailwind |
| `EntryCard` | sandbox | **Migrar para produção** | Adicionar status SRS ("volta em 3d") no rodapé; quick actions (Revisar / Flashcard / Aula / ...); preview expansível inline; migrar tokens CSS para Tailwind |
| `FilterBar` | sandbox | **Migrar para produção** | Adicionar faixa de status (Devidas / Em aprendizado / Agendadas / Dominadas); estado ativo sempre visível; migrar tokens CSS para Tailwind |
| `EmptyState` (sandbox) | sandbox | **Migrar, renomear** | Substituir `EmptyState` de produção (src/components/EmptyState.tsx) ou unificar como variante `variant="notebook-empty"` |
| `ZeroPendingState` | sandbox | **Migrar para produção** | Adicionar campo "Próxima revisão: {data}"; CTA secundário "Treinar simulado" |
| `Chip` | sandbox | **Migrar para produção** | Usar shadcn/Badge como base ou manter como componente próprio; adicionar suporte a `aria-checked` e navegação por setas de teclado no radiogroup |
| `ProgressBar` | sandbox | **Migrar para produção** | Já é bom; unificar com o progress bar inline do `SessionPanel` |
| `SessionPanel` | produção | **Manter, expandir** | Adicionar bottom sheet wrapper para mobile; ícone de status por fase (respondendo / revelado / dominado) |
| `SessionSummary` | produção | **Atualizar** | Renomear `snoozed` → `scheduled`; adicionar `nextDueDate`; CTA "Continuar revisão"; bloco de insight Prof. San **(Fase 2)** |
| `CadernoRevisaoPage` / `CadernoRevisaoContent` | produção | **Refatorar motor** | Extrair `useActiveRecallSession`; adicionar FSM de fases (answering/confidence/revealed/self_grade); remover "Já dominei" como CTA manual; remover snooze manual de 1/3/7d; adicionar handlers de recall |
| `RecallQuestionCard` | novo | **Criar** | Card de questão com prop `revealCorrect: boolean`; quando false, todas as alternativas neutras; quando true, destaca correta/errada; encapsula as alternativas + racionais |
| `ConfidenceSelector` | novo | **Criar** | Bloco inline com 3 botões (Baixa/Média/Alta) + atalhos 1-3; aparece em `phase === 'confidence'` |
| `SelfGradeSelector` | novo | **Criar** | Bloco inline com 4 botões (Errei/Difícil/Bom/Fácil) + atalhos 1-4; Fácil desabilitado se `was_correct === false` |
| `ProfSanorAvatar` | produção | **Sem alteração** | Já suporta `animated: boolean` |
| `AddToNotebookModal` | sandbox | **Migrar** | Já está bem implementado no sandbox; acoplar ao fluxo de produção |

### 9.2 Novos hooks

| Hook | Responsabilidade |
|------|-----------------|
| `useActiveRecallSession` | Carrega fila, gerencia `currentIndex`, `phase`, `selectedOptionId`, `confidence`, `selfGrade`; coordena chamadas a `record_review_attempt_guarded` e `schedule_next_review_guarded` |
| `useRecallKeyboard` | Registra listeners de teclado; verifica `currentPhase` antes de agir; evita colisões |

`useExamFlow` **não é reusado** aqui — a sessão de revisão tem lógica de fases própria e não tem timer nem controle de fullscreen.

---

## 10. Acessibilidade (WCAG AA)

### 10.1 Estrutura de foco

- Na transição entre questões, o foco é movido para o `h2` do card da questão (`Q{n}`) via `ref.focus()` após a animação de entrada concluir. Isso garante que leitores de tela anunciem a nova questão.
- Em mobile, o bottom sheet do `SessionPanel` usa `FocusTrap` (Radix Dialog interno do shadcn Sheet) para manter o foco dentro do sheet enquanto aberto.
- Chat: foco movido para o `textarea` ao abrir o chat (`setChatOpen(true)` → `requestAnimationFrame(() => textareaRef.current?.focus())`).

### 10.2 Contraste

- Texto principal sobre fundo card (`bg-card`): `text-foreground` — relação mínima 7:1 (AA grande texto ≥ 4.5:1, AA normal ≥ 7:1 quando possível).
- Badge "Lacuna" (vermelho `#be123c` sobre `#fff1f2`): ratio ≈ 5.5:1 — passa AA para texto normal.
- Badge "Memória" (roxo `#6d28d9` sobre `#f5f3ff`): ratio ≈ 7:1 — passa AAA.
- Botões de confiança/autoavaliação: usar `text-foreground` sobre `bg-card` no estado normal, `text-primary-foreground` sobre `bg-primary` no estado ativo — verificar no Storybook.
- Muted text (`text-muted-foreground`): usar apenas para informação redundante; nunca para texto único portador de informação crítica.

### 10.3 ARIA

| Elemento | ARIA |
|---------|------|
| Alternativas (A–E) | `role="radio"` em grupo `role="radiogroup" aria-label="Alternativas"` |
| Botões de confiança | `role="radio"` em grupo `role="radiogroup" aria-label="Nível de confiança"` |
| Botões de autoavaliação | `role="radio"` em grupo `role="radiogroup" aria-label="Autoavaliação"` |
| Barra de progresso header | `role="progressbar" aria-valuenow={n} aria-valuemax={total} aria-label="Progresso da sessão"` |
| Painel de fila | `role="navigation" aria-label="Fila da sessão"` |
| Avatar Prof. San | `role="img" aria-label="Prof. San"` |
| Estado "pensando" | `aria-live="polite"` no container da análise (anuncia quando o conteúdo aparecer) |
| Chat bottom | `aria-live="polite"` na área de mensagens |
| Badge contador dominadas | `aria-label="{N} dominadas nesta sessão"` |
| Tooltip de atalho | `title` + `TooltipContent` (já implementado) |

### 10.4 Navegação por teclado

- Todo o fluxo deve ser completável sem mouse.
- Ordem de foco: header → card questão (alternativas) → confiança/autoavaliação → Prof. San → chat → rodapé (← | 🗑 | →).
- Alternativas e botões de confiança/avaliação dentro de `radiogroup`: navegação por setas (↑↓ ou ←→) além dos atalhos de letra/número.
- Atalhos globais (`A`–`E`, `1`–`4`, `←→`, `R`) só disparam quando nenhum elemento interativo está focado (verifica `document.activeElement.tagName` — skip se `INPUT`, `TEXTAREA`, `SELECT` ou `[contenteditable]`).

### 10.5 prefers-reduced-motion

- `useReducedMotion()` do Framer Motion já em uso na produção — manter.
- Regra: com `reduced = true`, todas as animações de posição (`y`, `scale`) são removidas; apenas `opacity` é mantida (duração 150ms).
- O swipe de gestos no mobile ainda funciona funcionalmente; apenas a animação visual de deslize é suprimida.
- `animate-pulse` (skeleton): respeitar `@media (prefers-reduced-motion: reduce) { animation: none }` — adicionar ao global CSS ou via classe Tailwind `motion-safe:animate-pulse`.

---

## Apêndice A — Chamadas de API por fase

| Fase | Chamada | Momento |
|------|---------|---------|
| Carregamento da sessão | `simuladosApi.getErrorNotebook(userId)` (filtrando `srs_due_at <= now`) | Entrada em `/caderno-erros/revisao` |
| Carregamento da questão | `simuladosApi.getErrorNotebookEntryForReview(entryId, userId)` | Ao mudar `currentIndex` |
| Geração de IA (se sem cache) | `supabase.functions.invoke('gemini-error-notebook-review', {...})` | Fase 3, se `ai_review_md` nulo |
| Registro do attempt | `supabase.rpc('record_review_attempt_guarded', { entry_id, selected_option_id, was_correct, confidence, self_grade })` | Ao confirmar confiança (Fase 2→3) |
| Agendamento SRS | `supabase.rpc('schedule_next_review_guarded', { entry_id, outcome: self_grade, confidence })` | Ao confirmar autoavaliação (Fase 4→5) |
| Chat | `supabase.functions.invoke('gemini-error-notebook-chat', {...})` | Ao enviar mensagem (Fase 3) |
| Insight de sessão **(Fase 2)** | `supabase.functions.invoke('gemini-caderno-session-insight', {...})` | Ao entrar em `finished === true` — **não implementar na Fase 1** |
| Tracking | `trackEvent(...)` | Em cada transição de fase relevante |

`record_review_attempt_guarded` **não bloqueia a revelação** (Fase 3). A UI revela o gabarito imediatamente; a gravação é fire-and-forget com tratamento de erro silencioso (toast de erro apenas se crítico).

`schedule_next_review_guarded` **bloqueia a transição** para a próxima questão (o aluno viu a autoavaliação, esperamos confirmar o agendamento antes de avançar). Spinner inline no botão de autoavaliação enquanto aguarda. Timeout de 3s: se o RPC não responder, avança mesmo assim com toast de aviso.

---

## Apêndice B — Microcopy consolidado (PT-BR)

| Contexto | Texto |
|---------|-------|
| Header confiança | "Qual o seu nível de confiança nessa resposta?" |
| Subtexto confiança | "Seja honesto — isso ajusta sua agenda de revisão." |
| Header autoavaliação | "Como foi?" |
| Botão Errei | "Errei" + subtitle "Não lembrei / errei a resposta" |
| Botão Difícil | "Difícil" + subtitle "Acertei com esforço" |
| Botão Bom | "Bom" + subtitle "Acertei com segurança" |
| Botão Fácil | "Fácil" + subtitle "Muito fácil, dominado" |
| Fácil desabilitado | tooltip: "Só disponível quando você acerta" |
| Toast dominada | "Dominada! Q{n} sai da fila por um bom tempo." |
| Toast agendada | (sem toast — silencioso) |
| Pular sem avaliar | "Pular sem avaliar" (link discreto, não botão primário) |
| Próxima não disponível | "Avalie para continuar" (disabled state) |
| Caderno zerado — próxima revisão | "Próxima revisão: amanhã" / "em {N} dias ({data por extenso})" |
| Chat — limite atingido | "Você já fez {10} perguntas sobre essa questão. Quando dominar, pode treinar mais com os simulados sugeridos." |
| Prof. San — pensando | "Prof. San pensando…" |
| Prof. San — insight sessão **(Fase 2)** | Gerado pela IA; template: "{elogio neutro}. {dado concreto da sessão}. {próxima ação}." — não gerado na Fase 1 |
