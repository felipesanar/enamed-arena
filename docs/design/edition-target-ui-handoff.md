# Edição-alvo: Handoff da Fase A

## Entrega e Limites

Protótipo autocontido de HTML/CSS/JS para revisão da F1-8, não uma implementação React nem uma entrega em produção. Fontes: `edition-target-brief.md`, `PRODUCT.md`, `DESIGN.md`, componentes atuais e contratos de edições do repositório.

- `edition-target-prototype.html`: cadastro, aviso com diálogo na home e configurações.
- `edition-target-prototype.test.mjs`: testes de comportamento executando o JavaScript real com JSdom.
- Nenhuma alteração em React, dependências, schema, migrations ou tipos gerados. Nenhuma conexão com Supabase, escrita real ou chamada externa.
- Edições, contas e nomes são fictícios. Não há calendário oficial de 2027, promessa de produto ou regra para estudantes do quarto ano.
- Navegação, sidebar e perfil acadêmico são contexto visual, não novas funcionalidades. O botão de simulados apenas informa o limite da DEMO.

## Como Revisar

Abrir o HTML diretamente ou usar o preview local, quando ativo: `http://127.0.0.1:54739/edition-target-prototype.html`. Não depende de build ou recursos remotos.

Os controles DEMO aceitam os mesmos valores por query string; valores inválidos usam o padrão. Alterações nos controles não reescrevem a URL.

| Parâmetro | Valores | Padrão |
| --- | --- | --- |
| `scene` | `onboarding`, `home`, `settings` | `onboarding` |
| `theme` | `light`, `dark` | `light` |
| `catalog` | `ready`, `loading`, `empty`, `error` | `ready` |
| `result` | `success`, `error` | `success` |
| `long` | `off`, `on` | `off` |
| `account` | `a`, `b` | `a` |
| `flag` | `on`, `off` | `on` |
| `dialog` | `open` para abrir o diálogo da home | fechado |

Exemplo: `?scene=home&theme=dark&long=on&dialog=open`.

Envio e recuperação do catálogo simulam 450 ms. “Tentar novamente” recupera um catálogo fictício; não demonstra retry de servidor. A preferência fica apenas na memória da página e é reutilizada entre cenas. Trocar conta apaga preferência, rascunho e dispensa, inclusive ao voltar à conta anterior; recarregar também limpa tudo. Não existe localStorage nem cache persistente.

## Fluxos e Estados

### Cadastro

Com a flag ligada, a sequência é Sua edição → Especialidade → Instituições → Confirmação. A DEMO implementa somente Sua edição: depois do envio exibe um resumo e indica a próxima etapa, sem navegar ou executar as três etapas existentes.

Ano e semestre são opcionais em conjunto. Um campo isolado gera erro e foco no campo faltante. É obrigatório escolher explicitamente uma edição ou “Ainda não sei”; a ausência inicial de escolha não equivale a indecisão confirmada. Os anos 2026–2031 são apenas opções da DEMO, não um contrato de catálogo.

A sugestão ilustrativa compara conclusão com `code` do catálogo fictício e nunca marca o radio automaticamente. Não infere datas de prova ou edital. Na fase B, reutilizar o resolver real, sem copiar a simplificação da DEMO.

### Home

Aviso discreto e não bloqueante; nenhum redirecionamento ou impedimento de acessar simulados. “Agora não” dispensa apenas o aviso na memória atual. “Escolher edição” abre o diálogo; Cancelar/Escape descartam o rascunho não salvo e devolvem foco ao disparador. Durante o envio o fechamento por Escape fica desabilitado. Após salvar, o aviso desaparece e o foco vai ao título da home, pois o disparador ficou oculto.

**Limite do contrato:** `targetEditionId: null` representa tanto “Ainda não sei” quanto ausência de alvo explícito. Não há marcador persistente de dispensa/indecisão confirmada nos campos consultados. Não inventar um no cliente nem usar a edição resolvida como prova de escolha explícita. A ocultação após salvar na DEMO é local; a persistência dessa decisão exige contrato de Produto/backend próprio. Sem esse contrato, ao remontar a home pode haver novo aviso para alvo nulo, ainda não bloqueante.

### Configurações

Seção Edição-alvo independente de Especialidade e instituições. A DEMO mostra o perfil acadêmico bloqueado e permite salvar o alvo. Na integração não herdar o `disabled` nem a autorização de edição do `AcademicProfileEditor` para esse formulário.

### Matriz de Comportamento

| Estado | Comportamento |
| --- | --- |
| Catálogo carregando | Área reservada, anúncio de carregamento, “Ainda não sei” disponível |
| Catálogo vazio/erro | Mensagem explícita, recuperação e opção indecisa; sem inventar edições |
| Texto longo | Quebra de linha, inclusive identificador sem espaços; sem reticências ocultando a escolha |
| Envio pendente | Formulário desabilitado, `aria-busy`, status; bloqueio de envio duplicado |
| Falha de envio | Mensagem focada e campos preservados; permitir nova tentativa |
| Sucesso | Resumo em cadastro/configurações; anúncio e fechamento na home |
| Troca de conta/flag/cena durante envio | Token de revisão ignora conclusão obsoleta |
| Flag desligada | UI nova removida; indicador de três etapas no cadastro; DEMO não implementa o fluxo antigo |

## Contratos Para React

API de composição prevista, ainda não criada nesta fase:

```ts
type EditionTargetValue = {
  targetEditionId: string | null;
  expectedGraduationTerm: string | null;
};

type EditionTargetPickerProps = {
  value: EditionTargetValue;
  onChange: (value: EditionTargetValue) => void;
  disabled?: boolean;
};
```

Centralizar tipos de domínio em `src/types/`, conforme convenção do projeto. O picker controlado compõe campos, catálogo e sugestão; não deve assumir persistência nem adicionar props obrigatórias a componentes antigos. Manter estado de interação separado para exigir escolha explícita no cadastro: `null` sozinho não distingue “não tocado” de “Ainda não sei”. Uma preferência existente pode ser exibida sem forçar nova escolha.

- `EditionTargetPrompt`: sem props obrigatórias; consome providers existentes e pode ser reutilizado em `/simulados` na integração futura de listas. Sem duplicar prompts na mesma página.
- `EditionTargetSettings`: compõe picker, envio e feedback nas configurações, independente do guard acadêmico.
- `OnboardingPage`: inserir etapa somente com flag ativa, preservar especialidade/instituições e mostrar alvo/conclusão na confirmação final. Manter o parâmetro `next` e a navegação presencial existentes. A DEMO não testa esse roteamento.
- `HomePagePremium`: incluir o aviso sem substituir conteúdo ou criar um dashboard novo.
- `ConfiguracoesPage`: incluir seção independente, reutilizando o layout atual.

### Providers e Persistência

`useAppConfig('editions_ui')` lê a flag do banco e falha fechado. A fase B deve ocultar a UI nova enquanto o retorno não for `true`; o controle DEMO não é uma flag de produção nem autorização.

`useExamEditions()` fornece catálogo React Query (`['exam-editions']`, staleTime de uma hora), estados de consulta e relógio. `useUserEdition()` combina catálogo e perfil com `resolveUserEdition`; verifica identidade de `profile` e `onboarding` contra a conta autenticada. O resolver prioriza alvo explícito válido, conclusão correspondente ao `code` e fallbacks de catálogo/data. Esses fallbacks são contexto/sugestão, nunca consentimento ou seleção automática de radio.

`useUser()` expõe `onboarding`, `profile` e `saveTargetEdition(editionId, expectedGraduationTerm)`. Usar esse método, não gravação direta nem RPC repetida pelo componente. O contexto já protege transições de sessão/flag, atualiza perfil/guard, invalida caches da conta e emite analytics após sucesso. Não duplicar `target_edition_set` na UI.

O serviço usa `set_target_edition_guarded(p_edition_id, p_expected_graduation_term)`. Indecisão deve ser enviada como `null` para o ID; conclusão deve ser `null` ou `YYYY.1`/`YYYY.2`. A sentinela `undecided` e os IDs `demo-*` são exclusivos do HTML e nunca devem chegar ao serviço. A gravação preserva campos acadêmicos e status de onboarding, não concluindo o cadastro por si só.

Na integração, fechar diálogo e anunciar sucesso somente após o método do contexto confirmar a operação. Preservar campos em falha; não atualizar alvo otimisticamente. Limpar rascunho, erros e estado de dispensa na troca de conta/logout, e ignorar respostas anteriores. Não confiar apenas no estado visual desabilitado para evitar corrida.

## Identidade e Acessibilidade

Herança dos tokens semânticos atuais de `src/index.css`, marca wine e composição existente; não é migração de design system. Referências Dendê foram consultadas na fase A, mas o HTML customizado não utiliza nem comprova conformidade com componentes Dendê. Não instalar biblioteca nesta entrega. Na fase B reutilizar os componentes existentes e validar APIs da versão efetivamente instalada.

Plus Jakarta Sans está declarada, mas não há fonte local incorporada; sem rede, a renderização usa `system-ui`, `-apple-system`, `Segoe UI`, `sans-serif`. Revalidar métricas com a fonte do app na integração. O onboarding mantém a identidade escura nos dois temas; home e configurações acompanham claro/escuro.

Labels explícitos, fieldsets/legends, radios nativos, erros associados, regiões de status, foco visível e controles principais com altura mínima de 44 px. O diálogo usa modalidade nativa, foco inicial no título, contenção de Tab e retorno de foco. Motion restrito à abertura existente, desabilitado por `prefers-reduced-motion`. CSP bloqueia conexões, formulários e recursos externos; conteúdo editorial interpolado é escapado.

## Verificação e Aceite

```text
node --test docs/design/edition-target-prototype.test.mjs
```

Resultado da fase A: 19 passando, zero falhando. TDD iniciou com falha por HTML ausente; regressões adicionais foram reproduzidas antes da correção. Os testes exercitam validação, estados de catálogo, sugestão sem autoescolha, envio/falha, flag, diálogo, troca de conta e conclusão obsoleta. JSdom usa polyfill dos métodos de dialog ausentes; a validação de foco também foi executada em navegador real.

Verificação local com Playwright existente e Edge headless, sem instalação/download: 18 combinações de três cenas × dois temas × larguras 1440/768/375, com texto longo, sem overflow horizontal. Também verificados Escape, retorno de foco, ciclo de Tab, foco após salvar, reduced-motion, zero erros de página e zero requests externos. Medição automatizada dos textos amostrados: mínimos 4,73:1 no claro, 5,06:1 no escuro e 8,77:1 no onboarding. Isso não equivale a auditoria WCAG completa nem teste com leitor de tela.

Helpers, resultado `verification.json` e 30 capturas estão somente em `.superpowers/target-ui/`, diretório ignorado e não integrante da entrega versionável. Foram inspecionadas capturas de cadastro desktop/mobile, configurações mobile escuro, diálogo tablet, aviso mobile e falha de envio mobile. A medição e as capturas se referem ao HTML, não às páginas React reais.

## Próxima Fase

1. Implementar os três componentes e compor as páginas existentes, usando providers e tokens reais; não portar o estado global da DEMO.
2. Cobrir flag desligada sem regressão das três etapas atuais, `next`, confirmação final, catálogo indisponível, erro/retry e alvo editável sob lock acadêmico.
3. Cobrir troca de conta/logout/flag durante consultas e envios, e distinguir edição resolvida de escolha explícita.
4. Validar integração em ambiente autorizado com as migrations dependentes já revisadas; esta fase não comprova deploy nem funcionamento do Supabase real.
5. Repetir teclado, contraste, responsividade e motion nas telas React com a fonte real; incluir leitor de tela e zoom. Definir eventual dispensa persistente sem inventar campo ou regra de produto.
