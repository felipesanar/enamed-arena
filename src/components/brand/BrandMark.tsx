import type { ImgHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const BRAND_LOGO_SRC = "/logo.svg";
export const BRAND_ICON_SRC = "/icone.svg";
/** Marca SanarFlix (app), distinta do ícone da plataforma ENAMED (`BRAND_ICON_SRC`). */
export const SANARFLIX_MARK_SRC = "/sanarflix-icon.png";

export const BRAND_DEFAULT_ALT = "SanarFlix Simulados";

const logoHeightClass = {
  sm: "h-7 max-h-7",
  md: "h-9 max-h-9",
  lg: "h-10 max-h-10",
  xl: "h-11 max-h-11",
} as const;

const iconSizeClass = {
  xs: "h-4 w-4 max-h-4 max-w-4",
  sm: "h-5 w-5 max-h-5 max-w-5",
  md: "h-7 w-7 max-h-7 max-w-7",
  lg: "h-8 w-8 max-h-8 max-w-8",
  xl: "h-9 w-9 max-h-9 max-w-9",
} as const;

export type BrandLogoVariant = keyof typeof logoHeightClass;
export type BrandIconSize = keyof typeof iconSizeClass;

/** `onDark`: logo monocromática vira branca via filtro (útil em headers/footers escuros com `<img src=…>`). */
export type BrandLogoTone = "default" | "onDark";

const logoToneClass: Record<BrandLogoTone, string> = {
  default: "",
  onDark: "brightness-0 invert",
};

interface BrandLogoProps extends ImgHTMLAttributes<HTMLImageElement> {
  variant?: BrandLogoVariant;
  tone?: BrandLogoTone;
}

export function BrandLogo({
  variant = "md",
  tone = "default",
  className,
  alt = BRAND_DEFAULT_ALT,
  ...rest
}: BrandLogoProps) {
  return (
    <img
      src={BRAND_LOGO_SRC}
      alt={alt}
      draggable={false}
      decoding="async"
      className={cn(
        "w-auto object-contain object-left",
        logoHeightClass[variant],
        logoToneClass[tone],
        className,
      )}
      {...rest}
    />
  );
}

interface BrandIconProps extends ImgHTMLAttributes<HTMLImageElement> {
  size?: BrandIconSize;
}

/** Ícone de app / marca compacta (`/icone.svg`). Use `alt=""` quando decorativo ao lado de texto visível. */
export function BrandIcon({
  size = "md",
  className,
  alt = "",
  ...rest
}: BrandIconProps) {
  return (
    <img
      src={BRAND_ICON_SRC}
      alt={alt}
      draggable={false}
      decoding="async"
      className={cn("object-contain", iconSizeClass[size], className)}
      {...rest}
    />
  );
}
