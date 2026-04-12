import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const mockResumes = [
  {
    id: "resume-1",
    filename: "my_resume.pdf",
    content: "John Doe\nSoftware Engineer\n5 years experience",
    createdAt: "2026-01-15T00:00:00Z",
  },
];

import ResumePage from "./page";

describe("ResumePage", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ resumes: mockResumes }),
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("renders the page title", async () => {
    render(<ResumePage />);
    await vi.waitFor(() => {
      expect(screen.getAllByText("Resume Questions").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("renders the upload section", async () => {
    render(<ResumePage />);
    await vi.waitFor(() => {
      expect(screen.getAllByText("Upload Resume").length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getAllByText(/PDF.*TXT.*MD/i).length).toBeGreaterThanOrEqual(1);
  });

  it("renders the resume list with uploaded resumes", async () => {
    render(<ResumePage />);
    await vi.waitFor(() => {
      expect(screen.getAllByText("my_resume.pdf").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("renders the generate questions section", async () => {
    render(<ResumePage />);
    await vi.waitFor(() => {
      expect(screen.getAllByText("Generate Questions").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("renders question type selector", async () => {
    render(<ResumePage />);
    await vi.waitFor(() => {
      expect(screen.getAllByText("Question Type").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("renders company and role inputs", async () => {
    render(<ResumePage />);
    await vi.waitFor(() => {
      expect(screen.getAllByText(/Company/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/Role/i).length).toBeGreaterThanOrEqual(1);
    });
  });

  it("shows empty state when no resumes exist", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ resumes: [] }),
    }) as unknown as typeof fetch;

    render(<ResumePage />);
    await vi.waitFor(() => {
      expect(screen.getAllByText(/No resumes uploaded/i).length).toBeGreaterThanOrEqual(1);
    });
  });

  it("shows loading skeleton initially", () => {
    // Make fetch hang
    global.fetch = vi.fn().mockReturnValue(new Promise(() => {})) as unknown as typeof fetch;
    render(<ResumePage />);
    // Skeleton should show while loading
    const pulseElements = document.querySelectorAll(".animate-pulse");
    expect(pulseElements.length).toBeGreaterThan(0);
  });
});
