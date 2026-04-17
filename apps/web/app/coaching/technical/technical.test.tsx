import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// Mock prefillStore for PracticeButton
const mockSetTechnicalPrefill = vi.fn();
vi.mock("@/stores/prefillStore", () => ({
  usePrefillStore: (selector: (s: { setTechnicalPrefill: typeof mockSetTechnicalPrefill }) => unknown) =>
    selector({ setTechnicalPrefill: mockSetTechnicalPrefill }),
}));

// Mock next/navigation for PracticeButton
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

import TechnicalPage from "./page";

describe("TechnicalPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Regression: migrated content
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

  // New: all 4 TechnicalInterviewType values covered
  it("covers all 4 TechnicalInterviewType values (leetcode, system_design, frontend, backend)", () => {
    render(<TechnicalPage />);
    // LeetCode
    expect(screen.getAllByText(/LeetCode/i).length).toBeGreaterThanOrEqual(1);
    // System Design
    expect(screen.getAllByText(/System Design/i).length).toBeGreaterThanOrEqual(1);
    // Frontend
    expect(screen.getAllByText(/Frontend Interviews/i).length).toBeGreaterThanOrEqual(1);
    // Backend
    expect(screen.getAllByText(/Backend Interviews/i).length).toBeGreaterThanOrEqual(1);
  });

  // New: practice buttons for all 4 formats
  it("renders Practice this buttons for all 4 formats with prefillStore links", () => {
    render(<TechnicalPage />);
    expect(screen.getAllByTestId("practice-leetcode").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByTestId("practice-system_design").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByTestId("practice-frontend").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByTestId("practice-backend").length).toBeGreaterThanOrEqual(1);
  });

  it("clicking practice-leetcode pre-fills store with interview_type and navigates to setup", () => {
    render(<TechnicalPage />);
    fireEvent.click(screen.getAllByTestId("practice-leetcode")[0]);
    expect(mockSetTechnicalPrefill).toHaveBeenCalledWith({ interview_type: "leetcode" });
    expect(mockPush).toHaveBeenCalledWith("/interview/technical/setup");
  });

  it("clicking practice-frontend pre-fills store with interview_type and navigates to setup", () => {
    render(<TechnicalPage />);
    fireEvent.click(screen.getAllByTestId("practice-frontend")[0]);
    expect(mockSetTechnicalPrefill).toHaveBeenCalledWith({ interview_type: "frontend" });
    expect(mockPush).toHaveBeenCalledWith("/interview/technical/setup");
  });

  // New: Choose Your Line widget renders with at least 2 choice lines
  it("renders the Choose Your Next Line section with at least 2 choice buttons", () => {
    render(<TechnicalPage />);
    expect(screen.getAllByText(/Choose Your Next Line/i).length).toBeGreaterThanOrEqual(1);
    const choices = screen.getAllByTestId(/choice-\d+/);
    expect(choices.length).toBeGreaterThanOrEqual(2);
  });

  it("clicking a choice in ChooseYourLineWidget displays feedback", () => {
    render(<TechnicalPage />);
    fireEvent.click(screen.getByTestId("choice-0"));
    expect(screen.getByTestId("choice-feedback")).toBeTruthy();
  });

  // New: interviewer rubric
  it("renders What Interviewers Grade For section", () => {
    render(<TechnicalPage />);
    expect(screen.getAllByText(/What Interviewers Grade For/i).length).toBeGreaterThanOrEqual(1);
  });

  // New: frontend section content
  it("renders Frontend What Frontend Interviews Cover section with DOM and React", () => {
    render(<TechnicalPage />);
    expect(screen.getAllByText(/DOM manipulation/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/React component design/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Accessibility/i).length).toBeGreaterThanOrEqual(1);
  });

  // New: backend section content
  it("renders Backend What Backend Interviews Cover section with API design and Auth", () => {
    render(<TechnicalPage />);
    expect(screen.getAllByText(/API design/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Auth/i).length).toBeGreaterThanOrEqual(1);
  });
});
