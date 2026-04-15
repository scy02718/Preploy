import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

// Mock next/navigation with the canonical vi.hoisted() + vi.mock() pattern
// so the factory receives a hoisted ref before the import graph is evaluated.
const { mockPush } = vi.hoisted(() => ({
  mockPush: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => "/star",
}));

import StarPrepPage from "./page";

const MOCK_STORIES = [
  {
    id: "story-1",
    title: "Led microservices migration",
    role: "Senior Software Engineer",
    expectedQuestions: ["Tell me about a technical challenge"],
    situation: "Our monolith was slow.",
    task: "Design migration plan.",
    action: "Broke into 8 services.",
    result: "Deploys went from 2h to 10min.",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "story-2",
    title: "Handled team conflict",
    role: "Tech Lead",
    expectedQuestions: ["Tell me about conflict resolution"],
    situation: "Two engineers disagreed on architecture.",
    task: "Mediate and decide.",
    action: "Ran a structured design review.",
    result: "Reached consensus in 2 days.",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const MOCK_DETAIL = {
  story: MOCK_STORIES[0],
  analyses: [],
};

const originalFetch = global.fetch;

beforeEach(() => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ stories: MOCK_STORIES, pagination: { total: 2, page: 1, limit: 20, totalPages: 1 } }),
  });
});

afterEach(() => {
  global.fetch = originalFetch;
  vi.clearAllMocks();
});

describe("StarPrepPage", () => {
  it("renders the page title", async () => {
    render(<StarPrepPage />);
    expect(screen.getAllByText("STAR Story Prep").length).toBeGreaterThanOrEqual(1);
  });

  it("renders the new story button", () => {
    render(<StarPrepPage />);
    expect(screen.getAllByText("New Story").length).toBeGreaterThanOrEqual(1);
  });

  it("shows loading skeleton initially", () => {
    render(<StarPrepPage />);
    // Loading state shows skeleton elements with animate-pulse
    const { container } = render(<StarPrepPage />);
    const skeletons = container.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("renders stories after loading", async () => {
    render(<StarPrepPage />);
    await waitFor(() => {
      expect(screen.getAllByText("Led microservices migration").length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getAllByText("Handled team conflict").length).toBeGreaterThanOrEqual(1);
  });

  it("shows create form when New Story is clicked", async () => {
    render(<StarPrepPage />);
    const newStoryBtn = screen.getAllByText("New Story")[0];
    fireEvent.click(newStoryBtn);
    await waitFor(() => {
      expect(screen.getAllByText("New Story").length).toBeGreaterThanOrEqual(1);
    });
    // Form should have story title field
    expect(screen.getByLabelText("Story Title")).toBeTruthy();
  });

  it("shows story detail when a story is selected", async () => {
    // Mock the detail fetch
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ stories: MOCK_STORIES, pagination: { total: 2, page: 1, limit: 20, totalPages: 1 } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => MOCK_DETAIL,
      });

    render(<StarPrepPage />);

    await waitFor(() => {
      expect(screen.getAllByText("Led microservices migration").length).toBeGreaterThanOrEqual(1);
    });

    // Click on a story
    const storyBtn = screen.getAllByText("Led microservices migration")[0];
    fireEvent.click(storyBtn);

    await waitFor(() => {
      // Detail view shows the Get AI Feedback button and the story situation text
      expect(screen.getAllByText("Get AI Feedback").length).toBeGreaterThanOrEqual(1);
    });
    // The situation text from the mock detail should be visible
    expect(screen.getAllByText("Our monolith was slow.").length).toBeGreaterThanOrEqual(1);
  });

  it("shows empty state when no stories exist", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ stories: [], pagination: { total: 0, page: 1, limit: 20, totalPages: 0 } }),
    });

    render(<StarPrepPage />);
    await waitFor(() => {
      expect(screen.getAllByText(/No stories yet/).length).toBeGreaterThanOrEqual(1);
    });
  });

  it("shows Practice this question button in detail view", async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ stories: MOCK_STORIES, pagination: { total: 2, page: 1, limit: 20, totalPages: 1 } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => MOCK_DETAIL,
      });

    render(<StarPrepPage />);

    await waitFor(() => {
      expect(screen.getAllByText("Led microservices migration").length).toBeGreaterThanOrEqual(1);
    });

    fireEvent.click(screen.getAllByText("Led microservices migration")[0]);

    await waitFor(() => {
      expect(screen.getAllByText("Practice this question").length).toBeGreaterThanOrEqual(1);
    });
  });
});
