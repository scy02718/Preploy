/**
 * Component tests for the delete-resume feature on ResumePage.
 * Covers trace rows 117-F through 117-J.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

// Mock prefillStore with vi.hoisted so the mock is available at module evaluation
const mockClearResumeReference = vi.hoisted(() => vi.fn());
const mockSetBehavioralPrefill = vi.hoisted(() => vi.fn());

vi.mock("@/stores/prefillStore", () => ({
  usePrefillStore: () => ({
    setBehavioralPrefill: mockSetBehavioralPrefill,
    clearResumeReference: mockClearResumeReference,
  }),
}));

import ResumePage from "./page";

const RESUME_1 = {
  id: "resume-aaa",
  filename: "resume_one.pdf",
  content: "First resume content",
  createdAt: "2026-01-15T00:00:00Z",
};
const RESUME_2 = {
  id: "resume-bbb",
  filename: "resume_two.pdf",
  content: "Second resume content",
  createdAt: "2026-02-20T00:00:00Z",
};

function makeFetchMock(overrides?: Record<string, () => Promise<unknown>>) {
  return vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    const key = `${init?.method ?? "GET"} ${url}`;
    if (overrides && key in overrides) {
      return overrides[key]();
    }
    if (url === "/api/resume" && !init?.method) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ resumes: [RESUME_1, RESUME_2] }),
      });
    }
    return Promise.resolve({ ok: true, json: async () => ({}) });
  });
}

describe("ResumePage — delete feature (117-F through 117-J)", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = makeFetchMock() as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  // 117-F — Click delete → confirm strip appears, no request yet
  it("shows confirm strip when delete button clicked, without sending any DELETE request", async () => {
    render(<ResumePage />);

    // Wait for resumes to load
    await waitFor(() => {
      expect(screen.getAllByText("resume_one.pdf").length).toBeGreaterThanOrEqual(1);
    });

    const deleteButtons = screen.getAllByRole("button", { name: /delete resume_one\.pdf/i });
    expect(deleteButtons.length).toBeGreaterThanOrEqual(1);
    fireEvent.click(deleteButtons[0]);

    // Confirm strip should be visible
    await waitFor(() => {
      expect(
        screen.getAllByText(/Delete this resume\? This can't be undone\./i).length
      ).toBeGreaterThanOrEqual(1);
    });

    // No DELETE fetch should have been made yet
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    const deleteCalls = fetchMock.mock.calls.filter(
      (c) => c[1]?.method === "DELETE"
    );
    expect(deleteCalls).toHaveLength(0);
  });

  // 117-G — Cancel hides confirm strip
  it("hides confirm strip when Cancel is clicked", async () => {
    render(<ResumePage />);

    await waitFor(() => {
      expect(screen.getAllByText("resume_one.pdf").length).toBeGreaterThanOrEqual(1);
    });

    const deleteButtons = screen.getAllByRole("button", { name: /delete resume_one\.pdf/i });
    fireEvent.click(deleteButtons[0]);

    // Confirm strip visible
    await waitFor(() => {
      expect(
        screen.getAllByText(/Delete this resume\? This can't be undone\./i).length
      ).toBeGreaterThanOrEqual(1);
    });

    // Click Cancel
    const cancelButtons = screen.getAllByRole("button", { name: /cancel/i });
    fireEvent.click(cancelButtons[0]);

    // Confirm strip hidden
    await waitFor(() => {
      expect(
        screen.queryByText(/Delete this resume\? This can't be undone\./i)
      ).toBeNull();
    });
  });

  // 117-H — Confirm → fetch DELETE + card removed
  it("sends DELETE request and removes the card when Confirm Delete is clicked", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url === "/api/resume" && !init?.method) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ resumes: [RESUME_1, RESUME_2] }),
        });
      }
      if (url === `/api/resume/${RESUME_1.id}` && init?.method === "DELETE") {
        return Promise.resolve({ status: 204, ok: true, json: async () => ({}) });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<ResumePage />);

    await waitFor(() => {
      expect(screen.getAllByText("resume_one.pdf").length).toBeGreaterThanOrEqual(1);
    });

    // Click the trash icon to open confirm strip
    const deleteButtons = screen.getAllByRole("button", { name: /delete resume_one\.pdf/i });
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(
        screen.getAllByText(/Delete this resume\? This can't be undone\./i).length
      ).toBeGreaterThanOrEqual(1);
    });

    // Click the destructive "Delete" button inside the confirm strip
    const confirmDeleteButtons = screen.getAllByRole("button", { name: /^delete$/i });
    fireEvent.click(confirmDeleteButtons[0]);

    // DELETE request sent
    await waitFor(() => {
      const deleteCalls = fetchMock.mock.calls.filter(
        (c) =>
          typeof c[0] === "string" &&
          c[0].includes(`/api/resume/${RESUME_1.id}`) &&
          c[1]?.method === "DELETE"
      );
      expect(deleteCalls.length).toBeGreaterThanOrEqual(1);
    });

    // Card removed from the list
    await waitFor(() => {
      expect(screen.queryByText("resume_one.pdf")).toBeNull();
    });
  });

  // 117-I — Deleted selected resume → selectedResumeId falls to next/null
  it("selects the next resume (or null) when the currently-selected resume is deleted", async () => {
    // RESUME_1 is first in list and will be auto-selected on load
    const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url === "/api/resume" && !init?.method) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ resumes: [RESUME_1, RESUME_2] }),
        });
      }
      if (url === `/api/resume/${RESUME_1.id}` && init?.method === "DELETE") {
        return Promise.resolve({ status: 204, ok: true, json: async () => ({}) });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<ResumePage />);

    await waitFor(() => {
      expect(screen.getAllByText("resume_one.pdf").length).toBeGreaterThanOrEqual(1);
    });

    // RESUME_1 should be selected (shown with "Selected" badge)
    expect(screen.getAllByText("Selected").length).toBeGreaterThanOrEqual(1);

    // Delete RESUME_1
    const deleteButtons = screen.getAllByRole("button", { name: /delete resume_one\.pdf/i });
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(
        screen.getAllByText(/Delete this resume\? This can't be undone\./i).length
      ).toBeGreaterThanOrEqual(1);
    });

    const confirmDeleteButtons = screen.getAllByRole("button", { name: /^delete$/i });
    fireEvent.click(confirmDeleteButtons[0]);

    // RESUME_1 gone
    await waitFor(() => {
      expect(screen.queryByText("resume_one.pdf")).toBeNull();
    });

    // RESUME_2 is now selected (still has "Selected" badge)
    await waitFor(() => {
      expect(screen.getAllByText("Selected").length).toBeGreaterThanOrEqual(1);
    });
  });

  // 117-J — Deleting resume with resume_id in prefillStore → clearResumeReference called
  it("calls clearResumeReference with the deleted resume id", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url === "/api/resume" && !init?.method) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ resumes: [RESUME_1] }),
        });
      }
      if (url === `/api/resume/${RESUME_1.id}` && init?.method === "DELETE") {
        return Promise.resolve({ status: 204, ok: true, json: async () => ({}) });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<ResumePage />);

    await waitFor(() => {
      expect(screen.getAllByText("resume_one.pdf").length).toBeGreaterThanOrEqual(1);
    });

    const deleteButtons = screen.getAllByRole("button", { name: /delete resume_one\.pdf/i });
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(
        screen.getAllByText(/Delete this resume\? This can't be undone\./i).length
      ).toBeGreaterThanOrEqual(1);
    });

    const confirmDeleteButtons = screen.getAllByRole("button", { name: /^delete$/i });
    fireEvent.click(confirmDeleteButtons[0]);

    await waitFor(() => {
      expect(mockClearResumeReference).toHaveBeenCalledWith(RESUME_1.id);
    });
  });
});
