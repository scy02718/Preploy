import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LandingHero } from "./LandingHero";
import { LandingHowItWorks } from "./LandingHowItWorks";
import { LandingPersonas } from "./LandingPersonas";
import { LandingFeatures } from "./LandingFeatures";
import { LandingFAQ } from "./LandingFAQ";

describe("Landing page copy uniqueness", () => {
  it("section headings are unique across all landing sections", () => {
    const { container } = render(
      <>
        <LandingHero />
        <LandingHowItWorks />
        <LandingPersonas />
        <LandingFeatures />
        <LandingFAQ />
      </>
    );
    const headings = Array.from(container.querySelectorAll("h1, h2, h3")).map(
      (el) => el.textContent?.trim()
    );
    const unique = new Set(headings);
    expect(headings.length).toBe(unique.size);
  });

  it("feature tile titles are unique", () => {
    const { container } = render(<LandingFeatures />);
    const titles = Array.from(container.querySelectorAll("h3")).map(
      (el) => el.textContent?.trim()
    );
    const unique = new Set(titles);
    expect(titles.length).toBe(unique.size);
  });

  it("how-it-works step titles are unique", () => {
    const { container } = render(<LandingHowItWorks />);
    const titles = Array.from(container.querySelectorAll("h3")).map(
      (el) => el.textContent?.trim()
    );
    const unique = new Set(titles);
    expect(titles.length).toBe(unique.size);
  });

  it("FAQ questions are unique", () => {
    const triggers = screen.queryAllByTestId("faq-trigger");
    // Fresh render for this test
    const { container } = render(<LandingFAQ />);
    const questions = Array.from(
      container.querySelectorAll("[data-testid='faq-trigger'] span")
    ).map((el) => el.textContent?.trim());
    const unique = new Set(questions);
    expect(questions.length).toBe(unique.size);
    // Suppress unused warning
    void triggers;
  });

  it("hero does not contain banned jargon", () => {
    const { container } = render(<LandingHero />);
    const text = container.textContent ?? "";
    const banned = [
      "revolutionary",
      "empower",
      "unleash the power",
      "game-changing",
      "in today's fast-paced world",
      "leverage",
      "cutting-edge",
      "seamless",
    ];
    for (const word of banned) {
      expect(text.toLowerCase()).not.toContain(word.toLowerCase());
    }
  });

  it("how-it-works section does not contain banned jargon", () => {
    const { container } = render(<LandingHowItWorks />);
    const text = container.textContent ?? "";
    const banned = ["leverage", "cutting-edge", "seamless", "revolutionary"];
    for (const word of banned) {
      expect(text.toLowerCase()).not.toContain(word.toLowerCase());
    }
  });
});
