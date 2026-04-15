import { useEffect } from "react";
import "@/sandbox/caderno/tokens.css";

export default function SandboxCadernoPage() {
  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&display=swap";
    document.head.appendChild(link);
    return () => {
      document.head.removeChild(link);
    };
  }, []);

  return (
    <div className="caderno-sandbox" style={{ fontFamily: "'Inter', sans-serif" }}>
      <p style={{ padding: 32, color: "var(--wine)" }}>Sandbox Caderno — tokens loaded ✓</p>
    </div>
  );
}
