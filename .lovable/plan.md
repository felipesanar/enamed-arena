

# Redesign completo dos emails HTML

## Contexto

Os emails atuais (welcome, recovery, magic_link) existem em **dois arquivos** com templates duplicados:
- `supabase/functions/novu-email/index.ts` (3 templates)
- `supabase/functions/auth-email-hook/index.ts` (4 templates incluindo fallback)

Ambos usam a mesma estrutura CSS inline com visual genérico: header com gradiente wine, emojis (🎉, ⏱, 🔒), border-radius arredondado demais, tom infantil na comunicação.

## Problemas identificados

1. **Emojis no corpo** — parecem informais demais para uma plataforma médica
2. **Header só com texto** — sem logo, sem identidade visual forte
3. **Comunicação genérica** — tom jovial demais, pouco profissional
4. **Design flat** — sem hierarquia visual sofisticada, sem separação clara
5. **Footer fraco** — sem informações institucionais
6. **Logo ausente** — o SVG `/logo.svg` existe mas não é usado nos emails

## Plano

### 1. Hospedar logo para emails

O logo SVG local não funciona em emails (clientes de email bloqueiam SVG). Vou converter o logo para uma versão PNG branca hospedada publicamente via URL do app publicado (`https://enamed-arena.lovable.app/logo.svg`). Como alternativa mais segura, usarei SVG inline codificado em base64 data URI no header do email, ou referenciarei a URL pública diretamente (muitos clientes suportam SVG via `<img>`).

A abordagem mais confiável: usar a URL pública do app para o logo (`https://enamed-arena.lovable.app/logo.svg`) com filtro CSS `filter: brightness(0) invert(1)` para torná-lo branco no header escuro.

### 2. Redesign do `baseLayout` (ambos arquivos)

Novo design premium com identidade médica-acadêmica:
- **Background**: `#f7f5f3` (warm off-white) em vez de `#f5f5f5`
- **Container**: sombra mais sutil, border-radius `12px` (menos bolha)
- **Header**: gradiente mais profundo (`#3D0F1E` → `#6B1730`), logo SVG via URL pública, subtítulo "PRO: ENAMED" com tipografia refinada
- **Tipografia**: hierarquia mais clara, font-size do body `16px`, line-height `1.7`
- **CTA**: botão com `border-radius: 8px` (menos arredondado), padding mais generoso, letter-spacing
- **Note boxes**: sem borda, background mais sutil, ícone textual em vez de emoji
- **Footer**: mais informações, links de suporte, tom institucional
- **Dividers**: mais espaçamento, cor mais suave

### 3. Reescrever copy de cada template

**Welcome (signup):**
- Remover emoji 🎉
- Tom: "Sua conta foi criada. Confirme seu endereço de email para começar a usar a plataforma."
- CTA: "Confirmar email"
- Nota: "Este link expira em 1 hora. Após esse prazo, solicite um novo na página de login."

**Recovery:**
- Remover emoji 🔒
- Tom direto e seguro: "Recebemos uma solicitação de redefinição de senha para sua conta."
- CTA: "Redefinir senha"
- Nota: "Este link expira em 1 hora. Se você não fez essa solicitação, nenhuma ação é necessária."

**Magic Link:**
- Remover emoji ⏱
- Tom: "Use o link abaixo para acessar sua conta de forma segura."
- CTA: "Acessar plataforma"
- Nota: "Link de uso único, válido por 1 hora."

### 4. Atualizar ambos os arquivos

Ambos `novu-email/index.ts` e `auth-email-hook/index.ts` serão atualizados com:
- Novo `baseLayout` compartilhando o mesmo design
- Novos templates com copy profissional
- Logo no header via URL pública

### 5. Deploy das edge functions

Deploy de ambas as functions atualizadas:
- `novu-email`
- `auth-email-hook`

## Detalhes Técnicos

- Logo no email via `<img src="https://enamed-arena.lovable.app/logo.svg" style="filter:brightness(0) invert(1);height:32px">` — funciona na maioria dos clientes; fallback para texto "SanarFlix PRO: ENAMED"
- CSS custom properties (`--wine`, `--primary`) convertidas para valores HEX inline nos emails
- Cores: header `#3D0F1E`→`#5A1A2E`, CTA `#6B1730`, texto `#1a1a2e`, muted `#6b7280`
- Sem emojis em nenhum template
- Dois arquivos editados, mesma identidade visual

