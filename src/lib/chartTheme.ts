/**
 * Paleta e configuração de gráficos — identidade PRO: ENAMED (Fase A).
 * Uso em Recharts: cores, tipografia e tooltip alinhados ao design system.
 * Ref: docs/DIRECAO_UI_CARDS.md
 */

export const CHART_COLORS = {
  primary: "hsl(345, 65%, 30%)",
  success: "hsl(152, 60%, 36%)",
  destructive: "hsl(0, 72%, 51%)",
  muted: "hsl(220, 10%, 46%)",
  warning: "hsl(38, 92%, 50%)",
  info: "hsl(210, 80%, 52%)",
  grid: "hsl(220, 12%, 90%)",
  tooltipBg: "hsl(0, 0%, 100%)",
  tooltipBorder: "hsl(220, 12%, 90%)",
} as const;

/** Corpo de texto em eixos e labels */
export const CHART_FONT_SIZE_AXIS = 12;
export const CHART_FONT_SIZE_TOOLTIP = 13;

/** Estilo de tick para XAxis/YAxis (fill = muted) */
export const chartTickStyle = {
  fontSize: CHART_FONT_SIZE_AXIS,
  fill: CHART_COLORS.muted,
};

/** CartesianGrid com traço do design system */
export const chartGridProps = {
  strokeDasharray: "3 3",
  stroke: CHART_COLORS.grid,
};

/** Tooltip content style para Recharts */
export const chartTooltipContentStyle = {
  backgroundColor: CHART_COLORS.tooltipBg,
  border: `1px solid ${CHART_COLORS.tooltipBorder}`,
  borderRadius: "12px",
  fontSize: CHART_FONT_SIZE_TOOLTIP,
  padding: "10px 14px",
};

/** Cores para séries múltiplas (ordem: primary, success, destructive, muted, warning, info) */
export const CHART_SERIES_COLORS = [
  CHART_COLORS.primary,
  CHART_COLORS.success,
  CHART_COLORS.destructive,
  CHART_COLORS.muted,
  CHART_COLORS.warning,
  CHART_COLORS.info,
] as const;
