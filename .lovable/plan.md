

# Download de Gabarito e Prova Revisada (PDF)

## Contexto

O projeto atualmente **nao tem nenhuma biblioteca de PDF** instalada nem qualquer gerador de gabarito. Preciso criar do zero: instalar `jspdf`, criar os utilitarios de geracao, e integrar os botoes nas paginas de Resultado e Desempenho.

## Arquivos

| Arquivo | Mudanca |
|---------|---------|
| `package.json` | Instalar `jspdf` |
| `src/lib/pdf/gabaritoPdf.ts` | Novo — gera PDF de gabarito resumido (tabela de respostas, score por area) |
| `src/lib/pdf/provaRevisadaPdf.ts` | Novo — gera PDF da prova revisada (enunciados, alternativas coloridas, explicacoes, imagens) |
| `src/lib/pdf/pdfHelpers.ts` | Novo — helpers compartilhados (header premium com gradiente wine, footer paginado, cores, formatacao) |
| `src/pages/ResultadoPage.tsx` | Adicionar botao "Baixar Gabarito" no CTA footer, ao lado do link de correcao |
| `src/components/desempenho/DesempenhoSimuladoPanel.tsx` | Adicionar botoes "Gabarito PDF" e "Prova Revisada PDF" no HeroSection |
| `src/pages/CorrecaoPage.tsx` | Adicionar botao "Baixar Prova Revisada" no header/sticky bar |

## Plano

### 1. Instalar jsPDF
- `npm install jspdf`

### 2. Criar helpers compartilhados (`src/lib/pdf/pdfHelpers.ts`)
- Funcao `drawPremiumHeader(doc, title, subtitle)` — gradiente wine, nome do simulado, badge ENAMED 2026
- Funcao `addFooterToAllPages(doc)` — rodape com data de geracao + paginacao "Pagina X de Y"
- Funcao `drawIdentificationCard(doc, name, stats)` — card do aluno com resumo
- Constantes de cores (wine, green, red, muted) e tipografia (Plus Jakarta Sans fallback para Helvetica)

### 3. Criar Gabarito PDF (`src/lib/pdf/gabaritoPdf.ts`)
- Input: `{ simuladoTitle, studentName, questions, questionResults, breakdown }`
- Output: Blob do PDF
- Conteudo:
  - Header premium
  - Card de identificacao (nome, acertos/total, %)
  - Tabela: N | Resposta | Gabarito | Status (check/X) | Tema
  - Resumo por especialidade (barras coloridas)
  - Footer paginado
- 2-5 paginas, leve, sem imagens

### 4. Criar Prova Revisada PDF (`src/lib/pdf/provaRevisadaPdf.ts`)
- Input: `{ simuladoTitle, studentName, questions, questionResults, breakdown, onProgress }`
- Output: Blob do PDF
- Conteudo:
  - Capa com logo, resumo executivo, grafico por area
  - Loop por questao: enunciado, imagem (se houver, via fetch + base64), alternativas com marcacao visual (verde=correta, vermelho=errada do aluno), badge ACERTOU/ERROU/EM BRANCO, comentario do professor
  - Pagina final de analise estatistica
  - Footer paginado
- Callback `onProgress(stage, current, total)` para UI
- Carregamento de imagens em batches de 5

### 5. Integrar na ResultadoPage
- Botao "Baixar Gabarito" no footer, abaixo do CTA de correcao
- Icone Download, estilo sutil (ghost/outline) para nao competir com o CTA principal
- So aparece se `attemptFinished === true`

### 6. Integrar no DesempenhoSimuladoPanel (HeroSection)
- Dois botoes pequenos no hero: "Gabarito" e "Prova Revisada" com icones Download
- Estilo: pills translucidas (como os seletores de simulado), branco sobre fundo escuro
- Dialog de progresso para Prova Revisada (etapas: preparando, carregando imagens, gerando, completo)

### 7. Integrar na CorrecaoPage
- Botao "Baixar PDF" no header sticky
- Gera Prova Revisada com progress toast

### Restricoes
- PDFs so aparecem para quem tem tentativa finalizada (submitted/expired)
- Nao precisa de gate PRO — disponivel para todos os segmentos que conseguem ver resultados
- Analytics: `trackEvent('pdf_downloaded', { type, simulado_id })`

