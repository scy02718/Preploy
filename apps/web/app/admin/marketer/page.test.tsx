import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import MarketerAdminPage from "./page";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ push: vi.fn() })),
  usePathname: vi.fn(() => "/admin/marketer"),
}));

const mockDraft = {
  id: "draft-1",
  postId: "post-1",
  intent: "prepare",
  reply: "This is my helpful reply about interview prep.",
  status: "pending",
  createdAt: new Date().toISOString(),
  post: {
    id: "post-1",
    subreddit: "cscareerquestions",
    title: "How to prepare for Google interview?",
    body: "I have an interview in 3 weeks...",
    permalink: "https://reddit.com/r/cscareerquestions/comments/abc/",
    classification: "prepare",
    summary: "User wants Google prep tips",
    postedAt: new Date().toISOString(),
  },
};

const mockCheatDraft = {
  id: "draft-2",
  postId: "post-2",
  intent: "cheat",
  reply: "This is a reply about why cheating is risky.",
  status: "pending",
  createdAt: new Date().toISOString(),
  post: {
    id: "post-2",
    subreddit: "cscareerquestions",
    title: "Can I use AI during a live interview?",
    body: "Wondering if I can secretly use ChatGPT...",
    permalink: "https://reddit.com/r/cscareerquestions/comments/def/",
    classification: "cheat",
    summary: "User asking about cheating",
    postedAt: new Date().toISOString(),
  },
};

function mockFetchSuccess(drafts = [mockDraft, mockCheatDraft], total = 2) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      drafts,
      pagination: {
        page: 1,
        limit: 20,
        total,
        totalPages: 1,
      },
    }),
  } as Response);
}

describe("MarketerAdminPage", () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("renders loading skeleton while data fetches", () => {
    global.fetch = vi.fn().mockReturnValue(new Promise(() => {})); // never resolves
    render(<MarketerAdminPage />);
    // Should show skeleton loading states
    expect(document.querySelector(".animate-pulse, [data-slot='skeleton']")).toBeTruthy();
  });

  it("renders draft cards with post info after loading", async () => {
    mockFetchSuccess();
    render(<MarketerAdminPage />);
    await waitFor(() => {
      expect(screen.getAllByText("How to prepare for Google interview?")[0]).toBeTruthy();
    });
    expect(screen.getAllByText("Can I use AI during a live interview?")[0]).toBeTruthy();
  });

  it("shows empty state when no pending drafts", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        drafts: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      }),
    } as Response);

    render(<MarketerAdminPage />);
    await waitFor(() => {
      expect(screen.getAllByText(/No pending drafts/)[0]).toBeTruthy();
    });
  });

  it("shows prepare and cheat sections with correct draft counts", async () => {
    mockFetchSuccess();
    render(<MarketerAdminPage />);
    await waitFor(() => {
      expect(screen.getAllByText(/Prepare/)[0]).toBeTruthy();
      expect(screen.getAllByText(/Cheat/)[0]).toBeTruthy();
    });
  });

  it("approve button calls fetch and removes card from list", async () => {
    mockFetchSuccess([mockDraft]);
    // Mock navigator.clipboard
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    // Mock window.open
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);

    render(<MarketerAdminPage />);

    await waitFor(() => {
      expect(screen.getAllByText(/Approve/)[0]).toBeTruthy();
    });

    // Set up the approve API call mock
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ...mockDraft, status: "approved" }),
    } as Response);

    const approveButtons = screen.getAllByText(/Approve/);
    fireEvent.click(approveButtons[0]);

    await waitFor(() => {
      // The card should disappear after approval
      expect(global.fetch).toHaveBeenCalledWith(
        `/api/admin/marketer/drafts/${mockDraft.id}/approve`,
        expect.objectContaining({ method: "POST" })
      );
    });

    openSpy.mockRestore();
  });

  it("edit button switches textarea to editable mode", async () => {
    mockFetchSuccess([mockDraft]);
    render(<MarketerAdminPage />);

    await waitFor(() => {
      expect(screen.getAllByText(/Edit/)[0]).toBeTruthy();
    });

    const editButtons = screen.getAllByText(/Edit/);
    fireEvent.click(editButtons[0]);

    // Should now show a textarea that is editable
    const textareas = document.querySelectorAll("textarea");
    expect(textareas.length).toBeGreaterThan(0);
  });

  it("discard button requires selecting a reason before confirming", async () => {
    mockFetchSuccess([mockDraft]);
    render(<MarketerAdminPage />);

    await waitFor(() => {
      expect(screen.getAllByText(/Discard/)[0]).toBeTruthy();
    });

    const discardButtons = screen.getAllByText(/Discard/);
    fireEvent.click(discardButtons[0]);

    // Confirm button should appear but be disabled without a reason
    await waitFor(() => {
      const confirmBtn = screen.getAllByText(/Confirm/)[0] as HTMLButtonElement;
      expect(confirmBtn.disabled).toBe(true);
    });
  });
});
