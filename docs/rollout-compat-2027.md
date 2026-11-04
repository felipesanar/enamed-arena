# Compatibilidade do motor durante o rollout2027

O frontend tenta as assinaturas novas nas ações normais. Não conclui que todo o backend é antigo só porque o probe agregado está ausente.

A finalização manual só usa a assinatura legada finalize_attempt_with_results(p_attempt_id) após PGRST202 de schema cache da assinatura exata com p_attempt_id e p_auto_submit e HTTP404 quando o status está presente. A resposta legada continua sendo a nota calculada no servidor, inclusive zero. Erros de autorização, rede, servidor, função interna, overload ambíguo ou outra assinatura não autorizam repetição. Finalização automática nunca usa esse fallback. Rejeição de questões em branco pelo servidor antigo continua visível e não autoriza apagar cache ou marcar como finalizado.

A ausência exata de get_question_explanations(p_simulado_id) permite carregar o enunciado e alternativas sem chave/comentários, marcados explanationUnavailable. Nenhuma leitura REST de colunas restritas foi acrescentada. Na correção, AQR autorizado continua fonte da chave e a nota já registrada é preservada; sem chave suficiente, a página apresenta indisponibilidade, sem marcar respostas desconhecidas como erradas. Erros diferentes da ausência exata continuam sendo erros. A prova sem pedido de correção não consulta esse RPC.

Validação independente Codex:78testes em src/lib/backend-rpc-availability.test.ts, src/services/simuladosApi.test.ts e src/pages/CorrecaoPage.test.tsx passaram em04/11/2026. O OpenCode gravou a implementação; sua sessão terminou por limite de contexto, por isso a validação e este registro foram concluídos pelo orquestrador. Não equivale à validação Managed Supabase nem altera produção.

A ausência de migrations mantém limitações legadas. Aplicação do SQL, deploy de Edge e habilitação de pg_cron continuam etapas separadas de rollout e aprovação específica.
