import { useEffect, useState } from "react";
import { BellRing, Flame, CalendarClock, ClipboardCheck, type LucideIcon } from "lucide-react";

import { Switch } from "@/components/ui/switch";
import { SettingsCardGroup, SettingsRow } from "./SettingsRow";
import {
  simuladosApi,
  DEFAULT_NOTIFICATION_PREFERENCES,
  type NotificationPreferences,
} from "@/services/simuladosApi";
import { toast } from "@/hooks/use-toast";
import { logger } from "@/lib/logger";
import { trackEvent } from "@/lib/analytics";

type PrefKey = keyof NotificationPreferences;

interface ReminderCategory {
  key: PrefKey;
  icon: LucideIcon;
  label: string;
  description: string;
}

// Categorias de lembrete do Caderno (plano 08 §3.1). Os canais/cadência exata
// são decisão de Produto pendente — aqui controlamos apenas o opt-in.
const CATEGORIES: ReminderCategory[] = [
  {
    key: "caderno_daily_review",
    icon: BellRing,
    label: "Revisão diária do Caderno",
    description: "Avisamos quando você tem questões prontas para revisar hoje.",
  },
  {
    key: "caderno_streak",
    icon: Flame,
    label: "Sequência de estudo",
    description: "Um empurrãozinho para você não perder sua sequência de revisões.",
  },
  {
    key: "caderno_reta_final",
    icon: CalendarClock,
    label: "Reta final",
    description: "Lembretes intensificados na contagem regressiva para a prova.",
  },
  {
    key: "caderno_post_triage",
    icon: ClipboardCheck,
    label: "Triagem pós-prova",
    description: "Sugestão de revisar seus erros logo após finalizar um simulado.",
  },
];

export function NotificationsSection() {
  const [prefs, setPrefs] = useState<NotificationPreferences>(
    DEFAULT_NOTIFICATION_PREFERENCES,
  );
  const [loading, setLoading] = useState(true);
  // Trava por categoria para evitar disparos concorrentes no mesmo toggle.
  const [saving, setSaving] = useState<Partial<Record<PrefKey, boolean>>>({});

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const loaded = await simuladosApi.getNotificationPreferences();
        if (active) setPrefs(loaded);
      } catch (err) {
        logger.error("[NotificationsSection] load error:", err);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const handleToggle = async (key: PrefKey, next: boolean) => {
    const previous = prefs[key];
    // Optimistic UI: aplica já e reverte se falhar.
    setPrefs((p) => ({ ...p, [key]: next }));
    setSaving((s) => ({ ...s, [key]: true }));

    try {
      await simuladosApi.updateNotificationPreferences({ [key]: next });
      // Confirma só a chave alterada. NÃO sobrescreve as demais com o retorno,
      // que vem com defaults quando o RPC ainda não está deployado (evita
      // flipar visualmente prefs não tocadas).
      setPrefs((p) => ({ ...p, [key]: next }));
      trackEvent("notification_preferences_updated", {
        preference: key,
        enabled: next,
      });
    } catch (err) {
      logger.error("[NotificationsSection] update error:", err);
      setPrefs((p) => ({ ...p, [key]: previous }));
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível atualizar sua preferência. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSaving((s) => ({ ...s, [key]: false }));
    }
  };

  return (
    <SettingsCardGroup>
      {CATEGORIES.map((cat, idx) => (
        <SettingsRow
          key={cat.key}
          icon={cat.icon}
          label={cat.label}
          description={cat.description}
          divider={idx < CATEGORIES.length - 1}
          action={
            <Switch
              checked={prefs[cat.key]}
              disabled={loading || !!saving[cat.key]}
              onCheckedChange={(v) => handleToggle(cat.key, v)}
              aria-label={cat.label}
            />
          }
        />
      ))}
    </SettingsCardGroup>
  );
}
