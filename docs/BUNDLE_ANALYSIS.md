# Bundle Analysis — enamed-arena

> Documento de orientação. Nenhum build foi executado para gerá-lo.
> Os tamanhos e chunks são estimativas baseadas na leitura de `vite.config.ts` e `package.json`.

---

## 1. Como analisar o bundle

### Opção A — rollup-plugin-visualizer (recomendado, zero config extra)

```bash
npm install --save-dev rollup-plugin-visualizer
```

Adicione temporariamente ao `vite.config.ts`:

```ts
import { visualizer } from 'rollup-plugin-visualizer';

// dentro do array plugins:
visualizer({ open: true, gzipSize: true, brotliSize: true, filename: 'dist/stats.html' })
```

Então rode:

```bash
npm run build
# abre dist/stats.html automaticamente com treemap interativo
```

### Opção B — vite-bundle-visualizer (wrapper CLI)

```bash
npx vite-bundle-visualizer
```

Gera `stats.html` na raiz sem precisar editar o config.

### Opção C — vite --reporter (baseline rápido)

```bash
npm run build 2>&1 | grep -E "kB|MB"
```

Mostra tamanho de cada chunk no terminal. Útil para CI.

---

## 2. Chunks já configurados (vite.config.ts `manualChunks`)

O projeto já tem chunking manual. Os nomes abaixo são os produzidos na build:

| Chunk              | Libs incluídas                          | Tamanho estimado (gzip) |
|--------------------|-----------------------------------------|-------------------------|
| `vendor-react`     | react, react-dom, scheduler             | ~45 KB                  |
| `vendor-radix`     | @radix-ui/* (25+ pacotes)               | ~90-110 KB              |
| `vendor-pdf-xlsx`  | jspdf, exceljs, jszip                   | ~300-400 KB             |
| `vendor-framer`    | framer-motion                           | ~50-70 KB               |
| `vendor-lucide`    | lucide-react                            | ~30-50 KB               |
| `vendor-supabase`  | @supabase/supabase-js                   | ~60 KB                  |
| `vendor-query`     | @tanstack/react-query                   | ~20 KB                  |
| `vendor-router`    | react-router-dom                        | ~25 KB                  |
| *(não chunked)*    | recharts, react-markdown, date-fns, zod | vai pro chunk de rota   |

### Deps pesadas sem chunk dedicado

- **recharts** (~130 KB gzip): usado em páginas de Desempenho, Ranking e Comparativo. Candidato a lazy-import por rota.
- **exceljs** + **jszip** (~250 KB gzip juntos): exportação de planilha. Raramente executado. Já está em `vendor-pdf-xlsx`, mas esse chunk carrega junto com qualquer rota que importe os componentes de export.
- **jspdf** (~100 KB gzip): geração de PDF client-side. Mesma situação que exceljs.
- **framer-motion** (~60 KB gzip): animações UI. Carregado em todo o app via shadcn/layout. Difícil de lazyar sem refatoração, mas o chunk dedicado já o isola do critical path se as rotas usarem `React.lazy`.
- **react-markdown** (~15 KB gzip): usado nas páginas de IA (Caderno de Erros, Desempenho). Pode ficar no chunk de rota sem problema.

---

## 3. Rotas pesadas e recomendações de lazy-load

### 3.1 Estratégia geral

Em `src/App.tsx`, substitua imports diretos de páginas pesadas por `React.lazy`:

```tsx
// Antes
import SimuladoExamPage from "@/pages/SimuladoExamPage";

// Depois
import { lazy, Suspense } from "react";
const SimuladoExamPage = lazy(() => import("@/pages/SimuladoExamPage"));

// Envolva as rotas com Suspense:
<Suspense fallback={<LoadingSpinner />}>
  <Route path="/exam/:id" element={<SimuladoExamPage />} />
</Suspense>
```

### 3.2 Prioridade por rota

| Rota / Página              | Libs pesadas usadas                        | Impacto no carregamento inicial | Prioridade |
|----------------------------|--------------------------------------------|----------------------------------|------------|
| `SimuladoExamPage`         | Nenhuma lib de chart/pdf (lógica + timer)  | Média (componente grande)        | ALTA       |
| `DesempenhoPage`           | recharts                                   | Alta                             | ALTA       |
| `RankingPage`              | recharts                                   | Alta                             | ALTA       |
| `ComparativoPage`          | recharts                                   | Alta                             | ALTA       |
| `CadernoErrosPage`         | react-markdown                             | Média                            | MEDIA      |
| Componentes de exportação  | exceljs, jspdf, jszip                      | Alta (se importados em rotas principais) | ALTA |

### 3.3 Dynamic import de libs de chart/pdf

Se um componente de chart estiver em várias páginas, prefira encapsulá-lo e usar dynamic import no nível do componente:

```tsx
// components/charts/PerformanceChart.tsx
import { lazy } from "react";
const Recharts = lazy(() => import("recharts").then(m => ({ default: m.BarChart })));
```

Para exportação de planilha/PDF, o padrão mais simples é dynamic import no handler do botão:

```tsx
async function handleExportExcel() {
  const { utils, writeFile } = await import("exceljs");
  // ... usa a lib somente quando o usuário clicar
}
```

Isso evita que `vendor-pdf-xlsx` (~350 KB) seja carregado em toda visita.

---

## 4. Análise do critical path

Com base na configuração atual, o carregamento inicial baixa:

1. `vendor-react` (~45 KB) — essencial, ok
2. `vendor-radix` (~100 KB) — necessário para qualquer UI
3. `vendor-router` (~25 KB) — necessário para navegação
4. `vendor-supabase` (~60 KB) — necessário para auth/dados
5. Chunk de rota ativa — varia

**Se `React.lazy` for aplicado nas 5 rotas pesadas acima**, o JS inicial (rotas não visitadas) cai estimados 40-60% em transferência. O chunk `vendor-pdf-xlsx` (~350 KB) passaria a ser baixado somente na primeira vez que o usuário abre a rota de geração de PDF/exportação ou clica em exportar.

---

## 5. Próximos passos recomendados

1. Rodar `npx vite-bundle-visualizer` após build para confirmar os tamanhos reais.
2. Aplicar `React.lazy` nas páginas `DesempenhoPage`, `RankingPage`, `ComparativoPage` — maior ganho imediato (recharts).
3. Mover imports de `exceljs`/`jspdf` para dynamic imports dentro dos handlers de exportação.
4. Avaliar se `framer-motion` pode ser substituído por CSS transitions nas animações mais simples (menor ganho, mais trabalho).
5. Adicionar ao CI um step `npm run build && node scripts/check-bundle-size.mjs` com threshold em KB para evitar regressões.
