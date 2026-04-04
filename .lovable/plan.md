
Do I know what the issue is? Yes.

Problema real identificado: a regressão começou quando o modo offline foi adicionado, mas o fluxo online continuou lendo/escrevendo attempts de forma genérica.

1. O que está quebrando hoje
- `src/services/simuladosApi.ts`:
  - `getAttempt()` e `getUserAttempts()` não diferenciam attempt online vs offline.
  - Depois da adição de `attempt_type`, o fluxo online pode receber uma `offline_pending` como se fosse attempt da prova online.
- `src/hooks/useExamFlow.ts`:
  - o hook assume que o estado interativo só funciona com `status === 'in_progress'`.
  - se entrar uma attempt `offline_pending`, o timer fica pausado/errado e `updateState()` bloqueia seleção, navegação e marcações.
- `src/hooks/useExamStorageReal.ts`:
  - `initializeState()` salva estado local mesmo quando `createAttempt()` falha.
  - isso permite abrir a prova sem registro no banco.
  - depois `loadState()` reaproveita esse cache órfão, então a tela abre “normal”, mas sem `attemptId`.
- Banco:
  - ainda existe a restrição antiga `UNIQUE(simulado_id, user_id)`.
  - com `attempt_type` novo, isso impede coexistência correta entre online e offline.
  - se já existir attempt offline, a criação da online pode falhar.

2. Como isso explica os sintomas
- “Tabela de attempts vazia”:
  - `createAttempt()` falha, mas o app segue com cache local porque o erro é engolido no fluxo.
- “Cronômetro zerado”:
  - o app pode estar reabrindo um cache local órfão/expirado, ou uma `offline_pending` inválida para a tela online.
- “Não consigo selecionar, avançar ou navegar”:
  - quando o estado carregado não está em `in_progress`, `updateState()` retorna sem alterar nada.

3. Plano de correção
- Etapa 1 — separar online e offline nas leituras
  - Ajustar `simuladosApi.getAttempt()` para aceitar filtro por `attempt_type`.
  - Ajustar `getUserAttempts()` para não deixar `offline_pending` dirigir o status da experiência online.
  - Atualizar `useSimuladoDetail` e `useSimulados` para considerar apenas attempts online na lógica de “iniciar/continuar prova”.

- Etapa 2 — blindar o start da prova online
  - Em `useExamStorageReal.initializeState()`, se `createAttempt()` falhar:
    - não salvar `in_progress` local como se estivesse tudo certo;
    - abortar a abertura da prova;
    - mostrar erro claro.
  - Em `loadState()`, se não existir attempt online no banco:
    - não retomar cache local órfão automaticamente;
    - limpar cache inválido/expirado antes de continuar.

- Etapa 3 — impedir estados inválidos na tela online
  - Em `useExamFlow`, aceitar apenas estados online válidos (`in_progress`, `submitted`, `expired`).
  - Se vier `offline_pending` ou qualquer status inesperado:
    - redirecionar para a tela anterior com mensagem clara;
    - nunca renderizar a experiência online com esse estado.

- Etapa 4 — corrigir o schema/RPC
  - Criar migration para remover a unicidade antiga por `(simulado_id, user_id)`.
  - Substituir por unicidade compatível com os dois modos, ex.: `(simulado_id, user_id, attempt_type)`.
  - Atualizar `create_attempt_guarded` para gravar explicitamente `attempt_type = 'online'`.

- Etapa 5 — validar casos críticos
  - Caso A: iniciar online sem attempt prévia.
  - Caso B: existir offline pendente e iniciar online.
  - Caso C: falha ao criar attempt online.
  - Caso D: cache local órfão/expirado.
  - Adicionar testes para esses cenários.

4. Arquivos que precisam entrar na correção
- `src/services/simuladosApi.ts`
- `src/hooks/useExamStorageReal.ts`
- `src/hooks/useExamFlow.ts`
- `src/hooks/useSimuladoDetail.ts`
- `src/hooks/useSimulados.ts`
- migration SQL para `attempts` + `create_attempt_guarded`

Resultado esperado após a correção:
- escolher modo online sempre cria ou recupera a attempt online correta;
- a tabela `attempts` volta a refletir o início da prova;
- o cronômetro abre com deadline válido;
- seleção, navegação e resposta voltam a funcionar;
- attempts offline deixam de contaminar a experiência online.
