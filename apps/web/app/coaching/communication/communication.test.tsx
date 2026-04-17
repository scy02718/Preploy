import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// Mock next/navigation for Link components (not strictly needed for static links
// but communication page uses Link so we mock for safety)
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import CommunicationPage from "./page";

describe("CommunicationPage", () => {
  // Regression: migrated content
  it("renders the Communication Fundamentals section", () => {
    render(<CommunicationPage />);
    expect(screen.getAllByText("Communication Fundamentals").length).toBeGreaterThanOrEqual(1);
  });

  it("renders the Think Out Loud fundamental", () => {
    render(<CommunicationPage />);
    expect(screen.getAllByText("Think Out Loud").length).toBeGreaterThanOrEqual(1);
  });

  it("renders the Structure Your Answers fundamental", () => {
    render(<CommunicationPage />);
    expect(screen.getAllByText("Structure Your Answers").length).toBeGreaterThanOrEqual(1);
  });

  it("renders the Ask Good Questions fundamental", () => {
    render(<CommunicationPage />);
    expect(screen.getAllByText("Ask Good Questions").length).toBeGreaterThanOrEqual(1);
  });

  it("renders the Body Language & Presence section", () => {
    render(<CommunicationPage />);
    expect(screen.getAllByText(/Body Language/i).length).toBeGreaterThanOrEqual(1);
  });

  it("renders the Handling Difficult Moments section", () => {
    render(<CommunicationPage />);
    expect(screen.getAllByText("Handling Difficult Moments").length).toBeGreaterThanOrEqual(1);
  });

  it("renders tips about eye contact", () => {
    render(<CommunicationPage />);
    const eyeContactTip = screen.getAllByText(/eye contact/i);
    expect(eyeContactTip.length).toBeGreaterThanOrEqual(1);
  });

  it("renders tip about filler words", () => {
    render(<CommunicationPage />);
    const fillerTip = screen.getAllByText(/filler words/i);
    expect(fillerTip.length).toBeGreaterThanOrEqual(1);
  });

  // New: Voice delivery section
  it("renders the Voice Delivery section", () => {
    render(<CommunicationPage />);
    expect(screen.getAllByText("Voice Delivery").length).toBeGreaterThanOrEqual(1);
  });

  it("renders Pace sub-section in Voice Delivery", () => {
    render(<CommunicationPage />);
    expect(screen.getAllByText("Pace").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/150 words per minute/i).length).toBeGreaterThanOrEqual(1);
  });

  it("renders Strategic pauses sub-section", () => {
    render(<CommunicationPage />);
    expect(screen.getAllByText("Strategic pauses").length).toBeGreaterThanOrEqual(1);
  });

  // New: Filler word picker widget renders and responds to input
  it("renders the Filler Word Picker section", () => {
    render(<CommunicationPage />);
    expect(screen.getAllByText("Filler Word Picker").length).toBeGreaterThanOrEqual(1);
  });

  it("renders filler word chips for um, like, basically", () => {
    render(<CommunicationPage />);
    expect(screen.getAllByTestId("filler-chip-um").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByTestId("filler-chip-like").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByTestId("filler-chip-basically").length).toBeGreaterThanOrEqual(1);
  });

  it("clicking a filler chip shows before/after panel", () => {
    render(<CommunicationPage />);
    fireEvent.click(screen.getByTestId("filler-chip-um"));
    expect(screen.getByTestId("filler-panel-um")).toBeTruthy();
  });

  // New: Written/Async section
  it("renders the Written and Async Communication section", () => {
    render(<CommunicationPage />);
    expect(screen.getAllByText(/Written & Async Communication/i).length).toBeGreaterThanOrEqual(1);
  });

  // New: Cross-links to behavioral and technical
  it("renders cross-link to /coaching/behavioral", () => {
    const { container } = render(<CommunicationPage />);
    const link = container.querySelector('a[href="/coaching/behavioral"]');
    expect(link).toBeTruthy();
  });

  it("renders cross-link to /coaching/technical", () => {
    const { container } = render(<CommunicationPage />);
    const link = container.querySelector('a[href="/coaching/technical"]');
    expect(link).toBeTruthy();
  });
});
