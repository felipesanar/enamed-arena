# Refino do Modo Escuro — Design

**Data:** 2026-06-06
**Escopo:** Passo abrangente de qualidade no modo escuro (dark mode) do produto do aluno.
**Superfícies-alvo:** App logado/premium, Prova (exam mode), Resultados & Caderno de Erros.
**Fora de escopo:** Admin, Landing (`.landing-dark`), Auth (já fortemente dark-tuned). Modo claro **congelado**.

---

## 1. Problema

O modo escuro atual (`.dark` em `src/index.css`) é funcional mas tem deficiências concretas de
qualidade, coesão, contraste e conforto:

1. **Sombras invisíveis no escuro.** `--shadow-md/lg` usam `hsl(220 20% 10% / opacity)` — sombra
   escura sobre fundo escuro não aparece. `.premium-card` e derivados ficam "chapados", sem
   hierarquia de elevação.
2. **Escada de elevação curta.** `background 6%` → `card 10%` → `surface-elevated 13%`: saltos de
   3-4% de luminância. Cards "vazam" no fundo; a separação depende quase só da borda (22%).
3. **Fundo quase-preto (L 6%).** Agressivo para leitura longa — a tela de prova tem muito texto.
4. **Gradientes hero com hex cravado e azul-marinho** (`#080A14`, `#0C1020`, `#1A0816`...) que
   destoam da identidade vinho/quente — quebra de coesão visual.
5. **Contraste de texto secundário no limite.** `muted-foreground 65%` e `exam-text-secondary 55%`
   ficam no limite (ou abaixo) do WCAG AA em texto pequeno.
6. **~21 componentes premium/exam cravam cores** (`#hex`/`rgba()`) que furam os tokens, gerando
   inconsistência entre telas.

## 2. Direção visual aprovada

Decisões de direção confirmadas com o usuário:

- **Fundo base:** suavizar para **~9% L** (sair do quase-preto), conforto em leitura longa e melhor
  leitura de elevação (estilo Linear/Vercel).
- **Temperatura dos neutros:** **levemente quente**, ancorada no hue vinho (~345) com saturação
  baixíssima nos cinzas — sensação coesa/acolhedora e premium, casando com a marca.
- **Gradientes hero:** **harmonizar para vinho-quente** — quase-preto-vinho → borgonha, no lugar do
  azul-marinho cinematográfico.

## 3. Abordagem: Token-first + QA por superfície

Refinar a camada `.dark` como **fonte única da verdade**, depois um QA visual por superfície
corrigindo componentes que furam o token. Vantagens: ataca a raiz, coesão vem "de graça" via tokens,
e o risco no modo claro é quase nulo (mudanças concentradas no bloco `.dark` e em utilitários
dark-only).

Abordagens descartadas: redesenho superfície-a-superfície (arrisca divergência, o oposto de coesão);
correção só de contraste/a11y (não entrega o "bonito/premium/conforto" pedido).

---

## 4. Mudanças detalhadas

### 4.1 Nova paleta `.dark` (neutros quentes, escada de elevação)

Reescrever o bloco `.dark` em `src/index.css`. Princípios:

- **Hue dos neutros:** migrar de `220` (azul) para a vizinhança de `345` (vinho) com **saturação
  muito baixa** (≈4-8%) — quente o suficiente para coesão, neutro o suficiente para não "rosar".
- **Escada de elevação** com saltos perceptíveis (~4-5% L cada), do mais fundo ao mais alto:

  | Token | Papel | Alvo aproximado (HSL) |
  |---|---|---|
  | `--surface-sunken` | poços, trilhos | `345 8% 7%` |
  | `--background` | fundo da página | `345 8% 9%` |
  | `--card` / `--popover` | cards, menus | `345 7% 13%` |
  | `--surface-elevated` | cards sobre cards, modais | `345 7% 17%` |

  (Valores finais ajustados na implementação via QA visual; a tabela fixa a **relação** entre níveis.)

- **Texto:**
  - `--foreground`: `345 8% 92%` (sem branco puro — anti-glare).
  - `--muted-foreground`: elevar para garantir **WCAG AA (≥4.5:1)** em texto pequeno sobre `card`.
    Alvo de partida `345 6% 68-70%`, validado com checagem de contraste.
- **Bordas (2 níveis):**
  - `--border` sutil: legível sobre `card`/`elevated` (alvo `345 8% 24%`).
  - borda-forte (para divisores/realces): alvo `345 8% 30%`.
- **Primary (vinho):** manter/ajustar `345 ~58% ~52%` de forma que **texto branco sobre primary**
  passe contraste para texto grande/bold (uso atual: botões, badges). Validar; se necessário, escurecer
  levemente para subir contraste do `primary-foreground`.
- **`--input` / `--ring`:** alinhados à nova paleta (input = superfície levemente acima do card;
  ring = primary).
- **Sidebar dark:** re-tunar `--sidebar-*` para a mesma família quente (hoje `220`), mantendo a
  sidebar como superfície mais funda/escura coerente.

### 4.2 Sistema de elevação nativo de dark

Sombra escura não aparece no escuro. Introduzir elevação por **superfície + luz**:

- Tokens de sombra dark-only que combinam: sombra projetada suave (preta, baixa opacidade, para
  profundidade real onde houver) **+ inset top highlight** (rim de luz `rgba(255,255,255,~0.04-0.06)`
  no topo) que dá o "relevo" premium.
- `.premium-card`, `.premium-card-hero`, `SurfaceCard` e modais passam a receber a variante dark via
  override no `.dark` (sem tocar a aparência light).
- Glow vinho discreto reservado aos heros / elementos protagonistas (não em todo card, para não poluir).

### 4.3 Heros harmonizados

- `.dark .hero-premium-surface` e `.dark .hero-status-card`: substituir os hex azul-marinho por
  gradiente **quase-preto-vinho → borgonha** (família `345`), mantendo profundidade/cinematografia
  mas coeso com a marca. Ex. de família: `hsl(345 30% 8%)` → `hsl(345 45% 14%)` → `hsl(345 55% 20%)`
  (stops finais via QA visual).
- `--hero-premium-bg` (token) atualizado na mesma direção.

### 4.4 Feedback semântico

Re-tunar para o novo fundo quente, priorizando conforto (luminosidade adequada, saturação que não
"vibra" sobre fundo escuro), mantendo distinção clara entre estados:

- `--success`, `--warning`, `--info`, `--destructive` e seus `*-surface` (fundos de badge/alert).
- `--trend-up`/`--trend-down`, `--medal-*` revisados para legibilidade sobre o novo `card`.
- Garantir que `destructive` (badge "Errou") e `primary` (vinho/rosa) permaneçam **distinguíveis** —
  restrição já anotada no CSS atual.

### 4.5 QA visual por superfície

Rodar o app (`npm run dev`, porta 8080) e capturar **screenshots antes/depois em dark mode** de:

1. **Home premium** — hero, KPIs, cards de ação, ranking express, sidebar, bottom nav mobile.
2. **Prova** — `SimuladoExamPage`: header/timer, enunciado, opções (estados default/hover/selecionado),
   foco.
3. **Resultado & Correção** — `ResultadoPage`, `CorrecaoPage`.
4. **Caderno** — `CadernoErrosPage`, `CadernoRevisaoPage`.

Para cada superfície, corrigir os componentes que cravam cor (`#hex`/`rgba()`) e furam os tokens —
lista de partida (~21 arquivos) em `src/components/premium/**` e `src/components/exam/**`, mais as
páginas em `src/pages/*.tsx`. Regra: trocar valor cravado por token semântico equivalente; quando o
efeito for dark-specific (rim de luz, glow), usar utilitário dark-only.

> **Cap explícito:** o QA cobre as superfícies listadas acima. Telas fora do escopo (admin, landing,
> auth) **não** serão tocadas. Se durante o QA surgir um componente compartilhado que afete uma tela
> fora de escopo, registrar e tratar via token (sem regressão no claro).

## 5. Garantias / Critérios de aceite

- **Modo claro 100% congelado:** mudanças concentradas no bloco `.dark` e em utilitários/overrides
  `.dark *`. Nenhuma alteração de `:root`, `.landing-dark` ou tokens de auth.
- **Contraste WCAG AA:** texto normal ≥4.5:1, texto grande ≥3:1, sobre as superfícies onde aparece.
  Validar `foreground`, `muted-foreground`, `*-foreground` e textos sobre `primary`.
- **Build & lint verdes:** `npm run build` e `npm run lint` sem novos erros.
- **Testes:** `npm run test` sem regressões (testes existentes mockam `useTheme` como light — não
  devem quebrar).
- **Evidência visual:** screenshots antes/depois em dark das 4 superfícies anexados na entrega.

## 6. Riscos

| Risco | Mitigação |
|---|---|
| Mudança de hue dos neutros afeta percepção em telas não revisadas | Mudança via token; QA cobre as principais; relação de elevação preservada. |
| Componentes com cor cravada continuam destoando | QA por superfície lista e corrige os ~21 arquivos mapeados. |
| Contraste insuficiente após re-tune | Checagem AA explícita por token; ajuste iterativo no QA. |
| Regressão acidental no modo claro | Escopo restrito a `.dark`; diff revisado garante `:root` intocado. |
