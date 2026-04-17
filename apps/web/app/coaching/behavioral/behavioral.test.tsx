import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import BehavioralPage from "./page";

describe("BehavioralPage", () => {
  it("renders the STAR Method heading", () => {
    render(<BehavioralPage />);
    expect(screen.getAllByText("The STAR Method").length).toBeGreaterThanOrEqual(1);
  });

  it("renders all four STAR components (Situation, Task, Action, Result)", () => {
    render(<BehavioralPage />);
    expect(screen.getAllByText(/S — Situation/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/T — Task/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/A — Action/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/R — Result/i).length).toBeGreaterThanOrEqual(1);
  });

  it("renders the Common Question Categories section", () => {
    render(<BehavioralPage />);
    expect(screen.getAllByText("Common Question Categories").length).toBeGreaterThanOrEqual(1);
  });

  it("renders competency category labels", () => {
    render(<BehavioralPage />);
    expect(screen.getAllByText("Leadership").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Conflict").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Failure").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Teamwork").length).toBeGreaterThanOrEqual(1);
  });

  it("renders the Tips for Success section", () => {
    render(<BehavioralPage />);
    expect(screen.getAllByText("Tips for Success").length).toBeGreaterThanOrEqual(1);
  });

  it("renders the Practice Behavioral Interview button link", () => {
    const { container } = render(<BehavioralPage />);
    const link = container.querySelector('a[href="/interview/behavioral/setup"]');
    expect(link).toBeTruthy();
  });

  it("renders at least one tip about metrics", () => {
    render(<BehavioralPage />);
    // The tips mention "metrics"
    const metricsText = screen.getAllByText(/metrics/i);
    expect(metricsText.length).toBeGreaterThanOrEqual(1);
  });

  it("renders the Adaptability and Initiative categories", () => {
    render(<BehavioralPage />);
    expect(screen.getAllByText("Initiative").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Adaptability").length).toBeGreaterThanOrEqual(1);
  });
});
