# Revisão de copy — Caderno de Erros (interface ativa, V2)

Revisão completa da copy do Caderno de Erros para o estudante de medicina brasileiro.
Escopo: a interface de produção (rotas `/caderno/*`). Telas legadas (`/caderno-erros`),
sandbox e showcase foram deixadas de fora por não estarem ativas para o usuário.

**Diretrizes aplicadas**

- Linguagem direta, humana e encorajadora, como um colega de faculdade.
- Sem termos de produto/UX em inglês (recall, review, insights, feedback, progress, score, deck, background, ROI, override etc.).
- Sem travessão (—) em hipótese alguma. Trocado por ponto, vírgula, dois-pontos, parênteses ou conectivo.
- Sem jargão clínico desnecessário na UI.
- Frases curtas, no imperativo ou presente.
- Motivação genuína, sem gamificação vazia.

---

## Glossário de termos (decisões de vocabulário)

| Termo original | Adotado | Por quê |
|---|---|---|
| recall / recall ativo | **revisão** / **revisar de cabeça** | termo de produto em inglês; o aluno entende "revisar" |
| review | **revisão / revisar** | idem |
| insights | **diagnóstico** | já existe "Análise do Prof. San"; "diagnóstico" cai bem no contexto médico sem ser jargão |
| SRS / repetição espaçada (SRS) | **revisão espaçada** (sem a sigla) | "SRS" não diz nada ao aluno; "espaçada" basta |
| lapso(s) SRS | **tropeço(s) na revisão** | "lapso SRS" é jargão interno |
| ROI / retorno sobre investimento | **retorno do caderno** / **o quanto o caderno te ajudou** | sigla de gestão, fora de contexto |
| score | **pontuação / nota** | termo em inglês |
| deck | **baralho** | termo que o Anki em português usa; veja nota de decisão abaixo |
| War Room | **Reta Final** | o produto já tem nome em português; "War Room" é interno |
| overconfidence | **confiança demais / confiança alta demais** | termo em inglês |
| underconfidence | **você se subestima / confiança de menos** | idem |
| streak | **dias seguidos** | termo em inglês |
| background | **em segundo plano** | termo em inglês |
| override (SRS) | **ignora o ritmo automático** | termo técnico |
| delta | **diferença / variação** | termo técnico |
| active recall | **treinar de memória** | termo em inglês |
| flashcards | **flashcards** (mantido) | vocabulário consagrado entre estudantes de medicina no Brasil; traduzir soaria mais estranho que manter |

> **Nota de decisão — "deck" → "baralho":** sigo a regra estrita de não usar inglês. "Baralho"
> é o termo oficial do Anki em português e é compreensível. Se você preferir manter "deck"
> (também muito usado por quem estuda com Anki), é a única troca abaixo que pode ser revertida
> sem prejuízo. Me avise.

> **Travessão:** ele aparece em dezenas de strings. Abaixo listo as principais; o mesmo
> tratamento (trocar — por `.`, `,`, `:` ou conectivo) vale para qualquer outra ocorrência
> que sobre no código.

---

## 1. Caderno — lista principal, hero e estados

### `src/components/caderno/TabBar.tsx:29` — rótulo da aba
- **Original:** `Insights`
- **Revisada:** `Diagnóstico`
- **Justificativa:** termo de produto em inglês; "Diagnóstico" é o que o Prof. San entrega ali.

### `src/pages/CadernoPage.tsx:882` — descrição do hero
- **Original:** `Salve questões com motivo e anotação de aprendizado. Organize sua revisão por área e tipo de erro para estudar de forma estratégica.`
- **Revisada:** `Salve as questões que você errou, anote o que aprendeu e organize por área e tipo de erro. Assim você revisa só o que precisa.`
- **Justificativa:** mais direto e centrado no benefício; tira o tom de descrição de feature.

### `src/pages/CadernoPage.tsx:529` — estado vazio
- **Original:** `Na correção do simulado, toque em "Salvar no Caderno" para adicionar questões que quer dominar.`
- **Revisada:** `Na correção do simulado, toque em "Salvar no Caderno" para guardar as questões que você quer dominar.`
- **Justificativa:** "guardar" é mais natural que "adicionar"; "você quer" completa a frase.

### `src/pages/CadernoPage.tsx:528` — título do estado vazio
- **Original:** `Seu Caderno está vazio`
- **Revisada:** `Seu caderno ainda está vazio`
- **Justificativa:** "ainda" suaviza e sinaliza que é só o começo.

### `src/components/caderno/CadernoHero.tsx:48` — aria-label de domínio
- **Original:** `${pct}% de domínio — ${dominadas} de ${total} questões dominadas`
- **Revisada:** `${pct}% de domínio: ${dominadas} de ${total} questões dominadas`
- **Justificativa:** remove travessão.

### `src/components/caderno/CadernoHero.tsx:196` — subtítulo do progresso
- **Original:** `Revise suas questões organizadas por causa e especialidade — recall ativo com repetição espaçada.`
- **Revisada:** `Revise suas questões organizadas por causa e especialidade. Você revê de cabeça, no intervalo certo para fixar.`
- **Justificativa:** remove travessão e "recall"; explica o ganho em vez do mecanismo.

### `src/components/caderno/PageHero.tsx:145` — aria-label de progresso
- **Original:** `${resolvedCount} de ${totalCount} questões resolvidas — ${progressPct}%`
- **Revisada:** `${resolvedCount} de ${totalCount} questões resolvidas (${progressPct}%)`
- **Justificativa:** remove travessão.

### `src/components/caderno/ZeroPendingState.tsx:46` — caderno zerado
- **Original:** `Você revisou e dominou todas as questões pendentes. Esse é o nível que separa aprovados de reprovados.`
- **Revisada:** `Você revisou e dominou tudo que estava pendente. É esse cuidado que aprova.`
- **Justificativa:** mantém o orgulho do feito sem o peso de "reprovados".

### `src/components/caderno/ZeroPendingState.tsx:67` — sequência
- **Original:** `${pluralize(streak, 'dia de streak', 'dias de streak')}`
- **Revisada:** `${pluralize(streak, 'dia seguido', 'dias seguidos')}`
- **Justificativa:** "streak" em inglês.

### `src/components/caderno/CadernoModeCards.tsx:53` — revisão espaçada
- **Original:** `Recall ativo no momento certo (SRS). Fixa o que você errou sem precisar reestudar tudo.`
- **Revisada:** `Revê o que você errou na hora certa de lembrar. Fixa o conteúdo sem reestudar tudo.`
- **Justificativa:** tira "Recall" e "(SRS)"; foca no benefício.

### `src/components/caderno/CadernoModeCards.tsx:70` — treino direcionado
- **Original:** `Sessão cronometrada focada nas suas áreas mais fracas — prática deliberada.`
- **Revisada:** `Sessão cronometrada nas suas áreas mais fracas. Treino de verdade, sob pressão.`
- **Justificativa:** remove travessão e o jargão "prática deliberada".

### `src/components/caderno/CadernoModeCards.tsx:84` — reta final
- **Original:** `Plano diário priorizado pelo peso de cada área conforme a prova se aproxima.`
- **Revisada:** `Um plano para cada dia, priorizando as áreas que mais caem conforme a prova chega.`
- **Justificativa:** "que mais caem" é como o estudante fala; mais concreto.

### `src/components/caderno/CadernoModeCards.tsx:85` — selo
- **Original:** `War Room`
- **Revisada:** `Reta Final`
- **Justificativa:** nome interno em inglês; o produto já se chama Reta Final.

### `src/components/caderno/CadernoModeCards.tsx:122` — aria-label
- **Original:** `${m.title}${isRec ? ' — recomendado agora' : ''}`
- **Revisada:** `${m.title}${isRec ? ' (recomendado agora)' : ''}`
- **Justificativa:** remove travessão.

### `src/components/caderno/NotebookEntryCard.tsx:327` — tooltip de questão travada
- **Original:** `Questão travada — muitos erros nas revisões`
- **Revisada:** `Questão travada: muitos erros nas revisões`
- **Justificativa:** remove travessão.

### `src/components/caderno/NotebookEntryCard.tsx:335` — explicação de travada
- **Original:** `Travada — você errou várias vezes. Entre na revisão para desbloqueá-la.`
- **Revisada:** `Você errou várias vezes nesta questão. Entre na revisão para destravar.`
- **Justificativa:** remove travessão; "destravar" combina com "travada".

### `src/components/caderno/BulkActionBar.tsx:188` e `:199` — ações em lote
- **Original:** `${count} ${pluralize(count, 'questão selecionada', 'questões selecionadas')} — ações em lote`
- **Revisada:** `${count} ${pluralize(count, 'questão selecionada', 'questões selecionadas')} para ações em lote`
- **Justificativa:** remove travessão.

---

## 2. Adicionar ao Caderno (modal)

### `src/components/AddToNotebookModal.tsx:277` — já está no caderno
- **Original:** `Já está no Caderno — adicionada em ${fmtDate(existingEntry.addedAt)}. Selecione outro motivo para atualizar.`
- **Revisada:** `Já está no caderno, adicionada em ${fmtDate(existingEntry.addedAt)}. Escolha outro motivo para atualizar.`
- **Justificativa:** remove travessão; "escolha" é mais direto que "selecione".

### `src/components/AddToNotebookModal.tsx:292` — acerto sem domínio
- **Original:** `Acertar sem domínio é um risco na prova real. Vale revisar.`
- **Revisada:** _(mantida)_
- **Justificativa:** já está direta e encorajadora.

---

## 3. Revisão (sessão de recall)

### `src/pages/CadernoRevisaoV2Page.tsx:410` — nada para revisar
- **Original:** `Você não tem questões vencidas no caderno. Aproveita pra fazer mais um simulado e adicionar questões ao caderno.`
- **Revisada:** `Você não tem questões vencidas agora. Aproveita e faz mais um simulado para somar questões ao caderno.`
- **Justificativa:** tira a repetição de "caderno"; mantém o tom casual.

### `src/pages/CadernoRevisaoV2Page.tsx:872` — adiar manualmente
- **Original:** `Adiar manualmente (override SRS)`
- **Revisada:** `Adiar manualmente (ignora o ritmo automático)`
- **Justificativa:** "override SRS" é jargão técnico.

### `src/pages/CadernoRevisaoV2Page.tsx:200`, `:932` — atalhos / tooltip
- **Original:** `fechar chat` / `Avançar sem registrar autoavaliação`
- **Revisada:** `fechar conversa` / _(mantida)_
- **Justificativa:** "chat" em inglês; "conversa" combina com "Conversa com Prof. San".

### `src/components/caderno/recall/SelfGradeBar.tsx:109` — confiança
- **Original:** `Marque sua confiança — isso afina o algoritmo de revisão.`
- **Revisada:** `Marque sua confiança. Isso ajusta quando a questão volta para você.`
- **Justificativa:** remove travessão e "algoritmo"; explica o efeito prático.

### `src/components/caderno/recall/SessionSummaryV2.tsx:99` — sem atividade
- **Original:** `Continue revisando — cada sessão conta.`
- **Revisada:** `Continue revisando. Cada sessão conta.`
- **Justificativa:** remove travessão.

### `src/components/caderno/recall/RecallQuestionCard.tsx:292` — acertou
- **Original:** `Você marcou ${userLabel} — acertou! Consolide o raciocínio abaixo.`
- **Revisada:** `Você marcou ${userLabel} e acertou! Consolide o raciocínio abaixo.`
- **Justificativa:** remove travessão.

### `src/components/caderno/recall/ConfidenceStep.tsx:85` — honestidade
- **Original:** `Seja honesto — isso calibra seu próximo intervalo de revisão.`
- **Revisada:** `Seja honesto. Isso ajusta quando essa questão volta.`
- **Justificativa:** remove travessão e "calibra/intervalo"; fala do efeito real.

---

## 4. Treino direcionado

### `src/pages/CadernoTreinoPage.tsx:115` — dados insuficientes
- **Original:** `Dados insuficientes para o Treino`
- **Revisada:** `Ainda não dá para montar o treino`
- **Justificativa:** "dados insuficientes" é frio; a frase nova fala com o aluno.

### `src/pages/CadernoTreinoPage.tsx:116` — explicação
- **Original:** `Você precisa de pelo menos 3 questões pendentes no caderno para gerar um treino focado. Complete alguns simulados e adicione seus erros ao caderno.`
- **Revisada:** `Você precisa de pelo menos 3 questões pendentes para montar um treino focado. Faça alguns simulados e salve seus erros aqui.`
- **Justificativa:** "montar" e "salve" são mais humanos que "gerar/adicionar".

### `src/pages/CadernoTreinoPage.tsx:400` — subtítulo
- **Original:** `Ranqueamento automático das suas áreas mais fracas pelo histórico de erros.`
- **Revisada:** `Suas áreas mais fracas, ordenadas pelo seu histórico de erros.`
- **Justificativa:** "ranqueamento automático" é jargão de produto.

### `src/pages/CadernoTreinoPage.tsx:248` — critério SRS
- **Original:** `Lapsos de revisão (SRS)` / `Temas que você errou de novo após revisar pesam mais.`
- **Revisada:** `Tropeços na revisão` / _(descrição mantida)_
- **Justificativa:** "lapsos (SRS)" é jargão; a descrição já explica bem.

### `src/pages/CadernoTreinoPage.tsx:435` — seção de áreas
- **Original:** `Ranqueadas por erros pendentes, lapsos SRS e frequência recente. Escolha uma para treinar.`
- **Revisada:** `Ordenadas pelos erros pendentes, tropeços na revisão e o que você errou recentemente. Escolha uma para treinar.`
- **Justificativa:** tira "ranqueadas" e "lapsos SRS".

### `src/components/caderno/treino/WeakAreaPicker.tsx:204` — title de lapsos
- **Original:** `${area.totalLapses} lapso${area.totalLapses > 1 ? 's' : ''} SRS — alta resistência`
- **Revisada:** `${area.totalLapses} ${area.totalLapses > 1 ? 'tropeços' : 'tropeço'} na revisão, alta resistência`
- **Justificativa:** remove travessão e "lapso SRS".

### `src/components/caderno/treino/WeakAreaPicker.tsx:207` — badge
- **Original:** `${area.totalLapses} ${area.totalLapses === 1 ? 'lapso' : 'lapsos'}`
- **Revisada:** `${area.totalLapses} ${area.totalLapses === 1 ? 'tropeço' : 'tropeços'}`
- **Justificativa:** "lapso" é jargão; "tropeço" é claro.

### `src/components/caderno/treino/TreinoLauncher.tsx:170` — CTA principal
- **Original:** `Iniciar recall do caderno` (e aria-label `Iniciar recall do caderno: ...`)
- **Revisada:** `Começar revisão do caderno`
- **Justificativa:** "recall" em inglês.

### `src/components/caderno/treino/TreinoLauncher.tsx:170` — CTA cronometrado
- **Original:** `Iniciar treino cronometrado`
- **Revisada:** `Começar treino cronometrado`
- **Justificativa:** "começar" soa mais natural que "iniciar" no contexto.

### `src/components/caderno/treino/TreinoLauncher.tsx:225` — rótulo
- **Original:** `${area.totalLapses === 1 ? 'Lapso SRS' : 'Lapsos SRS'}`
- **Revisada:** `${area.totalLapses === 1 ? 'Tropeço' : 'Tropeços'}`
- **Justificativa:** jargão "Lapso SRS".

### `src/components/caderno/treino/TreinoLauncher.tsx:319` — descrição do cronômetro
- **Original:** `Cronômetro visível com alvo de ~3 min/questão. Sem avanço forçado — só pressão real.`
- **Revisada:** `Cronômetro à vista, com meta de ~3 min por questão. Ninguém te empurra para frente, só a pressão de verdade.`
- **Justificativa:** remove travessão; tom mais humano e motivador.

---

## 5. Reta Final

### `src/components/caderno/retafinal/RetaFinalHero.tsx:94`, `:233` e `src/pages/CadernoRetaFinalPage.tsx:410` — selo / nome
- **Original:** `War Room ENAMED`
- **Revisada:** `Reta Final ENAMED`
- **Justificativa:** "War Room" é nome interno em inglês.

### `src/pages/CadernoRetaFinalPage.tsx:101` — prova passou
- **Original:** `O War Room estará disponível no próximo ciclo. Continue revisando seu caderno de erros para manter o ritmo.`
- **Revisada:** `A Reta Final volta no próximo ciclo. Continue revisando seu caderno para manter o ritmo.`
- **Justificativa:** troca "War Room" e enxuga.

### `src/pages/CadernoRetaFinalPage.tsx:114` — caderno vazio
- **Original:** `Caderno vazio`
- **Revisada:** `Seu caderno está vazio`
- **Justificativa:** mais pessoal.

### `src/pages/CadernoRetaFinalPage.tsx:115` — explicação
- **Original:** `O War Room monta seu plano com base nas questões do seu Caderno de Erros. Adicione questões na correção do simulado para ativar o plano.`
- **Revisada:** `A Reta Final monta seu plano com as questões do seu caderno. Salve questões na correção do simulado para ativar o plano.`
- **Justificativa:** troca "War Room"; "salve" no lugar de "adicione".

### `src/pages/CadernoRetaFinalPage.tsx:130` — em dia
- **Original:** `Nenhuma revisão pendente para hoje. Continue assim — faltam ${daysUntil} ${daysUntil === 1 ? 'dia' : 'dias'} para o ENAMED.`
- **Revisada:** `Nenhuma revisão pendente hoje. Continue assim! Faltam ${daysUntil} ${daysUntil === 1 ? 'dia' : 'dias'} para o ENAMED.`
- **Justificativa:** remove travessão; "!" reforça o incentivo.

### `src/pages/CadernoRetaFinalPage.tsx:339` — priorização
- **Original:** `Questões priorizadas por lapso, peso ENAMED e vencimento.`
- **Revisada:** `Questões priorizadas pelos seus tropeços, pelo peso no ENAMED e pelo vencimento.`
- **Justificativa:** "lapso" é jargão.

### `src/components/caderno/retafinal/RetaFinalHero.tsx:126` — pós-prova
- **Original:** `Você chegou até aqui. Confie no seu preparo.`
- **Revisada:** _(mantida)_
- **Justificativa:** encorajamento genuíno, já no tom certo.

---

## 6. Favoritos

### `src/pages/CadernoFavoritosPage.tsx:387` — descrição (ProGate)
- **Original:** `Salve questões de alto valor para revisitar sempre que quiser — pegadinhas clássicas, temas prevalentes, qualquer questão que vale fixar.`
- **Revisada:** `Salve as questões que valem rever sempre: pegadinhas clássicas, temas que mais caem e qualquer uma que você quer fixar.`
- **Justificativa:** remove travessão; "temas que mais caem" no lugar de "prevalentes".

### `src/pages/CadernoFavoritosPage.tsx:249` — subtítulo
- **Original:** `Questões de alto valor que você salvou para revisitar.`
- **Revisada:** `As questões que você marcou para rever sempre.`
- **Justificativa:** "alto valor" é markety; a frase nova é mais direta.

### `src/components/caderno/favoritos/FavoritesEmptyState.tsx:62` — vazio
- **Original:** `Favorite questões de alto valor durante a correção do simulado — pegadinhas clássicas, temas prevalentes ou qualquer questão que vale fixar.`
- **Revisada:** `Favorite, na correção do simulado, as questões que valem rever: pegadinhas clássicas, temas que mais caem ou qualquer uma que você quer fixar.`
- **Justificativa:** remove travessão e "alto valor/prevalentes".

---

## 7. Anotações

### `src/components/caderno/anotacoes/NoteEditor.tsx:456` — placeholder do corpo
- **Original:** `Escreva sua anotação aqui…\n\nSuporta markdown: **negrito**, _itálico_, ## título, - listas, `código``
- **Revisada:** `Escreva sua anotação aqui…\n\nVocê pode formatar: **negrito**, _itálico_, ## título, - listas, `código``
- **Justificativa:** troca "Suporta markdown" por "Você pode formatar"; mantém os exemplos.

### `src/components/caderno/anotacoes/NotesEmptyState.tsx:19` — vazio
- **Original:** `Crie anotações livres com título e texto. Use para resumir temas, registrar dicas clínicas ou organizar ideias de estudo.`
- **Revisada:** _(mantida)_
- **Justificativa:** já direta; "dicas clínicas" aqui é uso legítimo, não jargão de UI.

### `src/pages/CadernoAnotacoesPage.tsx:202` — anotação criada
- **Original:** `Comece a escrever e será salva automaticamente.`
- **Revisada:** _(mantida)_
- **Justificativa:** clara e tranquilizadora.

---

## 8. Flashcards

> Trocas de **deck → baralho** (sujeitas à sua decisão). Locais: `CadernoFlashcardsPage.tsx`
> linhas 128, 129, 143, 144, 167, 447, 459; `DeckList.tsx` 54, 117, 118, 166, 175;
> `DeckTargetSelect.tsx` 52, 64, 70, 80, 83. Abaixo só as frases inteiras.

### `src/pages/CadernoFlashcardsPage.tsx:456` — subtítulo
- **Original:** `Revise com repetição espaçada inteligente`
- **Revisada:** `Revise no intervalo certo para fixar de vez.`
- **Justificativa:** "inteligente" é markety; a frase nova diz o benefício.

### `src/pages/CadernoFlashcardsPage.tsx:128` / `:129` — sem baralho
- **Original:** `Nenhum deck ainda` / `Crie seu primeiro deck para organizar flashcards por tema, área ou prova.`
- **Revisada:** `Nenhum baralho ainda` / `Crie seu primeiro baralho para organizar os flashcards por tema, área ou prova.`
- **Justificativa:** "deck" em inglês (ver nota de decisão).

### `src/pages/CadernoFlashcardsPage.tsx:460` — stat
- **Original:** `Devidos hoje`
- **Revisada:** `Para hoje`
- **Justificativa:** "devidos" soa burocrático; "para hoje" é claro.

### `src/components/caderno/flashcards/FlashcardReviewSession.tsx:203` — resumo
- **Original:** `{mastered} {mastered === 1 ? 'card com bom desempenho' : 'cards com bom desempenho'} — SRS atualizado.`
- **Revisada:** `{mastered} {mastered === 1 ? 'card com bom desempenho' : 'cards com bom desempenho'}. Revisão reagendada.`
- **Justificativa:** remove travessão e "SRS".

### `src/components/caderno/flashcards/FlashcardEditor.tsx:421` — IA
- **Original:** `Criando seu flashcard de active recall…`
- **Revisada:** `Criando seu flashcard para você treinar de memória…`
- **Justificativa:** "active recall" em inglês.

### `src/components/caderno/flashcards/FlashcardEditor.tsx:447` — botão
- **Original:** `Regerar com IA`
- **Revisada:** `Gerar de novo`
- **Justificativa:** "regerar" não existe; mais simples assim.

### `src/components/caderno/flashcards/FlashcardEditor.tsx:507` / `:540` — placeholders
- **Original:** `Pergunta, conceito ou imagem… (markdown suportado)` / `Resposta, explicação ou gabarito… (markdown suportado)`
- **Revisada:** `Pergunta, conceito ou imagem… (aceita formatação)` / `Resposta, explicação ou gabarito… (aceita formatação)`
- **Justificativa:** "markdown suportado" é técnico.

### `src/components/caderno/flashcards/bulk/DeckTargetSelect.tsx:52` / `:64` — destino
- **Original:** `Deck existente` / `Novo deck`
- **Revisada:** `Baralho existente` / `Novo baralho`
- **Justificativa:** "deck" em inglês.

### `src/components/caderno/flashcards/BulkGenerateModal.tsx:40-45` — fontes
- **Original:** `Vira suas questões erradas em cards` / `Foca nos temas em que você mais erra` / `Cards das questões que você errou` / `Usa as questões que você favoritou` / `Cola um resumo ou usa uma anotação salva`
- **Revisada:** _(mantidas)_
- **Justificativa:** já no tom de colega, curtas e diretas.

---

## 9. Diagnóstico (atual "Insights")

### `src/pages/CadernoInsightsPage.tsx:392` — atualizando
- **Original:** `Atualizando análise em background...`
- **Revisada:** `Atualizando a análise em segundo plano…`
- **Justificativa:** "background" em inglês.

### `src/pages/CadernoInsightsPage.tsx:343` — erro
- **Original:** `Os dados do caderno estão íntegros. Tente novamente em instantes.`
- **Revisada:** `Seus dados estão a salvo. Tente de novo em instantes.`
- **Justificativa:** "íntegros" é técnico; a frase nova tranquiliza.

### `src/pages/CadernoInsightsPage.tsx:510` — nome (ProGate)
- **Original:** `Caderno de Erros — Insights`
- **Revisada:** `Caderno de Erros: Diagnóstico`
- **Justificativa:** remove travessão e "Insights".

### `src/pages/CadernoInsightsPage.tsx:517` — benefício
- **Original:** `Painel de ROI: veja o impacto real do caderno nos seus simulados`
- **Revisada:** `Veja o impacto real do caderno nos seus simulados`
- **Justificativa:** "ROI" em inglês e dispensável.

### `src/components/caderno/insights/RoiPanel.tsx:290` — título
- **Original:** `Retorno do caderno (ROI)`
- **Revisada:** `O quanto o caderno te ajudou`
- **Justificativa:** "ROI" em inglês; a frase nova é autoexplicativa.

### `src/components/caderno/insights/RoiPanel.tsx:299` / `:327` — metodologia
- **Original:** `Como calculamos o ROI` / `...O delta mostra quantos pontos percentuais seu acerto mudou.`
- **Revisada:** `Como calculamos isso` / `...A diferença mostra quantos pontos percentuais seu acerto mudou.`
- **Justificativa:** tira "ROI" e "delta".

### `src/components/caderno/insights/RoiPanel.tsx:337` — vazio
- **Original:** `Sem dados de ROI ainda`
- **Revisada:** `Ainda sem dados de retorno`
- **Justificativa:** "ROI" em inglês.

### `src/components/caderno/insights/RoiPanel.tsx:348` / `:351` / `:397` — pontuação
- **Original:** `Evolução do score global` / `Score acumulado em simulados completados` / `Score por área`
- **Revisada:** `Evolução da sua pontuação` / `Pontuação acumulada nos simulados que você completou` / `Pontuação por área`
- **Justificativa:** "score" em inglês.

### `src/components/caderno/insights/RoiPanel.tsx:416` — coluna
- **Original:** `Delta`
- **Revisada:** `Diferença`
- **Justificativa:** termo técnico em inglês.

### `src/components/caderno/insights/CalibrationPanel.tsx:165` — confiança demais
- **Original:** `Overconfidence detectada. Você declarou confiança "alta" em ${n} questões que errou. Revise esses temas com atenção.`
- **Revisada:** `Confiança alta demais. Você marcou confiança "alta" em ${n} questões que errou. Revise esses temas com atenção.`
- **Justificativa:** "overconfidence" em inglês.

### `src/components/caderno/insights/CalibrationPanel.tsx:182` — se subestima
- **Original:** `Underconfidence detectada. Você acertou ${n} questões onde declarou confiança "baixa" — talvez domine mais do que imagina!`
- **Revisada:** `Você se subestima. Acertou ${n} questões em que marcou confiança "baixa". Você sabe mais do que pensa!`
- **Justificativa:** "underconfidence" em inglês e travessão; encerramento motivador.

### `src/components/caderno/insights/CalibrationPanel.tsx:148` — bem calibrado
- **Original:** `Bem calibrado! Seu acerto sobe junto com a confiança declarada — sinal de boa metacognição.`
- **Revisada:** `Mandou bem! Seu acerto cresce junto com a sua confiança. Você se conhece bem.`
- **Justificativa:** remove travessão e "metacognição".

### `src/components/caderno/insights/CalibrationPanel.tsx:300` — explicação
- **Original:** `Metacognição é saber o que você sabe. Comparamos sua confiança declarada (baixa / média / alta) com seu acerto real. Barras crescendo da esquerda para a direita = bem calibrado.`
- **Revisada:** `Saber o que você realmente sabe faz diferença. Comparamos a confiança que você declarou (baixa, média, alta) com seu acerto de verdade. Barras subindo da esquerda para a direita querem dizer que você se conhece bem.`
- **Justificativa:** tira "metacognição" e o "=" técnico.

### `src/components/caderno/insights/InsightCard.tsx:61` — severidade
- **Original:** `Info`
- **Revisada:** `Aviso`
- **Justificativa:** "Info" é abreviação anglófona; "Aviso" é claro.

### `src/components/caderno/insights/InsightCard.tsx:71` / `:72` — tipos
- **Original:** `Padrão de overconfidence` / `Retorno sobre investimento no caderno`
- **Revisada:** `Você está confiando demais` / `O quanto o caderno te ajudou`
- **Justificativa:** tira "overconfidence" e "retorno sobre investimento".

### `src/components/caderno/insights/InsightsEmptyState.tsx:37` — indisponível
- **Original:** `Insights indisponíveis — dados insuficientes`
- **Revisada:** `Diagnóstico indisponível: ainda faltam dados`
- **Justificativa:** remove travessão e "Insights".

> **Mantido (uso legítimo de termo clínico):** `Tabela diferencial` e `Ver tabela diferencial`
> (InsightCard) descrevem exatamente uma tabela de diagnósticos diferenciais. Aqui é a
> linguagem certa do domínio, não jargão de UI.

---

## 10. Banners de intervenção (questão travada / lacuna)

> Estas strings também têm **acentos faltando no código-fonte** (ex.: "Voce", "questao",
> "revisao"). As revisões abaixo já corrigem a acentuação.

### `src/components/caderno/LeechInterventionBanner.tsx:131` — título
- **Original:** `Voce esta travando nesta questao`
- **Revisada:** `Você está travando nesta questão`
- **Justificativa:** corrige acentos.

### `src/components/caderno/LeechInterventionBanner.tsx:135` — corpo
- **Original:** `Voce ja errou esta questao ${lapseCount} ${...'vezes':'vez'} nas revisoes. Re-testar no mesmo estado nao vai ajudar — e hora de mudar a abordagem para ${topicLabel}.`
- **Revisada:** `Você já errou esta questão ${lapseCount} ${...'vezes':'vez'}. Tentar de novo do mesmo jeito não ajuda. Está na hora de mudar a estratégia em ${topicLabel}.`
- **Justificativa:** corrige acentos, remove travessão e "re-testar".

### `src/components/caderno/LeechInterventionBanner.tsx:152` — fase 1
- **Original:** `Estude o tema no SanarFlix com foco no raciocinio clinico, nao na resposta.`
- **Revisada:** `Estude o tema no SanarFlix com foco no raciocínio clínico, não na resposta.`
- **Justificativa:** corrige acentos.

### `src/components/caderno/LeechInterventionBanner.tsx:168` — fase 2
- **Original:** `Quando se sentir seguro, reative a revisao abaixo — o caderno recomeça do zero com intervalos mais curtos.`
- **Revisada:** `Quando se sentir seguro, reative a revisão abaixo. O caderno recomeça do zero, com intervalos mais curtos.`
- **Justificativa:** corrige acento e remove travessão.

### `src/components/caderno/LeechInterventionBanner.tsx:208` — botão
- **Original:** `Mudei minha abordagem — reativar revisao`
- **Revisada:** `Mudei minha estratégia, reativar revisão`
- **Justificativa:** corrige acento, remove travessão, "estratégia" é mais comum que "abordagem".

### `src/components/caderno/LeechInterventionBanner.tsx:74` — toast
- **Original:** `A questao foi reiniciada com os parametros mais conservadores. Bora estudar ${topicLabel}!`
- **Revisada:** `A questão recomeçou com intervalos mais curtos. Bora estudar ${topicLabel}!`
- **Justificativa:** corrige acentos; tira "parâmetros conservadores".

### `src/components/caderno/LessonUnlockDialog.tsx:166` — título
- **Original:** `Estude antes de re-testar`
- **Revisada:** `Estude antes de tentar de novo`
- **Justificativa:** "re-testar" é construção esquisita.

### `src/components/caderno/LessonUnlockDialog.tsx:169` — lacuna
- **Original:** `Esta questão foi marcada como Lacuna — você nunca viu o conteúdo de ${topicLabel}.`
- **Revisada:** `Esta questão é uma Lacuna: você ainda não viu o conteúdo de ${topicLabel}.`
- **Justificativa:** remove travessão; "ainda não viu" é menos categórico que "nunca viu".

### `src/components/caderno/LessonUnlockDialog.tsx:190` — porquê
- **Original:** `Re-testar sem entender o conceito leva à memorização fraca. Ao estudar o tema primeiro, você consolida o raciocínio — e o caderno vai espaçar as revisões no ritmo certo a partir daí.`
- **Revisada:** `Tentar de novo sem entender o conceito gera uma memória fraca. Estude o tema primeiro para fixar o raciocínio. A partir daí, o caderno espaça as revisões no ritmo certo.`
- **Justificativa:** remove travessão e "re-testar"; frases mais curtas.

---

## 11. Motivos de erro (`src/lib/errorNotebookReasons.ts`)

### `:40` — estratégia (lacuna)
- **Original:** `Assista aula do tema no SanarFlix`
- **Revisada:** `Assista à aula do tema no SanarFlix`
- **Justificativa:** crase correta.

### `:50` — estratégia (memória)
- **Original:** `Construa Flashcards no app.`
- **Revisada:** `Crie flashcards no app.`
- **Justificativa:** "crie" é mais natural que "construa"; minúscula em flashcards.

### `:60` — estratégia (desatenção)
- **Original:** `Garanta um ambiente de foco e preparação no momento do simulado.`
- **Revisada:** `Faça o simulado num ambiente sem distrações.`
- **Justificativa:** mais curta e concreta.

### `:69` — dica (diferencial)
- **Original:** `Sabia aproximadamente, mas errei na discriminação entre condições similares.`
- **Revisada:** `Sabia mais ou menos, mas confundi condições parecidas.`
- **Justificativa:** "discriminação entre condições similares" é rebuscado.

### `:80` — estratégia (não entendi)
- **Original:** `Reler com atenção e identificar o que não ficou claro.`
- **Revisada:** `Releia com calma e veja o que não ficou claro.`
- **Justificativa:** imperativo direto ao aluno.

### `:89` — dica (chute)
- **Original:** `Acertei por eliminação — sem entender o raciocínio completo.`
- **Revisada:** `Acertei por eliminação, sem entender o raciocínio todo.`
- **Justificativa:** remove travessão.

---

## Strings revisadas em massa (mesmo tratamento, várias ocorrências)

| Padrão | Ação |
|---|---|
| Qualquer `—` (travessão) restante | trocar por `.`, `,`, `:` ou conectivo conforme o sentido |
| `deck` / `decks` (flashcards) | `baralho` / `baralhos` (sujeito à sua decisão) |
| `lapso(s) SRS` / `lapso(s)` no contexto de revisão | `tropeço(s) na revisão` |
| `score` | `pontuação` / `nota` |
| `recall` | `revisão` / `revisar de cabeça` |
| `War Room` | `Reta Final` |
| Acentos faltando no `LeechInterventionBanner.tsx` | corrigir todos |

## Strings mantidas (já no tom certo)

Botões e rótulos curtos e claros não precisam de mudança: `Cancelar`, `Voltar`,
`Salvar no Caderno`, `Salvar anotação`, `Tentar novamente`, `Limpar filtros`, `Área`,
`Todas`, `Pendentes`, `Dominadas`, `Favoritar`, `Remover do caderno`, `Como você se saiu?`,
`Qual foi sua confiança?`, `Mandou bem!`, `Excelente sessão!`, `Boa sorte na prova!`,
`Você está em dia!`, `Nada pra revisar agora`, entre outros.
