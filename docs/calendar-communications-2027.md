# Calendar Communications 2027

## Estado Da Entrega

Preparacao local, sem deploy, envio, agendamento, extensoes ou backfill. A migration
e atomica e reaplicavel; ambas as linhas de `communication_config` nascem com
`enabled=false`. Os switches Edge tambem exigem o valor literal `true`.
Nenhum workflow externo foi criado ou identificado como pronto nesta tarefa.
Nao interpretar os testes como entrega de e-mail, aceite do produto ou SLA real.

Fontes inspecionadas: HANDOFF F2-6/F1-10, F0 Vault, `novu-email`, F1 targets,
definicao/ACL de `notify_hubspot_new_user` e colunas do PostgreSQL local integrado.
Nao houve consulta a producao. A definicao encontrada era F0, owner-only; preservar
essa verificacao contra o ambiente de destino antes de uma aplicacao autorizada.

## Publico E Calendario

- Somente simulados `published` de edicoes nao `closed`.
- Eventos `window_open`, `last24h` (fim menos 24h) e `results_released`, derivados
  das tres datas do simulado, nunca de codigo especifico de uma prova.
- `calendar_notifications` em `notification_preferences` e um opt-in novo,
  inicialmente **false**. Nenhuma preferencia antiga e convertida em consentimento
  de calendario. O frontend desta tarefa nao oferece uma nova jornada de opt-in;
  so habilitar apos definir a coleta/importacao autorizada desse consentimento.
- E necessario e-mail confirmado em `auth.users`, igual ao perfil, e alvo explicito
  em `onboarding_profiles.target_edition_id` **ou tentativa propria naquela edicao**.
  A edicao global/fallback de navegacao nao e uma lista de destinatarios.
  Ser guest/standard/pro nao muda o acesso a estes avisos de simulados.
- Supressoes administrativas: `communication_suppressions.unsubscribed` e
  `internal_account`. Importar as decisoes da fonte autoritativa antes de ligar;
  esta tarefa nao presume que o Novu ja tenha informado todos os unsubscribes.
  Dominios Sanar, Techpirata e Cetrus e seus subdominios tambem sao excluidos.
- A elegibilidade e revalidada no claim e imediatamente antes do HTTP; mudanca do
  e-mail desde o claim impede usar o endereco antigo. Persistencia de preferencias
  indisponivel causa falha, nunca opt-in presumido.

Watermark inicial e `now()` na instalacao. Cada descoberta considera apenas
`max(watermark, agora - 5 minutos)` ate agora. Reativacao nao recupera meses de
backlog. Eventos de janela deixam de ser enviados ao fechar; resultados so entram
no intervalo de cinco minutos da liberacao. Tentativas offline antigas nao sao
varridas para disparar mensagens retroativas. A presenca de tentativa propria e
apenas uma regra de audiencia de eventos novos, nao um gatilho de recuperacao.

Expansao paginada por UUID, por evento, com cursor privado e limite de 100 por
invocacao (RPC limita a 500). O worker processa dez envios sequenciais por rodada;
cada HTTP tem timeout de cinco segundos. O limite e intencionalmente conservador:
audiencia grande pode expirar antes de ser toda atendida na janela de cinco minutos.
Dimensionar com dados sinteticos e revisar capacidade antes de ativar; aumentar
concorrencia sob observacao e permitido, ampliar retrospectivo automaticamente nao.

## Fila E ACK

`communication_events` usa hash de edicao/datas para a revisao. Reprogramacao cria
chave nova quando a nova data entrar na janela de descoberta. Claim invalida revisao
antiga pendente. O indice semantico `(simulado,user,event)` impede reenviar um evento
ja enviado ou incerto mesmo quando o calendario muda. Nao se envia uma "correcao de
data" automatica a quem ja recebeu; isso exigiria decisao de Produto separada.

Transicoes: `pending -> claimed -> sending -> sent | uncertain`. Claim usa
`FOR UPDATE SKIP LOCKED`, token aleatorio e lease de dois minutos. Claim expirado
sem inicio de HTTP pode voltar a pending. `sending` expirado vira `uncertain`.
Start/complete com token vencido ou antigo falham. Conclusao `sent` exige `sending`.
Uma entrega incerta nunca volta automaticamente para pending.

O gateway atual nao documenta suporte a chave de idempotencia upstream. O worker
nao inventa header/transactionId e **nao promete exactly-once**: ACK perdido pode
significar e-mail aceito. Excecao, timeout ou resposta negativa vira uncertain,
sem retry HTTP automatico. Falha de persistencia do ACK deixa `sending`; apos o
lease expirar o proximo claim a reconcilia como uncertain. Operador deve verificar
o provedor e a fila antes de qualquer intervencao manual. Nao resetar estados de
sent/uncertain em massa nem usar reaplicacao da migration como replay.

## Contratos Edge

Os endpoints aceitam apenas POST com `x-internal-secret`, comparado em tempo
constante a `NOVU_RELAY_SECRET`; qualquer JWT isolado e insuficiente. Corpos de
requisicao nao selecionam audiencia, URL, workflow, data, destinatario ou HTML.

O relay existente `novu-email` aceita tipos de autenticacao, nao o contrato generico
de eventos. Ele foi preservado. O destino usado e o **fixo** ja existente:
`https://kong.app-prod.sanar.cloud/novu/fallback/v1/events/trigger`.
`NOVU_TRIGGER_URL`, se presente, deve ser exatamente esse destino; redirects sao
recusados. `SUPABASE_URL` deve ser exatamente o projeto conhecido:
`https://lljnbysgcwvkhlnaqxtt.supabase.co`. Nao ha URL arbitraria via env ou request.

Contrato Novu utilizado: `{ name, to: [{ subscriberId, email }], payload }`.
Nao ha overrides HTML nem secrets no payload. Calendario envia IDs da edicao e
simulado, evento, titulo, codigo da edicao, datas e CTA fixo de dominio Sanar para
a rota real `/simulados/:id`. Templates externos devem escapar titulo/conteudo,
respeitar unsubscribe no provedor e ter seu contrato aprovado antes de ligar.
Nenhum nome, nota, respostas ou dados academicos do estudante sao enviados.

Variaveis obrigatorias, **somente no servidor**, sem valores versionados:

| Endpoint | Configuracao |
| --- | --- |
| Ambos | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NOVU_RELAY_SECRET` |
| Calendario | `CALENDAR_DISPATCH_ENABLED=true`, `CALENDAR_WINDOW_OPEN_WORKFLOW_ID`, `CALENDAR_LAST24H_WORKFLOW_ID`, `CALENDAR_RESULTS_RELEASED_WORKFLOW_ID` |
| Operacoes | `OPS_DISPATCH_ENABLED=true`, `OPS_ALERT_RECIPIENT`, `OPS_WORKFLOW_ID` |

Falta de configuracao ou dispatch desligado retorna 503 com `skipped`, nao `ok
sent`. Metodos nao suportados: 405; segredo incorreto: 403; falha de job/ACK: 503.
Respostas/logs nao incluem e-mail, token, HTML nem erro bruto de Supabase/HTTP.
Configurar verify_jwt conforme o padrao interno em um deploy autorizado: o segredo
proprio permanece obrigatorio independentemente do gateway JWT.

## Operacoes

`ops_health_snapshot()` e service-only e retorna agregados: pendencias acima de dez
minutos (`pending`, `processing`, `failed`), falhas cron dos ultimos cinco minutos,
nomes dos jobs e quantidade de entregas incertas. Nao retorna alunos, comandos ou
mensagens de erro dos jobs. Se `cron.job_run_details`/`cron.job` nao existirem,
retorna `cron_dependency=not_installed`. Fila quebrada gera erro SQL, nunca saudavel.

Incidentes `queue_stalled`, `cron_failed`, `cron_missing`, `delivery_uncertain`
sao deduplicados enquanto persistirem. Mudancas geram `ops_incident` ou
`ops_recovery` no payload do workflow **configurado** em `OPS_WORKFLOW_ID`.
Esses nomes descrevem eventos; nao sao IDs inventados de workflows remotos.
Um incidente pode emitir no maximo uma transicao a cada cinco minutos; recovery
adiado e reavaliado nas proximas consultas. Destinatario e obrigatorio e nao tem
fallback para nenhum e-mail pessoal ou lista de alunos.

Polling previsto: uma vez por minuto. A deteccao de uma fila que passou do limiar
de dez minutos pode ocorrer na rodada seguinte. Isso permite o objetivo de alerta
em cinco minutos **apos deteccao**, mas exige cron, gateway, workflow e entrega
reais, todos pendentes de verificacao. Dependencia cron ausente retorna 503 mesmo
quando uma notificacao operacional foi aceita pelo gateway.

## HubSpot E Caderno

Trigger F0 de INSERT e preservado; UPDATE de email/nome/segment e INSERT/UPDATE de
alvo consultam o perfil canonico via Edge. UPDATE sem mudanca e noop, incluindo
NULL -> NULL. F0 continua exigindo exatamente um `HUBSPOT_SYNC_SECRET` nao vazio
no Vault e isolando falhas de lookup/enqueue para nao abortar cadastro/update.
Body interno agora contem apenas `{ user_id }`; o endpoint e internal-only e nao
aceita mais payload arbitrario de perfil, JWT admin ou modo bulk. Nenhum cadastro
real e reenviado nesta entrega.

HubSpot exige `HUBSPOT_SYNC_ENABLED=true`, `HUBSPOT_SYNC_SECRET`, URL/chave Supabase
validos e confirmacao explicita do contrato via
`HUBSPOT_SEGMENT_PROPERTY=segment` e
`HUBSPOT_EDITION_PROPERTY=enamed_edicao_alvo`. O endpoint nao cria propriedades
remotas. Segment vem de `profiles.segment`, edicao vem do `exam_editions.code`
referenciado pelo onboarding. Ausencia de alvo envia `enamed_edicao_alvo:null`
explicitamente. Confirmar que o webhook aplica NULL como clear antes do rollout.
O endereco oficial anterior do webhook HubSpot permanece fixo; nao ha URL em input.
Campos permitidos sao email/nome canonicos, segmento, codigo de edicao, source e
os campos anteriores `subscriber_type`/`registered_at`, derivados do perfil.
Sinais de ACK falho sao redigidos e nunca afirmam envio bem-sucedido. Esta integracao
continua best-effort/pg_net (sem nova fila duravel de retry HubSpot).

O scaffold `caderno-reminders` foi reduzido a no-op autenticado, com 503 e sent=0,
antes de consultar PII. Nenhum workflow/cadencia foi implementado como decisao nova.
No componente real `src/components/settings/NotificationsSection.tsx`, foram
ocultos os quatro controles: Revisao diaria, Sequencia de estudo, Reta final e
Triagem pos-prova. Nao havia emissor funcional para streak/reta-final/post-triage;
o de revisao diaria era scaffold sem aceite. Nenhuma preferencia e carregada,
reescrita ou apagada. Outros controles de Configuracoes e edicao permanecem.
Nao foram adicionadas flags/secrets frontend. Sem redesenho visual ou consulta
remota ao Dende nesta execucao offline; validacao visual em navegador e pendente.

## Rollout Manual

1. Revisar schema/ACL reais, consentimento, supressoes e contratos de workflows.
2. Aplicar migration com autorizacao separada; verificar RLS e grants service-only.
3. Deploy dos endpoints e secrets com autorizacao; manter dispatch desligado.
4. Confirmar mapping HubSpot e NULL clear em ambiente nao produtivo. Remover/atualizar
   clientes legados que chamem modo admin/bulk antes de deployar seu novo endpoint.
5. Fazer smoke sintetico autorizado e verificar ACK, timeout e unsubscribe reais.
6. Somente entao ligar env e config SQL de cada job, com watermark atualizado a agora.
7. Instalar pg_cron/pg_net/Vault apenas por operacao aprovada, se faltarem.
8. O SQL comentado ao fim da migration propoe cada job `* * * * *` usando
   `invoke_communication_job`, que le Vault em runtime. Nao executar automaticamente.

`invoke_communication_job` valida os dois nomes de jobs, dispatch e dependencias;
falha explicita sem segredo/dependencia. Um ID pg_net significa **enqueue**, nao
HTTP 2xx nem entrega Novu. Monitorar tambem as respostas HTTP em `net._http_response`
com acesso operacional restrito e sem imprimir payloads/headers. pg_cron pode
registrar sucesso do SQL mesmo quando o HTTP assincrono falha; nao usar somente
`job_run_details` para certificar a saude do relay.

Rollback seguro e atomico no fim da migration desliga config e remove triggers
HubSpot. Parar/remover cron manualmente e desligar env. Preservar fila, incidentes,
eventos e preferencias para auditoria. Um HTTP ja iniciado nao pode ser desfeito.
O rollback para completamente HubSpot (inclusive INSERT), nao restaura um relay
anterior permissivo. Para retomar, revisar e reaplicar migration/config separadamente.

## Verificacao Local

Banco `enamed_test_comms_001b_20261104`, clone de
`enamed_test_integrated_20261104_0920` em `127.0.0.1:54737`.
Esse template nao continha `notification_preferences` nem o campo de confirmacao
de email do auth real: foi aplicada a migration existente
`20260607130000_notification_preferences.sql` e adicionada a coluna de fixture
`auth.users.email_confirmed_at timestamptz` somente no clone descartavel.

Aplicar a migration desta tarefa duas vezes e executar
`supabase/tests/fase2_calendar_communications.sql` com `ON_ERROR_STOP=1`.
As fixtures usam doubles de Vault/HTTP/cron, desabilitam somente o gate de
publicacao de conteudo sintetico e fazem rollback. Nao executar em Supabase real.
O script exige nome `enamed_test_comms_%` e host loopback antes de fixtures.

Concorrencia: em outro clone, executar o mesmo arquivo com
`-v concurrency_setup=1`; depois dois processos psql paralelos com `-v worker=1`
e `-v worker=2`. Cada um exige um claim e segura seu lock por dois segundos.
Os IDs devem ser distintos. Nao reaplicar setup nesse mesmo clone.

Deno local: `../../fase1-edicoes/.superpowers/runtimes/deno-2.9.8/deno.exe`,
com `DENO_DIR=../../fase1-edicoes/.superpowers/runtimes/deno-cache`, `--cached-only`
e `--no-lock` (para nao gerar lockfile fora do escopo).
Rodar apenas os quatro `worker.test.ts`/`handler.test.ts` desta tarefa. Sem permissoes
de rede; todos os HTTPs sao mocks. `deno check --cached-only --no-lock` cobre os quatro indices
com o import ja cacheado de Supabase 2.49.4. Vitest local cobre o novo teste do
NotificationsSection e a regressao existente de ConfiguracoesPage. Suites globais,
build, revisao visual, rollout e integracoes reais ficam com o orquestrador.
