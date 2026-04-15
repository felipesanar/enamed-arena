import { useEffect } from "react";
import { CadernoSandboxPage } from "@/sandbox/caderno/CadernoSandboxPage";

export default function SandboxCadernoPage() {
  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&display=swap";
    document.head.appendChild(link);
    return () => {
      if (link.parentNode) link.parentNode.removeChild(link);
    };
  }, []);

  return <CadernoSandboxPage />;
}
