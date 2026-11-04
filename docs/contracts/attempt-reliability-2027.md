# Contrato de confiabilidade restante — F1-9

Complementa a persistência/relógio já integrados. Nenhuma ação de produção autorizada.

- `create_attempt_guarded(uuid)` mantém assinatura e retorno atuais. Antes da abertura, rejeita sem gravar; chamadas simultâneas para o mesmo usuário/simulado respeitam a unicidade e retornam a tentativa existente. Não alterar política de novas tentativas, offline ou presencial por inferência.
- `update_attempt_progress_guarded` preserva assinatura, ownership, campos protegidos e validações; contadores de saída nunca diminuem, inclusive com requisições concorrentes.
- `SimuladoUserState.effectiveDeadline` e `isWithinWindow` vêm do attempt no servidor. Não inferir elegibilidade de ranking no navegador.
- Tentativa online in_progress com deadline futuro pode ser continuada em treino após o fim da janela, usando o status existente in_progress. Offline pendente, tentativa expirada ou finalizada não vira sessão online por causa desse fallback. A rotulagem explícita de treino será aplicada na integração de listas.
- Eventos de saída atualizam estado por função de setState e persistem a contagem capturada da tentativa correta. Telemetria usa o relógio sincronizado quando fornecido.
- Provar em duas conexões PostgreSQL reais: create simultâneo sem duplicata; resposta antes do lock de finalização entra na nota; resposta que espera uma finalização confirmada é rejeitada. Barreira observável de lock, timeout limitado e resultado do banco como evidência. Tests só em 127.0.0.1:54737/enamed_test_*; não usar dados reais ou backlog legado.

As datas de liberação e permissões de gabarito da Fase 0 permanecem vigentes. Não adicionar políticas de calendário, retentativas ou alteração de score fora do servidor.
