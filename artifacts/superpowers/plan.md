## Goal
Implementar integralmente os gaps identificados na auditoria PRD x codigo da Plataforma de Simulados, com foco em conformidade funcional (regras de janela e onboarding), experiencia (CTA LP PRO), mensuracao (KPIs) e robustez de backend (enforcement server-side), usando como CTA oficial a LP: https://sanarflix.com.br/sanarflix-pro-enamed.

## Assumptions
- A stack atual (React + Supabase) deve ser mantida; sem migracoes de arquitetura.
- "Implementar tudo" significa cobrir todos os gaps classificados como Blocker/Major/Minor/Nit na auditoria.
- O CTA de upsell deve apontar para a LP publica do PRO ENAMED: [SanarFlix PRO ENAMED](https://sanarflix.com.br/sanarflix-pro-enamed).
- A instrumentacao de KPI pode iniciar com tracking interno (eventos padronizados) e dispatch desacoplado (provider-agnostic), para depois ligar em ferramenta externa.

## Plan
1. Reforcar modelo de dominio para regras temporais no backend
   - Files: `supabase/migrations/*new*.sql`, `src/services/simuladosApi.ts`, `src/integrations/supabase/types.ts`
   - Change: Criar funcoes/RPC server-side para validar janela de execucao em create/update/finalize de tentativa (inicio dentro da janela; finalizacao dentro da janela ou expiracao controlada).
   - Change: Bloquear mutacoes fora da janela com erros semanticos consistentes para o frontend.
   - Verify: `npm run build` + consulta SQL de tentativa fora da janela retornando erro esperado.

2. Aplicar enforcement server-side no fluxo de prova
   - Files: `src/hooks/useExamStorageReal.ts`, `src/hooks/useExamFlow.ts`, `src/services/simuladosApi.ts`
   - Change: Substituir caminhos de escrita direta por RPCs validadas por janela.
   - Change: Tratar mensagens de erro no cliente (janela fechada, tentativa invalida, expiracao).
   - Verify: fluxo manual: iniciar prova fora da janela deve falhar; salvar/finalizar fora da janela deve falhar controladamente.

3. Implementar regra onboarding editavel apenas entre janelas
   - Files: `supabase/migrations/*new*.sql`, `src/contexts/UserContext.tsx`, `src/pages/OnboardingPage.tsx`, `src/pages/ConfiguracoesPage.tsx`
   - Change: Criar regra server-side para update de onboarding apenas quando nao houver simulado em execucao bloqueando alteracao.
   - Change: Expor estado de bloqueio no frontend (desabilitar edicao + mensagem clara de quando podera editar).
   - Verify: tentativa de update onboarding durante janela deve falhar no backend e refletir mensagem no frontend.

4. Fortalecer regra de instituicoes no onboarding
   - Files: `supabase/migrations/*new*.sql`, `src/contexts/UserContext.tsx`
   - Change: Validar no backend o minimo de instituicoes para segmento guest (>=3) para impedir bypass de UI.
   - Change: Garantir coerencia entre segment do profile e regra aplicada no save onboarding.
   - Verify: teste manual/API com guest e <3 instituicoes deve ser rejeitado.

5. Adicionar opt-in de notificacao de resultado por email na finalizacao
   - Files: `src/components/exam/ExamCompletedScreen.tsx`, `src/hooks/useExamFlow.ts`, `src/services/simuladosApi.ts`, `supabase/migrations/*new*.sql`, `supabase/functions/novu-email/index.ts` (se necessario)
   - Change: Criar controle de preferencia "avisar por email quando resultado estiver disponivel" no fim da prova.
   - Change: Persistir preferencia por tentativa/usuario e preparar trigger para envio quando resultado liberar.
   - Verify: marcar opt-in, persistir preferencia e validar registro no banco.

6. Expandir ranking para simulados com resultado liberado (nao apenas tentados)
   - Files: `src/services/rankingApi.ts`, `src/hooks/useRanking.ts`, `supabase/migrations/*new*.sql`
   - Change: Ajustar fonte de simulados do ranking para listar simulados com resultados publicados e ranking disponivel, independentemente de tentativa local.
   - Change: Manter fallback de UX para usuario sem tentativa (sem "sua posicao", mas com ranking global permitido).
   - Verify: usuario sem tentativa deve conseguir abrir ranking de simulado com resultados publicados.

7. Corrigir filtro de instituicao para considerar lista completa do onboarding
   - Files: `src/hooks/useRanking.ts`, `src/services/rankingApi.ts`
   - Change: Trocar logica de primeira instituicao por comparacao contra lista completa de instituicoes do usuario.
   - Change: Ajustar UI para exibir criterio aplicado no filtro.
   - Verify: filtro same_institution inclui participantes de qualquer instituicao da lista do usuario.

8. Implementar drill-down de desempenho ate nivel de questao
   - Files: `src/pages/DesempenhoPage.tsx`, `src/lib/resultHelpers.ts`, `src/hooks/useExamResult.ts`
   - Change: Adicionar navegacao por area > tema > questao com links/preview para correcao da questao.
   - Change: Preservar estado de navegacao para retorno rapido na analise.
   - Verify: usuario consegue chegar da tela Desempenho ate a questao especifica em 2-3 cliques.

9. Atualizar CTAs de upsell para LP oficial PRO ENAMED
   - Files: `src/components/ProGate.tsx`, `src/components/UpgradeBanner.tsx`, pontos de uso em `src/pages/*`
   - Change: Definir `ctaTo` para URL externa da LP oficial: https://sanarflix.com.br/sanarflix-pro-enamed.
   - Change: Ajustar copy para refletir valor da LP (desempenho detalhado, cronograma, mentoria etc.).
   - Verify: todos os bot?es de upsell redirecionam corretamente para a LP.

10. Instrumentar KPIs do PRD (tracking base)
   - Files: `src/lib/analytics.ts` (novo), `src/pages/*`, `src/hooks/*`, possivelmente `supabase/migrations/*new*.sql`
   - Change: Criar camada de eventos com schema padrao para: lead captado, onboarding concluido, simulado iniciado/concluido, retorno para correcao, visualizacao ranking, tempo de engajamento, clique CTA upsell/conversao.
   - Change: Disparar eventos nos pontos de jornada e armazenar/encaminhar para destino configurado.
   - Verify: logs/event store mostram eventos obrigatorios por fluxo principal.

11. Revisar copy e estados de UX para conformidade PRD
   - Files: `src/pages/SimuladoDetailPage.tsx`, `src/components/exam/ExamCompletedScreen.tsx`, `src/pages/ResultadoPage.tsx`, `src/pages/CorrecaoPage.tsx`
   - Change: Refinar mensagens de janela, pos-finalizacao e gate de recurso, alinhando com PRD.
   - Change: Completar estados de erro/loading/sucesso para evitar ambiguidades.
   - Verify: walkthrough manual com guest/standard/pro sem dead-ends.

12. Validacao tecnica final + fechamento
   - Files: `artifacts/superpowers/execution.md`, `artifacts/superpowers/finish.md`
   - Change: Rodar build/test/lint, corrigir regressao, revisar severidades remanescentes.
   - Change: Consolidar evidencias de implementacao total dos gaps e plano de follow-up opcional.
   - Verify: `npm run test` (ou comando disponivel), `npm run build`, `ReadLints` sem erros novos criticos.

## Risks & mitigations
- Mudancas server-side (RLS/RPC) podem quebrar fluxos existentes.
  - Mitigacao: rollout incremental por funcao, mensagens de erro claras, verificacao manual por segmento.
- Instrumentacao de analytics sem destino final definido pode gerar divida tecnica.
  - Mitigacao: camada abstrata com adaptador e contrato unico de eventos.
- Regras de janela podem conflitar com casos de expirar no meio da prova.
  - Mitigacao: regra explicita de expiracao controlada e finalizacao idempotente.

## Rollback plan
- Reverter migration nova que endurece regras se bloquear fluxo critico indevido.
- Reverter chamadas RPC no frontend para metodos anteriores de forma temporaria.
- Manter feature flags simples (ou guards condicionais) para desligar tracking e CTA externo se necessario.
