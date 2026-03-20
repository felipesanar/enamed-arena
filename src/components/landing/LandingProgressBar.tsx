import { useEffect, useState } from "react";

export function LandingProgressBar() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const winScroll = document.documentElement.scrollTop;
      const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      setProgress(height > 0 ? winScroll / height : 0);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className="fixed top-0 left-0 w-full h-0.5 z-[100] bg-foreground/5 origin-left"
      aria-hidden
    >
      <div
        className="h-full bg-primary shadow-[0_0_20px_hsl(var(--wine-glow)_/_0.5)] transition-transform duration-200 ease-out will-change-transform"
        style={{ transform: `scaleX(${progress})` }}
      />
    </div>
  );
}
