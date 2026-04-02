import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LandingHero } from "./LandingHero";

// Mock framer-motion so tests don't break on animation APIs
vi.mock("framer-motion", () => ({
  motion: new Proxy({}, {
    get: (_target: any, tag: string) =>
      ({ children, style, initial: _i, animate: _a, whileHover: _wh, transition: _t, ...rest }: any) =>
        ({ div: <div style={style} {...rest}>{children}</div>, h1: <h1 {...rest}>{children}</h1>, p: <p {...rest}>{children}</p>, span: <span style={style} {...rest}>{children}</span>, section: <section style={style} {...rest}>{children}</section> }[tag] ?? <div style={style} {...rest}>{children}</div>),
  }),
  animate: vi.fn(() => ({ stop: vi.fn() })),
  useReducedMotion: () => false,
  useScroll: () => ({ scrollY: { get: () => 0 } }),
  useTransform: () => 0,
  AnimatePresence: ({ children }: any) => children,
}));

// Mock react-router-dom Link
vi.mock("react-router-dom", () => ({
  Link: ({ children, to, onClick, ...rest }: any) => (
    <a href={to} onClick={onClick} {...rest}>{children}</a>
  ),
}));

// Mock analytics
vi.mock("@/lib/analytics", () => ({
  trackEvent: vi.fn(),
}));

import { trackEvent } from "@/lib/analytics";

describe("LandingHero", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the hero section with id='hero'", () => {
    render(<LandingHero />);
    expect(document.getElementById("hero")).toBeTruthy();
  });

  it("renders the headline", () => {
    render(<LandingHero />);
    expect(screen.getByRole("heading", { level: 1 })).toBeTruthy();
  });

  it("renders the primary CTA linking to /login", () => {
    render(<LandingHero />);
    const link = screen.getByRole("link", { name: /próximo simulado/i });
    expect(link.getAttribute("href")).toBe("/login");
  });

  it("calls trackEvent when primary CTA is clicked", () => {
    render(<LandingHero />);
    const link = screen.getByRole("link", { name: /próximo simulado/i });
    fireEvent.click(link);
    expect(trackEvent).toHaveBeenCalledWith("lead_captured", { source: "landing_hero_primary" });
  });

  it("renders the AI insight card", () => {
    render(<LandingHero />);
    expect(screen.getByText(/Vaga desejada/i)).toBeTruthy();
    expect(screen.getByText(/Clínica Médica na USP-SP/i)).toBeTruthy();
  });

  it("renders all three area scores", () => {
    render(<LandingHero />);
    expect(screen.getByText("82%")).toBeTruthy();
    expect(screen.getByText("68%")).toBeTruthy();
    expect(screen.getByText("54%")).toBeTruthy();
  });

  it("renders hero value props with titles and supporting copy", () => {
    render(<LandingHero />);
    // Mobile + desktop listas (uma oculta por breakpoint); mesma copy em ambas.
    expect(screen.getAllByText(/100 questões inéditas/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/envie respostas/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/INEP e DCN/i).length).toBeGreaterThanOrEqual(1);
  });

  it("renders secondary CTA linking to #como-funciona", () => {
    render(<LandingHero />);
    const link = screen.getByRole("link", { name: /como funciona/i });
    expect(link.getAttribute("href")).toBe("#como-funciona");
  });
});
