## Problema

Em 26/05/2026, Simulados 1 e 2 (janelas já encerradas, gabarito liberado) **somem da listagem** para alunos que não participaram. A causa é dupla:

1. `deriveSimuladoStatus` retorna `results_available` (uso pensado para "ver gabarito") sempre que `now > resultsReleaseAt`, mesmo quando o usuário nunca iniciou. Esse status não tem CTA "fazer como treino".
2. `SimuladosPage` monta `timelineItems` com 3 baldes (active / finished / upcoming) e **`results_available` não está em nenhum** → o card desaparece. Confirmado no screenshot do aluno não-PRO.

A regra de negócio do produto (memória `constraints/regras-de-negocio-simulados`) já prevê: fora da janela = treino, não conta no ranking. Falta UX consistente.

## Objetivo

Todo simulado publicado fica acessível a qualquer momento. A única coisa que muda fora da janela é: **não conta no ranking nacional**. Comunicar isso com clareza, sem esconder o card.

## Plano

### 1. Status: tratar passado-sem-tentativa como "treino disponível"
- `src/lib/simulado-helpers.ts` — em `deriveSimuladoStatus`:
  - Se `userFinished` → mantém `completed` / `closed_waiting` (inalterado).
  - Se janela encerrada e usuário **não finalizou** → retorna `available_late` (independente de `resultsReleaseAt`). O status `results_available` deixa de ser atingível pelo fluxo do usuário comum (mantido no tipo por compatibilidade, ou removido se nenhum outro consumidor depender).
- Atualizar `simulado-helpers.test.ts` (caso `returns results_available when results date passed but user finished (edge)` e `canViewResults`/`getSimuladoCTA` para `results_available`).
- Verificar `home-hero-state.ts`, `SimuladoCard.tsx`, `StatusBadge.tsx`, `Index.tsx`, `SimuladoDetailPage.tsx` para não regredir nada que dependa de `results_available`.

### 2. Listagem: garantir que nenhum status fique órfão
- `src/pages/SimuladosPage.tsx` — bucket `finished` passa a incluir explicitamente `results_available` (defesa em profundidade caso algum caminho ainda gere esse status). Ordenar histórico do mais recente ao mais antigo (já está).
- `SimuladosTimelineSection` — manter mapeamento já existente para todos os 7 status.

### 3. UX/UI do card "disponível como treino"
- `SimuladosTimelineSection.tsx` — variante `available_late`:
  - Rótulo: trocar "Fora da janela" por **"Disponível como treino"** (mais convidativo, ainda honesto).
  - Ícone: manter `Coffee` ou trocar para `Play` em tom mais sutil (outline).
  - Microcopy de apoio à direita: manter "Não entra no ranking" próximo ao CTA.
  - Tom visual: cartão neutro (atual) com um leve realce de borda âmbar/wine fraco para diferenciar de "Concluído", sem competir com `available` (janela oficial).
- CTA principal: **"Fazer como treino"** (link primário). Em telas concluídas o aluno já tem "Ver resultado"; em `available_late` ele tem "Fazer como treino".
- (Opcional, mesma seção) link secundário "Ver gabarito" quando `resultsReleaseAt` já passou — futura iteração se houver tela pública de gabarito. Não escopado agora.

### 4. Hero / banner de ação
- `SimuladosPage.heroSimulado` — manter prioridade: `available` > `in_progress` > `upcoming`. Quando não há nenhum desses (todas as janelas oficiais futuras já passaram do início), considerar promover o `available_late` mais recente ao hero com tom "Treino disponível". Para o estado atual (3 já vem), não muda nada visível, mas evita hero vazio em períodos sem janela aberta.

### 5. Copy de apoio
- Subtítulo da seção "Histórico e próximos": acrescentar 1 linha curta: "Provas com janela encerrada continuam disponíveis como treino — não contam no ranking."
- `STATUS_CONFIG.available_late.label` em `simulado-helpers.ts`: "Treino" (atualizar onde for usado em badges).

### 6. Validação
- `npm run test` — atualizar e rodar `simulado-helpers.test.ts`.
- Conferir manualmente no preview as 3 perspectivas:
  - Aluno que não fez Sim 1 e Sim 2 → ambos aparecem como "Disponível como treino" com CTA funcional.
  - Aluno que concluiu Sim 2 → continua "Concluído 27% / Ver resultado".
  - Aluno PRO e não-PRO → comportamento idêntico (treino não é feature PRO).
- Validar `SimuladoDetailPage` abre normalmente para `available_late` (já contemplado em `canAccessSimulado`).

## Risco e rollback

- Risco baixo: mudança concentrada em derivação de status + filtro de bucket + copy. Sem migração de banco, sem mudança de RPC.
- Rollback: reverter os arquivos `simulado-helpers.ts`, `SimuladosPage.tsx`, `SimuladosTimelineSection.tsx`.

## Fora do escopo

- Página pública de gabarito.
- Mudança em ranking ou desempenho.
- Caderno de Erros (continua PRO, alimentado pelas tentativas independente de janela).
