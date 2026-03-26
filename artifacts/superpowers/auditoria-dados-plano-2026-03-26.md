### Goal
Executar auditoria tecnica completa e implementar correcao definitiva do fluxo de dados de simulados, garantindo consistencia de ponta a ponta entre persistencia, processamento, desempenho, ranking e telas.

### Assumptions
- O escopo inclui frontend (`src/**`) e banco Supabase (`supabase/migrations/**`).
- Podemos adicionar novas funcoes/tabelas SQL para processamento server-side e agregacoes de desempenho.
- O comportamento esperado e: cliente envia respostas; servidor valida/corrige/persiste resultado oficial; telas leem dados oficiais.
- O ranking global continua permitido via funcao `SECURITY DEFINER`.

### Plan
1. Auditoria detalhada do fluxo atual e mapa de arquivos
   - Files: `src/hooks/useExamFlow.ts`, `src/hooks/useExamStorageReal.ts`, `src/hooks/useExamResult.ts`, `src/services/simuladosApi.ts`, `src/services/rankingApi.ts`, `src/pages/CorrecaoPage.tsx`, `src/pages/ResultadoPage.tsx`, `src/pages/DesempenhoPage.tsx`, `src/pages/RankingPage.tsx`, `src/components/premium/home/HomePagePremium.tsx`, `supabase/migrations/*.sql`
   - Change:
     - Documentar caminho real dos dados (write/read) e pontos de quebra por etapa.
     - Gerar checklist de inconsistencias (IDs, corrida, fallback local, origem de calculo).
   - Verify:
     - Checklist preenchido com evidencia de codigo para cada etapa.
     - Mapa salvo em `artifacts/superpowers/` antes de codar.

2. Fortalecer persistencia de respostas (atomica + retry + flush deterministico)
   - Files: `src/hooks/useExamStorageReal.ts`, `src/hooks/useExamFlow.ts`, `src/services/simuladosApi.ts`
   - Change:
     - Garantir write imediata por confirmacao de resposta (sem depender so de debounce).
     - Implementar retry com backoff e timeout nas escritas de resposta.
     - Exigir flush completo de respostas antes de `submitAttempt`.
   - Verify:
     - `npm test -- useExamStorageReal useExamFlow`
     - Simulacao manual: responder e desconectar/reconectar rede; confirmar persistencia final.

3. Mover correcao e resultado oficial para server-side
   - Files: `supabase/migrations/<new>_exam_processing.sql`, `src/services/simuladosApi.ts`, `src/hooks/useExamStorageReal.ts`
   - Change:
     - Criar funcao SQL/RPC para finalizar tentativa com calculo oficial (acertos, erros, percentual, answered, timestamps).
     - Fazer cliente chamar RPC de finalizacao em vez de calcular score oficial local.
   - Verify:
     - SQL check: tentativa finalizada possui score e totais corretos no banco.
     - Fluxo manual: comparar respostas vs score persistido em 2 simulados.

4. Criar persistencia consolidada de desempenho e historico
   - Files: `supabase/migrations/<new>_user_performance.sql`, `src/services/simuladosApi.ts`, `src/hooks/useExamResult.ts`
   - Change:
     - Criar tabela/visao de desempenho por usuario (geral, por area, historico por simulado).
     - Atualizar desempenho automaticamente ao finalizar tentativa (trigger ou funcao transacional).
   - Verify:
     - SQL query de consistencia por `user_id` e `simulado_id`.
     - `DesempenhoPage` refletindo dados oficiais apos cada finalizacao.

5. Alinhar consultas de telas para fonte oficial unica
   - Files: `src/pages/CorrecaoPage.tsx`, `src/pages/ResultadoPage.tsx`, `src/pages/DesempenhoPage.tsx`, `src/pages/RankingPage.tsx`, `src/components/premium/home/HomePagePremium.tsx`, `src/hooks/useRanking.ts`
   - Change:
     - Remover dependencia de fallback local para telas finais.
     - Garantir filtros e joins por `userId + simuladoId` onde aplicavel.
     - Ajustar Dashboard/Home para resumo do ultimo simulado + historico oficial.
   - Verify:
     - Validacao manual das 5 telas apos finalizar simulado.
     - `npm run build` sem erros.

6. Testes de regressao e validacao end-to-end
   - Files: `src/lib/resultHelpers.test.ts`, `src/lib/simulado-helpers.test.ts`, possiveis novos testes em `src/hooks/*.test.ts`
   - Change:
     - Adicionar testes de regressao para casos de resposta nao persistida e score divergente.
     - Cobrir caminho feliz e falhas de rede com retry.
   - Verify:
     - `npm test`
     - Teste manual completo em 2 simulados consecutivos (prompt fase 3).

7. Revisao final e evidencias
   - Files: `artifacts/superpowers/auditoria-dados-review-2026-03-26.md`, `artifacts/superpowers/auditoria-dados-finish-2026-03-26.md`
   - Change:
     - Executar review por severidade (Blocker/Major/Minor/Nit).
     - Consolidar resultados de verificacao e pendencias.
   - Verify:
     - Artefatos finais salvos em disco.
     - Comandos e resultados reportados.

### Risks & mitigations
- Risco: regressao em fluxo de prova em andamento.
  - Mitigacao: manter compatibilidade durante migracao; feature flag local no service para fallback controlado.
- Risco: inconsistencias de RLS em novas tabelas/funcoes.
  - Mitigacao: criar politicas explicitas + testes com dois usuarios.
- Risco: ranking ficar desatualizado apos mudanca de finalizacao.
  - Mitigacao: recalculo no mesmo fluxo transacional de submit.
- Risco: telas dependerem de campos antigos.
  - Mitigacao: adaptar contratos gradualmente e validar cada tela apos cada etapa.

### Rollback plan
- Reverter somente as migracoes novas deste pacote (down SQL correspondente) e restaurar caminho atual de `submitAttempt` no client.
- Preservar dados historicos em tabelas novas sem apagar, marcando recursos como inativos.
- Se houver falha critica, retornar leitura das telas para consultas antigas temporariamente enquanto corrige RPC.
