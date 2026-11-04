# Edições — extensão de fluxo

Modo Operate. Usuário administrador de conteúdo gerencia calendário e preparação das edições; aluno seleciona sua edição sem perder histórico. Mundo visual de DESIGN.md fixo.

```text
Edições                                          [Nova edição]
Organize o calendário e o formato de cada edição.
Código     Edição          Status       Data da prova     Ação
2027.1     ENAMED 2027.1   Planejada    A confirmar       Editar
2027.2     ENAMED 2027.2   Planejada    A confirmar       Editar
2026       ENAMED 2026     Encerrada   13/09/2026        Editar

Editar edição
Identificação  [Código] [Rótulo] [Status]
Calendário     [Data opcional] [Data confirmada] [Resultado oficial]
Formato        [Questões] [Alternativas] [Duração] [Pontuação]
Referências    [Matriz] [Referência do corte opcional]
                                              [Cancelar] [Salvar edição]
```

Código da edição e status textual à esquerda favorecem escaneamento. Não exibir contagens não disponíveis. Campos avançados têm explicação curta; TRI é modo do exame oficial e não implica que o simulado produz proficiência calibrada. Clonagem num diálogo de foco, pois cria um rascunho a partir de origem e calendário de destino e precisa confirmação protegida.

Aluno: cabeçalho existente, seletor com edição-alvo/sem escolha e "Ainda não sei", próximo simulado da edição e seção recolhível de histórico. Ranking/performance mantêm seus componentes, agrupando seletores por edição. Resultados liberados têm idade limitada na home. Sem data oficial: "Data oficial ainda não divulgada pelo Inep".

Protótipo local deverá incluir estado normal/vazio/carregando/erro/salvo e casos extremos. Campos e ações do protótipo usam dados fictícios explicitamente identificados. O protótipo não conecta ao backend nem simula autorização de produção.
