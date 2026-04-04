# Correções do PDF: Logo, Acentuação e Capa Redesenhada

## Problemas Identificados

1. **Header usa texto "SanarFlix PRO" ao invés da logo** — a logo completa do Sanarflix Pro simulados (a mesma que está no header da landing) deve ser embarcada
2. **Acentuação ausente em todo o PDF** — todas as strings foram escritas sem acentos (ex: "questoes" ao invés de "questões"). Os acentos portugueses são suportados pelo encoding WinAnsi (todos estão no range 0x00-0xFF), então o problema é apenas no código fonte
3. **Capa com instruções muito simples** — layout básico de bullet points sem design, precisa de uma página de capa profissional e visualmente impactante

## Plano de Implementação

### Etapa 1 — Embarcar logo no PDF

- Criar PNG branco da logo (100x100px, ~313 bytes) e encodar em base64
- Embarcar a constante base64 diretamente no código da Edge Function (420 chars, negligível)
- No `drawHeader`, usar `pdfDoc.embedPng(iconBytes)` + `page.drawImage()` para renderizar o ícone à esquerda do texto

### Etapa 2 — Corrigir toda a acentuação

Substituições no arquivo `supabase/functions/generate-exam-pdf/index.ts` (ambas as funções `generatePdf` e `generatePdfWithDoc`):


| De            | Para          |
| ------------- | ------------- |
| `questoes`    | `questões`    |
| `questao`     | `questão`     |
| `Questao`     | `Questão`     |
| `Pagina`      | `Página`      |
| `contem`      | `contém`      |
| `multipla`    | `múltipla`    |
| `disponivel`  | `disponível`  |
| `atencao`     | `atenção`     |
| `conferencia` | `conferência` |


### Etapa 3 — Redesenhar a capa (página de instruções)

Substituir o layout atual de bullets simples por uma capa profissional com:

- **Bloco de título** — grande, com fundo wine e texto branco: "PROVA OFFLINE" + nome do simulado
- **Seção "Informações da Prova"** — card com borda, ícones simulados com tipografia: número de questões, duração, tipo (múltipla escolha A-D)
- **Seção "Como funciona"** — passos numerados com design visual:
  1. "Imprima esta prova e resolva no papel"
  2. "Volte à plataforma SanarFlix PRO"
  3. "Preencha o gabarito digital"
  4. "Envie dentro do tempo para entrar no ranking"
- **Seção "Regras importantes"** — box com destaque visual:
  - "O tempo de prova começa no momento do download"
  - "Envie o gabarito dentro do prazo para participar do ranking"
  - "Questões não respondidas serão registradas como em branco"
- Todos os textos com acentuação correta
- Uso de retângulos coloridos, linhas separadoras e tipografia variada para criar hierarquia visual

### Etapa 4 — Invalidar cache

- Executar migration SQL `UPDATE simulados SET updated_at = now()` para forçar regeneração dos PDFs

## Arquivo Modificado


| Arquivo                                         | Alteração                                            |
| ----------------------------------------------- | ---------------------------------------------------- |
| `supabase/functions/generate-exam-pdf/index.ts` | Logo embarcada, acentos corrigidos, capa redesenhada |
| `supabase/migrations/...`                       | Invalidação de cache                                 |


## Detalhes Técnicos

- O ícone branco PNG (100x100, RGBA com pixels brancos sobre transparente) pesa apenas 313 bytes — ideal para embed base64
- `pdf-lib` embarca PNG via `pdfDoc.embedPng(Uint8Array)` — já usado para imagens de questões
- Helvetica (StandardFont do pdf-lib) suporta WinAnsi, que inclui todos os caracteres acentuados do português (ã=0xE3, é=0xE9, ç=0xE7, etc.)
- A capa será desenhada com primitivas do pdf-lib: `drawRectangle`, `drawText`, `drawLine`, `drawCircle`
- O `drawHeader` embarcará o ícone uma vez via `pdfDoc.embedPng()` e reutilizará a referência em todas as páginas