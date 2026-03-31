

## Plano de Implementacao — Feedbacks por Tela (Bloco 1: Home + Sidebar + TopBar)

Vamos implementar tela a tela. Este primeiro bloco cobre **Home (Inicio)**, **Menu Lateral (Sidebar)** e **Barra Superior (TopBar)**. Apos aprovacao, seguimos para o proximo bloco.

---

### Bloco 1A — Home (Inicio)

**1. Card Calendario — mostrar proximas datas**
- No `QuickActionCard` de "Calendario", substituir o copy generico por datas reais do proximo simulado (reutilizar `nextSimulado` que ja existe em `HomePagePremium`).
- Exibir: "Proxima janela: 03/04 a 06/04" (ou "Nenhuma janela proxima").

**2. Ranking Express — clarificar simulado de referencia + empty state + logica correta**
- Em `RankingExpressCard.tsx`: remover dados mock (`mockPosition`, `mockLastScore`, `hasRanking = true`).
- Exibir o titulo do simulado de referencia (ex: "Simulado #1").
- Empty state real: "Complete um simulado dentro da janela para aparecer no ranking."
- Ranking express mostra posicao apenas do ranking geral (sem filtro de especialidade/instituicao aqui — isso fica na pagina completa).

**3. Proximo Simulado Banner — 5 cenarios**
Refatorar `NextSimuladoBanner` para receber mais contexto e cobrir todos os cenarios:

```text
Cenario                                          | Exibicao
-------------------------------------------------|--------------------------------------------
Antes da janela                                  | "Proximo simulado: DD/MM" + CTA "Ver simulados"
Janela aberta, nao realizado                     | CTA "Realizar simulado" (link para detail)
Janela aberta, realizado, resultado nao liberado | Icone cadeado + "Resultado em DD/MM"
Apos janela, realizado                           | CTA "Ver resultado"
Apos janela, sem proximo                         | "Proximo simulado: DD/MM" + "Ver simulados"
```

Isso requer passar para o banner: `simulados` (lista completa), nao apenas `nextWindowStart/End`.

---

### Bloco 1B — Menu Lateral (Sidebar)

**4. Logo no canto superior esquerdo**
- Em `SidebarBrandBlock.tsx`: substituir o icone `GraduationCap` por uma imagem de logo (ou manter icone + ajustar posicionamento para ficar mais proeminente como logo no canto superior esquerdo).

**5. Corrigir animacao de transicao**
- Verificar `PremiumSidebar` e `NavItem` para animacoes de hover/active. Garantir transicoes suaves sem glitches.

**6. Labels de segmento — substituir em toda a plataforma**
- Atualizar `SEGMENT_LABELS` em `src/types/index.ts`:
  - `guest` → "Visitante"
  - `standard` → "Aluno SanarFlix"  
  - `pro` → "Aluno PRO"

---

### Bloco 1C — Barra Superior (TopBar)

**7. Remover nome da pagina, manter apenas label + perfil**
- Em `TopUtilityBar.tsx`: remover `sectionLabel` prop e sua exibicao.
- Manter apenas: label do segmento (Visitante / Aluno SanarFlix / Aluno PRO) + icone do perfil com link para `/configuracoes`.
- Fazer o avatar ser clicavel (link para configuracoes).

---

### Arquivos impactados (Bloco 1)

| Arquivo | Mudanca |
|---|---|
| `src/types/index.ts` | Atualizar `SEGMENT_LABELS` |
| `src/components/premium/home/HomePagePremium.tsx` | Passar dados completos para banner |
| `src/components/premium/home/NextSimuladoBanner.tsx` | Refatorar para 5 cenarios |
| `src/components/premium/home/QuickActionCard.tsx` | Aceitar prop de datas |
| `src/components/premium/home/RankingExpressCard.tsx` | Remover mocks, empty state, titulo do simulado |
| `src/components/premium/sidebar/SidebarBrandBlock.tsx` | Logo |
| `src/components/premium/TopUtilityBar.tsx` | Simplificar, remover sectionLabel |

### Blocos seguintes (apos aprovacao deste)

- **Bloco 2**: Simulados (remover busca/filtros, secoes, card sem subtitulo, "como funciona" no topo)
- **Bloco 3**: Execucao do Simulado (checklist, experiencia offline placeholder, tela cheia, fonte Finalizar)
- **Bloco 4**: Desempenho (remover redundancias, reordenar secoes, remover dificuldade)
- **Bloco 5**: Ranking (filtro exclusivo especialidade OU instituicao, anonimizar nomes, numeros)
- **Bloco 6**: Correcao + Caderno de Erros (comentario visivel, split view, filtros avancados, checkbox resolver)
- **Bloco 7**: Comparativo (comparativo de grandes areas) + Configuracoes (remover "dados reais", editar pessoais)

