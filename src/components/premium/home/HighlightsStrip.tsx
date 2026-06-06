import {
  BarChart3,
  Trophy,
  CalendarDays,
  BookOpen,
  TrendingUp,
  TrendingDown,
  type LucideIcon,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useCadernoRoutes } from "@/hooks/useCadernoRoutes";

interface HighlightItem {
  label: string;
  value: string;
  subtext: string;
  icon: LucideIcon;
  href: string;
  trend?: "up" | "down" | null;
  accent?: boolean;
}

interface HighlightsStripProps {
  lastScore: number | null;
  scoreDelta: number | null;
  rankPosition: number | null;
  rankTotal: number | null;
  nextWindowDate: string | null;
  pendingErrors: number | null;
}

export function HighlightsStrip({
  lastScore,
  scoreDelta,
  rankPosition,
  rankTotal,
  nextWindowDate,
  pendingErrors,
}: HighlightsStripProps) {
  const caderno = useCadernoRoutes();
  const items: HighlightItem[] = [
    {
      label: "Último simulado",
      value: lastScore !== null ? `${lastScore}%` : "—",
      subtext:
        scoreDelta !== null
          ? `${scoreDelta >= 0 ? "+" : ""}${scoreDelta} pts`
          : "Sem comparativo",
      icon: BarChart3,
      href: "/desempenho",
      trend:
        scoreDelta !== null
          ? scoreDelta > 0
            ? "up"
            : scoreDelta < 0
            ? "down"
            : null
          : null,
    },
    {
      label: "Ranking",
      value:
        rankPosition !== null ? `#${rankPosition}` : "—",
      subtext:
        rankTotal !== null
          ? `de ${rankTotal} candidatos`
          : "Complete um simulado",
      icon: Trophy,
      href: "/ranking",
      accent: rankPosition !== null && rankPosition <= 10,
    },
    {
      label: "Próxima janela",
      value: nextWindowDate ?? "—",
      subtext: nextWindowDate ? "Janela de execução" : "Sem janela próxima",
      icon: CalendarDays,
      href: "/simulados",
    },
    {
      label: "Caderno de erros",
      value: pendingErrors !== null ? `${pendingErrors}` : "Revisar",
      subtext:
        pendingErrors !== null && pendingErrors > 0
          ? "erros para revisar"
          : "Mantenha o caderno em dia",
      icon: BookOpen,
      href: caderno.base,
    },
  ];

  return (
    <section
      className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4"
      aria-label="Indicadores rápidos"
    >
      {items.map((item) => (
        <HighlightCard key={item.label} item={item} />
      ))}
    </section>
  );
}

function HighlightCard({ item }: { item: HighlightItem }) {
  const TrendIcon =
    item.trend === "up"
      ? TrendingUp
      : item.trend === "down"
      ? TrendingDown
      : null;

  return (
    <Link
      to={item.href}
      className="group block no-underline"
      aria-label={`${item.label}: ${item.value}`}
    >
      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/90 p-4 lg:p-5 shadow-sm backdrop-blur-sm transition-all duration-[280ms] ease-[cubic-bezier(0.25,0.46,0.45,0.94)] hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-md">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        <div className="relative z-10">
          <div className="flex items-center justify-between mb-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary/[0.08] to-primary/[0.14] border border-primary/[0.12]">
              <item.icon
                className="h-4 w-4 text-primary/80"
                aria-hidden
              />
            </div>
            {TrendIcon && (
              <div
                className={`flex items-center gap-0.5 text-[11px] font-semibold ${
                  item.trend === "up"
                    ? "text-[hsl(var(--trend-up))]"
                    : "text-[hsl(var(--trend-down))]"
                }`}
              >
                <TrendIcon className="h-3 w-3" aria-hidden />
                {item.subtext}
              </div>
            )}
          </div>

          <p className="text-[10px] uppercase tracking-[0.12em] font-semibold text-muted-foreground/70 mb-1">
            {item.label}
          </p>
          <p
            className={`text-[24px] font-extrabold leading-none tracking-[-0.03em] tabular-nums ${
              item.accent ? "text-primary" : "text-foreground"
            }`}
          >
            {item.value}
          </p>
          {!TrendIcon && (
            <p className="mt-1.5 text-[11px] text-muted-foreground/60 leading-snug truncate">
              {item.subtext}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}
