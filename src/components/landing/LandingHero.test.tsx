import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LandingHero } from "./LandingHero";

// Mock framer-motion so tests don't break on animation APIs
vi.mock("framer-motion", () => ({
  motion: new Proxy({}, {
    get: (_target, tag: string) =>
      ({ children, style, initial: _i, animate: _a, whileHover: _wh, transition: _t, ...rest }) =>
        ({ div: <div style={style} {...rest}>{children}</div>, h1: <h1 {...rest}>{children}</h1>, p: <p {...rest}>{children}</p>, section: <section style={style} {...rest}>{children}</section> }[tag] ?? <div style={style} {...rest}>{children}</div>),
  }),
  useReducedMotion: () => false,
  useScroll: () => ({ scrollY: { get: () => 0 } }),
  useTransform: () => 0,
  AnimatePresence: ({ children }) => children,
}));

// Mock react-router-dom Link
vi.mock("react-router-dom", () => ({
  Link: ({ children, to, onClick, ...rest }) => (
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

  it("renders social proof text", () => {
    render(<LandingHero />);
    expect(screen.getByText(/18\.400 alunos/i)).toBeTruthy();
  });

  it("renders the AI insight card", () => {
    render(<LandingHero />);
    expect(screen.getByText(/Análise SanarFlix/i)).toBeTruthy();
    expect(screen.getByText(/Unifesp \+ 3/i)).toBeTruthy();
  });

  it("renders all three area scores", () => {
    render(<LandingHero />);
    expect(screen.getByText("82%")).toBeTruthy();
    expect(screen.getByText("68%")).toBeTruthy();
    expect(screen.getByText("54%")).toBeTruthy();
  });

  it("renders secondary CTA linking to #como-funciona", () => {
    render(<LandingHero />);
    const link = screen.getByRole("link", { name: /como funciona/i });
    expect(link.getAttribute("href")).toBe("#como-funciona");
  });
});
