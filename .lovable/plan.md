

# Fix: Force all collapsed sidebar icons to be white

## Problem
The collapsed sidebar icons appear dark/burgundy instead of white. Despite `text-white/70` on the parent NavLink, the icons are not inheriting the white color properly — likely due to Lucide icons' `currentColor` not picking up the Tailwind text color in this context.

## Fix
Add explicit `text-white` class directly on every `<Icon>` element in the collapsed state across three files:

1. **`src/components/premium/NavItem.tsx`** (line 39) — add `text-white` to the collapsed icon className
2. **`src/components/premium/sidebar/SidebarProSection.tsx`** (line 30) — add `text-white` to the BookOpen icon
3. **`src/components/premium/sidebar/SidebarFooterAccount.tsx`** (lines 70, 86) — change `text-white/70` to `text-white` on Settings and LogOut icons

This ensures icons are always rendered white regardless of CSS inheritance.

