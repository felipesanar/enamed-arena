# Análises por edição e banco versionado

Esta interface consome os contratos de `edition-analysis-2027.md` e `question-bank-2027.md`. Não adiciona SQL, cálculos de nota, TRI, fontes de corte ou datas oficiais. `editions_ui` continua desligada por padrão; este trabalho não altera a flag nem aplica migrations.

## Aluno

O Comparativo mantém sua experiência atual na aba “Nesta edição” e acrescenta “Histórico por percentil”. A consulta longitudinal usa intencionalmente `get_my_percentile_history(p_edition_id: null)` para o próprio usuário. Edições aparecem em grupos separados, com data em America/Sao_Paulo, posição e população. Menor Top X% representa melhor posição relativa; ausência de percentil permanece indisponível, nunca zero. Amostras abaixo de 30 participantes recebem aviso. A tabela acessível preserva todos os pontos; não há uma série de notas brutas entre edições.

O Ranking mantém `useRanking`, a seleção por simulado, o provider da referência de corte e o contexto histórico existentes na aba “Simulado”. A nova aba “Edição” escolhe explicitamente a edição e consulta `get_edition_ranking`, com páginas de 50 e reset da página ao trocar a seleção. Política ausente ou desativada permanece não configurada; oferta insuficiente tem estado próprio. Cada participante informa simulados realmente considerados, concluídos e média dentro daquela edição. Nomes públicos são mascarados como “Candidato #posição”; a própria linha aparece como “Você”. `display_name` não é exibido.

No drawer de cortes, “Histórico da referência” recebe instituição, especialidade e cenário da linha selecionada. `specialty_id` foi acrescentado apenas à projeção da consulta já existente; não há busca adicional de catálogo, associação por nome ou fallback para o alvo atual. Campo canônico ausente mantém o histórico indisponível. Cenário vazio continua distinto de todos os cenários. Fontes/processos/anos/períodos são apresentados separadamente, sem setas, média de processos ou equivalência com a nota do simulado. Registros sem origem confirmada ficam separados.

Com a flag desligada, as novas experiências não são montadas e não consultam as novas RPCs. Os gates de segmento do Comparativo permanecem os existentes. A classificação publicada da edição segue o controle de acesso do backend, sem introduzir um gate PRO no aluno.

## Administração

`/admin/banco-questoes` exige a flag e `content.manage`. O menu acrescenta “Banco versionado”, preservando a rota anterior de questões dos simulados. A listagem busca somente pelo enunciado, com páginas de 50 e contagem real. O detalhe consulta versões apenas da identidade escolhida, com carregamento adicional explícito de páginas de 50.

O payload é apresentado como texto React, sem HTML executável. Imagens são identificadas por seus endereços textuais, sem carregamento automático. Versão selecionada e anterior podem ser comparadas; conteúdo igual não mescla identidades ou versões. “Foto do legado” representa observação, não autoria histórica. Versões incompletas continuam legíveis, mas não podem ser reutilizadas.

O reuso exige uma versão completa, um rascunho listado pelo serviço administrativo existente com contagem de tentativas confirmada em zero e um número de questão. Somente `admin_add_bank_version_to_simulado` grava a cópia. O backend valida formato, blueprint, área, posição, permissões e gera os novos IDs, mantendo a vinculação canônica. A confirmação oferece acesso ao simulado de destino. Não há publicação, alteração de tentativas ou atualização REST de conteúdo.

Conflito de lock permite atualizar os rascunhos e repetir manualmente. Uma confirmação incerta bloqueia novo envio e orienta conferir o destino; não há retentativa automática de mutação. Enquanto o envio está em andamento, a versão e o destino não mudam.

`intel.view` habilita exclusivamente a análise agregada da identidade selecionada. Sem essa capacidade, consulta e reuso continuam disponíveis. A apresentação mantém versão, edição, proveniência e participação separados. “Na janela” e “Treino ou fora da janela” descrevem `is_training`, não garantem elegibilidade completa para ranking. Acerto observado é proporção bruta, incluindo itens em branco; não representa TRI, calibração ou a versão comprovadamente exibida ao aluno.

Em Edições, configurar a política do ranking exige ambas as capacidades `content.manage` e `intel.view`. N e mínimo começam vazios, a ativação começa desmarcada e a justificativa é obrigatória. Todos os parâmetros são informados explicitamente; o formulário não pressupõe uma política existente. O backend controla oferta mínima, validação, auditoria e atomicidade.

## Identidade e atualização

Os adapters conferem a identidade esperada antes e depois das consultas. React Query usa usuário e escopo nas chaves, cinco minutos de staleTime e nenhum dado anterior como placeholder de outra conta/edição/referência. Logout esconde os dados imediatamente. Nenhum parâmetro de usuário é enviado ao endpoint longitudinal.

Prefixos: `my-percentile-history`, `edition-ranking`, `cutoff-score-history`, `analysis-editions`, `question-bank`, `question-bank-versions`, `question-bank-item-analysis` e `question-bank-drafts`. Finalização invalida o escopo do aluno. Reprocessamento e alteração administrativa de janela usam a invalidação global existente, sem iniciar consultas de alunos sob uma sessão administrativa.

`invalidateQuestionBankQueries` marca os três prefixos do banco como stale sem refetch após autoria de questão/alternativa/gabarito/exclusão, importação reconhecida, limpeza reconhecida e clonagem reconhecida. O refresh anterior das questões do simulado permanece. Reuso invalida também os rascunhos e somente as questões/estatísticas do destino, sem atingir dados administrativos não relacionados. A configuração de política invalida o ranking da edição. Nenhuma falha ou confirmação incerta é tratada como sucesso.

## Validação e limites

O protótipo aprovado está em `docs/design/edition-analysis-prototype.html`, com seis testes Node. A matriz do protótipo cobre 375/768/1440, claro/escuro, fontes diversas, textos longos e estados vazios/erro/carregando; não prova integração de backend.

Foram executados 126 testes em 20 arquivos do escopo, incluindo os fluxos administrativos e o fixture de countdown com QueryClient real e flag legada explicitamente desativada. Os testes anteriores de rótulos e mudanças de data entre edições permanecem. A checagem TypeScript restrita a 38 arquivos passou; dependências são resolvidas, mas a suíte/build/checagem global continuam com o orquestrador. Os logs privados de QA não são arquivos de produção.

A inspeção React usa componentes reais com serviços simulados e Edge headless local: histórico a 375px claro, reuso a 375px escuro e ranking/política a 1440px. Não é um teste de autenticação, Supabase gerenciado, publicação ou carga. O backend continua sendo a autoridade para capacidades, janelas, arquivamento, política, notas e preservação histórica.
