import { MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export interface AttemptModalityBadgeProps {
  /** Tipo bruto da tentativa (`attempts.attempt_type`). */
  attemptType?: string | null;
}

/**
 * Selo "Aplicação presencial" — exibido nas superfícies onde o aluno vê uma
 * tentativa (card do simulado, tela de resultado, histórico de desempenho)
 * quando ela foi realizada presencialmente (QR → gabarito → resultado).
 *
 * Renderiza `null` para qualquer `attemptType` diferente de `'presencial'`,
 * incluindo `'online'`, `'offline'`, `null` e `undefined` — decisão de
 * produto explícita (não existe selo para offline).
 */
export function AttemptModalityBadge({ attemptType }: AttemptModalityBadgeProps) {
  if (attemptType !== "presencial") return null;

  return (
    <Badge
      variant="outline"
      className="gap-1 border-info/20 bg-info/10 text-info hover:bg-info/10"
    >
      <MapPin className="h-3 w-3" aria-hidden />
      Aplicação presencial
    </Badge>
  );
}
