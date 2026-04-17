import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import CommunicationPage from "./page";

describe("CommunicationPage", () => {
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
});
