# UX/UI — Redesign do Fluxo de Simulados

**Data:** 2026-04-03
**Escopo:** Fluxo completo de simulado — do clique em "Iniciar" até a tela pós-prova
**Tipo:** Auditoria UX + Design de melhorias

---

## Contexto

O enamed-arena é uma plataforma de simulados para residência médica (ENAMED/SanarFlix). O fluxo de prova é o produto central — é onde o usuário passa mais tempo e onde a experiência tem maior impacto na retenção e engajamento.

Esta auditoria foi conduzida analisando o código-fonte (5 páginas, 9 componentes, 7 hooks envolvidos no fluxo) sob a perspectiva de UX e UI sênior, identificando fricções, oportunidades e acertos a preservar.

---

## Diagnóstico por Fase

### Fase 1 — Lista de Simulados (`SimuladosPage`)

**Status:** Atenção

- Botão contextual "Iniciar / Continuar" funciona bem — reconhece o estado do usuário.
- Hierarquia visual entre simulados ativos e passados pode ser mais clara.
- CTAs no card hero vs. timeline podem criar confusão quando múltiplos simulados estão disponíveis.

---

### Fase 2 — Pré-Prova (`SimuladoDetailPage`)

**Status:** Crítico

**Diagnóstico central:** Um usuário recorrente precisa de 9+ interações para iniciar uma prova que já fez antes. O fluxo foi desenhado para o primeiro uso e não se adapta ao veterano.

**Problemas identificados:**

| # | Problema | Severidade |
|---|----------|-----------|
| 2.1 | Checklist de 5 itens obrigatórios sem memória — repete para todo usuário toda vez | Crítico |
| 2.2 | Modal de escolha online/offline aparece com apenas 1 opção ativa (offline desabilitado) | Crítico |
| 2.3 | "Como funciona" ocupa espaço proeminente mesmo para usuários experientes | Atenção |
| 2.4 | Status de ranking (dentro/fora da janela oficial) não tem urgência visual diferenciada | Atenção |

**Acertos a manter:**
- Aviso "prova sem pausa" — essencial e corretamente posicionado
- Botão contextual "Continuar Simulado" — excelente UX

---

### Fase 3 — Interface da Prova (`SimuladoExamPage`)

**Status:** Crítico

**Diagnóstico central:** A interface tem funcionalidades poderosas e subutilizadas. Eliminar alternativas, alta confiança e atalhos de teclado existem no código mas são funcionalmente invisíveis. Uma funcionalidade que não é descoberta não existe para o usuário.

**Problemas identificados:**

| # | Problema | Severidade |
|---|----------|-----------|
| 3.1 | Botão "✕" de eliminar alternativa é minúsculo e sem label — taxa de descoberta próxima de zero | Crítico |
| 3.2 | Botão ⚡ "Alta confiança" sem tooltip nem explicação de propósito ou impacto | Crítico |
| 3.3 | Atalhos de teclado (1-5, ←→, R, H, Esc) não visíveis em nenhum lugar da interface | Crítico |
| 3.4 | Botão "Finalizar" no header ao lado do timer — risco de clique acidental, especialmente mobile | Crítico |
| 3.5 | Navegador de questões escondido em sheet modal no mobile — perde visão geral de progresso | Atenção |
| 3.6 | Cores do navegador (azul/amarelo/verde/branco) sem legenda visível | Atenção |
| 3.7 | Fullscreen ativado automaticamente sem aviso prévio no produto | Atenção |
| 3.8 | Progresso salvo sem feedback visual — usuário não sabe se está sendo sincronizado | Atenção |

**Acertos a manter:**
- Persistência resiliente: localStorage imediato + Supabase debounced + flush no beforeunload
- Marcação para revisão (⚑) — padrão e compreensível
- Timer com mudança de estado progressiva (5 min → warning, 1 min → destructive + pulse)
- Barra de progresso respondidas/total

---

### Fase 4 — Finalização (`SubmitConfirmModal`)

**Status:** Atenção

**Problemas identificados:**

| # | Problema | Severidade |
|---|----------|-----------|
| 4.1 | Modal mostra quantidade de questões em branco mas não quais — usuário não consegue agir sem fechar o modal | Atenção |
| 4.2 | Loading de envio mostra spinner genérico sem etapas de progresso — alta ansiedade em conexões lentas | Atenção |

**Acertos a manter:**
- Resumo (respondidas, revisão, branco, alta confiança) — correto e útil
- Prevenção de fechar modal durante envio — correto
- CTA "Continuar respondendo" disponível até o último momento

---

### Fase 5 — Pós-Prova (`ExamCompletedScreen`)

**Status:** Atenção

**Problemas identificados:**

| # | Problema | Severidade |
|---|----------|-----------|
| 5.1 | Tela de conclusão não celebra a conquista — checkmark + texto plano tratam prova como upload de arquivo | Atenção |
| 5.2 | CTA "Ver resultado" aparece mesmo quando resultados não foram liberados — gera frustração | Atenção |
| 5.3 | Opt-in de notificação por email pouco proeminente para uma funcionalidade tão valiosa | Atenção |

**Acertos a manter:**
- Data de liberação de resultado visível — elimina comportamento de "ficar checando"
- Opt-in de email posicionado no momento de maior engajamento (logo após a prova)

---

## Design das Melhorias

### Bloco A — Mover modal online/offline para antes do checklist (P1 · Baixo esforço)

**Situação atual:** O modal de escolha online/offline aparece como último passo — após o checklist completo na `SimuladoDetailPage`. Isso inverte a ordem lógica: o usuário deveria escolher o modo de prova antes de ler as instruções específicas daquele modo.

**Solução:** Mover o modal de escolha para ser o **primeiro passo** ao clicar em "Iniciar Simulado" na página `/simulados` (no `SimuladoCard` ou diretamente na `SimuladosPage`). O fluxo passa a ser:

```
/simulados
  → clique "Iniciar Simulado"
  → modal online/offline (imediato, antes de qualquer navegação)
  → se online selecionado → navega para /simulados/:id/start (checklist)
  → início da prova
```

- O modal não navega para a detail page — ele aparece sobre a lista, como uma escolha de entrada
- A `SimuladoDetailPage` não precisa mais conhecer o modal; recebe o modo como parâmetro de rota ou state de navegação se necessário no futuro
- Quando offline for lançado, a escolha já está no lugar certo

**Arquivos afetados:** `SimuladoCard.tsx` (ou `SimuladosPage.tsx`), `SimuladoDetailPage.tsx` (remover modal existente)

---

### Bloco B — Discoverability das funcionalidades de prova (P1 · Baixo esforço)

**3 problemas, 1 abordagem unificada: tornar visível o que já existe.**

#### B1 — Eliminar alternativa

- Adicionar tooltip `title="Eliminar esta alternativa"` no botão `✕`
- No hover da opção, mostrar o botão com label visível: `✕ Eliminar`
- Opção eliminada: estilo visual mais claro (fundo acinzentado + texto tachado + badge "Eliminada")

**Arquivo:** `QuestionDisplay.tsx`

#### B2 — Alta confiança

- Adicionar tooltip: "Marque quando tiver certeza da resposta — aparecerá na sua análise de resultados"
- Exibir no `SubmitConfirmModal` a contagem de questões com alta confiança e o percentual de acerto nelas (quando resultado disponível)

**Arquivos:** `QuestionDisplay.tsx`, `SubmitConfirmModal.tsx`

#### B3 — Atalhos de teclado

- Adicionar ícone de teclado (⌨) no `ExamHeader`, à direita do timer
- Clicar abre um dropdown com a tabela de atalhos:

| Tecla | Ação |
|-------|------|
| `1` – `5` | Selecionar alternativa A–E |
| `←` `→` | Questão anterior / próxima |
| `R` | Marcar para revisão |
| `H` | Alta confiança |
| `Esc` | Abrir modal de finalização |

**Arquivo:** `ExamHeader.tsx`

---

### Bloco C — Legenda do navegador de questões (P1 · Baixo esforço)

Adicionar mini legenda abaixo do grid no `QuestionNavigator`:

```
● Respondida  ● Revisão  ⚡ Alta conf.  ○ Em branco
```

Usando as mesmas cores e ícones do grid. Ocupa ~16px de altura.

**Arquivo:** `QuestionNavigator.tsx`

---

### Bloco D — Checklist adaptativo (P2 · Esforço médio)

**Lógica:** verificar se o usuário já possui ao menos uma tentativa finalizada em qualquer simulado (`attempts` onde `user_id = atual` e `status = 'submitted'`, count > 0). Não é específico do simulado atual — basta ter completado qualquer prova antes.

**Novato (primeira prova):** exibe o checklist completo com os 5 itens, botão "Como funciona" proeminente.

**Veterano (já fez ao menos uma prova):** substitui o checklist por um banner resumido:

```
⏱ X questões · Xh de duração · Sem pausa
[Iniciar Simulado]          [ver detalhes ↓]
```

"Ver detalhes" expande o checklist completo para quem quiser rever.

**Arquivos:** `SimuladoDetailPage.tsx`, `useSimuladoDetail.ts` (verificar histórico de tentativas)

---

### Bloco E — Fullscreen no checklist (P2 · Baixo esforço)

Adicionar um item informativo (não-checkbox) no checklist:

> 🖥 "A prova abre em tela cheia para sua concentração. Sair do fullscreen é registrado."

Transforma surpresa em expectativa gerenciada.

**Arquivo:** `SimuladoDetailPage.tsx`

---

### Bloco F — Modal de finalização com questões acionáveis (P2 · Esforço médio)

No `SubmitConfirmModal`, quando houver questões em branco, exibir os números das questões abaixo do aviso:

```
⚠ 13 questões sem resposta
[6] [14] [23] [31] [38] +8 mais →
```

Cada número é clicável: fecha o modal, navega para aquela questão. O usuário resolve sem sair do contexto de decisão.

**Arquivo:** `SubmitConfirmModal.tsx`

---

### Bloco G — Celebração na tela de conclusão (P2 · Esforço médio)

Substituir o checkmark estático por:

1. **Microcelebração:** confetti leve ou animação de spring na entrada (já existe `framer-motion` no projeto)
2. **Título mais impactante:** "Prova entregue! 🎉" em vez de "Simulado concluído!"
3. **Resumo da prova:** "Você respondeu 87 de 100 questões · 32 com alta confiança · 5 para revisão"
4. **Notificação proeminente:** elevar o bloco de opt-in de email, explicar quando e como o aviso chegará
5. **CTA condicional:** mostrar "Ver resultado" apenas quando `simulado.status` indicar resultados liberados. Enquanto não disponível, CTA primário é "Voltar ao calendário" com a data de liberação destacada

**Arquivo:** `ExamCompletedScreen.tsx`

---

### Bloco H — Mini-nav mobile (P2 · Alto esforço)

No mobile, adicionar uma barra fixa no rodapé da tela de questão:

- Mostra as questões em janela deslizante (5 anteriores, atual, 5 próximas)
- Bolinhas coloridas com as mesmas cores do navegador desktop
- Swipe horizontal para navegar
- Toque na bolinha → vai para aquela questão

Substitui a necessidade de abrir o sheet modal para ter consciência de progresso.

**Arquivo:** `QuestionNavigator.tsx` (nova variante mobile)

---

## Princípios que guiam estas melhorias

1. **Discoverability first** — funcionalidade não descoberta não existe
2. **Fluxo adaptativo ao contexto** — novato e veterano têm necessidades diferentes
3. **Reforço emocional positivo** — completar uma prova de residência é uma conquista, tratar como tal
4. **Menos cliques, mais foco** — cada clique antes da prova é ansiedade adicionada
5. **Mobile como cidadão de primeira classe** — o navegador de questões em sheet não é equivalente ao sidebar
6. **CTAs honestos com o estado real** — não mostrar "Ver resultado" sem resultado disponível

---

## Impacto esperado

| Melhoria | Impacto esperado |
|----------|-----------------|
| Remover modal online/offline | −2 cliques no fluxo de início |
| Checklist adaptativo para veterano | −7 cliques para usuários recorrentes |
| Funcionalidades visíveis (B1/B2/B3/C) | +uso de eliminar alternativa e alta confiança; menos abandono por confusão |
| Modal com questões clicáveis | Menos finalizações prematuras com questões em branco evitáveis |
| Celebração pós-prova | Associação emocional positiva com a plataforma; maior retenção |

---

## Priorização

### P1 — Corrigir agora (baixo esforço, alto impacto)

- [ ] Bloco A: Remover modal online/offline
- [ ] Bloco B1: Tornar "eliminar alternativa" visível
- [ ] Bloco B2: Explicar "alta confiança" via tooltip
- [ ] Bloco B3: Expor atalhos de teclado no header
- [ ] Bloco C: Legenda de cores no navegador de questões

### P2 — Próximo sprint (esforço médio, alto impacto)

- [ ] Bloco D: Checklist adaptativo (novato vs veterano)
- [ ] Bloco E: Aviso de fullscreen no checklist
- [ ] Bloco F: Questões em branco clicáveis no modal de finalização
- [ ] Bloco G: Celebração e CTA condicional na tela pós-prova
- [ ] Bloco H: Mini-nav mobile no rodapé

### P3 — Polimento (baixo esforço, impacto menor)

- [ ] Indicador "✓ Salvo" sutil no header durante sync com Supabase
- [ ] Timer: adicionar estado de atenção suave em 15 minutos restantes
- [ ] Countdown regressivo ("em 12 dias") em vez de só data absoluta no pós-prova

---

## Arquivos afetados

| Arquivo | Blocos |
|---------|--------|
| `src/components/SimuladoCard.tsx` (ou `src/pages/SimuladosPage.tsx`) | A (mover modal para cá) |
| `src/pages/SimuladoDetailPage.tsx` | A (remover modal existente), D, E |
| `src/components/exam/ExamHeader.tsx` | B3 |
| `src/components/exam/QuestionDisplay.tsx` | B1, B2 |
| `src/components/exam/QuestionNavigator.tsx` | C, H |
| `src/components/exam/SubmitConfirmModal.tsx` | B2 (resultado), F |
| `src/components/exam/ExamCompletedScreen.tsx` | G |
| `src/hooks/useSimuladoDetail.ts` | D (verificar histórico) |
