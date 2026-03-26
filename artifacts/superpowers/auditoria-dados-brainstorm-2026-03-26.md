### Goal
- Auditar ponta a ponta o fluxo de dados do simulado (respostas -> correcao -> resultado -> desempenho -> ranking -> dashboard) e corrigir as quebras para garantir persistencia confiavel por `userId + simuladoId`.
- Entregar um fluxo robusto server-side para calculo de resultado e atualizacao de agregados, sem depender de fallback local para dados oficiais.

### Constraints
- Stack atual: React + hooks client-side + Supabase (tabelas `attempts`, `answers`, `simulados`, `questions`, `question_options`) e RPC `get_ranking_for_simulado`.
- Nao quebrar UX atual das telas (`CorrecaoPage`, `ResultadoPage`, `DesempenhoPage`, `RankingPage`, Home).
- Respeitar RLS existente e evitar expor dados de outros usuarios fora do ranking agregado.
- Mudancas devem ser incrementais e verificaveis em ambiente local.

### Known context
- Gravacao de respostas hoje ocorre por debounce em `useExamStorageReal.saveStateDebounced` + `bulkUpsertAnswers`, com cache local write-through.
- Finalizacao ocorre em `useExamFlow.finalize` -> `useExamStorageReal.submitAttempt` -> `simuladosApi.submitAttempt`.
- `useExamResult` precisa de fallback local quando DB nao tem respostas (sinal claro de inconsistencia).
- `DesempenhoPage` calcula metricas somente no client via `computePerformanceBreakdown` (sem persistencia consolidada).
- Ranking vem de RPC (`rankingApi.fetchRankingForSimulado`), baseado em `attempts` submetidos.
- Nao ha hoje tabela dedicada para historico consolidado de desempenho do usuario.

### Risks
- Race condition entre ultimo sync de respostas e `submitAttempt` (resultado pode ser calculado com snapshot incompleto).
- Dependencia de client para calcular score e desempenho (integridade fraca; risco de divergencia).
- Fallback local mascarando perda de dados no banco.
- Regressao de telas se mudarmos contrato de dados sem compatibilidade.
- Risco de RLS/permissao em novas tabelas/funcoes de agregacao server-side.

### Options (2-4)
- Option 1: Hardening client-first (melhorar debounce/retry/checks) sem mover logica critica para server.
  - Pros: menor esforco inicial, menos SQL novo.
  - Cons: mantem risco estrutural; cliente continua fonte de verdade de regra de negocio.
  - Complexity / risk: media complexidade, risco funcional medio-alto.

- Option 2: Hibrido (submissao server-side, leitura mista), mantendo parte do fluxo atual.
  - Pros: reduz risco principal de score incorreto; migracao gradual.
  - Cons: convivio de dois modelos por mais tempo; manutencao mais complexa.
  - Complexity / risk: complexidade media-alta, risco medio.

- Option 3: Server-authoritative completo para correcao/resultado/desempenho + client apenas captura input.
  - Pros: consistencia forte, trilha auditavel, eliminacao de fallback como fonte oficial.
  - Cons: exige migracoes SQL, RPCs novas e refatoracao multiarquivo.
  - Complexity / risk: alta complexidade, menor risco de dados no longo prazo.

### Recommendation
- Adotar Option 3 com rollout incremental: primeiro garantir persistencia atomica de resposta e finalizacao confiavel; depois mover correcao/resultado/desempenho para server-side; por fim alinhar telas e dashboard para consumir dados consolidados.
- Motivo: o problema reportado e de confiabilidade de dados cross-tela. Apenas hardening client nao resolve a causa raiz.

### Acceptance criteria
- Cada resposta confirmada gera persistencia no banco com retry e idempotencia.
- Finalizacao do simulado falha de forma segura se houver resposta pendente nao persistida.
- Resultado oficial (nota/acertos/erros/tempo) passa a ser calculado server-side e persistido.
- Desempenho consolidado por usuario e historico por simulado passam a existir em fonte dedicada no banco.
- Ranking e dashboard refletem dados oficiais atualizados apos finalizacao.
- `CorrecaoPage`, `ResultadoPage`, `DesempenhoPage`, `RankingPage` e Home exibem dados corretos sem depender de fallback local para estado final.
- Fluxo validado manualmente com dois simulados consecutivos e checks de consistencia em DB.
