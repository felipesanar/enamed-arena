export function BackgroundGlowLayer() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="absolute inset-0 bg-auth-base" />
      <div className="absolute inset-0 bg-[radial-gradient(92%_88%_at_0%_8%,hsl(var(--auth-accent-glow)/0.38),transparent_54%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(66%_54%_at_20%_26%,hsl(var(--primary)/0.22),transparent_62%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(90%_76%_at_82%_78%,hsl(var(--auth-accent-glow)/0.08),transparent_68%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(102deg,hsl(var(--auth-bg-soft))_0%,hsl(var(--auth-bg-base))_34%,hsl(var(--auth-bg-base))_100%)] opacity-95" />

      {/* Orb 1 — CSS animation, compositor-only */}
      <div className="absolute -left-36 top-[-6%] h-[32rem] w-[32rem] rounded-full bg-primary/24 blur-[120px] auth-orb-1" />
      {/* Orb 2 */}
      <div className="absolute -right-24 bottom-10 h-72 w-72 rounded-full bg-primary/8 blur-[110px] auth-orb-2" />
      {/* Orb 3 */}
      <div className="absolute left-[42%] top-[18%] h-44 w-44 rounded-full bg-[hsl(var(--auth-accent-glow)/0.05)] blur-[86px] auth-orb-3" />

      <div className="absolute inset-0 bg-[linear-gradient(180deg,hsl(var(--auth-text-primary)/0.025)_0%,hsl(var(--auth-text-primary)/0)_14%,hsl(var(--auth-bg-base)/0.78)_100%)]" />
    </div>
  );
}
