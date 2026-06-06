# 08 — Plano de Integração da Plataforma ao novo Caderno de Erros

**Objetivo:** (1) substituir a experiência antiga do Caderno pela nova em definitivo; (2) implementar em **todas as páginas e features que alimentam o Caderno** o necessário para que o novo loop pedagógico feche de ponta a ponta. Status: plano para Design + Eng.

---

## 0. A tese do loop (o que precisa existir para o caderno fazer sentido)

O novo Caderno é um motor de **revisão ativa espaçada**. Ele só funciona se o loop completo existir:

```
CAPTURAR            →  ORGANIZAR        →  REVISAR (SRS)     →  VOLTAR
erro/favorito/nota     triagem + causa     recall ativo         lembrete + home
(prova/correção)       (auto + manual)     (devidas hoje)       (push/email/badge)
```

Hoje o **meio** do loop (organizar + revisar) está completo e premium. As **pontas** (capturar em toda a plataforma; e voltar via lembretes/surfacing) estão incompletas — e sem elas o SRS é invisível (as revisões vencem sem ninguém ver). Este plano fecha as pontas e aposenta a versão antiga.

---

## PARTE 1 — Cutover: substituir a experiência antiga

### 1.1 Estado atual (fork)
- **Novo (canônico):** `/caderno` (+ `/caderno/revisao|favoritos|anotacoes|flashcards|insights`, `/caderno/reta-final`, `/caderno/treino`, `/simulados/:id/triagem`) — atrás de `useCadernoV2Flag` (hoje só na conta de teste).
- **Antigo (a aposentar):** `/caderno-erros` (`CadernoErrosPage`), `/caderno-erros/revisao` (`CadernoRevisaoPage`), `AddToNotebookModal.tsx` (modal antigo na correção), componentes legados (`QueueRow`, `HeroStatusCard`, `helpers.ts`), e o protótipo `src/sandbox/caderno/*`.
- **Dado:** ambos usam a MESMA tabela `error_notebook` → **não há migração de dados** no cutover.

### 1.2 Passos do cutover (ordem segura, sem downtime)
1. **Rollout gradual da flag:** ligar `profiles.caderno_v2_enabled` por lote (ex.: 10% → 50% → 100% dos PRO), monitorando os eventos `caderno_*` e erros. (Decisão de Produto: ritmo.)
2. **Promover a 100%** e então **remover o gate** `useCadernoV2Flag` das rotas/nav (o novo vira padrão para todo PRO).
3. **Redirects** de rota: `/caderno-erros` → `/caderno`, `/caderno-erros/revisao` → `/caderno/revisao` (React Router `<Navigate replace>`), preservando query params. Mantém bookmarks/links antigos.
4. **Decomissionar** os arquivos legados: `CadernoErrosPage`, `CadernoRevisaoPage` (antigo), `AddToNotebookModal` (antigo), `QueueRow`/`HeroStatusCard`/`helpers.ts` legados, e `src/sandbox/caderno/*`. Remover seus imports em `App.tsx`.
5. **Substituir o modal de "adicionar ao caderno" individual** na correção pelo novo (ver 2.1) — antes de remover o antigo.
6. **Limpar a flag** do schema só depois de estável (`profiles.caderno_v2_enabled` pode virar default true e depois ser removida numa migração futura).

### 1.3 Atualizar todos os apontamentos para o caderno antigo
Trocar `/caderno-erros` → `/caderno` em: `AppSidebar`, `SidebarProSection`, `MobileBottomNav`, `CommandPalette`, `HomePagePremium` (ResumeSection/QuickActionsSection/HighlightsStrip), landing (`LandingValueProps`/`LandingHowItWorks` se citarem), e qualquer CTA de outras páginas.

**Critério de aceite do cutover:** nenhum caminho do app leva ao caderno antigo; `/caderno-erros` redireciona; build sem os arquivos legados; todos os PRO veem o novo.

---

## PARTE 2 — Feeders: o que muda em cada página que alimenta o caderno

> Princípio: **3 ações de primeira classe** disponíveis em TODA superfície onde aparece uma questão — **Salvar no Caderno (erro)**, **Favoritar**, **Anotar** — via componentes únicos reaproveitáveis, no design system novo (`.caderno-root` tokens).

### 2.1 Correção (`CorrecaoPage`) — feeder primário
- **Salvar no Caderno:** substituir o `AddToNotebookModal` antigo por um modal/sheet novo (usar `AdaptiveModal` + as causas coloridas + lembrete opcional), reaproveitando a taxonomia de causa. Detecção de duplicata mantida.
- **Favoritar:** `FavoriteToggleButton` (já existe e foi integrado) — manter, restilizar ao novo DS.
- **Anotar (NOVO):** botão "Anotar" por questão → cria `user_notes` vinculada a `question_id`/`simulado_id`/`area`/`theme` e abre o editor (sheet no mobile). A nota aparece na aba **Anotações** e contextualmente ao revisitar a questão. (Ver 3.2 reconciliação de notas.)
- **Seleção de texto → ação:** o highlight-to-note hoje vira `learning_text` do erro; estender para oferecer "criar anotação" também.

### 2.2 Gabarito (`AnswerSheetPage`)
- Adicionar as 3 ações (Salvar no Caderno / Favoritar / Anotar) por questão — hoje o gabarito é só leitura. Reaproveita os mesmos componentes da correção.

### 2.3 Prova (`SimuladoExamPage` / `useExamFlow`)
- **Confiança:** `ConfidenceSelector` já capturando — confirmar proeminência (é o que alimenta calibração/triagem). 
- **Marcar/Favoritar durante a prova:** já há "marcar para revisão"; conectar essa marcação ao caderno (questões marcadas viram candidatas pré-selecionadas na triagem) e permitir **favoritar** na hora (a captura mais quente).
- Pós-finalize → **triagem** (`/simulados/:id/triagem`) já é o feeder em lote (feito).

### 2.4 Resultado (`ResultadoPage`)
- CTA de **triagem** "Transforme seus erros em plano" (feito) — manter destaque.
- Adicionar **resumo do caderno** pós-prova: "N erros foram para seu caderno · M já estavam · próxima revisão amanhã" (fecha o ciclo logo após a prova).

### 2.5 Home premium (`HomePagePremium`) — a porta de retorno diária
- **Card "Para revisar hoje"** (feito) — manter, com contagem de devidas + CTA `/caderno/revisao?mode=due`.
- Adicionar: **streak** de revisão, **countdown ENAMED / Reta Final** (quando próximo), e **teaser de Insights** ("Prof. San achou 2 padrões nos seus erros"). A home é o gatilho diário do SRS.

### 2.6 Desempenho (`DesempenhoPage`)
- É o "irmão analítico" do Insights. Em cada **área/tema fraco**, adicionar ações: "Ver meus erros desse tema" (→ `/caderno?area=...`), "Treinar" (→ `/caderno/treino` ou `/caderno/revisao?mode=drill&area=...`). Conecta diagnóstico → ação no caderno.

### 2.7 Navegação (Sidebar, MobileBottomNav, CommandPalette)
- Rotas → `/caderno` (cutover).
- **Badge de devidas** no item do Caderno (contagem de revisões devidas hoje) — sinal visual constante que puxa para a revisão. Mobile bottom nav idem.
- CommandPalette: ações rápidas ("Revisar agora", "Ir ao Caderno", "Treinar pontos fracos").

### 2.8 Onboarding (`OnboardingPage`)
- (Opcional/Fase posterior) 1 passo apresentando o novo Caderno (recall ativo, flashcards, reta final) para ativação.

---

## PARTE 3 — O que falta na plataforma (sistêmico) para o caderno fazer sentido

### 3.1 Lembretes / Notificações (o MAIOR gap) — Novu
Sem lembrete, repetição espaçada não acontece (as devidas vencem invisíveis). Implementar via Novu (o projeto já usa Novu por edge functions):
- **Lembrete diário de revisão:** job agendado (Supabase `pg_cron` ou edge function agendada) que, por usuário PRO com devidas hoje, dispara Novu (e-mail e/ou push): "Você tem N questões para revisar hoje". 
- **Nudge de streak em risco** ("não perca sua sequência de X dias").
- **War Room ENAMED:** à medida que a prova se aproxima, lembrete do plano do dia ("Faltam 14 dias — hoje, domine estas 12").
- **Pós-triagem:** "M erros adicionados; primeira revisão amanhã."
- Respeitar preferências/opt-out (Configurações).

### 3.2 Reconciliação do modelo de NOTAS
Hoje há dois conceitos; definir claramente:
- `error_notebook.learning_text` = **lembrete do erro** (por que errei / o que lembrar), mostrado no recall. **Mantém.**
- `user_notes` = **anotações de estudo** livres (aba Anotações, Medway parity). 
- **Ação "Anotar" numa questão** → cria `user_notes` ligada à questão (aparece na aba Anotações e ao revisitar a questão). 
- Definir se ambas coexistem na UI da questão (recomendado: sim — "lembrete do erro" no fluxo de salvar erro; "anotação" como nota de estudo). Documentar a distinção na UI para o aluno não confundir.

### 3.3 Favoritar e Anotar como componentes de 1ª classe
- `FavoriteToggleButton` (existe) e um novo `NoteButton`/`QuickNoteSheet` — reaproveitados em correção, gabarito e prova. Estado sincronizado via React Query (`['caderno','favorites']`, `['caderno','notes']`).

### 3.4 Metadados de questão + mapa tema→aula (Conteúdo)
- Garantir `area`/`theme`/peso ENAMED bem preenchidos nas questões (insights/treino/flashcards/reta-final dependem disso).
- **Mapa oficial tema→aula** para o deep-link "Ver aula" sair do placeholder de busca genérica → ativa o gating de Lacuna ("estude antes de re-testar").

### 3.5 Gating de Lacuna (ponta solta funcional)
- Hoje `awaiting_lesson` + `clear_awaiting_lesson_guarded` + `LessonUnlockDialog` existem mas **nada coloca a entrada em `awaiting_lesson`**. Implementar o gatilho: entradas com causa **Lacuna** nascem (ou após 1º lapso entram) em `awaiting_lesson`; o recall mostra "estude a aula antes de re-testar" → "Já estudei isso" desbloqueia. Depende de 3.4 (deep-link) para o melhor efeito.

### 3.6 Admin / Analytics do funil
- Surfar as métricas do caderno (eventos `caderno_*` já instrumentados) no admin (`AdminProduto`/`AdminAnalytics`): ativação, taxa de revisão, taxa de domínio, ROI, conversão da triagem. Sem isso não dá para medir o sucesso do cutover.

---

## PARTE 4 — Decisões de produto pendentes (deferidas)
- **Rollout da flag** (ritmo) — Produto.
- **Decks colaborativos / cohort** — discovery de compartilhamento/privacidade.
- **"Simulado do meu caderno" do banco** (cronometrado, questões novas) — mexe no motor de prova.
- **Pesos ENAMED** (validar `enamedBlueprint.ts`) e **`ENAMED_DATE`** — Conteúdo/Ops.
- **Canais de notificação** (e-mail vs push vs ambos) e cadência — Produto.

---

## PARTE 5 — Roadmap por fases

| Fase | Escopo | Por quê / dependências |
|---|---|---|
| **A — Cutover** | Rollout flag → remover fork → redirects → atualizar nav/CTAs → decomissionar legado + sandbox → substituir AddToNotebookModal | Coloca o novo no lugar do antigo. Pré-requisito de tudo. Baixo risco (dado compartilhado). |
| **B — Captura em toda a plataforma** | 3 ações (Salvar/Favoritar/Anotar) em correção, gabarito e prova; reconciliação de notas; marcação na prova → triagem | Enche o caderno de qualquer ponto. Depende de A (rotas/DS). |
| **C — Loop de retorno (faz o SRS funcionar)** | Lembretes Novu (diário/streak/reta final/pós-triagem) + home surfacing (devidas/streak/reta/insights) + badge de devidas no nav | Sem isto o SRS é invisível. Maior alavancagem de retenção. Paralelo a B. |
| **D — Integrações analíticas** | Desempenho → caderno (treinar/ver erros por tema); admin funnel; gating de Lacuna (3.5) + deep-link aula (3.4) | Fecha diagnóstico→ação e medição. Depende de conteúdo (3.4). |
| **E — Decisões de produto** | Colaborativo, simulado-do-banco, rollout amplo, canais de notificação | Discovery; fora do caminho crítico. |

**Critério de priorização:** A (destrava) → C (retenção/SRS real, maior impacto) ≈ B (entrada de dados) → D (medição/loop fechado) → E.

---

## PARTE 6 — Riscos & critérios de aceite
- **Risco:** remover o legado cedo demais → mitigar com rollout gradual + redirects + monitorar `caderno_*`.
- **Risco:** lembretes intrusivos → opt-out + cadência conservadora + horário inteligente.
- **Risco:** dois modelos de nota confundirem o aluno → UI clara (3.2).
- **Aceite global:** (a) nenhum caminho leva ao caderno antigo; (b) é possível Salvar/Favoritar/Anotar de correção, gabarito e prova; (c) usuário com devidas recebe lembrete e vê badge/contagem na home/nav; (d) Desempenho linka para o caderno; (e) admin mostra o funil; (f) build/tsc/lint/testes verdes, sem regressão.
