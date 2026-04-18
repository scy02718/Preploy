import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LandingFAQ } from "./LandingFAQ";

describe("LandingFAQ", () => {
  it("renders the FAQ heading", () => {
    render(<LandingFAQ />);
    expect(screen.getByText("Frequently asked questions")).toBeTruthy();
  });

  it("renders all FAQ questions", () => {
    render(<LandingFAQ />);
    const triggers = screen.getAllByTestId("faq-trigger");
    expect(triggers.length).toBeGreaterThanOrEqual(5);
  });

  it("FAQ items start collapsed", () => {
    render(<LandingFAQ />);
    const contents = screen.getAllByTestId("faq-content");
    contents.forEach((content) => {
      expect(content.className).toContain("max-h-0");
    });
  });

  it("clicking a trigger expands the answer", () => {
    render(<LandingFAQ />);
    const triggers = screen.getAllByTestId("faq-trigger");
    fireEvent.click(triggers[0]);
    const contents = screen.getAllByTestId("faq-content");
    expect(contents[0].className).toContain("max-h-96");
  });

  it("clicking an open trigger collapses it", () => {
    render(<LandingFAQ />);
    const triggers = screen.getAllByTestId("faq-trigger");
    fireEvent.click(triggers[0]);
    fireEvent.click(triggers[0]);
    const contents = screen.getAllByTestId("faq-content");
    expect(contents[0].className).toContain("max-h-0");
  });

  it("only one item is open at a time", () => {
    render(<LandingFAQ />);
    const triggers = screen.getAllByTestId("faq-trigger");
    fireEvent.click(triggers[0]);
    fireEvent.click(triggers[1]);
    const contents = screen.getAllByTestId("faq-content");
    expect(contents[0].className).toContain("max-h-0");
    expect(contents[1].className).toContain("max-h-96");
  });

  it("pricing answer describes free + Pro tiers, not the old beta copy", () => {
    render(<LandingFAQ />);
    const triggers = screen.getAllByTestId("faq-trigger");
    fireEvent.click(triggers[0]);
    // Copy updated when the Pro tier + feature gating shipped.
    expect(screen.getByText(/free tier/i)).toBeTruthy();
    expect(screen.getByText(/Pro is \$15\/month/)).toBeTruthy();
    expect(screen.getByText(/Interview-day Planner/)).toBeTruthy();
  });

  it("privacy answer explains audio handling", () => {
    render(<LandingFAQ />);
    const triggers = screen.getAllByTestId("faq-trigger");
    fireEvent.click(triggers[1]);
    expect(screen.getByText(/raw audio is not retained/i)).toBeTruthy();
  });
});
