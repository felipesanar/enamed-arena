"use client";

import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Clock, ChevronLeft, ChevronRight, Flag } from "lucide-react";

/** Dados de demonstração — 5 questões simuladas no estilo Modo Prova */
const DEMO_QUESTIONS = [
  {
    id: "q1",
    number: 12,
    area: "Clínica Médica",
    theme: "Pneumologia",
    text: "Paciente com quadro de febre há 5 dias, tosse seca e dispneia aos médios esforços. Rx de tórax com infiltrado intersticial bilateral. Qual a hipótese diagnóstica mais provável?",
    options: [
      { id: "a", label: "A", text: "Pneumonia bacteriana típica" },
      { id: "b", label: "B", text: "COVID-19 / SARS-CoV-2" },
      { id: "c", label: "C", text: "Tuberculose pulmonar" },
      { id: "d", label: "D", text: "Insuficiência cardíaca" },
    ],
  },
  {
    id: "q2",
    number: 31,
    area: "Clínica Médica",
    theme: "Cardiologia",
    text: "Paciente hipertenso em uso de IECA apresenta tosse seca persistente. Qual conduta mais adequada?",
    options: [
      { id: "a", label: "A", text: "Manter IECA e associar antitussígeno" },
      { id: "b", label: "B", text: "Suspender IECA e trocar por BRA" },
      { id: "c", label: "C", text: "Reduzir dose do IECA" },
      { id: "d", label: "D", text: "Associar corticóide inalatório" },
    ],
  },
  {
    id: "q3",
    number: 45,
    area: "Pediatria",
    theme: "Infectologia",
    text: "Criança 2 anos, febre alta, exantema maculopapular que inicia na face e progride para tronco, manchas de Koplik. Diagnóstico mais provável:",
    options: [
      { id: "a", label: "A", text: "Sarampo" },
      { id: "b", label: "B", text: "Rubéola" },
      { id: "c", label: "C", text: "Dengue" },
      { id: "d", label: "D", text: "Escarlatina" },
    ],
  },
  {
    id: "q4",
    number: 61,
    area: "Cirurgia",
    theme: "Emergência",
    text: "Paciente com trauma abdominal fechado, FAST positivo. Qual conduta inicial?",
    options: [
      { id: "a", label: "A", text: "Laparotomia exploradora" },
      { id: "b", label: "B", text: "TC de abdome com contraste" },
      { id: "c", label: "C", text: "Observação e reavaliação" },
      { id: "d", label: "D", text: "Laparoscopia diagnóstica" },
    ],
  },
  {
    id: "q5",
    number: 90,
    area: "Clínica Médica",
    theme: "Nefrologia",
    text: "Paciente com IRA oligúrica, creatinina elevada, sedimento urinário com cilindros granulares. Qual a causa mais provável?",
    options: [
      { id: "a", label: "A", text: "Necrose tubular aguda" },
      { id: "b", label: "B", text: "Glomerulonefrite rapidamente progressiva" },
      { id: "c", label: "C", text: "Pielonefrite aguda" },
      { id: "d", label: "D", text: "Nefropatia por contraste" },
    ],
  },
];

const TOTAL_QUESTIONS = 120;

export function LandingExamDemo() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [markedForReview, setMarkedForReview] = useState<Set<number>>(new Set());

  const q = DEMO_QUESTIONS[currentIndex];
  const currentAnswer = answers[q.id];
  const isMarked = markedForReview.has(currentIndex);
  const answeredCount = Object.keys(answers).length;

  const handleSelectOption = useCallback((optionId: string) => {
    setAnswers((prev) => ({ ...prev, [q.id]: optionId }));
  }, [q.id]);

  const toggleReview = useCallback(() => {
    setMarkedForReview((prev) => {
      const next = new Set(prev);
      if (next.has(currentIndex)) next.delete(currentIndex);
      else next.add(currentIndex);
      return next;
    });
  }, [currentIndex]);

  const handlePrev = () => setCurrentIndex((i) => Math.max(0, i - 1));
  const handleNext = () => setCurrentIndex((i) => Math.min(DEMO_QUESTIONS.length - 1, i + 1));

  return (
    <div className="relative rounded-3xl border border-border overflow-hidden bg-card/90 shadow-xl flex flex-col min-h-[420px]">
      {/* Header — espelho do ExamHeader */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/95">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-destructive/80" />
          <span className="w-2.5 h-2.5 rounded-full bg-warning/80" />
          <span className="w-2.5 h-2.5 rounded-full bg-success/80" />
        </div>
        <div className="flex items-center gap-3">
          <span className="text-caption text-muted-foreground">
            {q.number}/{TOTAL_QUESTIONS}
          </span>
          <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${(answeredCount / DEMO_QUESTIONS.length) * 100}%` }}
            />
          </div>
          <span className="flex items-center gap-1.5 text-caption font-semibold text-foreground px-2.5 py-1 rounded-lg bg-muted/50">
            <Clock className="h-3.5 w-3.5" aria-hidden />
            01:24:35
          </span>
          <span className="text-overline uppercase tracking-wider text-muted-foreground hidden sm:inline">
            Simulado ao vivo
          </span>
        </div>
      </div>

      {/* Barra de progresso respondidas */}
      <div className="px-4 py-2 bg-muted/30 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${(answeredCount / DEMO_QUESTIONS.length) * 100}%` }}
            />
          </div>
          <span className="text-caption font-medium text-muted-foreground whitespace-nowrap">
            {answeredCount}/{DEMO_QUESTIONS.length} respondidas
          </span>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Conteúdo principal — questão + alternativas */}
        <main className="flex-1 overflow-y-auto p-4 md:p-5">
          <div className="max-w-2xl">
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className="px-2.5 py-1 rounded-md bg-primary/15 text-primary text-caption font-medium">
                {q.area}
              </span>
              <span className="px-2.5 py-1 rounded-md bg-muted text-muted-foreground text-caption">
                {q.theme}
              </span>
            </div>
            <p className="text-overline uppercase text-muted-foreground mb-2">
              Questão {q.number} de {TOTAL_QUESTIONS}
            </p>
            <p className="text-body text-foreground leading-relaxed mb-6">{q.text}</p>

            <div className="space-y-2">
              {q.options.map((opt) => {
                const isSelected = currentAnswer === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleSelectOption(opt.id)}
                    className={cn(
                      "w-full text-left p-3 rounded-xl border-2 transition-all duration-200",
                      isSelected
                        ? "border-primary bg-primary/10 ring-2 ring-primary/20"
                        : "border-border bg-card/50 hover:border-primary/30 hover:bg-muted/20",
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={cn(
                          "flex-shrink-0 h-6 w-6 rounded-full flex items-center justify-center text-caption font-bold",
                          isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                        )}
                      >
                        {opt.label}
                      </span>
                      <span className="text-body text-foreground pt-0.5">{opt.text}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={toggleReview}
              className={cn(
                "mt-4 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-body-sm font-medium transition-all",
                isMarked ? "bg-info/10 text-info border border-info/30" : "bg-muted/50 text-muted-foreground hover:bg-muted border border-transparent",
              )}
            >
              <Flag className="h-3.5 w-3.5" aria-hidden />
              {isMarked ? "Marcada para revisão" : "Marcar para revisão"}
            </button>

            <div className="mt-6 flex items-center justify-between">
              <button
                type="button"
                onClick={handlePrev}
                disabled={currentIndex === 0}
                className="inline-flex items-center gap-1 px-4 py-2.5 rounded-xl bg-muted text-muted-foreground text-body font-medium hover:bg-muted/80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-4 w-4" />
                Anterior
              </button>
              <button
                type="button"
                onClick={handleNext}
                disabled={currentIndex === DEMO_QUESTIONS.length - 1}
                className="inline-flex items-center gap-1 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-body font-medium hover:bg-wine-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Próxima
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </main>

        {/* Sidebar — navegação por questões (espelho do QuestionNavigator) */}
        <aside className="hidden md:flex w-52 border-l border-border bg-card/80 p-4 flex-col shrink-0">
          <p className="text-body font-semibold text-foreground mb-1">Questões</p>
          <p className="text-caption text-muted-foreground mb-3">
            {answeredCount}/{DEMO_QUESTIONS.length} respondidas
          </p>
          <div className="grid grid-cols-1 gap-1.5">
            {DEMO_QUESTIONS.map((_, i) => {
              const isCurrent = i === currentIndex;
              const isAnswered = !!answers[DEMO_QUESTIONS[i].id];
              const isReview = markedForReview.has(i);
              return (
                <button
                  key={DEMO_QUESTIONS[i].id}
                  type="button"
                  onClick={() => setCurrentIndex(i)}
                  className={cn(
                    "h-9 w-full rounded-lg text-caption font-semibold transition-all",
                    isCurrent && "ring-2 ring-primary ring-offset-1 ring-offset-card",
                    isAnswered && !isReview && "bg-primary/15 text-primary",
                    isReview && "bg-info/20 text-info",
                    !isAnswered && !isReview && "bg-muted/50 text-muted-foreground hover:bg-muted",
                  )}
                >
                  {DEMO_QUESTIONS[i].number}
                </button>
              );
            })}
          </div>
          <div className="mt-auto pt-4 border-t border-border space-y-2 text-caption text-muted-foreground">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded bg-primary/30 border border-primary/40" />
              Respondida
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded bg-info/20" />
              Para revisão
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
