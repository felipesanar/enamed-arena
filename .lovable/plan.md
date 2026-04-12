

# Desempenho: Números absolutos + Hierarquia Especialidade > Tema

## Resumo

Duas mudancas no modulo de Desempenho:

1. **% para numero absoluto** — exibir "X/Y" (acertos/total) em vez de percentual em todos os indicadores
2. **Hierarquia Grande Area > Tema para Especialidade > Tema** — o campo `theme` no banco ja contem "Especialidade > Tema" (ex: "Hematologia > Hemostasia e Trombose"). Vamos parsear esse campo para extrair Especialidade como nivel primario e Tema como sub-nivel, eliminando o agrupamento por `area` (Grande Area)

## Dados atuais no banco

- `questions.area` = "Clinica Medica", "Cirurgia", "Pediatria", etc. (Grande Area)
- `questions.theme` = "Hematologia > Hemostasia e Trombose" (ja contem Especialidade > Tema)

## Plano de implementacao

### 1. Atualizar `resultHelpers.ts` — parser e breakdown

- Adicionar funcao `parseThemeField(theme: string)` que retorna `{ specialty: string, subTopic: string }`
- Mudar `computePerformanceBreakdown` para agrupar por **Especialidade** (primeira parte do theme) em vez de `area`
- O segundo nivel (byTheme) agrupa por Tema (segunda parte do theme) dentro de cada Especialidade
- Mudar `AreaPerformance.score` para manter `correct` e `questions` como dados primarios (score % ainda calculado internamente para barras, mas display sera absoluto)

### 2. Atualizar `DesempenhoSimuladoPanel.tsx` — labels e display

- Trocar label "Grande Area" por "Especialidade"
- Trocar placeholder "Selecione uma Grande Area" por "Selecione uma Especialidade"
- Trocar label "Temas · X" por "Temas · [Especialidade]"
- Trocar "Evolucao por grande area" por "Evolucao por especialidade"
- No `AreaCard`: exibir "X/Y" em vez de "score%"
- No `ThemeAccordionRow`: exibir "X/Y" em vez de "score%"
- No `HeroSection`: manter total de acertos "X de Y questoes" como metrica principal, remover ou secundarizar o percentual
- No `EvoBars`: exibir "X/Y" em vez de "score%"
- No `SummarySection`: ajustar texto para usar acertos absolutos

### 3. Atualizar `ComparativoPage.tsx`

- Trocar labels "grande area" por "especialidade"
- Exibir acertos absolutos nas celulas da tabela

### 4. Atualizar `CadernoErrosPage.tsx`

- Trocar label "Grande area" por "Especialidade" no filtro

### 5. Atualizar `HomePagePremium.tsx`

- Trocar "Grande area de atencao" por "Especialidade de atencao"

### 6. Atualizar `AdminUploadQuestions.tsx`

- Manter mapeamento de colunas do CSV (Grande Area, Especialidade, Tema) inalterado — os dados ja sao compostos corretamente no upload
- Trocar apenas labels de UI de "Grande Area" para "Especialidade" na tabela de preview

### 7. Corrigir build errors pre-existentes

- **`SimuladoResultNav.tsx`**: remover prop `variant` duplicada na interface
- **`ResultadoPage.test.tsx`**: adicionar tipos explicitos para `eliminatedAlternatives`, `imageUrl`, `explanationImageUrl`, `difficulty`
- **`rankingApi.test.ts`**: adicionar `segment` obrigatorio na funcao helper `p()`
- **`DesempenhoPage.test.tsx`**: atualizar texto de assertions para refletir novos labels

### Arquivos editados

| Arquivo | Mudanca |
|---------|---------|
| `src/lib/resultHelpers.ts` | Parser de theme, agrupamento por especialidade |
| `src/components/desempenho/DesempenhoSimuladoPanel.tsx` | Labels + display absoluto |
| `src/pages/ComparativoPage.tsx` | Labels especialidade |
| `src/pages/CadernoErrosPage.tsx` | Label filtro |
| `src/components/premium/home/HomePagePremium.tsx` | Label card |
| `src/admin/pages/AdminUploadQuestions.tsx` | Labels preview |
| `src/components/simulado/SimuladoResultNav.tsx` | Fix duplicate variant |
| `src/pages/ResultadoPage.test.tsx` | Fix implicit any |
| `src/services/rankingApi.test.ts` | Fix missing segment |
| `src/pages/DesempenhoPage.test.tsx` | Update assertions |

