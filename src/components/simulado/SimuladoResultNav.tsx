import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

export type SimuladoResultNavVariant = "public" | "admin";

interface SimuladoResultNavProps {
  simuladoId: string;
  variant?: 'public' | 'admin';
  className?: string;
  /** admin: links para rotas /admin/preview/... e ranking-preview */
  variant?: SimuladoResultNavVariant;
}

export function SimuladoResultNav({
  simuladoId,
  className,
  variant = "public",
}: SimuladoResultNavProps) {
  const location = useLocation();
  const pathname = location.pathname;

  const items =
    variant === "admin"
      ? [
          {
            label: "Ver Correção",
            to: `/admin/preview/simulados/${simuladoId}/correcao`,
            match: (p: string) =>
              p.includes(`/admin/preview/simulados/${simuladoId}/correcao`),
          },
          {
            label: "Ver Resultado",
            to: `/admin/preview/simulados/${simuladoId}/resultado`,
            match: (p: string) =>
              p.includes(`/admin/preview/simulados/${simuladoId}/resultado`),
          },
          {
            label: "Ver Desempenho",
            to: `/admin/preview/simulados/${simuladoId}/desempenho`,
            match: (p: string) =>
              p.includes(`/admin/preview/simulados/${simuladoId}/desempenho`),
          },
          {
            label: "Ver Ranking",
            to: "/admin/ranking-preview",
            match: (p: string) => p.startsWith("/admin/ranking-preview"),
          },
        ]
      : [
          {
            label: "Ver Correção",
            to: `/simulados/${simuladoId}/correcao`,
            match: (p: string) => p === `/simulados/${simuladoId}/correcao`,
          },
          {
            label: "Ver Resultado",
            to: `/simulados/${simuladoId}/resultado`,
            match: (p: string) => p === `/simulados/${simuladoId}/resultado`,
          },
          {
            label: "Ver Desempenho",
            to: "/desempenho",
            match: (p: string) => p === "/desempenho",
          },
          {
            label: "Ver Ranking",
            to: "/ranking",
            match: (p: string) => p === "/ranking",
          },
        ];

  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      {items.map((item) => {
        const isActive = item.match(pathname);

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
