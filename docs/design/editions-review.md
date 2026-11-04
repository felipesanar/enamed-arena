# Revisão do protótipo de edições — 04/11/2026

Direção de DESIGN.md preservada. Protótipo de docs/design/editions-prototype.html revisado pelo orquestrador no navegador embutido, com dados explícitos de demonstração, sem backend.

- Conferidas larguras 1440, 768 e 375. A captura inicial por getScreenshot recortava a área visível do painel; a API de página completa mostrou o layout inteiro. A medição DOM confirmou ausência de overflow horizontal, independentemente desse recorte da ferramenta.
- Corrigida legenda da tabela no mobile: em 375px, tabela e caption têm 341,6px de largura; página tem 375px. Mantida a semântica de caption e rótulos por célula nas linhas empilhadas.
- Sidebar segue a versão escura do painel. Callouts têm borda uniforme de 1px e formato demonstrativo padrão segue 100/4/300, sem declarar formato oficial de 2027.
- Conferidos os temas claro/escuro e o formulário com datas nulas. Os oito testes do protótipo passaram após os ajustes; incluem erro sem perda de campos, clone em memória, dados extremos, escape de texto e foco.
- A medição headless do job cobriu 72 combinações de largura, tema, experiência e estado, sem overflow; o handoff distingue essa medição da revisão visual.

Limites: a fonte do protótipo usa fallback quando Plus Jakarta Sans não está instalada; a aplicação deve conservar sua fonte real. A implementação inclui os cinco estados do contrato EditionStatus, mesmo que o seletor simplificado do protótipo só demonstre parte deles. Blueprint será um seletor real do catálogo, nunca texto livre criando uma matriz implícita. Nenhuma data/fonte de corte deve ser inventada a partir das amostras.

Handoff autorizado para implementação reversível atrás da flag editions_ui. Este registro não autoriza migração, deploy, mudança da flag ou envio em produção.
