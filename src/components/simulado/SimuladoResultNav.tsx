import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

interface SimuladoResultNavProps {
  simuladoId: string;
  className?: string;
}

export function SimuladoResultNav({ simuladoId, className }: SimuladoResultNavProps) {
  const location = useLocation();
  const currentPath = location.pathname;

  const items = [
    { label: "Ver Correção", to: `/simulados/${simuladoId}/correcao` },
    { label: "Ver Resultado", to: `/simulados/${simuladoId}/resultado` },
    { label: "Ver Desempenho", to: "/desempenho" },
    { label: "Ver Ranking", to: "/ranking" },
  ];

  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      {items.map((item) => {
        const isActive = currentPath === item.to;

        return (
          <Link
            key={item.label}
            to={item.to}
            className={cn(
              "inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-body font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.995]",
              isActive
                ? "bg-primary text-primary-foreground hover:bg-wine-hover"
                : "border border-border bg-secondary text-secondary-foreground hover:bg-muted",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
