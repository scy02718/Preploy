import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import TechnicalPage from "./page";

describe("TechnicalPage", () => {
  it("renders the LeetCode / Coding Interviews heading", () => {
    render(<TechnicalPage />);
    expect(screen.getAllByText(/LeetCode \/ Coding Interviews/i).length).toBeGreaterThanOrEqual(1);
  });

  it("renders the System Design Interviews heading", () => {
    render(<TechnicalPage />);
    expect(screen.getAllByText(/System Design Interviews/i).length).toBeGreaterThanOrEqual(1);
  });

  it("renders the Problem-Solving Framework section (LeetCode)", () => {
    render(<TechnicalPage />);
    expect(screen.getAllByText("Problem-Solving Framework").length).toBeGreaterThanOrEqual(1);
  });

  it("renders the System Design Framework section", () => {
    render(<TechnicalPage />);
    expect(screen.getAllByText("System Design Framework").length).toBeGreaterThanOrEqual(1);
  });

  it("renders Common Patterns with LeetCode algorithm patterns", () => {
    render(<TechnicalPage />);
    expect(screen.getAllByText("Common Patterns").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Two Pointers").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Dynamic Programming").length).toBeGreaterThanOrEqual(1);
  });

  it("renders Key Concepts to Know with system design concepts", () => {
    render(<TechnicalPage />);
    expect(screen.getAllByText("Key Concepts to Know").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Load Balancing").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("CAP Theorem").length).toBeGreaterThanOrEqual(1);
  });

  it("renders Practice LeetCode Interview button link", () => {
    const { container } = render(<TechnicalPage />);
    const links = container.querySelectorAll('a[href="/interview/technical/setup"]');
    expect(links.length).toBeGreaterThanOrEqual(1);
  });

  it("renders the 4-step problem-solving steps", () => {
    render(<TechnicalPage />);
    expect(screen.getAllByText(/1\. Understand/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/2\. Plan/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/3\. Implement/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/4\. Verify/i).length).toBeGreaterThanOrEqual(1);
  });
});
