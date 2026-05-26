/**
 * Paleta e configuração de gráficos — identidade PRO: ENAMED (Fase A).
 * Uso em Recharts: cores, tipografia e tooltip alinhados ao design system.
 * Ref: docs/DIRECAO_UI_CARDS.md
 */

/** Core semantic colors used across all charts */
export const CHART_COLORS_BASE = {
  primary: "hsl(345, 65%, 30%)",
  success: "hsl(152, 60%, 36%)",
  destructive: "hsl(0, 72%, 51%)",
  muted: "hsl(220, 10%, 46%)",
  warning: "hsl(38, 92%, 50%)",
  info: "hsl(210, 80%, 52%)",
} as const;

/** Get theme-aware grid and tooltip colors */
function getThemeAwareColors() {
  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

  return {
    grid: isDark ? "hsl(220, 15%, 16%)" : "hsl(220, 12%, 90%)",
    tooltipBg: isDark ? "hsl(220, 18%, 10%)" : "hsl(0, 0%, 100%)",
    tooltipBorder: isDark ? "hsl(220, 15%, 16%)" : "hsl(220, 12%, 90%)",
  };
}

export const CHART_COLORS = {
  ...CHART_COLORS_BASE,
  ...getThemeAwareColors(),
} as const;

/** Corpo de texto em eixos e labels */
export const CHART_FONT_SIZE_AXIS = 12;
export const CHART_FONT_SIZE_TOOLTIP = 13;

/** Get dynamic chart tick style based on current theme */
export function getChartTickStyle() {
  return {
    fontSize: CHART_FONT_SIZE_AXIS,
    fill: CHART_COLORS_BASE.muted,
  };
}

/** Get dynamic CartesianGrid props based on current theme */
export function getChartGridProps() {
  const { grid } = getThemeAwareColors();
  return {
    strokeDasharray: "3 3",
    stroke: grid,
  };
}

/** Get dynamic tooltip content style based on current theme */
export function getChartTooltipContentStyle() {
  const { tooltipBg, tooltipBorder } = getThemeAwareColors();
  return {
    backgroundColor: tooltipBg,
    border: `1px solid ${tooltipBorder}`,
    borderRadius: "12px",
    fontSize: CHART_FONT_SIZE_TOOLTIP,
    padding: "10px 14px",
  };
}

/** NOTE: Use the function versions (getChartTickStyle, getChartGridProps, getChartTooltipContentStyle)
 * to get theme-aware values. The static exports below are for backwards compatibility only.
 * Components using charts should call the functions in their render methods to get fresh values.
 */
export const chartTickStyle = getChartTickStyle();
export const chartGridProps = getChartGridProps();
export const chartTooltipContentStyle = getChartTooltipContentStyle();

/** Cores para séries múltiplas (ordem: primary, success, destructive, muted, warning, info) */
export const CHART_SERIES_COLORS = [
  CHART_COLORS_BASE.primary,
  CHART_COLORS_BASE.success,
  CHART_COLORS_BASE.destructive,
  CHART_COLORS_BASE.muted,
  CHART_COLORS_BASE.warning,
  CHART_COLORS_BASE.info,
] as const;
