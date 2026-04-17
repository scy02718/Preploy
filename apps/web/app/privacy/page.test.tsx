import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import PrivacyPage from "./page";

describe("PrivacyPage", () => {
  it("discloses Vercel Web Analytics in the third-party processors section", () => {
    render(<PrivacyPage />);
    const matches = screen.getAllByText(/Vercel Web Analytics/i);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it("renders the Gaze & Presence Analysis section heading", () => {
    render(<PrivacyPage />);
    const matches = screen.getAllByText(/Gaze.*Presence Analysis/i);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it("discloses that no video or images leave the device", () => {
    const { container } = render(<PrivacyPage />);
    expect(container.textContent).toMatch(/leave your device/i);
  });

  it("discloses on-device processing", () => {
    const { container } = render(<PrivacyPage />);
    expect(container.textContent).toMatch(/on-device/i);
  });

  it("states the feature is off by default", () => {
    const { container } = render(<PrivacyPage />);
    expect(container.textContent).toMatch(/off by default/i);
  });

  it("does not use forbidden copy words in the gaze section", () => {
    render(<PrivacyPage />);
    // Find the gaze section by its heading, then check its parent container
    const headings = screen.getAllByText(/Gaze.*Presence Analysis/i);
    const gazeSection = headings[0].closest("section") ?? headings[0].parentElement;
    const gazeText = gazeSection?.textContent ?? "";

    const forbidden = ["cheating", "suspicious", "caught", "detect", "monitor your gaze"];
    for (const word of forbidden) {
      expect(gazeText.toLowerCase()).not.toContain(word.toLowerCase());
    }
  });

  it("does not use forbidden copy words anywhere on the page", () => {
    const { container } = render(<PrivacyPage />);
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/\bcheating\b/i);
    expect(text).not.toMatch(/\bsuspicious\b/i);
    expect(text).not.toMatch(/\bcaught\b/i);
  });
});
