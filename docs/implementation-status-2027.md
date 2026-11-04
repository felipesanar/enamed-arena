# Execução ENAMED2027 — estado em04/11/2026

Este arquivo registra evidência e dependências do trabalho autorizado nos handoffs. Não representa aprovação de produção. A entrega continua em implementação; não declarar todas as fases concluídas enquanto houver itens abaixo.

## Evidência já obtida

- Fase0: PR32, seis checks CI verdes no commit4b7a2b8. SQL ensaiado em PostgreSQL17 isolado com catálogo sanitizado, Auth/Storage/Vault/net/cron representados por doubles explícitos.
- Conjunto das edições: PR33 com base main em rascunho, seis checks CI verdes em1cb2ce0. Interface nova depende de app_config.editions_ui e falha fechada quando a flag/catálogo não estão disponíveis.
- Front integrado em3c1cb39:1351testes/166arquivos; TypeScript,lint ebuild semerros. Alterações posteriores exigem nova validação ao integrar.
- Treze migrations F1/F2 aplicadas juntas em ordem cronológica no clone vazio enamed_test_integrated_20261104_0920: todas passaram. Isso não equivale ao replay limpo das180migrations históricas, que contém drift conhecido.
- Reprocessamento:49ASSERT+15verificações reais de concorrência independentes; nenhuma operação sobre tentativas reais. Histórico arquivado:76ASSERT no clone independente. Relatórios administrativos: comparações legadas não vazias, negativas de autorização, falha injetada, reapply e rollback; fixture também passou no catálogo integrado.
- Integração de fixtures antigas: setup de provas publicadas deve ser adaptado ao gate administrativo novo. A fixture de reprocessamento precisa de cenário published para validar ranking pós-F2. Essas falhas de compatibilidade de setup não foram contadas como aprovação integrada.
- IA servidor:26testes Deno e22testes MCP independentes; fontes em57b6cd6. Bundle MCP regenerado pelo plugin oficial Linux, duas emissões determinísticas e check do grafo JS da cópia byte-idêntica passou. Verificação de segurança do gerador está sendo atualizada para autorizar somente o RPC de leitura por edição. O artefato .ts gerado pelo SDK tem diagnósticos strict conhecidos; não foi editado à mão para escondê-los.

## Frentes em execução

| Entrega | Estado |
|---|---|
| F1 domínio/modelo/matriz/admin/clonagem/importador/alvo/labels | Integrados e revisados; rollout e baseline completo pendentes |
| F1-7 home, simulado atual e F3-7 React Query | OpenCode f1-home-queries-6328; revisão final pendente |
| F1-5 importação de cortes e F2-5 ação de reprocessar | Agente admin_ops + jobf2-admin-ops-ui-8255; protótipo revisado, React em execução |
| F2-4 período/edição global admin | SQL integrado; agentadmin_ops/period-phase-a-334e e admin-session-server-41d1 para frontend, RBAC e regra presencial/recálculo |
| F2-7 caderno por edição, paginação, counts, export e insights | Agentnotebook_front/notebook-front-a-8a19; SQL adicional de filtros e protótipo antes React |
| F2-2 cliente IA/cache e referência de cortes | ai-client-c552 enfileirado; servidor integrado |
| F3-6 conflito entre abas | Agentmultitab/f3-multitab-6cd9; SQL freshness + lease e teste real2abas em andamento |
| F3-8 acessibilidade, preload e F1-10 integração configurável/E2E | Agentmultitab/f3-a11y-reliability-d0c7 enfileirado; observabilidade real depende de conta/DSN e secrets |
| F3-5 recuperação offline | Agentmultitab/f3-offline-recovery-c9dc enfileirado; sem envio de emails e sem tocar backlog |
| F3-1 calendário e F3-4 plano pela edição/matriz | calendar-study-a-d4bd enfileirado, protótipo/helpers antes React |
| F3-3 percentil longitudinal e F4-3/F4-5 consultas de edição/cortes | edition-analysis-d10a enfileirado; política N configurável sem seed inventado |
| F4-2 banco versionado de questões | question-bank-5416 enfileirado; preservar IDs/respostas/histórico, proveniência aproximada explícita no backfill |
| F2-6 calendário/HubSpot UPDATE e alertas operacionais | calendar-comms-001b enfileirado; dispatch desativado e configuração externa obrigatória |
| F3-10 upgrades | Integrado, audit sem high/critical, exceções resolvidas removidas; limitação strict do SDK documentada |
| F3-9 higiene | A executar após estabilizar diffs das frentes de confiabilidade |

## Dependências que código não substitui

1. F1-0: exportação do baseline completo e tipos gerados depende de permissões indisponíveis. Não arquivar migrations antigas nem afirmar dbdiffvazio. Catálogo sanitizado é evidência parcial.
2. D1: destino das399+1655tentativas históricas não foi decidido nem aplicado. O código não autoriza finalizar/reclassificar esses dados.
3. D6: fonte e escala de cortes precisam de Conteúdo/Produto. Não inventar referência ou reaproveitar valores sem fonte como2027.
4. D2/F2-8/F4-4: contrato HMAC/SSO e validade PRO precisam da SanarFlix. Não inventar protocolo nem expirar assinantes legados.
5. D10/F3-2: jornada específica do4ºano requer definição de produto; campo de graduação já existe sem jornada fictícia.
6. D11/F1-10: Sentry/DSN e credenciais de teste CI ausentes. Configuração opt-in e testes locais não são operação real em cinco minutos ou E2E gerenciado aprovado.
7. F4-1: calibração TRI precisa de estatístico/dados por item. Não fornecer estimativa de proficiência ou intervalo fabricado a partir de percentual bruto.
8. D12: funções one-off em produção continuam exigindo revisão individual; mentoria-export é trabalho ativo.
9. D13: calendário oficial fica null até fonte oficial; exemplos de UI/testes são demonstrações.

## Integração e produção

Main só será atualizada ao terminar a implementação revisável e os checks necessários; o checkout principal sujo e seu MCPcorrompido permanecem intocados. O merge final foi autorizado pelo usuário. Habilitarpg_cron, aplicar migrations, publicarEdge, configurarworkflow/secrets e reenviarHubSpot/emails exigem aprovação específica do handoff e não foram executados.