import { useEffect, useCallback, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  LayoutDashboard,
  Calendar,
  Trophy,
  BarChart3,
  GitCompareArrows,
  BookOpen,
  Settings,
  Target,
  Dumbbell,
  Sparkles,
} from "lucide-react";
import { useHasAccess } from "@/contexts/UserContext";
import { useCadernoRoutes } from "@/hooks/useCadernoRoutes";

const navItems = [
  { title: "Início", url: "/", icon: LayoutDashboard },
  { title: "Simulados", url: "/simulados", icon: Calendar },
  { title: "Desempenho", url: "/desempenho", icon: BarChart3 },
  { title: "Ranking", url: "/ranking", icon: Trophy },
  { title: "Comparativo", url: "/comparativo", icon: GitCompareArrows },
  { title: "Configurações", url: "/configuracoes", icon: Settings },
];

interface CommandPaletteProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function CommandPalette({ open: openProp, onOpenChange }: CommandPaletteProps) {
  const [openInternal, setOpenInternal] = useState(false);
  const open = openProp ?? openInternal;
  const setOpen = onOpenChange ?? setOpenInternal;

  const navigate = useNavigate();
  const location = useLocation();

  const caderno = useCadernoRoutes();
  const hasCaderno = useHasAccess("cadernoErros");

  const proItems = hasCaderno
    ? caderno.v2
      ? [
          { title: "Caderno de Erros", url: caderno.base, icon: BookOpen },
          { title: "Revisar agora", url: caderno.reviewDue, icon: Target },
          { title: "Treinar pontos fracos", url: caderno.treino, icon: Dumbbell },
          { title: "Insights do caderno", url: caderno.insights, icon: Sparkles },
        ]
      : [{ title: "Caderno de Erros", url: caderno.base, icon: BookOpen }]
    : [];

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(true);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [setOpen]);

  const run = useCallback(
    (url: string) => {
      navigate(url);
      setOpen(false);
    },
    [navigate, setOpen]
  );

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Buscar ou navegar..." />
      <CommandList>
        <CommandEmpty>Nenhum resultado.</CommandEmpty>
        <CommandGroup heading="Navegação">
          {navItems.map((item) => (
            <CommandItem
              key={item.url}
              value={item.title}
              onSelect={() => run(item.url)}
              className="gap-3"
            >
              <item.icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <span>{item.title}</span>
              {location.pathname === item.url && (
                <span className="ml-auto text-caption text-primary font-medium">Aqui</span>
              )}
            </CommandItem>
          ))}
        </CommandGroup>
        {proItems.length > 0 && (
        <CommandGroup heading="PRO Exclusivo">
          {proItems.map((item) => (
            <CommandItem
              key={item.url}
              value={item.title}
              onSelect={() => run(item.url)}
              className="gap-3"
            >
              <item.icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <span>{item.title}</span>
            </CommandItem>
          ))}
        </CommandGroup>
        )}
      </CommandList>
      <div className="border-t border-border px-3 py-2 text-caption text-muted-foreground">
        <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">
          ⌘K
        </kbd>{" "}
        para abrir · Navegue pelo teclado
      </div>
    </CommandDialog>
  );
}
