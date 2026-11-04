# ENAMED Arena

Plataforma de simulados cronometrados para residência médica, integrada ao SanarFlix PRO. O aluno escolhe uma prova publicada, responde com persistência de progresso e recebe resultado/correção no horário definido. Ranking considera apenas tentativas elegíveis; treino e histórico continuam acessíveis. Segmentos e permissões vêm do banco.

## Transição 2027

Fonte de requisitos: HANDOFF-2027.md, HANDOFF-FASE0.md e docs/auditoria-enamed-2027.md. Edições permitem preparar 2027.2 enquanto 2027.1 está ativa, preservando 2026. Não há datas oficiais confirmadas para 2027. Exibir ausência de data explicitamente. Nenhuma referência de corte ou calibração TRI deve ser inventada.

Aluno: escolher alvo opcional, inclusive "Ainda não sei"; encontrar a prova da edição; distinguir treino/histórico de resultado elegível; compreender a referência dos cortes. Novos recursos ficam sob editions_ui no banco, desligada por padrão.

Operação: criar/editar edição, definir formato/blueprint e datas confirmadas, clonar simulado como rascunho com IDs novos e importar questões atomicamente. Conteúdo original e tentativas nunca são alterados pela clonagem. Publicação requer validação no servidor e capacidade content.manage. Erros de importação são apresentados por linha e nenhuma linha é gravada num lote inválido.

## Critério de qualidade

Fluxos antigos (UUID/slug), respostas, notas, rankings históricos e permissões mantidos. Estados vazio/carregando/erro/sucesso, acesso por teclado, leitura a 375px e dark mode. SQL em ambiente descartável e testes de regressão por tarefa. Dados/serviços externos ausentes mantêm recursos configuráveis ou indisponíveis; não aparecem como resultados reais.

Produção exige autorização específica para cada migration, extensão, função ou envio. O pedido de implementar e integrar código não fornece parâmetros de SSO, dados editoriais, DSN ou calibração estatística.
