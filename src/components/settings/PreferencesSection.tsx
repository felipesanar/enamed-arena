import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { SettingsCardGroup, SettingsRow } from "./SettingsRow";
import { logger } from "@/lib/logger";

type ThemePreference = "light" | "dark" | "system";

interface PreferencesState {
  theme: ThemePreference;
}

const STORAGE_KEY = "enamed.preferences.v1";

const DEFAULT_STATE: PreferencesState = {
  theme: "light",
};

function loadPreferences(): PreferencesState {
  if (typeof window === "undefined") return DEFAULT_STATE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_STATE, ...parsed };
  } catch (err) {
    logger.error("[Preferences] load error:", err);
    return DEFAULT_STATE;
  }
}

function persistPreferences(state: PreferencesState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    logger.error("[Preferences] persist error:", err);
  }
}

function applyTheme(theme: ThemePreference) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const prefersDark =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia?.("(prefers-color-scheme: dark)").matches);
  root.classList.toggle("dark", !!prefersDark);
}

export function PreferencesSection() {
  const [state, setState] = useState<PreferencesState>(() => loadPreferences());

  useEffect(() => {
    applyTheme(state.theme);
    persistPreferences(state);
  }, [state]);

  useEffect(() => {
    if (state.theme !== "system" || typeof window === "undefined") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme("system");
    media.addEventListener?.("change", handler);
    return () => media.removeEventListener?.("change", handler);
  }, [state.theme]);

  const updateField = <K extends keyof PreferencesState>(key: K, value: PreferencesState[K]) =>
    setState((prev) => ({ ...prev, [key]: value }));

  return (
    <SettingsCardGroup>
      {/* Theme */}
      <SettingsRow
        icon={state.theme === "dark" ? Moon : state.theme === "system" ? Monitor : Sun}
        label="Tema"
        description="Escolha a aparência que combina com seu ritmo de estudo."
        divider={false}
        action={
          <ThemeToggle value={state.theme} onChange={(v) => updateField("theme", v)} />
        }
      />
    </SettingsCardGroup>
  );
}

interface ThemeToggleProps {
  value: ThemePreference;
  onChange: (v: ThemePreference) => void;
}

function ThemeToggle({ value, onChange }: ThemeToggleProps) {
  const options: { id: ThemePreference; label: string; icon: typeof Sun }[] = [
    { id: "light", label: "Claro", icon: Sun },
    { id: "dark", label: "Escuro", icon: Moon },
    { id: "system", label: "Sistema", icon: Monitor },
  ];

  return (
    <div
      role="radiogroup"
      aria-label="Tema"
      className="inline-flex items-center rounded-xl bg-muted p-1 ring-1 ring-border"
    >
      {options.map((opt) => {
        const Icon = opt.icon;
        const active = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.id)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-caption font-semibold transition-all",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
              active
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
