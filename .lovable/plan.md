

# Corrigir imagens ausentes no PDF offline

## Causa raiz

Analisei a Edge Function `generate-exam-pdf/index.ts` e identifiquei **3 problemas** que causam perda silenciosa de imagens:

1. **Limite de tamanho muito baixo**: `MAX_IMAGE_BYTES = 800_000` (800KB). A imagem da questao 70, por exemplo, tem **2.09MB** -- e eliminada silenciosamente pelo `fetchImageWithTimeout` sem qualquer log.

2. **Limite de 30 imagens**: `MAX_IMAGES = 30` -- se houver mais de 30 questoes com imagem, as excedentes sao descartadas via `.slice(0, MAX_IMAGES)`.

3. **Falhas completamente silenciosas**: quando uma imagem e rejeitada por tamanho, timeout ou erro de embed, nada e logado. Impossivel diagnosticar qual imagem faltou.

## Plano

### Passo 1 -- Aumentar limites e remover cap artificial

- `MAX_IMAGE_BYTES`: de 800KB para **5MB** (imagens medicas podem ser grandes)
- `MAX_IMAGES`: de 30 para **150** (cobrir simulados com 100 questoes, todas com imagem)
- `IMAGE_FETCH_TIMEOUT`: de 8s para **15s** (imagens grandes em conexoes lentas)

### Passo 2 -- Adicionar logging detalhado em cada ponto de falha

Em `fetchImageWithTimeout`:
- Logar quando imagem excede o limite de bytes: `"[generate-exam-pdf] Image for Q${num} skipped: ${bytes}B exceeds limit"`
- Logar quando fetch falha ou da timeout: `"[generate-exam-pdf] Image for Q${num} fetch failed: ${reason}"`

Em `embedImage`:
- Logar quando embed falha: `"[generate-exam-pdf] Image for Q${num} embed failed"`

No loop principal (linhas 643-659):
- Logar cada imagem processada com sucesso e cada falha

### Passo 3 -- Comprimir imagens grandes com pdf-lib scale-down

Para imagens que excedem um threshold (ex: 1500px de largura ou altura), redimensionar proporcionalmente no momento do embed. Isso reduz o tamanho do PDF sem perder qualidade visual no A4.

- Usar `PDFImage.scale()` para calcular dimensoes proporcionais
- Limitar a imagem renderizada a no maximo `maxImgW` pixels de largura (ja feito no render, mas o embed carrega a imagem original inteira)

### Passo 4 -- Adicionar resumo final de imagens

Apos processar todas as imagens, logar um resumo:
```
[generate-exam-pdf] Image summary: 15 found, 14 embedded, 1 failed (Q70: size exceeded)
```

Isso permite diagnosticar rapidamente qualquer problema futuro.

### Passo 5 -- Remover funcao `generatePdf` morta

A funcao `generatePdf` (linhas 182-281) e codigo morto -- o handler real usa `generatePdfWithDoc`. Remover para evitar confusao.

### Passo 6 -- Forcar regeneracao do PDF em cache

Apos o deploy, chamar a Edge Function com `force: true` para regenerar o PDF do simulado atual, garantindo que as imagens das questoes 9 e 70 sejam incluidas.

## Arquivos alterados

| Arquivo | Mudanca |
|---------|---------|
| `supabase/functions/generate-exam-pdf/index.ts` | Aumentar limites, logging, remover dead code |

## Riscos

- **CPU Time limit**: aumentar limites pode estourar o tempo de CPU da Edge Function com muitas imagens grandes. Mitigacao: manter timeout por imagem e processar sequencialmente em vez de `Promise.allSettled` para controlar uso de memoria.
- **Tamanho do PDF**: com mais imagens, o PDF pode ficar grande (>20MB). Aceitavel para download offline.

