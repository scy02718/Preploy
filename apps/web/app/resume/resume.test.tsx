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
    structuredData: null,
  },
];

const mockResumesWithStructured = [
  {
    id: "resume-2",
    filename: "structured_resume.pdf",
    content: "John Doe\nSoftware Engineer at Acme Corp",
    createdAt: "2026-01-15T00:00:00Z",
    structuredData: {
      roles: [
        {
          company: "Acme Corp",
          title: "Senior Engineer",
          dates: "2020-2023",
          bullets: [
            {
              text: "Led migration of monolith to microservices, reducing latency by 40%",
              impact_score: 9,
              has_quantified_metric: true,
            },
            {
              text: "Participated in team meetings",
              impact_score: 2,
              has_quantified_metric: false,
            },
          ],
        },
      ],
      skills: ["TypeScript", "Node.js"],
    },
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

  // 118-N: empty state nudge mentions "no quota cost"
  it("118-N: empty state nudge mentions 'no quota cost'", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ resumes: [] }),
    }) as unknown as typeof fetch;

    render(<ResumePage />);
    await vi.waitFor(() => {
      const elements = screen.getAllByText(/no quota cost/i);
      expect(elements.length).toBeGreaterThanOrEqual(1);
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

  it("renders Structured View card when structuredData is present", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ resumes: mockResumesWithStructured }),
    }) as unknown as typeof fetch;

    render(<ResumePage />);
    await vi.waitFor(() => {
      expect(screen.getAllByText("Structured View").length).toBeGreaterThanOrEqual(1);
    });
    // Role name should be visible inside the structured view
    expect(screen.getAllByText("Acme Corp").length).toBeGreaterThanOrEqual(1);
  });

  it("does not render Structured View card when structuredData is null (plaintext-only fallback)", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ resumes: mockResumes }),
    }) as unknown as typeof fetch;

    render(<ResumePage />);
    await vi.waitFor(() => {
      // The resume list should render
      expect(screen.getAllByText("my_resume.pdf").length).toBeGreaterThanOrEqual(1);
    });
    // Structured View card should NOT be present
    expect(screen.queryByText("Structured View")).toBeNull();
  });
});
