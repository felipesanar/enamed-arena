import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        wine: {
          DEFAULT: "hsl(var(--wine))",
          light: "hsl(var(--wine-light))",
          hover: "hsl(var(--wine-hover))",
          glow: "hsl(var(--wine-glow))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        info: {
          DEFAULT: "hsl(var(--info))",
          foreground: "hsl(var(--info-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
          muted: "hsl(var(--sidebar-muted))",
        },
        landing: {
          bg: "hsl(var(--landing-bg))",
          "bg-soft": "hsl(var(--landing-bg-soft))",
          surface: "hsl(var(--landing-surface))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xl: "calc(var(--radius) + 4px)",
        "2xl": "calc(var(--radius) + 8px)",
      },
      fontSize: {
        "display": ["2.5rem", { lineHeight: "1.1", letterSpacing: "-0.025em", fontWeight: "700" }],
        "heading-1": ["1.875rem", { lineHeight: "1.2", letterSpacing: "-0.02em", fontWeight: "700" }],
        "heading-2": ["1.5rem", { lineHeight: "1.25", letterSpacing: "-0.015em", fontWeight: "600" }],
        "heading-3": ["1.25rem", { lineHeight: "1.3", letterSpacing: "-0.01em", fontWeight: "600" }],
        "body-lg": ["1.0625rem", { lineHeight: "1.6", fontWeight: "400" }],
        "body": ["0.9375rem", { lineHeight: "1.6", fontWeight: "400" }],
        "body-sm": ["0.8125rem", { lineHeight: "1.5", fontWeight: "400" }],
        "caption": ["0.75rem", { lineHeight: "1.4", fontWeight: "500" }],
        "overline": ["0.6875rem", { lineHeight: "1.3", letterSpacing: "0.08em", fontWeight: "600" }],
        "kpi": ["2.5rem", { lineHeight: "1", letterSpacing: "-0.03em", fontWeight: "800" }],
        "kpi-sm": ["1.75rem", { lineHeight: "1", letterSpacing: "-0.02em", fontWeight: "700" }],
        "hero-headline": ["2.75rem", { lineHeight: "1.06", letterSpacing: "-0.04em", fontWeight: "700" }],
        "micro-label": ["0.5625rem", { lineHeight: "1.2", letterSpacing: "0.14em", fontWeight: "600" }],
      },
      boxShadow: {
        "glow-wine": "0 0 24px -4px hsl(345 65% 42% / 0.18)",
        "glow-wine-lg": "0 0 40px -6px hsl(345 65% 42% / 0.24)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "glow-pulse": {
          "0%, 100%": { opacity: "0.12" },
          "50%": { opacity: "0.18" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "glow-pulse": "glow-pulse 6s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
