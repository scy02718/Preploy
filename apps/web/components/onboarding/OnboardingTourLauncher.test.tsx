import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";

// --- Mock next/navigation ---
const mockPush = vi.fn();
const mockGet = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => ({
    get: mockGet,
  }),
}));

// --- Mock OnboardingTour so we can inspect what run value it receives ---
let capturedRun = false;
let capturedOnFinish: (() => void) | null = null;
let capturedOnSkip: (() => void) | null = null;

vi.mock("./OnboardingTour", () => ({
  OnboardingTour: vi.fn(
    ({
      run,
      onFinish,
      onSkip,
    }: {
      run: boolean;
      onFinish: () => void;
      onSkip: () => void;
    }) => {
      capturedRun = run;
      capturedOnFinish = onFinish;
      capturedOnSkip = onSkip;
      return run ? <div data-testid="tour-active" /> : null;
    }
  ),
}));

import { OnboardingTourLauncher } from "./OnboardingTourLauncher";

// Helpers for building mock fetch responses
function makeUserMeResponse(overrides: Partial<{
  tourCompletedAt: string | null;
  tourSkippedAt: string | null;
}> = {}) {
  return {
    tourCompletedAt: null,
    tourSkippedAt: null,
    ...overrides,
  };
}

describe("OnboardingTourLauncher", () => {
  const originalInnerWidth = window.innerWidth;

  beforeEach(() => {
    capturedRun = false;
    capturedOnFinish = null;
    capturedOnSkip = null;
    mockPush.mockClear();
    mockGet.mockReturnValue(null); // no ?tour=1 by default
    // Default viewport: desktop
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 1280,
    });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: originalInnerWidth,
    });
    vi.clearAllMocks();
  });

  async function renderWithFetch(
    userMeData: ReturnType<typeof makeUserMeResponse>,
    props = { totalSessions: 0, isStatsLoading: false }
  ) {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => userMeData,
    });

    let component: ReturnType<typeof render>;
    await act(async () => {
      component = render(
        <OnboardingTourLauncher
          totalSessions={props.totalSessions}
          isStatsLoading={props.isStatsLoading}
        />
      );
    });
    // Allow fetch promise to resolve
    await act(async () => {
      await Promise.resolve();
    });
    return component!;
  }

  // 118-A: Tour auto-starts for new users
  it("118-A: tour starts for new user (0 sessions, no timestamps)", async () => {
    await renderWithFetch(makeUserMeResponse());

    // Advance timer past 600ms delay
    await act(async () => {
      vi.advanceTimersByTime(700);
    });

    expect(capturedRun).toBe(true);
  });

  // 118-B: Tour does NOT auto-start when tourCompletedAt is set
  it("118-B: tour does not start when tourCompletedAt is set", async () => {
    await renderWithFetch(
      makeUserMeResponse({ tourCompletedAt: "2026-01-01T00:00:00Z" })
    );

    await act(async () => {
      vi.advanceTimersByTime(700);
    });

    expect(capturedRun).toBe(false);
  });

  // 118-C: Tour does NOT auto-start when tourSkippedAt is set
  it("118-C: tour does not start when tourSkippedAt is set", async () => {
    await renderWithFetch(
      makeUserMeResponse({ tourSkippedAt: "2026-01-01T00:00:00Z" })
    );

    await act(async () => {
      vi.advanceTimersByTime(700);
    });

    expect(capturedRun).toBe(false);
  });

  // 118-D: ?tour=1 forces tour open even with timestamps set
  it("118-D: ?tour=1 forces tour open even with tourCompletedAt set", async () => {
    mockGet.mockReturnValue("1"); // simulate ?tour=1

    await renderWithFetch(
      makeUserMeResponse({ tourCompletedAt: "2026-01-01T00:00:00Z" })
    );

    await act(async () => {
      vi.advanceTimersByTime(700);
    });

    expect(capturedRun).toBe(true);
  });

  // Tour does NOT start when totalSessions > 0
  it("tour does not start when totalSessions > 0", async () => {
    await renderWithFetch(makeUserMeResponse(), {
      totalSessions: 5,
      isStatsLoading: false,
    });

    await act(async () => {
      vi.advanceTimersByTime(700);
    });

    expect(capturedRun).toBe(false);
  });

  // Tour does NOT start while stats are loading
  it("tour does not start while isStatsLoading is true", async () => {
    await renderWithFetch(makeUserMeResponse(), {
      totalSessions: 0,
      isStatsLoading: true,
    });

    await act(async () => {
      vi.advanceTimersByTime(700);
    });

    expect(capturedRun).toBe(false);
  });

  // Mobile: tour does not start on narrow viewport
  it("tour does not start on mobile viewport (<768px)", async () => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 375, // mobile width
    });

    await renderWithFetch(makeUserMeResponse());

    await act(async () => {
      vi.advanceTimersByTime(700);
    });

    expect(capturedRun).toBe(false);
  });

  // 118-F: handleSkip PATCHes with tour_skipped_at
  it("118-F: handleSkip PATCHes /api/users/me with tour_skipped_at", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => makeUserMeResponse(),
    });
    global.fetch = fetchMock;

    await act(async () => {
      render(
        <OnboardingTourLauncher totalSessions={0} isStatsLoading={false} />
      );
    });
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      vi.advanceTimersByTime(700);
    });

    // Trigger skip
    await act(async () => {
      capturedOnSkip?.();
    });

    const patchCalls = fetchMock.mock.calls.filter(
      (c) => c[0] === "/api/users/me" && c[1]?.method === "PATCH"
    );
    expect(patchCalls.length).toBeGreaterThanOrEqual(1);
    const body = JSON.parse(patchCalls[patchCalls.length - 1][1].body);
    expect(body).toHaveProperty("tour_skipped_at");
    expect(typeof body.tour_skipped_at).toBe("string");
  });

  // 118-H: handleFinish PATCHes with tour_completed_at and pushes to setup
  it("118-H: handleFinish PATCHes with tour_completed_at and pushes to /interview/behavioral/setup", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => makeUserMeResponse(),
    });
    global.fetch = fetchMock;

    await act(async () => {
      render(
        <OnboardingTourLauncher totalSessions={0} isStatsLoading={false} />
      );
    });
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      vi.advanceTimersByTime(700);
    });

    await act(async () => {
      capturedOnFinish?.();
    });

    const patchCalls = fetchMock.mock.calls.filter(
      (c) => c[0] === "/api/users/me" && c[1]?.method === "PATCH"
    );
    expect(patchCalls.length).toBeGreaterThanOrEqual(1);
    const body = JSON.parse(patchCalls[patchCalls.length - 1][1].body);
    expect(body).toHaveProperty("tour_completed_at");
    expect(typeof body.tour_completed_at).toBe("string");

    expect(mockPush).toHaveBeenCalledWith("/interview/behavioral/setup");
  });
});
