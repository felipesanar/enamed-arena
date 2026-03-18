import { BookOpen, CalendarClock } from "lucide-react";
import { SectionHeader } from "@/components/premium/SectionHeader";
import { ResumeCard } from "./ResumeCard";

export function ResumeSection() {
  return (
    <section aria-labelledby="resume-heading">
      <SectionHeader
        id="resume-heading"
        title="Retome por onde faz mais sentido"
        eyebrow="Continuidade"
        className="mb-6"
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
        <ResumeCard
          title="Caderno de Erros"
          copy="Revise o que mais gera aprendizado agora."
          ctaLabel="Abrir"
          to="/caderno-erros"
          icon={BookOpen}
        />
        <ResumeCard
          title="Próximo simulado"
          copy="Planeje sua preparação para entrar mais forte na próxima janela."
          ctaLabel="Planejar"
          to="/simulados"
          icon={CalendarClock}
        />
      </div>
    </section>
  );
}
