import type { InputHTMLAttributes } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  icon?: LucideIcon;
  hint?: string;
  error?: string;
  labelClassName?: string;
}

export function TextField({ label, icon: Icon, hint, error, className, labelClassName, id, ...props }: TextFieldProps) {
  const inputId = id ?? `field-${label.toLowerCase().replace(/\s+/g, "-")}`;

  return (
    <div className="space-y-1">
      <label htmlFor={inputId} className={cn("block text-body-sm font-medium text-auth-text-primary", labelClassName)}>
        {label}
      </label>
      <div className="relative">
        {Icon && <Icon className="pointer-events-none absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-auth-text-muted lg:left-3" />}
        <input
          id={inputId}
          className={cn(
            "h-11 w-full rounded-lg border border-auth-border-subtle bg-auth-input px-3.5 text-body text-auth-text-primary outline-none transition-all duration-200 lg:h-9 lg:rounded-md lg:px-3 lg:text-[13px]",
            "placeholder:text-auth-text-muted/80",
            "hover:border-auth-border-strong",
            "focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-0",
            "disabled:cursor-not-allowed disabled:opacity-55",
            Icon ? "pl-11 lg:pl-10" : "",
            error ? "border-destructive/70 focus-visible:border-destructive focus-visible:ring-destructive/30" : "",
            className
          )}
          {...props}
        />
      </div>
      {error ? (
        <p className="text-caption text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-caption text-auth-text-muted">{hint}</p>
      ) : null}
    </div>
  );
}
