# Revisão profunda — Mais vida na landing

## Objetivo

Transformar a LP de “bonita porém morta” para “bonita e viva”: mais produto real, mais contexto humano, mais dados plausíveis, mais variedade visual e narrativa, sem perder o nível premium.

---

## Problemas de “falta de vida” encontrados

### 1. Pouco elemento real da plataforma
- **Performance (Comparison):** Só 3 cards conceituais; nenhum ranking ou dado concreto.
- **Experiência:** Mockup de prova com caixas genéricas, sem timer, contador de questões nem ações (“Marcar para revisão”).
- **Como funciona:** Painel direito genérico (“Fluxo guiado”, “Cada etapa prepara a próxima”) sem próximo simulado nem inscritos.

### 2. Dados e ranking abstratos
- Nenhum ranking com nomes, posição, score ou variação.
- Stats de prova social vagas (“Milhares”, “Simulados”, “Especialidades”) em vez de números concretos.
- Nenhum “próximo simulado” com data, questões e inscritos.

### 3. Feedbacks e microcontextos ausentes
- Nenhuma linha do tipo “Resultado liberado para X alunos”, “Ranking atualizado há Xh”, “X inscritos”.
- CTA final sem contexto de próximo simulado ou sensação de urgência/uso.

### 4. Prova social limitada
- Uma única citação; stats genéricas.
- Falta segunda voz e números que reforcem escala e uso.

### 5. Variedade visual e cromática
- Seções muito uniformes (título + texto + cards).
- Pouca alternância de ritmo e quase nenhuma variação de superfície/cor entre seções.

---

## Melhorias implementadas

### 1. Dados simulados reutilizáveis (`src/lib/landingMockData.ts`)
- **RANKING_PREVIEW_ROWS:** 6 linhas com posição, nome, especialidade, score e variação; linha “Você” em destaque.
- **NEXT_SIMULADO:** título, questões, data, número de inscritos.
- **SOCIAL_PROOF_STATS:** “2.4k+”, “340+”, “12” com labels concretas.
- **LIVE_FEEDBACK_LINES:** frases de resultado liberado, ranking atualizado e inscritos.

### 2. Performance (Comparison) — Ranking real
- Bloco **“Ranking · Clínica Médica”** com tabela (#, Aluno, Especialidade, Score, Var.).
- Dados de `RANKING_PREVIEW_ROWS`; linha “Você” com fundo primary e borda.
- Rodapé: “Entre 2.4k participantes · Sua posição e evolução em tempo real”.
- “Atualizado há 2h” no cabeçalho da tabela.
- Gradiente de fundo sutil na seção (via-primary/[0.03]) para dar identidade à área de dados.

### 3. Experiência — Mockup de prova vivo
- **Timer:** “01:24:35” com ícone de relógio.
- **Sidebar:** label “Questões” e números (1, 12 em destaque, 31, 61, 91); questão atual com borda primary.
- **Questão:** “Questão 12 de 120 — Clínica Médica” e trecho de enunciado plausível.
- **Ação:** botão “Marcar para revisão” com ícone Bookmark.
- **Navegação:** blocos “Anterior” e “Próxima” (Próxima em destaque).

### 4. Como funciona — Painel “Próximo simulado”
- Badge “Próximo simulado” com ponto verde animado.
- Card com **título, questões, data e inscritos** vindos de `NEXT_SIMULADO`.
- Copy: “Cada etapa prepara a próxima. Inscreva-se, escolha o simulado e acompanhe sua evolução.”
- Remoção do bloco genérico “Fluxo guiado”.

### 5. Prova social — Mais densidade
- **Stats concretas:** uso de `SOCIAL_PROOF_STATS` (2.4k+, 340+, 12 especialidades).
- **Segunda citação:** depoimento focado em ranking por especialidade, em bloco separado abaixo (variação de layout).
- Mantida a primeira citação em destaque; segunda em card mais compacto.

### 6. Diferenciais (ValueProps) — Feedback “ao vivo”
- Faixa acima do grid: “Resultado liberado para 1.203 alunos no último simulado.” (primary/5, borda primary/20).

### 7. Premium (PRO) — Ranking atualizado
- Linha abaixo da descrição: “Ranking atualizado há 2 horas.” (text-primary/90).

### 8. CTA final — Próximo simulado em evidência
- Linha antes do título: “Clínica Médica · 120 questões · 12 de abril · 2.847 inscritos” (text-primary).
- Reforça produto real e sensação de uso/urgência.

### 9. Variedade de cor e composição
- **Performance:** fundo com gradiente sutil (primary/[0.03]) para diferenciar a seção de ranking.
- Demais seções mantêm o fundo atual; identidade SanarFlix Pro preservada.

---

## Elementos reais da plataforma adicionados

| Onde | O quê |
|------|--------|
| Comparison | Tabela de ranking com 6 linhas, posição, aluno, especialidade, score, variação, “Você” em destaque, “Atualizado há 2h”. |
| Experience | Mockup com timer, contador “Questão 12 de 120”, enunciado, “Marcar para revisão”, Anterior/Próxima. |
| HowItWorks | Card “Próximo simulado” com título, 120 questões, data, 2.847 inscritos. |
| ValueProps | Faixa “Resultado liberado para 1.203 alunos no último simulado.” |
| Premium | “Ranking atualizado há 2 horas.” |
| Cta | “Clínica Médica · 120 questões · 12 de abril · 2.847 inscritos.” |
| SocialProof | Stats 2.4k+, 340+, 12; segunda citação sobre ranking. |

---

## Contexto humano

- **Hero:** já tinha imagem da aluna e bloco “Análise SanarFlix” com mensagem de aprovação; mantido.
- **Prova social:** segunda citação traz outra voz (“ranking por especialidade”) e reforça uso real.
- **Ranking:** nomes simulados (Ana C. M., Lucas R., etc.) e linha “Você” dão sensação de competição e identificação.

Nenhuma foto nova foi adicionada; presença humana continua na hero e nas citações.

---

## Variedade de cor e composição (sem sair da marca)

- Uma única seção com fundo diferenciado: **Performance** com gradiente vertical primary/[0.03], mantendo tom escuro e wine/primary.
- Stats e ranking usam primary para destaque e success para variação positiva; sem novas cores fora do sistema.
- Layout: prova social ganha duas citações em níveis diferentes (uma em card grande, outra em card menor abaixo); Comparison ganha bloco de tabela antes do texto de fechamento.

---

## Arquivos alterados

| Arquivo | Alteração |
|---------|-----------|
| `src/lib/landingMockData.ts` | **Novo:** ranking, próximo simulado, stats e linhas de feedback. |
| `src/components/landing/LandingComparison.tsx` | Tabela de ranking, uso de RANKING_PREVIEW_ROWS, gradiente de fundo sutil. |
| `src/components/landing/LandingExperience.tsx` | Mockup com timer, questões numeradas, enunciado, “Marcar para revisão”, Anterior/Próxima. |
| `src/components/landing/LandingHowItWorks.tsx` | Painel com card “Próximo simulado” (NEXT_SIMULADO) e inscritos. |
| `src/components/landing/LandingSocialProof.tsx` | SOCIAL_PROOF_STATS, duas citações (QUOTES), layout em duas camadas. |
| `src/components/landing/LandingValueProps.tsx` | Faixa com LIVE_FEEDBACK_LINES[0]. |
| `src/components/landing/LandingPremium.tsx` | LIVE_FEEDBACK_LINES[1] no header. |
| `src/components/landing/LandingCta.tsx` | Linha “próximo simulado” com NEXT_SIMULADO. |

---

## Consistência e design system

- Tokens de cor (primary, wine, card, border, success, muted) e tipografia mantidos.
- Componentes e motion system existentes preservados.
- Novos textos e números são fictícios mas plausíveis; fáceis de trocar via `landingMockData.ts`.

---

## Critério de sucesso

A landing passa a:
- Mostrar **produto real:** ranking, próximo simulado, resultado liberado, ranking atualizado.
- Transmitir **plataforma em uso:** inscritos, atualização há 2h, duas citações e stats concretas.
- Ter **mockup de prova** com timer, questão e ações reconhecíveis.
- Manter **nível premium** e identidade SanarFlix Pro, com uma seção levemente diferenciada (Performance) e sem poluição visual.
