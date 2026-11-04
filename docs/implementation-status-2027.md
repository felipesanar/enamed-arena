# Execução ENAMED 2027 — 04/11/2026

Registro de implementação dos handoffs das fases 0–4. As entregas abaixo estão em revisão na PR #33, que incorpora a Fase 0 da PR #32. Felipe autorizou a implementação e o merge na main. Nenhuma mudança foi aplicada em produção; os critérios de conclusão operacional das fases ainda dependem do rollout e dos contratos externos abaixo.

## Implementação integrada

| Entrega | Evidência e limite |
|---|---|
| Fase 0: data no banco, integridade, liberação, finalização, preservação/PDF e correções operacionais | PR #32; seis checks verdes em 4b7a2b8. Incorporada na PR #33. SQL validado localmente; produção e destino das tentativas históricas pendentes. |
| F1: domínio, edições, formatos, matriz, admin, clonagem, importador, alvo, rótulos e histórico arquivado | Implementação integrada, com contratos, testes e rollback. Interface nova depende de app_config.editions_ui, desativada quando indisponível. |
| F1-7 / F3-7: home, seleção do simulado, percentil e React Query | Integrado. Histórico de áreas usa resultados elegíveis da edição. Consultas por conta e escopo com cache de cinco minutos; medição comparativa em bundle-analysis-2027.md mostra redução no chunk da home, sem alegar redução do total. |
| F1-5 / F2-5: importação de cortes e reprocessamento administrativo | Integrados. Reprocessamento exige autorização, motivo, preview e revisão do estado. Referência oficial dos cortes depende de D6. |
| F2-4: relatórios por edição e período | SQL, frontend, regras de sessão/janela e RBAC integrados. Filtros simultâneos: 99 testes independentes. Janela e cache: 89 testes integrados. Contagem ausente não vira zero; preview aceita corrigir a ordem histórica do S7, mantendo a janela nova estrita. Datas reais não foram alteradas. |
| F2-1 / F2-2 / F2-3: análises, IA e comparação histórica | Servidor e cliente integrados. Foto da especialidade e de todas as instituições é preservada no ranking fechado. Última revisão: 110 testes do escopo no OpenCode e 53 testes independentes do orquestrador. |
| F2-7: Caderno por edição | Filtros, contagens, paginação, exportação, revisão, treino e insights integrados. Cache dos insights inclui conta, edição e versão dos dados. Fixture com 1.500 entradas e seis cenários reais de interface aprovados. |
| Compatibilidade do motor no rollout | Finalização manual só recorre à assinatura antiga após ausência exata da RPC nova; comentários ausentes não viram respostas erradas. 78 testes independentes aprovados. Limitações antigas permanecem até aplicar o SQL. |
| F3-8 / F1-10: acessibilidade, recuperação e observabilidade configurável | Integrado após 50 testes do escopo, cinco testes de segurança do E2E e TypeScript sem erros. E2E real gerenciado e transporte de erros permanecem sem configuração externa. |
| F3-10: upgrades | Vite 7, Vitest 5, Zod 4 e MCP SDK 3 integrados. Audit sem high/critical; exceções resolvidas removidas. |

## Frentes complementares integradas

| Entrega | Estado |
|---|---|
| F3-6: proteção entre abas e respostas mais recentes | Integrada após revisão de compatibilidade. Verificação independente de integração: 107 testes em cinco arquivos; duas abas e concorrência SQL também validadas. |
| F3-5: recuperação de gabarito offline | Integrada após 67 testes independentes e exercícios de interface móvel/claro/escuro. Preservação por conta/tentativa, recuperação após falha do PDF e telemetria; sem mensagens ou alteração de backlog, nem alegação de aumento de conversão. |
| F3-1 / F3-4: calendário e plano pela edição | Helpers, protótipo e React integrados: rota de calendário, exportação ICS/Google Agenda e adaptação do plano pela data e matriz da edição. Datas oficiais desconhecidas continuam nulas. |
| F3-3 / F4-3 / F4-5: percentil longitudinal, ranking agregado e histórico de cortes | SQL, contratos e interfaces integrados; 69 verificações SQL independentes. Política N/mínimo explícita e auditada, sem valor oficial inventado. Cortes de processos/escala diferentes não viram tendência. |
| F4-2: banco versionado de questões | SQL e interface de identidades, versões imutáveis, usos, análise e reutilização explícita em rascunho integrados. Legado sem proveniência permanece identificado. Validação independente das interfaces F4: 117 testes em 19 arquivos; três vistas React revisadas. |
| F2-6: calendário, HubSpot UPDATE e alertas operacionais | Integrados com dispatch desativado, fila de entregas incertas sem repetição automática e configuração externa obrigatória. Toggles sem serviço operacional foram escondidos. Nenhum email foi enviado. |
| Integração das fixtures SQL antigas | 19 fixtures e helper passaram juntos contra todas as novas migrations. Setup sintético compatível com o gate de publicação; asserções de produto preservadas. |
| F3-9: higiene | Integrada: erro recuperável da home, código morto, copy, domínio/allowlist e documentação. Gitlinks temporários inválidos removidos do índice, com diretórios preservados. Hosting definitivo depende de confirmação externa. |
| Relógio durante rollout | Integrado após revisão cruzada e 72 testes independentes em sete arquivos. Contagem estimada segue sem RPC, sem autorizar auto/timestamps v1. Resync devolvendo tempo cancela grace antes do envio e rearma timer/anúncio; rejeição manual conhecida não impede auto futura, e ACK incerto não causa repetição automática. |

## Evidência do ambiente

- Treze migrations F1/F2 passaram juntas no clone vazio enamed_test_integrated_20261104_0920. As sete posteriores passaram juntas em enamed_test_all_20261104_1655, incluindo a dependência histórica canônica notification_preferences e a coluna de email confirmado no double local de Auth. PostgreSQL 17 local usa doubles explícitos de Auth/Storage/Vault/net/cron; isso não prova integração Managed Supabase.
- Outro clone desse conjunto, enamed_test_fixtures_integrated_all_20261104_1715, passou nas 19 fixtures aplicáveis e no helper de publicação, com assertions ativas. Drivers pré-instalação F0 jobs/F1 backfill não foram contabilizados nessa rodada; exigem preparação e evidência próprias.
- Segurança do gerador e pins: 30 testes aprovados; 72 arquivos Edge sem import externo não fixado. Harnesses SQL: 36 testes unitários aprovados, três casos de integração opcionais pulados, sem falhas. Concorrência real foi verificada separadamente nos clones das tarefas.
- Protótipos integrados: 98 testes Node aprovados. Build local do conjunto de código e8de066 aprovado com envDir=false e valores públicos fictícios; métricas em bundle-analysis-2027.md. Os avisos de chunk grande e anotações PURE do Zod não foram ocultados.
- TypeScript global aprovado após completar a fixture de respostas do teste de Lifecycle; seus 29 testes passaram novamente. Lint global: zero erros e 313 avisos; os 14 arquivos TS/TSX finais do relógio passaram também sem avisos. Não foram desativadas regras para obter aprovação.
- Reprocessamento: 49 asserções e 15 verificações reais de concorrência independentes. Histórico arquivado: 76 asserções. Nenhuma tentativa real foi reprocessada ou finalizada.
- IA servidor: 26 testes Deno e 22 MCP independentes. Gerador oficial em Linux: duas emissões determinísticas; 30 testes de segurança do gerador aprovados. O grafo JS da cópia byte-idêntica passou; o artefato .ts gerado pelo SDK mantém diagnósticos strict conhecidos. Não foi editado à mão para escondê-los.
- O checkpoint 524df44 passou nos sete checks remotos, incluindo 2.129 testes em 261 arquivos, 30 testes de segurança, 25 testes Deno, lint, tipos, pins, audit e build. A separação Deno/Vitest preserva os testes legítimos; o build depende de ambos. A cópia global Windows foi encerrada como redundante após o mesmo código passar no CI, sem declarar aprovação local dessa execução. O HEAD de integração deve passar novamente nos sete checks da PR #33; esse checkpoint não substitui a verificação final.
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
10. **Conteúdo e infraestrutura:** pesos/aliases ambíguos, provedor definitivo de deploy, workflows, destinatário operacional, consentimentos/supressões e capacidade da fila exigem confirmação externa.

## Integração e produção

A entrega da PR #33 deve entrar na main somente após revisão e os sete checks verdes no HEAD exato. O checkout principal sujo e seu MCP de outra sessão permanecem intocados. A integração Git não habilita editions_ui. Seguir os runbooks e a ordem: snapshot e pré-condições → migrations → invariantes → Edge Functions → frontend/flag → observação.

Habilitar pg_cron, aplicar migrations, corrigir datas do S7, publicar Edge Functions, configurar workflows/secrets, ativar flags e reenviar cadastros/emails são ações separadas de produção, sujeitas à aprovação específica prevista no handoff. Nenhuma dessas ações foi executada. Conferir ACLs e definições reais antes do rollout; não alterar hashes de segurança para contornar divergências.
