import { Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface InstitutionChipProps {
  name: string;
  className?: string;
}

/** Hash estável para tinta de chip (pastel baseado no nome). */
function tint(name: string): { bg: string; text: string; ring: string } {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  // Paleta harmonizada com o wine do produto.
  const palettes = [
    { bg: "bg-accent", text: "text-primary", ring: "ring-primary/15" },
    { bg: "bg-info/10", text: "text-info", ring: "ring-info/20" },
    { bg: "bg-success/10", text: "text-success", ring: "ring-success/20" },
    { bg: "bg-warning/10", text: "text-warning", ring: "ring-warning/20" },
    { bg: "bg-muted", text: "text-foreground", ring: "ring-border" },
  ];
  return palettes[Math.abs(hash) % palettes.length];
}

export function InstitutionChip({ name, className }: InstitutionChipProps) {
  const t = tint(name);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-caption font-semibold ring-1 transition-colors",
        t.bg,
        t.text,
        t.ring,
        className,
      )}
      title={name}
    >
      <Building2 className="h-3 w-3 opacity-70" aria-hidden="true" />
      <span className="truncate max-w-[220px]">{name}</span>
    </span>
  );
}
