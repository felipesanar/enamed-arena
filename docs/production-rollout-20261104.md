# Rollout de produção — ENAMED 2027 — 04/11/2026

A execução remota pertence ao orquestrador. Os scripts operacionais não substituem nem modificam as migrations revisadas. A autorização cobre migrations, cron, publicação das Edge Functions e ativação de `editions_ui` após validação; disparos externos permanecem condicionados à configuração real de workflows, consentimentos e destinatários.

O checkpoint preserva o simulado existente `enamed-2027-simulado-1` em `2027.1`, com o mesmo UUID, slug, conteúdo, janelas e duas tentativas originais sem nota. A sequência global 8 passa a 1 apenas depois da remoção da unicidade global pela migration F1 original. Os sete simulados legados permanecem em 2026. Não há retarget de alunos, finalização, recálculo ou restauração de notas.

## Ordem obrigatória

1. Capturar, em uma transação, os onze snapshots `backup.rollout_20261104_*` e o ledger `backup.rollout_20261104_actions`. Manter owner `postgres`/`supabase_admin`, RLS e nenhuma permissão de API. Não usar actor JWT forjado nem registrar dados pessoais nos logs.
2. Aplicar as sete migrations F0 e dependências aprovadas; conferir os invariantes acadêmicos contra o snapshot.
3. Executar `supabase/ops/20261104_before_f1.sql` como owner sem `auth.uid()`. Esse checkpoint atribui apenas o simulado de slug exato à edição 2027.1, ainda com sequência 8. Corrige somente o S7 aprovado: se a liberação anteceder o fim, define `results_release_at=execution_window_end`, preservando início e fim.
4. Aplicar **sem alterações** `20261104065001_fase1_edition_model.sql`. O backfill original associa os demais simulados a 2026, preserva o alvo pré-semeado e preenche a proveniência das tentativas.
5. Executar `supabase/ops/20261104_after_f1.sql` imediatamente, **antes de 20261104072218** e antes de liberar novas escritas. O script exige snapshot e ledger anteriores, compara todas as colunas acadêmicas originais e renumera somente o alvo 8→1. Os `updated_at` derivados dos updates originais de F1 não são valores acadêmicos e podem mudar.
6. Continuar as migrations dependentes na ordem aprovada; validar RPCs/ACLs, schema cache e workers. Configurar e testar os segredos internos fora do repositório. Publicar workers não autoriza despacho de mensagens sem os seus contratos externos.
7. Validar a UI com conta sintética e só então ativar a flag pela operação administrativa auditada. Recarregar a aplicação para evitar os caches de cinco minutos da flag e uma hora do catálogo.

## Escopo do checkpoint pós-F1

O único alias adicionado é `Medicina de Família e Comunidade (MFC)` à área `medicina_familia_comunidade` do blueprint `inep-478-2025`. A normalização já existente cobre caixa, acentos e espaços. O preenchimento alcança somente questões com `area_id IS NULL`, texto normalizado exatamente igual e blueprint correspondente. `Preventiva`, `Clínica Médica/Preventiva` e `Saúde Coletiva/Preventiva` continuam sem interpretação automática. Alias presente em outra área do mesmo blueprint aborta a transação.

A constraint `simulados_edition_windows_check` só é validada após conferir todas as janelas finitas e ordenadas. Outra inconsistência exige interrupção; o script não escolhe uma nova data editorial. Datas oficiais 2027 continuam NULL; pesos permanecem provisórios. `editions_ui` continua false durante os checkpoints.

Os scripts usam transações e timeout curto de locks. O comparador acadêmico do pós-F1 tem statement_timeout de 180 segundos para o volume real de answers/results; isso não amplia o timeout dos locks nem permite retry cego. O pós-F1 obtém locks `NOWAIT` nas tabelas verificadas; concorrência deve gerar recusa e revisão, sem matar sessões de alunos. Idempotência preserva `captured_at` e os detalhes do ledger. Uma nova resposta, alteração de perfil ou outro dado acadêmico após o snapshot causa recusa por desenho: interromper e investigar, sem enfraquecer o comparador ou refazer snapshots silenciosamente.

## Validação local

A fixture `supabase/tests/rollout_20261104_ops.sql` aceita somente clones novos `enamed_test_rollout_ops_*`, em `127.0.0.1:54737` como postgres, com stub HTTP local explícito. Usa UUIDs gerados, oito simulados, 800 questões, duas tentativas antigas sem nota no alvo e uma tentativa legada pontuada. Snapshots de tabelas vazias também são comparados: inserções adicionais não ficam invisíveis.

Exemplo, usando o PostgreSQL portátil já disponível:

```powershell
& '..\fase0-2027\.superpowers\editions\pg17-1260616\pgsql\bin\createdb.exe' -w -h 127.0.0.1 -p 54737 -U postgres -T enamed_test_fixtures_integrated_f0_20261104_0cb2 enamed_test_rollout_ops_novo
& '..\fase0-2027\.superpowers\editions\pg17-1260616\pgsql\bin\psql.exe' -X -w -h 127.0.0.1 -p 54737 -U postgres -d enamed_test_rollout_ops_novo -f supabase/tests/rollout_20261104_ops.sql
```

Para cada negativo, criar outro clone e passar `-v negative=missing_snapshot`, `wrong_edition`, `active`, `score`, `occupied`, `academic`, `ambiguous_alias` ou `empty_snapshot_addition`. A fixture comprova a recusa e a ausência de checkpoint parcial. A validação local não comprova Auth gerenciado, entrega de mensagens ou integração real de cron.

## Recuperação controlada se F1 já foi aplicada sem o pré-checkpoint

Esse caminho é uma exceção operacional explícita, não uma retomada automática do script normal. O snapshot original permanece intocado mesmo quando há atividade legítima posterior. O caso identificado foi uma submissão offline legítima do S2 que adicionou nota 65; restaurar o snapshot antigo apagaria essa atividade.

O orquestrador deve revisar a procedência da atividade e executar `supabase/ops/20261104_repair_initial_assignment.sql` seguido do pós-F1 na **mesma transação**. A composição privada remove somente os delimitadores de transação no nível superior dos dois scripts; mantém todos os guards e usa uma única transação externa. Qualquer falha no pós-F1 deve desfazer também o reparo e a criação dos checkpoints dessa tentativa.

Antes de qualquer UPDATE de reparo, o script captura as dez tabelas acadêmicas atuais em novas tabelas `backup.rollout_20261104_stage_<t>`, projetadas no tipo da tabela de snapshot original por `jsonb_populate_record`. Assim, os campos novos de F1 não mudam a comparação das colunas antigas. O script não sobrescreve os onze snapshots originais. Os stages usam owner confiável, RLS e nenhuma permissão de API, sob locks dos writers. O ledger `live_activity_checkpoint` registra versão, fonte, motivo, timestamp e mapping exatos das dez tabelas; o pós-F1 não cria nem atualiza esse baseline.

O pós-F1 só usa os stages se o ledger `before_f1` também registrar `recovered_after_model=true`. Ele verifica os nomes, tipos e ordem das colunas contra o snapshot original, proteção de cada stage e coerência dos timestamps. Depois exige igualdade de todas as colunas acadêmicas atuais com o baseline novo. Divergência posterior, tabela ausente, grant de API ou mapping diferente aborta. Isso preserva a nota 65 aprovada e rejeita qualquer alteração posterior não capturada.

A identidade e as janelas do alvo/S7 continuam provadas pelos snapshots originais. As duas tentativas do alvo também conservam todos os valores de negócio originais. Somente o `updated_at` técnico dessas duas linhas pode mudar no reparo: os JSONs completos e ordenados `attempts_before`/`attempts_after` ficam nos ledgers, e o pós-F1 exige o estado final exato registrado. Nenhum timestamp de outra tentativa ou campo acadêmico é ignorado.

Para ensaiar, criar outro clone local e executar a mesma fixture com `-v recovery=true`. Ela aplica F1 sem o pré-checkpoint, simula `offline_pending→submitted` com nota 65, executa o reparo real e o pós-F1, verifica history/summary preservados e fingerprints de todos os originais e stages. Com `recovery=true`, os negativos adicionais são `stage_missing`, `stage_mapping`, `stage_grant`, `stage_types`, `stage_drift` e `stage_business`. O teste local não autoriza recapturar stages existentes ou ignorar atividade concorrente real.

## Ativação e recuperação

Antes da flag, conferir o relacionamento REST exato `simulados_edition_id_fkey`, leitura autenticada dos catálogos, formatos/matrizes válidos e RPCs com as assinaturas/ACLs esperadas. A conta sintética deve abrir Home, lista, calendário, seletor e estados neutros sem produzir notas ou tentativas de alunos. Sem alvo explícito, a inferência pode selecionar 2027.1 e mostrar catálogo vazio nessa edição; não migrar alunos em massa para preencher a tela.

`answer_freshness_v1` depende do probe de runtime e não de `editions_ui`. A migration pode ativar o writer v1 mesmo com a flag false; o relógio autenticado precisa funcionar. Desligar somente a flag não reverte esse protocolo.

Recuperação preserva dados: desligar a flag pela RPC administrativa auditada, manter snapshots, proveniência e guards, consultar o ledger e preparar correção adiante. Nunca restaurar a liberação antecipada do S7, apagar edições ou executar restauração acadêmica em massa automaticamente. Segredos, registros de alunos e notas não pertencem a este documento.

## Evidências desta execução

O backup físico gerenciado foi concluído em 04/11/2026 às 05:31:50 UTC, antes das alterações. Os onze snapshots originais e os dez stages adicionais permanecem privados, com RLS e sem grants para as roles de API.

Nesta execução, o preview pré-F1 foi desfeito por uma comparação incorreta da soma global após uma submissão offline legítima. O modelo F1 avançou antes da confirmação desse checkpoint. A recuperação revisada executou REPAIR e AFTER na mesma transação: preservou a nota 65 recebida, corrigiu somente os metadados do simulado 2027 e a liberação do S7, restaurou o guard e confirmou a igualdade das onze tabelas. A comparação final contra o stage encontrou zero registros antigos perdidos ou alterados indevidamente. A fila histórica de 399 itens permaneceu pendente.

As 31 migrations iniciais tiveram o conteúdo registrado conferido contra os blobs revisados. A migration de sessões recebeu somente o hash exato do corpo LF canônico de `create_attempt_guarded`; os demais baselines, ACLs, checkpoints e recusas de drift foram mantidos. A migration adicional `20261104130000` restringe catálogo e RPC de edições a usuários autenticados, conforme a regra do projeto. Nenhuma migration corretiva histórica de dados foi repetida em massa.

Foram publicadas vinte Edge Functions do código revisado. Os dois workers novos (`calendar-notifications` e `ops-health-alerts`) exigem JWT no gateway **e** segredo interno; suas configurações de despacho permanecem false, sem cron de mensagens. A revisão automática recusou um comando que forçava JWT desligado em seis funções; a alternativa adotada preservou os modos das quatro existentes e acrescentou a barreira de JWT aos dois workers novos. Antes de habilitar despacho futuro, é necessário validar o contrato real de invocação com essa barreira, os workflows, destinatários, consentimentos e Vault. Não houve reenvio de cadastros ao HubSpot nem envio deliberado de emails.

O smoke de Auth gerenciado passou em 34 verificações com conta sintética removida ao final: catálogo, relacionamento REST, relógio, capacidades v1, analytics vazias, recusas PRO/admin e gates das funções. O MCP corretamente rejeitou o JWT comum de sessão por ausência de `client_id`/`azp` OAuth e publicou metadados do emissor esperado; isso não equivale a validar um fluxo completo de consentimento OAuth.

O teste de navegador validou Home, seletor, lista e navegação direta ao calendário com Auth e catálogo reais. Para evitar gravar onboarding ou ativar a flag global antes da conferência, apenas as respostas da flag e do onboarding da conta sintética foram simuladas no navegador descartável. Nenhuma prova, nota ou escolha de edição foi gravada. O problema de navegação durante o carregamento da flag foi reproduzido e corrigido com 31 testes de escopo, mantendo a API booleana existente e a recusa após false/erro final.

O job `fase0-attempt-maintenance` foi retomado com o cutoff original de 04/11/2026 às 18:58:30.083656 UTC. As execuções naturais de 20:05 e 20:10 UTC tiveram sucesso; os 399 itens antigos continuaram preservados. O ledger privado registra `maintenance_resumed`; a habilitação final da interface deve registrar `editions_ui_enabled` na mesma transação da alteração de flag. Isso é auditoria operacional de owner, sem forjar usuário administrativo.

O relatório dos advisors não apresentou ERROR; há avisos sobre funções SECURITY DEFINER acessíveis às roles esperadas, configuração de Auth e funções legadas. Esses avisos não foram ocultados nem corrigidos por revogações indiscriminadas. Permanecem externos os contratos de SSO/validade PRO, datas oficiais, pesos definitivos, classificação das áreas históricas ambíguas e decisões sobre o passivo de tentativas. O rollout não inventa esses dados.
