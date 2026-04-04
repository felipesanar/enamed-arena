import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { HomeHeroSection } from "./HomeHeroSection";
import type { HomeHeroState } from "@/lib/home-hero-state";

function renderHero(heroState: HomeHeroState) {
  return render(
    <MemoryRouter>
      <HomeHeroSection heroState={heroState} />
    </MemoryRouter>,
  );
}

describe("HomeHeroSection", () => {
  it("renderiza copy adaptativa e CTA do estado atual", () => {
    renderHero({
      scenario: "window_open",
      tone: "focus",
      eyebrow: "Janela ativa",
      headline: "Seu proximo passo esta disponivel",
      description: "Simulado aberto para evoluir seu desempenho.",
      ctaLabel: "Realizar simulado",
      ctaTo: "/simulados/sim-1",
    });

    expect(screen.getByText("Janela ativa")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Seu proximo passo esta disponivel" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Simulado aberto para evoluir seu desempenho.")).toBeInTheDocument();

    const cta = screen.getByRole("link", { name: /Realizar simulado/i });
    expect(cta).toHaveAttribute("href", "/simulados/sim-1");
  });

  it("quebra headline com virgula mantendo destaque final", () => {
    renderHero({
      scenario: "first_simulado",
      tone: "default",
      eyebrow: "Inicio da jornada",
      headline: "Comece sua preparacao, Felipe",
      description: "Seu primeiro simulado cria sua linha de base.",
      ctaLabel: "Iniciar primeiro simulado",
      ctaTo: "/simulados",
    });

    expect(
      screen.getByRole("heading", {
        name: /Comece sua preparacao\s*,\s*Felipe/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Iniciar primeiro simulado/i }),
    ).toHaveAttribute("href", "/simulados");
  });
});
