# Edições: Handoff Do Protótipo

## Preview Local

Execute na raiz do worktree:

```sh
node scripts/design-preview.mjs
```

Abra `http://127.0.0.1:54738/editions-prototype.html`. O servidor vincula exclusivamente `127.0.0.1:54738`, sem Vite, plugin MCP, backend, dependências novas ou uso da porta 54737. Encerre com Ctrl+C. Não encerre um processo de outra tarefa se a porta estiver ocupada.

O diretório servido é somente `docs/design`, sem listagem de diretórios. Apenas documentos `.html`/`.md` de primeiro nível são permitidos. Segmentos, barras adicionais, nomes ocultos, streams NTFS, caminhos malformados e escapes por symlink para fora do diretório são recusados. Apenas GET/HEAD e o Host exato são aceitos. CSP impede conexão, envio de formulário e enquadramento. O teste não precisa abrir sockets.

## Estado E Limites

- Dados inteiramente demonstrativos. Tudo existe apenas em memória e recarregar restaura os exemplos. Não usar este arquivo como controle de acesso ou autorização.
- Admin: lista → Nova edição/Editar → formulário → Salvar edição → lista com feedback. Cancelar/Voltar descarta alterações não salvas e devolve foco à ação de origem.
- Erro no formulário mantém os valores e oferece Tentar novamente. A recuperação não salva automaticamente; depois dela o operador pode conferir e salvar.
- Clonar como rascunho abre diálogo nativo com origem fictícia e destino. Confirmar gera `demo-1`, `demo-2` etc., mostra feedback e mantém a edição/origem intacta. Não duplica uma edição: demonstra a clonagem de um simulado para uma edição.
- A clonagem não copia questões reais, não cria UUIDs reais, não publica e não define janela de execução. Cópia atômica e novos IDs de entidades são contrato do backend, não uma promessa deste HTML.
- Sementes 2027.1/2027.2 planejadas, sem datas oficiais, confirmação desmarcada e resultado oficial vazio. Histórico 2026 encerrado, também sem data preenchida: não apresentar a data ilustrativa do brief como evidência oficial.
- Quantidades **100 questões / 4 alternativas / 300 minutos** seguem o exemplo do JSON F0 indicado na revisão, tanto nas sementes quanto em Nova edição. Continuam editáveis/configuráveis e demonstrativas, não uma afirmação de formato oficial de 2027. Blueprint e referência de corte começam vazios. Nenhuma fonte de corte foi inventada.
- **TRI oficial não significa nota calibrada do simulado.** O seletor representa o formato do exame oficial, não habilita um cálculo de proficiência local.
- Área do aluno: seletor opcional com Sem escolha, 2027.1, 2027.2 e Ainda não sei. Mudança atualiza o contexto local; histórico 2026 começa recolhido. Treino/histórico exibem feedback demo e não iniciam tentativa nem mostram notas fictícias.

## Direção E Medidas

Extensão do mundo visual de `DESIGN.md`, `PRODUCT.md`, `editions-brief.md` e componentes atuais. Não há dashboard de métricas, gradiente, sombra decorativa ou nova paleta. O diferencial é a leitura de código/calendário em linha e a continuidade do histórico.

| Elemento | Medidas do protótipo |
| --- | --- |
| Corpo | 14px / 1.55; texto auxiliar 12–13px |
| Título admin | 24px, peso 800, entreletra -0.025em, linha 1.25 |
| Título de seção | 20px; legendas 15px / 700 |
| Shell desktop | trilho escuro 240px, como a AdminSidebar expandida; conteúdo até 1160px, incluindo padding lateral 40px |
| Header | ação à direita; margem inferior 24px; descrição abaixo do título |
| Lista | superfície plana, borda 1px, raio 12px, altura mínima 276px |
| Callouts | superfície raised e borda line uniforme de 1px, sem faixa lateral de destaque |
| Colunas | código 13%, rótulo 29%, status 17%, data 27%, ação 14% |
| Células | padding 18px; data/código com números tabulares |
| Formulário | padding 28px; duas colunas; gap 20px; grupos separados por linha e 24px |
| Controles | altura mínima 44px; raio 6px; foco de 2px com offset 3px |
| Diálogo | largura até 520px, margem mínima 16px, padding 28px, altura limitada ao viewport |
| 768px | navegação ilustrativa horizontal, padding 24px; lista ainda tabular |
| 375px | padding 16px; tabela em linhas com rótulos visíveis; caption em bloco com largura 100%; rótulo da edição e ações ocupam linha inteira; formulário em uma coluna |

Em até 600px, linhas empilhadas substituem a tabela visual sem remover seus cabeçalhos semânticos. Não mascarar overflow com `overflow-x:hidden`: texto variável usa `overflow-wrap:anywhere`, grids têm `minmax(0,1fr)` e campos têm `min-width:0`. Formulário e diálogo rolam verticalmente, não horizontalmente. No mobile, ações de salvar/confirmar ficam primeiro visualmente; a ordem DOM continua Cancelar → Salvar, sem tabindex positivo.

O `<caption>` continua sendo filho direto da tabela, antes de colgroup/thead/tbody. Somente sua apresentação mobile muda para `display:block;width:100%`, evitando a caixa table-caption estreita quando a tabela vira bloco. Não substituir o caption por texto solto ou ocultá-lo.

## Tokens E Fonte

Os valores locais foram extraídos dos tokens admin existentes, sem alterar tokens globais:

| Token local | Claro | Escuro |
| --- | --- | --- |
| bg | #FAFAF9 | #0B0C0E |
| surface | #FFFFFF | #141619 |
| raised | #F4F4F3 | #1C1F23 |
| text | #1A1715 | #ECEDEE |
| muted | #57534E | #9BA1A9 |
| line | #E7E5E3 | #292D33 |
| accent | #AB2350 | #E14E78 |
| accent-soft | #FBEAEF | hsl(342 35% 18%) |
| success | #0F7A55 | #34D399 |
| warning | #B45309 | hsl(38 92% 60%) |
| destructive | #C5303A | hsl(356 70% 64%) |

Texto usa text/muted, não o token faint de baixo contraste. Status tem nome e cor, não depende só de cor. Botão primário usa on-accent branco no claro e #0B0C0E no escuro. Há uma ação primária por contexto: Nova edição, Salvar edição, confirmação do diálogo ou treino demo.

A sidebar segue os valores fixos de `src/admin/components/AdminSidebar.tsx`: fundo #0B0C0E, texto #C9C4BF, borda #1F2329, marca branca e item ativo #AB2350 com texto branco. Permanece escura nos dois temas. A marca é Arena Admin; o exemplo mantém a navegação reduzida e não replica busca, perfil, colapso ou permissões. Textos auxiliares usam #C9C4BF, em vez de reproduzir os tons de baixo contraste do componente. Não migrar o shell real para branco a partir deste protótipo.

Não há `.woff`, `.woff2` ou `.ttf` local no repositório consultado. O HTML tenta `local("Plus Jakarta Sans")`; se não instalada, usa Arial/sans-serif temporariamente, sem download ou CDN. Espessura, largura das palavras, quebras de linha e altura final podem divergir das capturas do produto. A implementação real deve usar a Plus Jakarta Sans já carregada no app; não reproduzir essas diferenças como novos tokens.

## Reutilização No Produto

| Necessidade | Referência existente / orientação |
| --- | --- |
| Cabeçalho | `src/admin/components/ui/AdminPageHeader.tsx`, preservando título/descrição/slot de ação e corrigindo wrap no mobile se necessário no job de UI |
| Lista e estados | `src/admin/pages/AdminSimulados.tsx`: organização das linhas, semântica de status e superfície; não copiar shimmer/gradiente deste componente para o protótipo |
| Vazio | `src/admin/components/ui/AdminEmptyState.tsx` |
| Confirmação | `src/admin/components/ui/AdminConfirmDialog.tsx`; validar a API existente para compor origem/destino e foco |
| Campos e controles | componentes já instalados de `src/components/ui`, sem gerar/instalar uma biblioteca nova |
| Feedback | `use-toast` existente; feedback local persistente no HTML é substituto ilustrativo, não especificação de duração de toast |
| Navegação admin | `src/admin/components/AdminSidebar.tsx`, sempre escura nos dois temas e expandida em 240px; reutilizar o componente real, não implementar outro shell a partir da navegação reduzida do HTML |
| Navegação aluno | shell premium existente; o trilho deste HTML é ilustrativo, não um redesign da navegação |
| Permissões | `AdminCapabilityGate`/capability real `content.manage`; nunca inferir autorização a partir do controle Experiência |

A consulta Dendê nesta execução confirmou biblioteca React v3, alvos de toque 44px, foco 2px/2px e reduced-motion sem animação. Este protótipo usa HTML nativo e tokens do projeto, com foco 2px/3px conforme CSS local; não importa componentes Dendê nem declara conformidade integral de API. Não instalar HeroUI ou migrar stack para implementar esta extensão.

## Motion E Acessibilidade

- Abertura do formulário e feedback: 150ms, deslocamento de 3px/opacity. Sem pulso, shimmer, entrada sequencial ou animação na troca de dados. Reduced-motion remove animações.
- Labels são visíveis e associados. Erros de validação usam `aria-describedby`, `aria-invalid` e foco no primeiro erro. Código único, rótulo obrigatório e inteiros de formato são validados localmente somente para demonstrar o fluxo.
- Data confirmada só habilita com data válida; limpar data desmarca a confirmação. Ausência de data explica a espera pelo Inep, não inventa estimativa.
- `dialog.showModal()` oferece modalidade, contenção de foco e Escape nativos; fechamento devolve foco ao disparador. Testar isso em navegador real: jsdom usa apenas um shim de abertura/fechamento.
- Contraste textual deve ser >=4.5:1. A escolha usa os pares text/muted/accent existentes; conformidade final, zoom, foco e leitores de tela precisam da revisão visual/browser.
- Loading tem dimensão estável na tabela, texto acessível e `aria-busy`; formulário não é desmontado pela troca do estado demo. Estado Vazio durante edição não apaga nem oculta campos.

## Revisão Recebida E Ajustes

Revisão de navegador embutido informada pelo orquestrador: DOM em 1440px sem overflow e mobile 375px sem scroll horizontal; caption mobile espremido em aproximadamente 100px e sete linhas. Também foram apontados callout com faixa lateral incompatível com craft-floor/brief, shell admin branco e default de alternativas divergente do JSON F0.

Correções desta rodada: caption mobile com toda a largura, preservando o elemento semântico; callouts com superfície discreta e borda uniforme de 1px; sidebar alinhada à AdminSidebar escura; defaults 100/4/300 nas sementes e no formulário novo. O CSS efetivo deste HTML é a referência visual para o job de UI posterior. Fluxos, estados, datas vazias, controle demo, conteúdo sobre TRI e teclado permanecem no escopo.

## Capturas Para Codex

Capturar em **1440 × 1000**, **768 × 1024** e **375 × 812**, no navegador embutido. O arquivo não inclui capturas. Esta rodada fez medições automatizadas em Edge headless local, não inspeção visual de imagens nem nova revisão no navegador embutido. A revisão recebida acima é anterior às correções. Roteiro:

1. Admin / Normal / Claro: tabela com 2027.1, 2027.2 e histórico 2026. Confirmar uma ação primária e ausência de scroll horizontal.
2. Editar 2027.1: capturar início e fim do formulário, datas vazias, confirmação desabilitada, aviso TRI, blueprint/referência vazios.
3. Preencher rótulo → Estado demo Erro → Salvar → Tentar novamente. Conferir campos preservados e foco; salvar novamente deve voltar à lista com feedback.
4. Nova edição: tentar código repetido e valores numéricos inválidos. Conferir erro associado, foco e ausência de duplicata na lista.
5. Abrir Clonar como rascunho: escolher 2027.2; capturar diálogo, confirmar e capturar feedback. Repetir para identificar `demo-2`. Testar Tab, Shift+Tab, Escape e retorno de foco.
6. Admin: Vazio, Carregando, Erro, Salvo e Texto longo. Em Texto longo testar também um código de 100 caracteres digitado no formulário e rótulo com cadeia sem espaços. Colar texto com marcação deve renderizar como texto, nunca HTML executável.
7. Área do aluno: Normal em 2027.1 e 2027.2, Sem escolha e Ainda não sei; histórico recolhido/aberto; treino e histórico com feedback claramente demo.
8. Área do aluno: Vazio, Carregando, Erro com Tentar novamente, Salvo e Texto longo. Conferir preservação do alvo e separação entre treino, histórico e resultado elegível.
9. Repetir principais vistas em tema Escuro, zoom 200%, teclado e reduced-motion. Medir contraste dos textos, foco e bordas de controles. Bordas de superfície discretas não são limites de campos (estes usam muted).
10. Revalidar os achados corrigidos: caption ocupa toda a tabela em 375px, callouts têm quatro bordas de 1px e sidebar desktop continua escura ao trocar o tema. Conferir 100/4/300 em uma semente e em Nova edição, e depois alterar/salvar o formato para confirmar que o exemplo não é uma restrição oficial.

## Verificação Executada

```sh
node scripts/design-preview.mjs --test
```

**8 testes passando, 0 falhando**, preservando a quantidade de testes original. Testes embutidos no único script autorizado, com `node:test` e jsdom já instalado. Cobrem resolução segura de caminhos, handler HTTP/Host/métodos/CSP/HEAD, código único, valores retidos em erro, data/confirmação, clonagem com IDs demo distintos, estados, alvo/histórico, recuperação do aluno, validação numérica, texto não interpretado como HTML e retorno de foco ao cancelar. Asserções adicionadas aos testes existentes verificam 100/4/300 nas três sementes e em Nova edição, além da edição/persistência local da quantidade de alternativas. Antes da implementação, os dois testes alterados falharam pelo default anterior de 5 alternativas; depois passaram.

Medições adicionais via Playwright e **Edge headless já instalado**, lendo apenas o HTML local via `file:` e bloqueando requisições HTTP/HTTPS da página, sem servidor, dependências novas ou downloads. O Chromium padrão do Playwright não está instalado; não foi baixado. Estas verificações foram pontuais no terminal, não novos testes adicionados à suíte:

| Viewport (altura 1000px) | Largura da página | Tabela / caption | Display do caption |
| --- | --- | --- | --- |
| 1440px | 1440px | 1078px / 1078px | table-caption |
| 768px | 768px | 718px / 718px | table-caption |
| 375px | 375px | 341px / 341px | block |

Em todas as larguras, sidebar medida como `rgb(11,12,14)` e quatro bordas do callout medidas em 1px. Foram verificadas **72 combinações** (3 larguras × 2 temas × 2 experiências × 6 estados), sem overflow horizontal da página, e formulário sem overflow nas três larguras. Diálogo: foco inicial interno, Tab/Shift+Tab sem focar controles de fundo, Escape e retorno de foco ao disparador nas três larguras. Navegação nativa pode passar pelo chrome do navegador, representado por body como activeElement; isso não equivale a focar um controle de fundo.

Limites: ausência de overflow não prova qualidade de composição ou ausência de cortes locais. A altura de 1000px nessas medições não substitui as capturas mobile de 812px ou tablet de 1024px. Abrir via `file:` não valida a CSP HTTP do preview; o handler é coberto nos oito testes. Nenhuma imagem foi gerada, anexada ou inspecionada nesta rodada. Fonte fallback continua sujeita às diferenças documentadas. Não executado: Vite build, suíte global, backend, comparação visual, medição instrumental de contraste ou teste de tecnologias assistivas. A revisão Codex com novas capturas deve preceder o job React de UI; medições automatizadas não encerram a revisão visual.
