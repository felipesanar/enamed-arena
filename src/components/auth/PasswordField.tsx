import { Eye, EyeOff, Lock } from "lucide-react";
import { TextField } from "@/components/auth/TextField";

interface PasswordFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  showPassword: boolean;
  onTogglePassword: () => void;
  placeholder?: string;
  error?: string;
  labelClassName?: string;
}

export function PasswordField({
  label,
  value,
  onChange,
  showPassword,
  onTogglePassword,
  placeholder = "Sua senha",
  error,
  labelClassName,
}: PasswordFieldProps) {
  return (
    <div className="space-y-1">
      <div className="relative">
        <TextField
          id="auth-password"
          type={showPassword ? "text" : "password"}
          label={label}
          icon={Lock}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          autoComplete="current-password"
          error={error}
          labelClassName={labelClassName}
          className="pr-11"
        />
        <button
          type="button"
          onClick={onTogglePassword}
          className="absolute right-3 top-[2.26rem] -translate-y-1/2 text-auth-text-muted transition-colors hover:text-auth-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 rounded-md lg:right-2.5 lg:top-[1.95rem]"
          aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
        >
          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
