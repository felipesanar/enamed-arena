# Edição-alvo — extensão dos fluxos existentes

Modo Operate. Inherit PRODUCT.md e DESIGN.md, componentes reais de onboarding, configurações e home. Não é redesign. A etapa nova ajuda o aluno a informar quando conclui o curso, oferece edição sugerida por metadata real e permite "Ainda não sei". Datas oficiais de 2027 permanecem desconhecidas. Não criar jornada do quarto ano nem regras de etapa sem decisão de Produto.

Cadastro novo com flag ativa: etapa "Sua edição" antes de Especialidade → Instituições → Confirmação. Ano/semestre de conclusão são opcionais; edição pode ser sugerida pelo resolver existente. O aluno confirma uma edição ou escolhe explicitamente "Ainda não sei". Flag desligada preserva as três etapas atuais. A confirmação final mostra os dados escolhidos e respeita o parâmetro next do fluxo presencial.

Aluno antigo: aviso discreto na home quando não há alvo explícito, sem redirecionamento ou bloqueio. Ação "Escolher edição" abre diálogo de foco; "Agora não" fecha apenas o aviso. O alvo pode ser alterado nas configurações mesmo quando a edição acadêmica de especialidade/instituições está bloqueada por janela.

API de composição prevista: EditionTargetPicker recebe value {targetEditionId,expectedGraduationTerm}, onChange e disabled opcional. EditionTargetPrompt não precisa de props e usa providers existentes; será reutilizado por /simulados na integração de listas. EditionTargetSettings integra a ação persistente nas configurações. Não acrescentar props obrigatórias a componentes antigos.

Estados: carregamento sem deslocar o formulário, catálogo vazio/erro com recuperação e opção indecisa, envio pendente sem dupla gravação, sucesso, falha mantendo campos, texto longo, troca de conta. UI nova sempre atrás de editions_ui no banco. Não usar localStorage como flag nem carregar estado de outro usuário.

Layout herda Plus Jakarta Sans, wine e superfícies da aplicação. Uma ação primária por contexto, labels explícitos, foco visível, nomes de edição com quebra de linha, alvos de toque confortáveis e diálogo com Escape/retorno ao disparador. Temas claro/escuro e 1440/768/375. Somente motion existente de abrir/fechar, com reduced-motion.
