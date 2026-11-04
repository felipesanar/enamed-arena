# Execução ENAMED 2027 — 04/11/2026

Registro de implementação dos handoffs das fases 0–4. As entregas abaixo estão em revisão na PR #33; este documento não representa aprovação ou aplicação em produção. O merge final na main foi autorizado pelo Felipe.

## Implementação integrada

| Entrega | Evidência e limite |
|---|---|
| Fase 0: data no banco, integridade, liberação, finalização, preservação/PDF e correções operacionais | PR #32; seis checks verdes em 4b7a2b8. Incorporada na PR #33. SQL validado localmente; produção e destino das tentativas históricas pendentes. |
| F1: domínio, edições, formatos, matriz, admin, clonagem, importador, alvo, rótulos e histórico arquivado | Implementação integrada, com contratos, testes e rollback. Interface nova depende de app_config.editions_ui, desativada quando indisponível. |
| F1-7 / F3-7: home, seleção do simulado, percentil e React Query | Integrado. Histórico de áreas usa resultados elegíveis da edição. Medição comparativa de bundle ainda pendente. |
| F1-5 / F2-5: importação de cortes e reprocessamento administrativo | Integrados. Reprocessamento exige autorização, motivo, preview e revisão do estado. Referência oficial dos cortes depende de D6. |
| F2-4: relatórios por edição e período | SQL e frontend integrados. Correção de alterações simultâneas de filtros validada independentemente em 99 testes; contagens ausentes no backend antigo são desconhecidas, sem permitir exclusão insegura. Regras de sessão/janela e RBAC adicional continuam em implementação. |
| F2-1 / F2-2 / F2-3: análises, IA e comparação histórica | Servidor e cliente integrados. Foto da especialidade e de todas as instituições é preservada no ranking fechado. Última revisão: 110 testes do escopo no OpenCode e 53 testes independentes do orquestrador. |
| F2-7: Caderno por edição | Filtros, contagens, paginação, exportação, revisão e treino integrados. Fixture com 1.500 entradas e seis cenários reais de interface aprovados. Backend de insights continua separado em execução. |
| Compatibilidade do motor no rollout | Finalização manual só recorre à assinatura antiga após ausência exata da RPC nova; comentários ausentes não viram respostas erradas. 78 testes independentes aprovados. Limitações antigas permanecem até aplicar o SQL. |
| F3-8 / F1-10: acessibilidade, recuperação e observabilidade configurável | Integrado após 50 testes do escopo, cinco testes de segurança do E2E e TypeScript sem erros. E2E real gerenciado e transporte de erros permanecem sem configuração externa. |
| F3-10: upgrades | Vite 7, Vitest 5, Zod 4 e MCP SDK 3 integrados. Audit sem high/critical; exceções resolvidas removidas. |

## Em implementação ou revisão

| Entrega | Estado |
|---|---|
| F3-6: proteção entre abas e respostas mais recentes | Integrada após revisão de compatibilidade. Verificação independente de integração: 107 testes em cinco arquivos; duas abas e concorrência SQL também validadas. |
| F3-5: recuperação de gabarito offline | Em execução. Preservação por conta, recuperação após falha do PDF e telemetria; sem mensagens nem alteração de backlog. |
| F3-1 / F3-4: calendário e plano pela edição | Helpers e protótipo integrados após 29 testes de lógica e 19 de protótipo. React, rota e adaptação do plano em execução. |
| F3-3 / F4-3 / F4-5: percentil longitudinal, ranking agregado e histórico de cortes | SQL e contratos revisados; 69 verificações independentes aprovadas. Interface em tarefa paralela. Política N configurável, sem valor oficial inventado. |
| F4-2: banco versionado de questões | Camada de versões e uso validada localmente; complemento de reutilização explícita em rascunho e listagem em execução. |
| F2-6: calendário, HubSpot UPDATE e alertas operacionais | Em execução com dispatch desativado e configuração externa obrigatória. Nenhum email foi enviado. |
| Integração das fixtures SQL antigas | Em tarefa separada. Adequação do setup sintético ao gate de publicação, preservando todas as asserções de produto. |
| F3-9: higiene | Gitlinks temporários inválidos removidos do índice, com diretórios preservados. Demais verificações após estabilizar confiabilidade. |

## Evidência do ambiente

- Treze migrations F1/F2 passaram juntas, em ordem cronológica, no clone vazio enamed_test_integrated_20261104_0920. PostgreSQL 17 local usa doubles explícitos de Auth/Storage/Vault/net/cron; isso não prova integração Managed Supabase.
- Reprocessamento: 49 asserções e 15 verificações reais de concorrência independentes. Histórico arquivado: 76 asserções. Nenhuma tentativa real foi reprocessada ou finalizada.
- IA servidor: 26 testes Deno e 22 MCP independentes. Gerador oficial em Linux: duas emissões determinísticas; 30 testes de segurança do gerador aprovados. O grafo JS da cópia byte-idêntica passou; o artefato .ts gerado pelo SDK mantém diagnósticos strict conhecidos. Não foi editado à mão para escondê-los.
- A última execução remota em 7cddb70 encontrou falhas de lint e composição de testes, além de um bug real no filtro administrativo. Correções já integradas exigem nova execução de CI no HEAD atual. Checks anteriores verdes não são evidência do conjunto final.
- O replay limpo das 180 migrations históricas tem drift conhecido. Não foi declarado db diff vazio.

## Dependências externas preservadas

1. **F1-0:** exportação do baseline completo e tipos gerados depende de permissões indisponíveis. Migrations antigas e tipos gerados não foram substituídos por aproximações.
2. **D1:** destino das 399 + 1.655 tentativas históricas. Nenhuma decisão de reclassificação ou finalização foi inventada.
3. **D6:** fonte e escala dos cortes. Dados sem referência não são atribuídos a 2027.
4. **D2 / F2-8 / F4-4:** contrato HMAC/SSO e validade PRO com a SanarFlix. Não expirar assinantes legados sem contrato.
5. **D10 / F3-2:** jornada específica do quarto ano e primeira etapa ainda depende de definição de produto.
6. **D11 / F1-10:** conta/DSN do monitoramento e credenciais de staging no GitHub. Os testes locais não equivalem a E2E real ou alerta operacional em cinco minutos.
7. **F4-1:** calibração TRI exige estatístico e dados por item. Percentual bruto não foi apresentado como proficiência ou intervalo de confiança.
8. **D12:** funções one-off em produção exigem revisão individual; mentoria-export permanece trabalho ativo.
9. **D13:** datas oficiais permanecem nulas até divulgação. Datas de protótipos são demonstrações.

## Integração e produção

A main será atualizada após a implementação revisável e os checks necessários. O checkout principal sujo e seu MCP de outra sessão permanecem intocados. Habilitar pg_cron, aplicar migrations, publicar Edge Functions, configurar workflows/secrets e reenviar cadastros ou emails são ações separadas de produção, sujeitas à aprovação específica prevista no handoff. Nenhuma dessas ações foi executada.

