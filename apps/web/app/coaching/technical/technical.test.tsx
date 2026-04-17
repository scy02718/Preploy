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

  // Shared sections (always visible — not in the carousel)
  it("renders What Interviewers Grade For section", () => {
    render(<TechnicalPage />);
    expect(screen.getAllByText(/What Interviewers Grade For/i).length).toBeGreaterThanOrEqual(1);
  });

  it("renders Live Coding Dos and Don'ts section", () => {
    render(<TechnicalPage />);
    expect(screen.getAllByText(/Live Coding Dos and Don'ts/i).length).toBeGreaterThanOrEqual(1);
  });

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

  it("renders the Browse All Technical Formats CTA button", () => {
    render(<TechnicalPage />);
    expect(screen.getAllByText(/Browse All Technical Formats/i).length).toBeGreaterThanOrEqual(1);
  });

  // Carousel is present
  it("renders the format carousel", () => {
    render(<TechnicalPage />);
    expect(screen.getByTestId("technical-format-carousel")).toBeTruthy();
  });

  it("renders carousel navigation pills for all 4 formats", () => {
    render(<TechnicalPage />);
    expect(screen.getByTestId("carousel-pill-leetcode")).toBeTruthy();
    expect(screen.getByTestId("carousel-pill-system_design")).toBeTruthy();
    expect(screen.getByTestId("carousel-pill-frontend")).toBeTruthy();
    expect(screen.getByTestId("carousel-pill-backend")).toBeTruthy();
  });

  // LeetCode slide (first/default)
  it("renders LeetCode slide content initially (Problem-Solving Framework)", () => {
    render(<TechnicalPage />);
    expect(screen.getAllByText("Problem-Solving Framework").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Two Pointers").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Dynamic Programming").length).toBeGreaterThanOrEqual(1);
  });

  it("renders the LeetCode / Coding Interviews heading on the first slide", () => {
    render(<TechnicalPage />);
    expect(screen.getAllByText(/LeetCode \/ Coding Interviews/i).length).toBeGreaterThanOrEqual(1);
  });

  // Navigate to System Design slide
  it("renders System Design Framework section after navigating to system_design slide", () => {
    render(<TechnicalPage />);
    fireEvent.click(screen.getByTestId("carousel-pill-system_design"));
    expect(screen.getAllByText("System Design Framework").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Key Concepts to Know").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Load Balancing").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("CAP Theorem").length).toBeGreaterThanOrEqual(1);
  });

  it("renders System Design Interviews heading on system_design slide", () => {
    render(<TechnicalPage />);
    fireEvent.click(screen.getByTestId("carousel-pill-system_design"));
    expect(screen.getAllByText(/System Design Interviews/i).length).toBeGreaterThanOrEqual(1);
  });

  // Navigate to Frontend slide
  it("renders Frontend Interviews content after navigating to frontend slide", () => {
    render(<TechnicalPage />);
    fireEvent.click(screen.getByTestId("carousel-pill-frontend"));
    expect(screen.getAllByText(/DOM manipulation/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/React component design/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Accessibility/i).length).toBeGreaterThanOrEqual(1);
  });

  it("renders Frontend Interviews heading on frontend slide", () => {
    render(<TechnicalPage />);
    fireEvent.click(screen.getByTestId("carousel-pill-frontend"));
    expect(screen.getAllByText(/Frontend Interviews/i).length).toBeGreaterThanOrEqual(1);
  });

  // Navigate to Backend slide
  it("renders Backend Interviews content after navigating to backend slide", () => {
    render(<TechnicalPage />);
    fireEvent.click(screen.getByTestId("carousel-pill-backend"));
    expect(screen.getAllByText(/API design/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Auth/i).length).toBeGreaterThanOrEqual(1);
  });

  it("renders Backend Interviews heading on backend slide", () => {
    render(<TechnicalPage />);
    fireEvent.click(screen.getByTestId("carousel-pill-backend"));
    expect(screen.getAllByText(/Backend Interviews/i).length).toBeGreaterThanOrEqual(1);
  });

  // Practice buttons — each is on its own slide
  it("renders practice-leetcode button on LeetCode slide", () => {
    render(<TechnicalPage />);
    expect(screen.getAllByTestId("practice-leetcode").length).toBeGreaterThanOrEqual(1);
  });

  it("renders practice-system_design button on system_design slide", () => {
    render(<TechnicalPage />);
    fireEvent.click(screen.getByTestId("carousel-pill-system_design"));
    expect(screen.getAllByTestId("practice-system_design").length).toBeGreaterThanOrEqual(1);
  });

  it("renders practice-frontend button on frontend slide", () => {
    render(<TechnicalPage />);
    fireEvent.click(screen.getByTestId("carousel-pill-frontend"));
    expect(screen.getAllByTestId("practice-frontend").length).toBeGreaterThanOrEqual(1);
  });

  it("renders practice-backend button on backend slide", () => {
    render(<TechnicalPage />);
    fireEvent.click(screen.getByTestId("carousel-pill-backend"));
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
    fireEvent.click(screen.getByTestId("carousel-pill-frontend"));
    fireEvent.click(screen.getAllByTestId("practice-frontend")[0]);
    expect(mockSetTechnicalPrefill).toHaveBeenCalledWith({ interview_type: "frontend" });
    expect(mockPush).toHaveBeenCalledWith("/interview/technical/setup");
  });
});
