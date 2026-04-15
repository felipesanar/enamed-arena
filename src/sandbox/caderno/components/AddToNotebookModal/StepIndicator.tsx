interface StepIndicatorProps {
  current: 1 | 2;
}

export function StepIndicator({ current }: StepIndicatorProps) {
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      {([1, 2] as const).map((n) => {
        const done = n < current;
        const active = n === current;
        return (
          <div
            key={n}
            style={{
              width: done || active ? 20 : 8,
              height: 8,
              borderRadius: "var(--radius-pill)",
              background: done
                ? "var(--success)"
                : active
                ? "var(--wine)"
                : "var(--border)",
              transition: "all .2s ease",
            }}
          />
        );
      })}
    </div>
  );
}
