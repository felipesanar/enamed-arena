# Hero da Home e retomada de simulado offline

## Problema (confirmado no código)

Quando o aluno inicia um simulado no modo **offline**, o attempt fica com `status = 'offline_pending'` e `attempt_type = 'offline'`. Porém o estado do usuário que alimenta a Home e a página do simulado joga fora essa informação:

- `attemptToUserState` (`src/hooks/useSimulados.ts:24`) e o mapeamento equivalente em `src/hooks/useSimuladoDetail.ts:36` só guardam `started`, `startedAt`, `finished`, `finishedAt`, `score`. Não guardam o tipo (online/offline) nem o status bruto do attempt.
- Com isso, `deriveSimuladoStatus` classifica o attempt offline como `in_progress` e a Hero (`src/lib/home-hero-state.ts`, cenário `in_progress`) manda para `/simulados/:id`, onde o CTA "Continuar Simulado" navega para `/simulados/:id/prova` (`src/pages/SimuladoDetailPage.tsx:616`) — a prova online.

O destino correto para um attempt offline em andamento é o preenchimento de gabarito: `/simulados/:id/gabarito` (rota já existente em `src/App.tsx:181`).

## O que será feito

1. **Propagar o modo do attempt até a UI**
   - Acrescentar `attemptType` (`'online' | 'offline'`) e `attemptStatus` ao tipo `SimuladoUserState`.
   - Preencher esses campos nos dois pontos de montagem (`useSimulados` e `useSimuladoDetail`), sem alterar a escolha de attempt feita por `pickMostRelevantAttempt`.

2. **Mapear todos os casos da Hero para o CTA certo**
   A derivação da Hero passa a considerar o modo do attempt:

   | Situação do aluno | Cenário | CTA | Destino |
   |---|---|---|---|
   | Onboarding incompleto | `onboarding_pending` | Completar perfil | `/onboarding` |
   | Attempt **offline** em andamento (aguardando gabarito) | `in_progress` (offline) | Preencher gabarito | `/simulados/:id/gabarito` |
   | Attempt **online** em andamento | `in_progress` | Retomar simulado | `/simulados/:id/prova` |
   | Janela aberta, nenhum attempt | `window_open` | Realizar simulado | `/simulados?openModal=:id` |
   | Enviado, resultado não liberado | `awaiting_results` | Ver desempenho | `/desempenho` |
   | Resultado liberado | `results_ready` | Ver resultado | `/simulados/:id` |
   | Fora da janela, não realizado | `late_training` | Bora treinar | (mantém atual) |
   | Sem histórico / futuro / progresso estável | `first_simulado`, `upcoming`, `steady_progress` | (mantém atual) | (mantém atual) |

   Textos do caso offline em andamento: eyebrow "Prova offline", headline sobre gabarito pendente e descrição orientando a transcrever as respostas do PDF para o gabarito digital antes do fim do prazo.

3. **Coerência na página do simulado**
   Em `SimuladoDetailPage`, quando o attempt em andamento for offline, o botão passa a ser "Preencher gabarito" apontando para `/simulados/:id/gabarito`, em vez de "Continuar Simulado" → `/prova`. Isso evita o mesmo desvio quando o aluno chega pela listagem.

4. **Testes**
   Casos unitários em `home-hero-state` cobrindo attempt offline em andamento (destino gabarito) e attempt online em andamento (destino prova), além de um caso de status derivado para garantir que o offline não vira prova online.

## Detalhes técnicos

- Arquivos: `src/types/index.ts`, `src/hooks/useSimulados.ts`, `src/hooks/useSimuladoDetail.ts`, `src/lib/home-hero-state.ts`, `src/components/premium/home/HomePagePremium.tsx` (apenas passagem de dados, se necessário), `src/pages/SimuladoDetailPage.tsx`, novo/atualizado teste em `src/lib/`.
- Nenhuma mudança de schema, RPC ou rota nova; apenas leitura de campos já existentes em `attempts` (`attempt_type`, `status`).
- `AnswerSheetPage` já resolve o attempt offline ativo via `useOfflineAttempt`, então o link direto funciona sem alterações nessa página.
