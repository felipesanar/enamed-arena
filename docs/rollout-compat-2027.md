# Compatibilidade do motor durante o rollout2027

O frontend tenta as assinaturas novas nas ações normais. Não conclui que todo o backend é antigo só porque o probe agregado está ausente.

A finalização manual só usa a assinatura legada finalize_attempt_with_results(p_attempt_id) após PGRST202 de schema cache da assinatura exata com p_attempt_id e p_auto_submit e HTTP404 quando o status está presente. A resposta legada continua sendo a nota calculada no servidor, inclusive zero. Erros de autorização, rede, servidor, função interna, overload ambíguo ou outra assinatura não autorizam repetição. Finalização automática nunca usa esse fallback. Rejeição de questões em branco pelo servidor antigo continua visível e não autoriza apagar cache ou marcar como finalizado.

A ausência exata de get_question_explanations(p_simulado_id) permite carregar o enunciado e alternativas sem chave/comentários, marcados explanationUnavailable. Nenhuma leitura REST de colunas restritas foi acrescentada. Na correção, AQR autorizado continua fonte da chave e a nota já registrada é preservada; sem chave suficiente, a página apresenta indisponibilidade, sem marcar respostas desconhecidas como erradas. Erros diferentes da ausência exata continuam sendo erros. A prova sem pedido de correção não consulta esse RPC.

Validação independente Codex:78testes em src/lib/backend-rpc-availability.test.ts, src/services/simuladosApi.test.ts e src/pages/CorrecaoPage.test.tsx passaram em04/11/2026. O OpenCode gravou a implementação; sua sessão terminou por limite de contexto, por isso a validação e este registro foram concluídos pelo orquestrador. Não equivale à validação Managed Supabase nem altera produção.

A ausência de migrations mantém limitações legadas. Aplicação do SQL, deploy de Edge e habilitação de pg_cron continuam etapas separadas de rollout e aprovação específica.

## Relógio visual e recuperação

Sem `get_server_time`, o relógio estimado mantém a âncora monotônica e continua
contando, inclusive em zero. Não autoriza expiração, autoenvio, descarte de cache
ou encerramento local. Saltos do relógio do sistema não movem essa âncora. A UI
mostra **Tempo estimado** e não anuncia prazo esgotado nem cinco minutos restantes
como certeza nesse estado.

Clock pendente bloqueia o `canWrite` global, inclusive no storage. Após falha
declarada, legado confirmado pode editar respeitando preparação, ownership e
guards existentes; V1 continua bloqueado até sincronização confiável e
reconciliação. Capabilities V1 confirmadas com clock indisponível apresentam o
erro recuperável existente, com **Tentar novamente** habilitado. O retry refaz
capabilities e clock, volta a preparar enquanto aguarda e não fabrica versões de
respostas. Falha transitória após amostra confiável conserva status e âncora
confiáveis. Respostas antigas são isoladas por sessão/unmount.

Uma amostra tardia corrige o contador pelo prazo real: futuro não dispara
finalização; passado dispara uma vez quando autorizado. Zero estimado não consome
essa chance. O relógio visual não altera prazo backend, score server-side,
invalidação React Query, dirty cache nem as limitações da finalização legada.

Validação local do job `f3-clock-rollout-6883`, em 04/11/2026:

```powershell
node node_modules/vitest/vitest.mjs run src/hooks/useExamTimer.test.ts src/hooks/useServerClock.test.ts src/hooks/useExamFlow.test.tsx src/hooks/exam/useExamLifecycle.test.tsx src/components/exam/ExamHeader.test.tsx src/components/exam/ExamTimerAnnouncement.test.tsx src/pages/SimuladoExamPage.test.tsx --maxWorkers=2
```

Resultado final: **55 testes passaram, 0 falharam, 7 arquivos**. ESLint executado
nos 14 arquivos TypeScript/TSX de implementação e testes desse escopo, incluindo
Timer/Lifecycle já checkpointados: **0 erros, 0 avisos**, sem desabilitar regras.
Documentação revisada manualmente; `git diff --check` sem erros de whitespace
(apenas avisos de normalização LF/CRLF do ambiente Windows).

Cobertura: tick 10→9→0, OS saltando nos dois sentidos, zero sem callback/autoenvio
ou conclusão, sincronização tardia, ownership sem consumir fired key, retry real
da RPC mockada com V1 bloqueado até reconciliação, preservação da amostra confiável,
labels/avisos acessíveis e callers antigos. Não foi executada suíte global, SQL,
deploy, Auth/Supabase/cron real nem inspeção em navegador; essas etapas continuam
separadas e sob responsabilidade do orquestrador.
