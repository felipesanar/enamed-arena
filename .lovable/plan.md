

# PDF Premium: Prova Revisada via `@react-pdf/renderer`

## Contexto

O PDF atual usa **jsPDF** no client-side — fonte Helvetica sem kerning, sem fontes customizadas, sem gradientes, tipografia mecânica. Puppeteer não roda em Edge Functions do Supabase e exigiria infraestrutura externa (Railway/Fly.io), o que adiciona complexidade desnecessária.

A melhor solução **dentro da arquitetura atual** (client-side, sem microserviço extra) é **`@react-pdf/renderer`**: biblioteca React que gera PDFs com fontes customizadas (Inter/Plus Jakarta Sans), flexbox layout, gradientes via SVG, e tipografia real. Roda 100% no browser.

## Resultado esperado

- Fontes Inter (body) e Plus Jakarta Sans (headings) com kerning nativo
- Capa full-bleed bordô com gradiente (SVG)
- Cards de questão com bordas arredondadas, alternativas coloridas (verde/vermelho)
- Comentário do professor com estilo distinto
- Barras de desempenho por especialidade
- Imagens do enunciado incorporadas
- Quebra de página inteligente (`break-inside: avoid`)
- Progress tracking mantido (etapas: preparando, carregando imagens, gerando, completo)

## Plano

### 1. Instalar `@react-pdf/renderer`
- `npm install @react-pdf/renderer`
- Registrar fontes Inter e Plus Jakarta Sans via `Font.register()` usando Google Fonts CDN

### 2. Criar template React do PDF
- **Arquivo:** `src/lib/pdf/ProvaRevisadaDocument.tsx`
- Componente `<Document>` com páginas:
  - **Capa**: fundo bordô escuro (#421424), título do simulado, nome do aluno, score em destaque, stats (acertos/erros/branco), barras de desempenho por especialidade
  - **Questões** (1 por página ou com smart break): número + área/tema, badge ACERTOU/ERROU/EM BRANCO, enunciado com tipografia 10pt, imagem (se houver), alternativas com fundo colorido (verde = correta, vermelho = errou, branco = outras), círculo com letra A-D
  - **Comentário do professor**: caixa com fundo lilás claro, borda, título "Comentário do Professor"
  - **Página de análise**: stats gerais, barras horizontais por especialidade
  - **Footer**: "ENAMED Arena — data" + "Página X de Y"

### 3. Reescrever `provaRevisadaPdf.ts`
- **Arquivo:** `src/lib/pdf/provaRevisadaPdf.ts`
- Substituir toda a geração jsPDF por:
  1. Carregar imagens como base64 (reutilizar `loadImageAsBase64` com retry)
  2. Renderizar `<ProvaRevisadaDocument>` via `pdf().toBlob()`
  3. Manter a interface `ProvaRevisadaInput` e `ProgressCallback` iguais
- O hook `usePdfDownload` e os botões **não precisam de mudança** — a API permanece idêntica

### 4. Remover dependências antigas (se não usadas em outro lugar)
- `gabaritoPdf.ts` e `pdfHelpers.ts` — verificar se ainda são usados; se não, remover
- `jspdf` — remover do `package.json` se não usado em nenhum outro arquivo

### 5. CSS/Estilo no template
- Cores: `#421424` (wineDark), `#7a1a32` (wine), `#ffcbd8` (wineLight)
- Alternativa correta: `#F0FDF4` bg, `#22C55E` borda
- Alternativa errada: `#FFF1F2` bg, `#F43F5E` borda
- Explicação: `#F5F0F8` bg, `#C8B4DC` borda
- `page-break-inside: avoid` em blocos de questão
- Tipografia: Inter 400/500/600/700, Plus Jakarta Sans para headings

### Restrições técnicas
- `@react-pdf/renderer` não suporta gradientes CSS — usar `<Svg>` + `<Defs>` + `<LinearGradient>` para o fundo da capa
- Imagens precisam ser base64 data URIs (já é o caso atual)
- Fontes são carregadas via HTTP na primeira geração (cache automático depois)

### Arquivos afetados

| Arquivo | Ação |
|---------|------|
| `package.json` | Instalar `@react-pdf/renderer` |
| `src/lib/pdf/ProvaRevisadaDocument.tsx` | **Novo** — template React do PDF |
| `src/lib/pdf/provaRevisadaPdf.ts` | Reescrever — usar react-pdf em vez de jsPDF |
| `src/lib/pdf/pdfHelpers.ts` | Verificar se ainda usado, possivelmente remover |
| `src/lib/pdf/gabaritoPdf.ts` | Verificar se ainda usado, possivelmente remover |

