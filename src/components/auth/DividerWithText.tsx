interface DividerWithTextProps {
  text?: string;
}

export function DividerWithText({ text = "ou continue com" }: DividerWithTextProps) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className="h-px flex-1 bg-auth-border-subtle" />
      <span className="text-caption uppercase tracking-[0.08em] text-auth-text-muted">{text}</span>
      <div className="h-px flex-1 bg-auth-border-subtle" />
    </div>
  );
}
