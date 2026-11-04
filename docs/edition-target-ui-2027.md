# F1-8: Edição-Alvo em React

## Status e Escopo

Fase B: extensão dos fluxos existentes a partir de `design/edition-target-brief.md`, do protótipo aprovado e de `design/edition-target-ui-handoff.md`. Não é redesenho. Implementação local para revisão; não houve deploy, acesso a banco, instalação de dependências, rede, leitura de `.env`, git mutante ou subagentes.

Componentes Radix/shadcn/Tailwind existentes, tokens semânticos e fonte herdada da aplicação. As referências Dendê da fase A foram mantidas como contexto, sem migrar biblioteca nem alegar conformidade com componentes Dendê. As capturas aprovadas na fase A são do HTML, não desta integração React.

## Componentes

- `EditionTargetPicker`: API pública `value: { targetEditionId: string | null | undefined, expectedGraduationTerm: string | null }`, `onChange` e `disabled?`. `undefined` significa não escolheu; `null` é escolha explícita de Ainda não sei. Só monta o consumidor de `useExamEditions()` quando `useAppConfig('editions_ui')` é verdadeiro.
- Conclusão com ano digitável de quatro dígitos e semestre, sem lista ou intervalo de anos da DEMO. Ambos vazios resultam em `null`. Durante digitação o valor pode representar um par incompleto; o formulário bloqueia envio até estar vazio ou em `YYYY.1`/`YYYY.2`. Nenhum valor parcial chega a `saveTargetEdition`.
- A sugestão usa `resolveUserEdition` com metadata do catálogo real e sem alvo explícito. Não marca radio, não persiste fallback nem anuncia datas oficiais. `useUserEdition`/uma edição resolvida não são prova de escolha explícita.
- Catálogo vazio/falho oferece retry e indecisão; carregamento mantém espaço reservado e indecisão disponível. Falha de consulta nunca cria lista fictícia ou converte um UUID escolhido em `null`.
- `EditionTargetSettings`: seção independente do guard acadêmico; só monta para conta/perfil atual carregados e flag ativa. `EditionTargetForm`, exportado no mesmo arquivo para composição interna, centraliza validação, envio, erro, sucesso e bloqueio de dupla submissão.
- `EditionTargetPrompt`: sem props; aviso não bloqueante, sem redirect/gate. Só usa alvo explícito do onboarding da conta atual para decidir elegibilidade, não fallback do resolver. Dispensa e rascunho são memória do mount da conta; não há localStorage, flag local ou campo novo.

O diálogo usa primitivas Radix já instaladas e wrappers de título, descrição e overlay existentes. Foco inicial no título, contenção modal de foco e Escape/Cancelar com retorno ao disparador. Durante envio, Escape, clique fora e Cancelar não fecham. Overlay e conteúdo desativam animação com reduced-motion. Após sucesso, o disparador desaparece e o foco vai ao `h1` existente da home, identificado pelo wrapper `data-edition-target-home`; um consumidor futuro pode oferecer `[data-edition-target-focus]` ou um `main h1`. Não há autofocus nos renders normais.

## Integrações

### Onboarding

Com flag ativa e cadastro ainda incompleto: Sua edição → Especialidade → Instituições → Confirmação. É necessário escolher UUID do catálogo ou Ainda não sei; salvar via `saveTargetEdition` confirma a primeira etapa antes de avançar. O resumo final mostra edição e conclusão. Voltar da especialidade permite rever a edição e salvá-la novamente.

Com flag desligada, mantém três etapas e somente o `saveOnboarding` acadêmico antigo. Um cadastro já completo não é forçado ao passo novo. A finalização continua chamando `saveOnboarding({ specialtyId, targetInstitutionIds })` e preserva o `next` relativo seguro existente, incluindo o fluxo presencial.

As chaves já usadas para persistir o rascunho acadêmico agora incluem o ID da conta; as antigas chaves sem conta não são reaproveitadas para evitar vazamento entre logins. Alvo/dispensa não são persistidos nesse armazenamento. Respostas antigas não limpam rascunho nem navegam na conta seguinte.

Os eventos `onboarding_step_viewed` existentes mantêm a numeração acadêmica 1–3, pois o schema compartilhado não faz parte deste escopo. Não foi inventado evento ou número 4 para a etapa nova.

### Home e Configurações

`HomePagePremium` monta um prompt depois do hero, sem substituir a home; acrescenta somente o identificador para foco após salvar. O mount atual pertence ao fluxo de perfil completo, preservando os branches de loading/perfil incompleto da página.

`ConfiguracoesPage` monta Edição-alvo no início da seção Perfil acadêmico, antes do aviso/editor acadêmico. O alvo não recebe o lock de especialidade/instituições. A navegação existente dessa seção continua restrita a perfis completos, sem mudança de API do `AcademicProfileEditor`.

`SimuladosPage.tsx` não foi tocado: o mount futuro de `EditionTargetPrompt` nessa página é do job dependente. A ampliação explícita de escopo autorizou `UserContext.tsx` e seu teste para centralizar a telemetria de conclusão. Não há alteração em App/rotas, AuthContext, hooks de domínio, serviços, SQL ou tipos compartilhados/gerados.

## Sessão e Persistência

Os wrappers verificam autenticação, loading, `profile.id` e `onboarding.userId`; trocar conta, deslogar, entrar em loading ou desligar a flag desmonta os formulários. Cada conta recebe uma instância com chave própria. Callbacks e retorno de foco usam um marcador de instância ativa, ignorando conclusão de envio de instâncias anteriores. Isso complementa, sem substituir, os tokens e autorização do contexto/RPC existentes.

Não existe escrita otimista. Sucesso/avanço/fechamento só ocorrem após `saveTargetEdition` resolver. Falha mantém campos e permite retry. Payload é ID real do catálogo ou `null`, com conclusão válida ou `null`; nenhum ID `demo-*`, seleção automática ou sentinela textual é enviado.

**Limite mantido:** o banco não distingue alvo nulo nunca informado de Ainda não sei confirmado. O aviso é dispensado na memória atual após salvar; ao remontar, um alvo nulo pode voltar a receber aviso. Não foi criado contrato de dispensa persistente.

## Analytics: Lacuna Resolvida

Os componentes não emitem `target_edition_set` nem `onboarding_completed`. A página permanece sem emissão duplicada; ambos os eventos são responsabilidade do contexto.

A premissa original de que `saveOnboarding` já emitia o evento estava incorreta. Após a ampliação explícita do escopo, `UserContext.saveOnboarding` passou a emitir `onboarding_completed` somente após a primeira conclusão confirmada pelo RPC, com conta, identidade e snapshot da flag ainda válidos. Perfis já concluídos não geram evento em edições acadêmicas posteriores. Um registro em memória por conta na instância do provider evita duplicação entre saves concorrentes e callbacks antigos; o status persistido carregado também impede emissão para perfis previamente concluídos.

O payload preserva `segment`, `specialty` (nome devolvido pelo RPC, ou o rótulo de indecisão) e `institutions_count`, acrescentando `edition_code`. O código vem exclusivamente do catálogo para o `targetEditionId` explícito capturado no início do save. Alvo nulo/ausente produz `null`, sem inferência pela graduação ou pelo resolver. Flag desligada mantém o caminho legado, emite `edition_code: null` e não chama catálogo nem APIs de edições.

Catálogo indisponível ou sem o alvo explícito omite o evento e registra diagnóstico, sem converter falha em indecisão. Falhas síncronas/assíncronas de `trackEvent` são isoladas: não desfazem a gravação nem rejeitam o save por causa da telemetria. Não há retry de telemetria em uma edição posterior. Callbacks de save acadêmico e de alvo retidos de outra sessão/flag são recusados antes da escrita. Não foi necessário alterar `analytics.ts`: o contrato aberto existente aceita os campos e `null`.

## Verificação

TDD: testes adicionados primeiro falharam por componentes ausentes, etapa nova não renderizada e mounts inexistentes. Implementação seguida de testes de regressão para falhas/contas/flag. Os testes de UI usam doubles locais de hooks/contextos, não Supabase real.

Comando restrito, Vitest 5, no máximo dois workers:

```text
node node_modules/vitest/vitest.mjs run src/contexts/UserContext.test.tsx src/pages/__tests__/OnboardingPage.test.tsx src/components/editions/EditionTargetPicker.test.tsx src/components/editions/EditionTargetSettings.test.tsx src/components/editions/EditionTargetPrompt.test.tsx src/pages/__tests__/ConfiguracoesPage.test.tsx src/components/premium/home/HomePagePremium.test.tsx --maxWorkers=2 --reporter=dot --silent
```

Cobertura: flag desligada sem catálogo/UI/save de alvo; UUID e null explícitos; conclusão opcional e incompleta; sugestão sem autoescolha; catálogo loading/vazio/falho; erro/retry preservando campos; dupla submissão; alvo sob lock acadêmico; foco modal/Escape/Cancelar; foco após sucesso; troca de conta/logout/loading/flag durante envio; resultado antigo sem redirect; `next` presencial e rejeição de destino externo. A consulta do catálogo é global e não contém preferências; a UI da conta antiga é desmontada nas transições, sem copiar seleção da resposta de catálogo.

Cobertura adicional da telemetria: uma emissão na primeira conclusão; nenhuma durante o RPC ou após erro de save; retry do cadastro; nenhuma em edição de perfil já concluído; deduplicação de saves concorrentes; indecisão e flag desligada sem catálogo; catálogo indisponível/sem alvo; falhas síncronas e assíncronas de analytics; troca de conta/logout/loading/flag durante RPC; conta/flag durante consulta ao catálogo; callbacks de outra sessão recusados antes de gravar; resposta com conta divergente ignorada. Os testes da página verificam ausência de emissão duplicada nos fluxos com e sem etapa de alvo.

O comando de lint restrito usa `node node_modules/eslint/bin/eslint.js` com os 14 arquivos TS/TSX desta entrega. Resultado: zero erros e 11 avisos preexistentes no `UserContext` (8 casts `any` e 3 exports de Fast Refresh). Vitest após a centralização: 7 arquivos, 82 testes passando e nenhum falhando. A fase B anterior também validou o protótipo com `node --test docs/design/edition-target-prototype.test.mjs`: 19 testes, nenhum falhando; esse teste de HTML não foi repetido na retomada de telemetria. Sem suíte global, build ou tsc completo.

## Revisão TypeScript Restrita

Após a revisão independente, a checagem restrita reproduziu TS2345 no argumento de `saveTargetEdition` e seis TS7031 nos mocks de motion de Configurações. O formulário agora captura `targetEditionId` e rejeita `undefined` em um guard explícito antes do save; não usa cast, non-null assertion nem conversão silenciosa para `null`. A prioridade das mensagens de validação foi preservada. Uma regressão adicional confirma o erro de escolha e que somente a seleção explícita de Ainda não sei permite enviar `null`.

Os mocks de Configurações usam `PropsWithChildren`, `HTMLMotionProps` e `forwardRef` tipado. Os filhos são `ReactNode`, pois os mocks os repassam ao DOM, sem suporte simulado a `MotionValue`. Não há `any` nesses mocks e nenhuma asserção existente foi alterada. Os arquivos de contexto e a telemetria permaneceram intactos nesta revisão.

Comandos executados nesta retomada:

```text
node node_modules/vitest/vitest.mjs run src/components/editions/EditionTargetSettings.test.tsx src/pages/__tests__/ConfiguracoesPage.test.tsx --maxWorkers=2 --reporter=dot --silent
node node_modules/typescript/bin/tsc --project .superpowers/target-ui/tsconfig.target-form.json --noEmit
node node_modules/eslint/bin/eslint.js src/components/editions/EditionTargetSettings.tsx src/components/editions/EditionTargetSettings.test.tsx src/pages/__tests__/ConfiguracoesPage.test.tsx
```

Resultados: 16 testes passando em 2 arquivos, nenhum falhando; checagem tipada com exit 0 e nenhum diagnóstico; lint sem erros ou avisos. A configuração de QA ignorada estende `tsconfig.app.json` sem alterar suas opções e limita as entradas ao formulário, aos dois testes, ao setup de testes e às declarações Vite, incluindo suas dependências transitivas. Não foi executado typecheck global, build ou suíte global; a validação global permanece com Codex.

## Correção do Progresso React

A revisão visual independente encontrou o indicador novo com bolinhas e legendas em containers de larguras diferentes no desktop. A correção ficou somente no branch `hasTargetStep`: lista ordenada passiva com quatro colunas iguais, largura máxima de 900px e bolinha/legenda agrupadas no mesmo item. O indicador legado de três etapas foi preservado, inclusive para perfis já concluídos com flag ativa. O anúncio live Etapa X de Y continua existente; `aria-current="step"` identifica um único item atual. Não há botões, links, tab stops ou handlers para pular a gravação.

As legendas novas usam sentence case, 10px no mobile e a escala `text-caption` a partir de `sm`, com quebra de texto e sem truncamento. As colunas têm `min-w-0`, sem largura mínima fixa que force overflow. O escopo escuro local usa tokens existentes: `muted-foreground` para inativas, `foreground` para atual e `success` para concluídas, sem opacidade reduzida nas legendas. Foram preservados o pulso existente da bolinha atual (já condicionado a no-preference no CSS), o formulário e os glows; a transição de cor nova desliga com reduced-motion.

Cálculo WCAG de luminância sRGB dos tokens atuais: inativas 5,76:1, atual 11,99:1 e concluídas 6,21:1. O fundo conservador usado no cálculo sobrepõe duas camadas do glow mais claro (RGB 232,56,98, alpha 0,16 e 0,14) ao stop mais claro do gradiente (RGB 22,6,16), mais branco com alpha 0,004 para a textura; resulta aproximadamente RGB 81,21,40. É uma verificação numérica de contraste, não uma captura ou medição do viewport React.

TDD: o novo teste falhou primeiro porque a lista agrupada não existia. Depois da correção:

```text
node node_modules/vitest/vitest.mjs run src/pages/__tests__/OnboardingPage.test.tsx src/components/editions/EditionTargetSettings.test.tsx --maxWorkers=2 --reporter=dot --silent
node node_modules/eslint/bin/eslint.js src/pages/OnboardingPage.tsx src/pages/__tests__/OnboardingPage.test.tsx
```

Resultado: 33 testes passando em 2 arquivos, nenhum falhando; lint sem erros ou avisos. Os testes verificam agrupamento de bolinha e legenda no mesmo item, ausência de navegação no progresso, bloqueio até save confirmado, avanço pelas quatro etapas, retorno e preservação do indicador legado. Não espelham classes de layout nem simulam coordenadas que o jsdom não mede. A nova conferência visual em 375px/1280px, fonte real, zoom e temas permanece com Codex; não foi alegada aprovação visual desta correção.

Fases de design aplicadas: contexto local, consulta aos padrões de grid e ao Stepper no MCP Dendê e revisão restrita de acessibilidade/responsividade com web-interface-guidelines. O padrão é adaptado aos componentes/tokens existentes, sem instalar ou alegar uso do Stepper Dendê. Direção, protótipo e motion novos não se aplicam ao ajuste pontual. Impeccable não foi necessário para esta correção delimitada; stress de dados variáveis não se aplica às quatro legendas fixas. Contexto/telemetria, tipos corrigidos e `/simulados` não foram alterados nesta rodada. Sem suíte global, typecheck global ou build.

## Pendências de Integração

Codex fará a checagem global e a validação em navegador com a fonte real, incluindo claro/escuro, 375/768/1440, teclado, zoom, reduced-motion e nomes longos. Não se reutiliza a aprovação visual do HTML como aprovação do React. Migrations, RPCs e analytics precisam da validação integrada em ambiente autorizado. O mount de `/simulados` permanece com o job dependente.
