# Integrações da Fase 0: Deploy

> **Propósito:** preparar a aplicação autorizada de I-01 e I-05, sem confundir scaffold local com integração ativa.
> **Audiência:** orquestrador, responsável pelo banco e operador de integrações.
> **Última revisão:** 2026-11-04.

## Estado E Limites

Este documento é um checklist futuro. Nenhuma migration remota, extensão, secret, chamada HTTP, backfill, publicação ou envio foi executado nesta tarefa. As permissões de acesso em produção não foram verificadas nesta sessão.

Fontes: snapshot de metadados de 04/11/2026 (`production-context.json` e `production-comments.json`), [auditoria](auditoria-enamed-2027.md), itens I-01, I-05, F-01 e F-02, e inventário CLI de 04/11 informado pelo orquestrador na ampliação de escopo.

- O inventário confirmou as três funções ACTIVE: gabarito v5, HubSpot v58 e PDF v70, todas com `verify_jwt=false`. Isso descreve produção no inventário, não um deploy desta correção. PDF não foi alterada neste escopo.
- O trigger `on_profile_created_hubspot` existe, mas sua função no snapshot omite `x-internal-secret`; as chamadas observadas falharam com 403.
- O snapshot lista `pg_net` e `supabase_vault`, não `pg_cron`, e não lista nomes de secrets Vault cadastrados.
- As migrations de tabela/RPC e cron de gabarito não constam como aplicadas no snapshot. Revalidar o histórico antes de qualquer aplicação.
- A nova função HubSpot local preserva o payload `email`, `full_name`, `segment`, `created_at`. Lê o secret a cada INSERT e retorna `NEW` mesmo se Vault/enfileiramento falhar; aviso não inclui perfil, valor de secret ou SQLERRM. Não há retry durável/backfill automático para cadastros pulados ou HTTP malsucedido.
- O helper SQL `invoke_gabarito_key_alerts()` lê Vault em cada chamada e retorna ID de enfileiramento ou NULL. Somente owner e `service_role` têm EXECUTE; anon/authenticated/PUBLIC não têm. A função de trigger não tem chamadores RPC, nem grant para `service_role`. Ambas usam `search_path=pg_catalog` e objetos de outros schemas qualificados.
- `net.http_post` necessariamente recebe o secret em headers na fila interna transitória do pg_net. Não copiar fila, headers ou respostas completas para logs/tickets; restringir acesso ao schema `net`. A garantia aqui é ausência de valor de secret em DDL, avisos e `cron.job.command`, não ausência de credencial na memória/fila de transporte.

## Autenticação HTTP

A v5 inventariada de `gabarito-key-alerts` não autentica o header recebido. A correção está implementada SOMENTE no código local: [auth.ts](../supabase/functions/gabarito-key-alerts/auth.ts), chamado no início do handler antes de qualquer leitura da chave `SUPABASE_SERVICE_ROLE_KEY`, criação de cliente administrativo ou consulta. O helper é puro, sem Deno, imports remotos, acesso a ambiente ou logs de credenciais.

- Somente POST com `x-internal-secret` exatamente igual ao `NOVU_RELAY_SECRET` configurado pode processar dados. A comparação segue o padrão de `novu-email`: rejeita comprimentos diferentes e percorre todos os caracteres de strings do mesmo comprimento sem saída antecipada por mismatch.
- Header ausente, vazio ou incorreto retorna 403. Configuração ausente, vazia ou somente espaços retorna 503, sem varrer dados e sem `dryRun` anônimo. JWT de admin e `Origin` não são alternativas de autenticação.
- `OPTIONS` retorna 204 sem processamento nem abertura de CORS. Os demais métodos retornam 405 com `Allow: POST, OPTIONS`.
- Com secret correto e `GABARITO_ALERT_EMAILS` ausente, mantém `dryRun: true` autenticado: pode consultar suspeitas, mas não envia nem grava dedup.
- A seção explícita `[functions.gabarito-key-alerts]` em `supabase/config.toml` mantém `verify_jwt=false`, coerente com o inventário, pois o gate é pelo secret. Essa configuração NÃO publica o código nem comprova que o gate está ativo em produção.

Os 22 testes locais do helper passaram. Ainda é necessário revisar e publicar o handler corrigido em janela aprovada, antes de ativar o cron. A pendência deixou de ser implementação HTTP e passou a ser deploy autorizado e verificação da versão publicada. ACL SQL não substitui autenticação HTTP.

Mesmo `dryRun: false`/200 não prova entrega: erros individuais de envio podem ser apenas logados, e ausência de suspeitas não gera e-mail. Verificar a cadeia completa até o relay/provedor e destinatário aprovado.

## Checklist De Preparação

- [ ] Obter autorização do Felipe para F-01 (`pg_cron`). Não há `CREATE EXTENSION` nestas migrations. Habilitação pertence ao operador aprovado, não a esta tarefa.
- [ ] Resolver drift F-02 e registrar quais migrations já foram aplicadas. Não executar `db push` irrestrito para tentar aplicar apenas I-01/I-05: há outros arquivos pendentes no repositório.
- [ ] Confirmar ambiente/alvo e URL das funções: os dois arquivos SQL usam o project ref histórico `lljnbysgcwvkhlnaqxtt`. Não apontar ensaio local para esse host.
- [ ] Confirmar owner confiável das funções, grants/default privileges, acesso do owner a Vault/pg_net e identidade do owner do job. Não conceder leitura do Vault a anon/authenticated.
- [ ] Provisionar via fluxo seguro, sem valores em SQL versionado, comandos cron, histórico de terminal ou tickets: `HUBSPOT_SYNC_SECRET` no Vault e no ambiente da Edge `hubspot-contact-sync`, com valores correspondentes.
- [ ] Provisionar `NOVU_RELAY_SECRET` no Vault e nos ambientes Edge de `gabarito-key-alerts` e `novu-email`, com valores correspondentes. Exatamente um registro não vazio por nome no Vault; nomes duplicados/valor vazio falham fechado.
- [ ] Configurar `GABARITO_ALERT_EMAILS` no ambiente Edge com destinatários aprovados. Revisar `ADMIN_BASE_URL` opcional e allowlist `ALLOWED_ACTION_HOSTS` de `novu-email`.
- [ ] Verificar configuração de Novu e variáveis injetadas pela plataforma (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) sem ler/imprimir seus valores. Secrets Vault não configuram automaticamente Edge secrets.
- [ ] Revisar a correção HTTP local, obter aprovação de deploy e publicar a versão corrigida de gabarito antes de qualquer agendamento. Verificar que o artefato inclui `auth.ts`; não presumir que v5 já contém o gate.
- [ ] Obter aprovação separada para o teste de envio e seus destinatários.

## Ordem De Aplicação

Somente em janela autorizada, após ensaio e revisão do diff. As instruções abaixo NÃO foram executadas em produção.

1. Confirmar F-02, dependências de schema e F-01 autorizado. I-01 pode ser aplicado independentemente de pg_cron; precisa de Vault, pg_net e secret para efetivamente enviar.
2. Preparar secrets/configuração Edge, publicar a correção HTTP de gabarito após aprovação e verificar o gate na nova versão. Manter `verify_jwt=false` com autenticação interna obrigatória; não ativar cron apontando para a v5 sem gate.
3. Aplicar [20260817160000_gabarito_key_alerts.sql](../supabase/migrations/20260817160000_gabarito_key_alerts.sql) se ausente, após confirmar `simulados`, `attempts`, `questions`, `question_options`, `attempt_question_results`, `has_role` e `auth.uid`. Esse arquivo cria tabela/RLS/dedup e RPC `gabarito_key_stats(uuid)` para service_role.
4. Após o aceite de segurança, aplicar [20260817160100_gabarito_key_alerts_cron.sql](../supabase/migrations/20260817160100_gabarito_key_alerts_cron.sql). Instala helper e tenta criar `gabarito-key-alerts-daily`, `0 12 * * *` (12:00 UTC, 09:00 BRT).
5. Aplicar [20261104052630_fase0_hubspot_vault.sql](../supabase/migrations/20261104052630_fase0_hubspot_vault.sql). Substitui a função, preservando o trigger existente. Se o trigger estiver ausente, parar e reconciliar o drift; a migration não o recria silenciosamente.
6. Validar metadados e respostas antes de declarar I-01/I-05 ativos. Registrar evidências sanitizadas e aprovação, sem payloads pessoais.

Uma migration concluída sem erro NÃO garante job instalado: ausência de interfaces pg_cron/pg_net, Vault inacessível ou secret inválido produz WARNING e não agenda. Se cron está disponível, o arquivo remove o job anterior ANTES de verificar net/secret, evitando deixar comando legado com segredo em execução. Erros inesperados de agendamento não são mascarados. Depois de resolver pré-requisitos, o operador deve reexecutar explicitamente o arquivo de cron revisado; o histórico da migration não o repetirá sozinho. A reexecução é idempotente. O helper consulta o secret novamente em cada execução, inclusive após rotação/remoção.

## Verificação Autorizada

Consultas de metadados para o operador no ambiente correto. Não selecionar `decrypted_secret`, headers, corpos da fila ou conteúdo integral de respostas.

```sql
SELECT extname FROM pg_extension WHERE extname IN ('pg_cron', 'pg_net', 'supabase_vault');
SELECT name, count(*) FROM vault.decrypted_secrets
WHERE name IN ('HUBSPOT_SYNC_SECRET', 'NOVU_RELAY_SECRET') GROUP BY name;
SELECT p.oid::regprocedure AS function_name, r.rolname AS owner,
       p.prosecdef, p.proconfig, p.proacl
FROM pg_proc p JOIN pg_roles r ON r.oid = p.proowner
WHERE p.oid IN ('public.notify_hubspot_new_user()'::regprocedure,
               'public.invoke_gabarito_key_alerts()'::regprocedure);
SELECT pg_get_triggerdef(oid) FROM pg_trigger
WHERE tgrelid = 'public.profiles'::regclass AND tgname = 'on_profile_created_hubspot';
```

Depois de confirmar que o schema cron existe, consultar sem exibir comandos legados:

```sql
SELECT jobid, jobname, schedule, active,
       command = 'SELECT public.invoke_gabarito_key_alerts();' AS safe_command
FROM cron.job WHERE jobname = 'gabarito-key-alerts-daily';
SELECT jobid, status, start_time, end_time
FROM cron.job_run_details
WHERE jobid IN (SELECT jobid FROM cron.job WHERE jobname = 'gabarito-key-alerts-daily')
ORDER BY start_time DESC LIMIT 10;
SELECT id, status_code, timed_out, created
FROM net._http_response ORDER BY created DESC LIMIT 20;
```

- [ ] Na versão corrigida, verificar POST sem header/incorreto → 403; GET → 405; OPTIONS → 204, sem acesso a dados e sem CORS aberto. Em ambiente isolado sem configuração, POST → 503; não remover secret de produção para forçar esse cenário. JWT de admin sozinho não deve autorizar.
- [ ] Esperado: exatamente um job ativo, horário correto, `safe_command=true`; owner do job capaz de executar o helper e owner do helper capaz de ler/enfileirar. Não imprimir `command` se houver suspeita de job legado. Se um valor já foi persistido no comando antigo, desagendar e rotacionar pelo fluxo seguro.
- [ ] Para uma chamada manual autorizada, `SELECT public.invoke_gabarito_key_alerts();` retorna o request ID. Isso ENFILEIRA uma chamada real e pode gerar e-mail: não é um health check inofensivo. Correlacionar esse ID com `net._http_response` em uma consulta posterior ao COMMIT, pois pg_net é assíncrono. Não manter a transação aberta esperando resposta.
- [ ] `cron.job_run_details.status='succeeded'` só prova SQL executado: helper pode ter emitido aviso/retornado NULL. A consulta de últimas respostas HTTP não prova por si só a origem; correlacionar o ID da chamada autorizada e a janela de execução, respeitando retenção do pg_net.
- [ ] Em gabarito, conferir HTTP 2xx E `dryRun: false`, logs sanitizados, relay/provedor e entrega ao destinatário aprovado quando houver suspeita nova. Validar dedup em `gabarito_key_alerts`; um 200 sem suspeitas não exercita e-mail. Não fabricar suspeitas em produção só para testar.
- [ ] Em HubSpot, após aprovar um cadastro de teste controlado, conferir ausência de WARNING, resposta HTTP 2xx e contato recebido no CRM em menos de 5 min (critério I-01). 403 sugere secret Edge/Vault divergente ou ausente; 400 exige revisar payload; 5xx exige revisar relay externo. Nunca corrigir expondo credenciais.
- [ ] Usar somente evidências redigidas: ID técnico, horário, status HTTP e resultado de verificação, sem email/nome/headers. Acesso ao CRM/provedor e permissão para envio ainda dependem do operador.

## Backfill HubSpot

Exige OK explícito do Felipe separado da correção do trigger. NÃO executar nesta tarefa.

O modo atual `bulk` lê TODOS os `profiles` com email não nulo, em páginas de 500, sem filtro por data e sem recorte dos cadastros perdidos desde 07/09. Usa secret interno (JWT de admin não autoriza bulk) e envia sequencialmente ao webhook do CRM. Não existe modo de simulação implementado nesse caminho. O total atual precisa ser levantado por metadados em procedimento autorizado; não assumir que coincide com os 1.006 cadastros citados na auditoria.

Para aprovação, explicitar volume total, reenvio de contatos antigos, possibilidade de reativar automações de marketing, duplicação conforme regras do CRM, limites do provedor, duração/timeouts e tratamento de falhas parciais. `success: true` no bulk não basta: conferir `total`, `sent`, `failed` e eventuais erros de leitura paginada nos logs; o código atual pode interromper a leitura e devolver contagens parciais. Não repetir automaticamente após timeout/resposta incerta. Se o escopo aprovado exigir apenas um intervalo de datas, abrir tarefa para essa capacidade; não executar bulk alegando que filtra datas.

## Rollback

1. Parar gabarito desagendando somente `gabarito-key-alerts-daily` com `cron.unschedule(jobid)`, se cron existir; depois remover `public.invoke_gabarito_key_alerts()`. Comandos comentados no final da migration. Isso não cancela chamadas já enfileiradas/enviadas; acompanhar filas pelo procedimento aprovado, sem expor dados.
2. Não reverter a Edge para a v5 sem autenticação como rollback da correção HTTP. Se necessário, manter cron parado e solicitar contenção autorizada do endpoint; restaurar somente uma versão que preserve o gate. Parar cron sozinho não bloqueia chamadas HTTP diretas.
3. Preservar `gabarito_key_alerts` e `gabarito_key_stats`: excluir dedup pode reenviar alertas. Rollback de tabela/RPC exige plano de dados separado.
4. Para parar HubSpot com segurança, remover somente `on_profile_created_hubspot` de `public.profiles` e depois sua função. NÃO restaurar o trigger antigo sem autenticação ou token literal. Cadastro segue funcionando sem sincronização; registrar intervalo perdido para backfill autorizado. Para retomar, reaplicar a função e recriar o trigger AFTER INSERT conforme comentário da migration.
5. Não remover extensões compartilhadas. Não apagar/rotacionar secrets compartilhados com outros consumidores sem coordenação. Rollback SQL não desfaz efeitos externos no CRM ou e-mails enviados.

## Testes Locais

[auth.test.ts](../supabase/functions/gabarito-key-alerts/auth.test.ts) importa somente o helper puro, sem importar o módulo Deno/remote. Executado com dependências existentes, sem rede:

```sh
npm run test -- supabase/functions/gabarito-key-alerts/auth.test.ts
```

Resultado: 22 testes passando, 0 falhando. Testes escritos antes do helper; após adequação ao setup `jsdom` existente, a suíte falhou pela ausência de `auth.ts` e passou depois da implementação. Cobre ausência/vazio/mismatch/comprimentos distintos, configuração ausente, autorização válida, JWT/origin sem alternativa, métodos e ausência de eco de credenciais. Não comprova deploy nem executa o handler Deno; o posicionamento do gate antes de acesso privilegiado foi revisado no código local.

[fase0_integration_jobs.sql](../supabase/tests/fase0_integration_jobs.sql) usa mocks de Vault, pg_net e pg_cron em transação com ROLLBACK. Requer PostgreSQL/psql, superuser, banco local vazio e descartável; recusa schemas/objetos de integração existentes. NUNCA executar no banco Supabase real, nem mesmo para validar: o teste não foi feito para banco migrado.

```sh
psql -X -h 127.0.0.1 -p 5432 -v ON_ERROR_STOP=1 -d fase0_integration_fixture -f supabase/tests/fase0_integration_jobs.sql
```

O banco deve estar previamente criado localmente pelo responsável. Em caso de erro, o psql encerra a sessão e a transação não commitada é revertida. Fixtures sintéticas usam domínio `.invalid`; o transporte é uma função mock que só escreve em tabela local.

Cobertura SQL prevista: payload/header HubSpot, RETURN NEW observado por trigger BEFORE na fixture, falta de secret/Vault/net, exceção de enqueue/ID nulo, rotação em runtime, idempotência do cron, remoção de job legado, ausência de segredo no comando, search_path e ACL incluindo chamada negada a authenticated. O trigger real permanece AFTER INSERT; a fixture BEFORE torna observável um retorno NULL incorreto.

TDD SQL: arquivo de testes escrito antes da implementação; tentativa de execução bloqueada porque `psql` não está instalado/disponível no PATH (também sem `postgres`/Docker no PATH). Portanto NÃO houve ciclo comportamental vermelho/verde SQL e nenhum teste SQL foi confirmado passando. O orquestrador precisa executar esse arquivo na engine local antes de aprovar o diff. Estes mocks não comprovam integração real das extensões nem comportamento da Edge/CRM/Novu. O verde dos testes HTTP não resolve essa pendência SQL.

## Pendências De Produção

- [ ] Revisão do SQL e execução das fixtures em engine local pelo orquestrador.
- [ ] F-02/drift reconciliado; F-01 aprovado pelo Felipe e pg_cron habilitado pelo operador.
- [ ] Secrets/configuração e dependências de tabela/RPC validados, sem divulgação de valores.
- [ ] Revisão, aprovação e deploy da autenticação HTTP implementada/testada localmente, com verificação do gate na nova versão antes de ativar cron. Não presumir publicação aplicada.
- [ ] Aplicação autorizada, confirmação do job e observação de HTTP/entrega sem `dryRun`.
- [ ] Aceite do cadastro de teste HubSpot e aprovação separada de impacto/volume para backfill.
