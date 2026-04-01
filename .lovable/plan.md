

## Plan: "Adicionar ao Google Agenda" para simulados futuros

### Abordagem

Usar a URL pública do Google Calendar para criar eventos — **não requer OAuth, API key, nem backend**. É um link que abre o Google Calendar com os dados pré-preenchidos.

Formato: `https://calendar.google.com/calendar/event?action=TEMPLATE&text=...&dates=START/END&details=...`

### Alterações

#### 1. Criar helper `buildGoogleCalendarUrl` em `src/lib/simulado-helpers.ts`

- Recebe um `SimuladoWithStatus`
- Gera URL com título, janela de execução (start/end em formato `YYYYMMDDTHHmmssZ`), e descrição com link para a plataforma

#### 2. Adicionar botão "Adicionar ao Google Agenda" no `SimuladoDetailPage.tsx`

- Visível apenas quando `status === 'upcoming'`
- Ícone de calendário + texto
- Abre a URL em nova aba (`window.open`)
- Posicionado na seção de informações do simulado, abaixo das datas

#### 3. (Opcional) Adicionar ícone no `SimuladoCard.tsx`

- Pequeno ícone de calendário ao lado da data para simulados `upcoming`
- Ao clicar, abre o Google Calendar link (com `e.preventDefault()` para não navegar ao card)

### Detalhes técnicos

- Zero dependências externas
- Nenhuma alteração no banco de dados
- A URL do Google Calendar é pública e funciona sem autenticação da API
- O evento será adicionado à conta Google do usuário logado no navegador

### Arquivos editados

- `src/lib/simulado-helpers.ts` — novo helper
- `src/pages/SimuladoDetailPage.tsx` — botão CTA
- `src/components/SimuladoCard.tsx` — ícone opcional

