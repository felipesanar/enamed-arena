# Direção de UI — Sistema de Cards e Hierarquia

**Objetivo:** Definir quando usar cada variante de card para hierarquia clara e experiência premium. Base do Plano Mestre de Transformação UX/UI (Fase A).

---

## 1. Variantes de card

### 1.1 Hero card

**Uso:** Um único protagonista por tela — próximo simulado, resultado (nota em destaque), conclusão da prova, CTA principal de detalhe do simulado.

**Características:**
- Maior peso visual: mais padding (`p-6 md:p-8` ou tokens de respiro), tipo maior (heading-2 ou display quando for número).
- Opcional: gradiente sutil (wine) ou borda wine; fundo que se destaque do restante da página.
- Um CTA principal por bloco; texto de apoio claro.
- Não competir com outro bloco do mesmo tamanho na mesma viewport.

**Onde usar:**
- Dashboard: bloco “Próximo simulado” ou “Complete seu perfil”.
- Resultado: hero com nota + acertos/erros/em branco.
- Detalhe do simulado: “Iniciar simulado” quando disponível.
- Conclusão da prova: reconhecimento + “Ver resultado”.

**Componente:** `PremiumCard variant="hero"` ou `HeroCard` (wrapper que aplica classes de hero).

---

### 1.2 Content card

**Uso:** Blocos de lista, detalhes secundários, seções de apoio (últimos simulados, acesso rápido, breakdown por área, tabelas, formulários).

**Características:**
- Padrão atual do `PremiumCard`: borda, sombra leve, `rounded-xl`, padding moderado (`p-4 md:p-5`).
- Pode ser interativo (hover, link) com `interactive`.
- Densidade média; não roubar atenção do hero.

**Onde usar:**
- Listas (últimos simulados, caderno de erros, cronograma em cards).
- Cards de insight (comparativo, desempenho).
- Tabelas e conteúdos tabulares dentro de card.
- Blocos de configuração, perfil, conta.

**Componente:** `PremiumCard` (default) ou `PremiumCard variant="content"`.

---

### 1.3 Stat card

**Uso:** Métricas em grid — número + label; opcional ícone e link (ex.: “Ranking → Ver”).

**Características:**
- Compacto: `p-4 md:p-5`, valor em destaque (heading-2), label em caption/body-sm.
- Pode ser um “hero stat” quando for a métrica principal da tela (ex.: simulados realizados no dashboard) — aí ocupa mais espaço ou maior tipo.
- Evitar valor “—” sem ação; preferir link “Ver” quando não houver dado.

**Onde usar:**
- Dashboard: resumo (simulados realizados, média, ranking).
- Resultado: acertos, erros, em branco.
- Desempenho: aproveitamento, acertos, questões respondidas.
- Comparativo: simulados, média, melhor nota, último score.

**Componente:** `StatCard` (já existe). Para hero stat, usar layout dedicado ou StatCard com prop `hero` que aumenta tipo e padding.

---

## 2. Regras de hierarquia

- **Uma tela, um protagonista:** Quando fizer sentido, uma única área hero (hero card ou bloco hero). O restante é apoio.
- **Ritmo variado:** Zonas de respiro (hero, conclusão, empty state) com mais espaço e tipo maior; zonas densas (tabelas, listas) com grid e tipo menor.
- **CTA único por seção:** Um botão/link primário por contexto (ex.: “Ver correção” no resultado); demais secundários ou terciários.

---

## 3. Paleta para gráficos (Charts)

Para que gráficos pareçam “do produto”, usar sempre:

| Uso            | Token / Cor        | Uso em gráficos                          |
|----------------|--------------------|------------------------------------------|
| Primário / progresso | `primary` / wine   | Linha principal, barra principal, área  |
| Sucesso        | `success`          | Evolução positiva, acertos, meta        |
| Erro / queda   | `destructive`      | Queda, erros, abaixo da média            |
| Neutro / secundário | `muted`       | Grid, eixos, séries secundárias          |
| Destaque       | `warning` ou `info`| Pontos de atenção, máximos/mínimos       |

**Tipografia em charts:**
- Eixos e labels: `caption` (fontSize 12, fill: muted-foreground).
- Tooltip: `body-sm`, fundo card, borda border, radius alinhado ao design system (ex.: 12px).
- Números: tabular-nums.

**Implementação:** Constante ou CSS vars em `src/lib/chartTheme.ts` (ou equivalente) e uso em Recharts (Comparativo, Desempenho) para Line, Bar, Tooltip, CartesianGrid, XAxis, YAxis.

---

## 4. Tokens estendidos (respiro e hero)

- **Spacing de respiro:** Para seções hero ou conclusão, usar `mb-10 md:mb-12` (ou tokens como `--section-breathe`) entre seções pesadas e o restante da página.
- **Hero gradient:** Gradiente wine para fundo de hero (ex.: próximo simulado) já usado no dashboard; token opcional `--hero-gradient` para consistência.
- **Sombras:** `--shadow-premium` para cards hero quando precisar elevar mais que o content card.

---

## 5. Checklist por tela (referência para fases B–F)

- [ ] Dashboard: 1 hero (próximo simulado ou onboarding); resumo com hero stat + stats em grid; content cards para últimos e atalhos.
- [ ] Resultado: 1 hero (nota + resumo); content cards para áreas e CTAs.
- [ ] Simulados: hero “seu próximo” quando fizer sentido; content para lista e cronograma.
- [ ] Detalhe simulado: hero com CTA “Iniciar simulado” quando disponível.
- [ ] Conclusão prova: hero de reconhecimento + 1 CTA.
- [ ] Desempenho / Ranking / Comparativo: títulos editoriais; charts com paleta do produto; stat cards onde couber.

Este documento é a referência para uso consistente de hero vs content vs stat em todo o produto.
