# Regras administrativas de sessão e janela — contrato do orquestrador

Escopo F2-4/A05–A08. Não há autorização de execução em produção. A migration reservada é 20261104120004_fase2_admin_session_rules.sql; checkpoints privados e rollback preservam os dados e recusam sobrescrever mudanças posteriores.

## Autorização e auditoria

As duas Edge Functions de verificação usam o JWT real do chamador: getUser e admin_require(content.manage) no cliente com esse JWT, antes de criar/usar o cliente de serviço. A exclusão usa users.manage (capability existente, atribuída a admin e support), mantendo bloqueio de autoexclusão e CORS. Identidade de ator não vem de um campo user_id enviado pelo cliente. As escritas administrativas passam a registrar ator e diff sem restaurar o trigger antigo: F0 tg_admin_audit já corrige RECORD e produz before/after/diff.

## Regra presencial versionada

presencial_sessions.ranking_rule aceita legacy_online_window e session_window_v1; existentes e chamadas antigas permanecem legacy. O upsert administrativo acrescenta p_ranking_rule ao final, com null preservando a regra existente ou escolhendo legacy numa criação legada. Nenhum overload ambíguo é mantido.

Um RPC novo exclusivo de serviço, create_or_convert_presencial_attempt_for_session, valida a sessão ativa, o simulado e a janela antes de chamar a criação/conversão existente. Um checkpoint privado imutável registra a primeira sessão válida, versão/regra, janela e horário de check-in. Repetição não retargeteia uma tentativa para outra sessão. Para submissões não vinculadas, a regra é congelada ao criar a submissão, antes do vínculo administrativo posterior; o vínculo propaga esse contexto sem recalcular qual regra era vigente. Alterar a sessão depois não altera tentativas antigas.

session_window_v1 considera check-in e envio dentro da janela congelada da sessão, com IDs consistentes. Funciona fora da janela online; envio fora da sessão não se torna elegível apenas porque a janela online está aberta. Sem esse snapshot, a regra completa legada permanece. O fluxo autenticado offline com caderno é diferente do Edge fiscalizado com sessão: preservar o hotfix de caderno sem ampliá-lo para novas situações. Não recalcular automaticamente o histórico, finalizar tentativas pendentes nem modificar notas/respostas/modalidade/deadline/snapshots acadêmicos.

## Alteração explícita de janela

admin_preview_simulado_window recebe simulado e as três datas novas e devolve hash da janela atual e contagens agregadas antes/depois. admin_update_simulado_window recebe também hash esperado e motivo, exige content.manage + attempts.manage e atualiza janela e elegibilidade na mesma transação. Valida start < end <= release; hash obsoleto falha e não substitui alterações concorrentes. Auditoria e checkpoint acompanham o commit ou o rollback integral.

Online usa started_at; offline finalizado usa o horário de submissão correspondente e preserva a exceção legada de caderno. O presencial com regra congelada session_window_v1 conserva a elegibilidade da sessão; presencial legado usa a semântica anterior. Não recalcular notas ou reescrever respostas por alterar a janela. O relatório expõe somente operation_id, simulado_id, quantidades e diff da janela.

O guard de UPDATE direto precisa consultar a existência real de tentativas mesmo quando o chamador é um content_editor que não enxerga tentativas de alunos por RLS. Um trigger SECURITY INVOKER que consulta attempts sob RLS e conclui que não há dados seria um bypass. Um trigger SECURITY DEFINER não pode usar current_user=postgres como prova de origem, pois esse também é o current_user de um UPDATE direto que acione o trigger. Um GUC simples gravável por set_config também não prova autorização. Usar atestação privada da operação, restrita ao RPC e vinculada à transação/backend/ator, ou outro mecanismo equivalente cuja origem o authenticated não possa forjar. Testar explicitamente UPDATE direto como editor com tentativas invisíveis e tentativa de falsificar GUC. Manutenção privilegiada não deve ser confundida com SET ROLE authenticated numa conexão postgres de teste.

Locks devem ser compatíveis com finalizadores e persistência: o guard F0 de answers já toma attempt FOR UPDATE; finalizadores tomam attempt antes do parent simulado. A nova operação de janela não deve esperar por attempt depois de segurar parent enquanto um finalizador espera por esse parent. NOWAIT e erro 55P03 antes de qualquer write são aceitáveis e precisam ser testados com duas conexões reais. Não alterar o novo versionamento de answers da frente multiaba.

## Validação e entrega

Somente clones descartáveis enamed_test_admin_session_* em 127.0.0.1:54737, postgres, com guard antes de qualquer escrita. Testar JWT/capabilities positivos e negativos, legacy/defaults, sessões e limites de horários, vínculo tardio/unlinked, reatribuição, imutabilidade, retry/concorrência, stale hash, rollback, reaplicação, atomicidade e preservação de respostas/notas. A implementação frontend será outra rodada: não alterar forms ou adminApi nesta tarefa de servidor.

## Baseline local confirmado nesta execução

Consulta somente leitura em `enamed_test_f1_admin_review_20261104`, servidor `127.0.0.1:54737`, session_user `postgres`: `users.manage` pertence a `admin` e `support`; `content.manage` a `admin` e `content_editor`; `attempts.manage` a `admin` e `support`. As definições atuais foram consultadas por `pg_get_functiondef`, incluindo upsert, criação/conversão, submissão, vínculo, autorização e auditoria. `admin_require` retorna void: sucesso é ausência de erro, não um booleano em data. `admin_log_action` deriva o ator de `auth.uid()`; as Edges devem chamá-lo pelo cliente JWT e não pelo cliente de serviço.

## Integração de leitura para editar a sessão

O contrato de sessão precisa completar o ciclo de edição: admin_presencial_sessions_list deve devolver ranking_rule ao final das colunas atuais, preservando a assinatura sem argumentos, capability, owner/ACL e demais contagens/campos. Sem essa informação, a interface não sabe qual regra está editando e pode sobrescrever uma sessão v1 como legada. Expandir o retorno na mesma migration, com checkpoint/rollback e sem overload ambíguo, é parte deste escopo SQL; nenhuma alteração de frontend nesta rodada. Testar sessão legada e v1 na leitura autorizada e as permissões negativas. Clientes antigos que ignoram a coluna adicional permanecem compatíveis.

## Revisão do limite de confiança do guard

O guard INVOKER aceita o papel SQL efetivo privilegiado de um RPC DEFINER; isso não identifica sozinho qual RPC iniciou a escrita. A revisão somente leitura de 04/11/2026 no catálogo integrado mais esta migration encontrou quatro writers públicos de `simulados`: `admin_update_simulado_window` escreve as datas; `admin_publish_simulado` escreve só `status`; `admin_import_questions` e `admin_delete_question` escrevem só `questions_count`. Não há função pública DEFINER executável por `authenticated` com SQL dinâmico (`EXECUTE`) nesse catálogo. O snapshot sanitizado pré-F0 e as migrations de 04/11 também não mostraram outro writer de datas. Não houve bypass concreto que exigisse ampliar o guard para uma atestação por operação nesta entrega. Se um RPC DEFINER novo vier a aceitar alteração de datas, sua revisão deve aplicar o mesmo contrato de capabilities, recálculo, locks e auditoria ou introduzir uma atestação privada específica antes de habilitá-lo. Nenhuma conclusão depende de `session_user=postgres` em uma conexão que fez `SET ROLE authenticated`.

Os dois FKs das tabelas auxiliares privadas `attempt_rules` e `submission_rules` acompanham por CASCADE exclusivamente a vida do seu attempt/submission. Essa decisão preserva o fluxo administrativo explícito de exclusão já existente; não concede DELETE ao aluno nem altera os RESTRICT acadêmicos da F0. Não há autorização de excluir dados reais.

## Revisões aprovadas durante implementação

As quatro criações guarded/conversoras leem o simulado com FOR SHARE antes de derivar datas; o lock tardio da FK não impediria uma inserção com janela antiga após recálculo concorrente. Nenhuma tentativa existente tem seu deadline reescrito por esse patch. Retry de presencial preexistente sem snapshot não cria proveniência retroativa. O wrapper serializa o estado pré-conversão e só congela novas criações/conversões.

Somente as FKs auxiliares de attempt_rules e submission_rules acompanham exclusão do respectivo pai com ON DELETE CASCADE, inclusive na reaplicação. Nenhum RESTRICT F0, ACL de exclusão, permissão do aluno ou registro acadêmico é ampliado por essa decisão.
