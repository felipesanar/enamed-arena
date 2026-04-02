

# Redesign da sidebar colapsada — ícones maiores e mais visíveis

## Problema

Os ícones de navegação na sidebar colapsada estão com 18px, opacidade baixa (`white/60`, `opacity-85`), e os botões de 44px (`h-11 w-11`) ficam escuros demais no fundo wine. Resultado: quase invisíveis, ilegíveis.

## Referência

A sidebar colapsada do Academy usa ícones maiores (~20-22px), com fundo hover mais visível, e os ícones em repouso têm contraste alto (branco ~70-80% de opacidade). Os botões têm mais padding e o espaçamento entre itens é generoso.

## Alterações

### 1. `NavItem.tsx` — ícones collapsed maiores e mais brilhantes

- Aumentar `barCollapsed` de `h-11 w-11` para `h-12 w-12`
- Ícones collapsed de `h-[18px] w-[18px]` para `h-5 w-5` (20px)
- Texto base de `text-white/60` para `text-white/70`
- Hover de `hover:bg-white/[0.06]` para `hover:bg-white/[0.08]`
- Ícone `opacity-85` para `opacity-100` quando collapsed
- Active state: manter o brilho atual mas com mais contraste

### 2. `SidebarProSection.tsx` — mesma correção para o item PRO collapsed

- Mesmas dimensões: `h-12 w-12`, ícone `h-5 w-5`
- Remover `opacity-85` do ícone collapsed

### 3. `SidebarFooterAccount.tsx` — botões do footer collapsed maiores

- `railIconBtn`: de `h-10 w-10` para `h-12 w-12`, rounded de `rounded-xl` para `rounded-xl`
- Ícones de `h-[18px] w-[18px]` para `h-5 w-5`
- Opacidade de `text-white/45` para `text-white/65`
- Avatar container de `h-10 w-10` para `h-11 w-11`

### 4. `PremiumSidebar.tsx` — mais espaço no rail collapsed

- Padding collapsed de `px-2 py-4` para `px-2.5 py-5`
- Gap entre itens de `gap-1` para `gap-1.5`

### 5. `SidebarNavSection.tsx` — espaçamento collapsed

- De `space-y-1` (collapsed) para `space-y-1.5`

Nenhum arquivo novo. Apenas ajustes de tamanho, opacidade e espaçamento nos 5 arquivos existentes.

