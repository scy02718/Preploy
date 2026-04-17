import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { SessionCostBanner } from "./SessionCostBanner";

describe("SessionCostBanner", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    vi.clearAllMocks();
  });

  // 118-M: Free plan (used:0, limit:3) — renders "1 of your 3"
  it("118-M: free plan shows '1 of your 3 remaining'", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ plan: "free", used: 0, limit: 3 }), {
        status: 200,
      })
    );

    await act(async () => {
      render(<SessionCostBanner />);
    });

    const banner = screen.getByTestId("session-cost-banner");
    expect(banner.textContent).toMatch(/1 of your 3/i);
  });

  // 118-M: Pro plan near limit (used:39, limit:40) — renders "last mock interview"
  it("118-M: pro plan near limit renders 'last mock interview'", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ plan: "pro", used: 39, limit: 40 }), {
        status: 200,
      })
    );

    await act(async () => {
      render(<SessionCostBanner />);
    });

    const banner = screen.getByTestId("session-cost-banner");
    expect(banner.textContent?.toLowerCase()).toContain("last mock interview");
  });

  // 118-M: Unlimited plan (limit:null) — renders nothing
  it("118-M: unlimited plan renders nothing", async () => {
    fetchSpy.mockResolvedValue(
      new Response(
        JSON.stringify({ plan: "unlimited", used: 5, limit: null }),
        { status: 200 }
      )
    );

    await act(async () => {
      render(<SessionCostBanner />);
    });

    expect(screen.queryByTestId("session-cost-banner")).toBeNull();
    expect(screen.queryByTestId("session-cost-banner-skeleton")).toBeNull();
  });

  // 118-M: Before fetch completes — renders skeleton
  it("118-M: before fetch completes renders skeleton", () => {
    // Return a never-resolving promise to keep loading state
    fetchSpy.mockReturnValue(new Promise(() => {}));

    render(<SessionCostBanner />);

    expect(screen.getByTestId("session-cost-banner-skeleton")).toBeInTheDocument();
    expect(screen.queryByTestId("session-cost-banner")).toBeNull();
  });

  // 118-M: Fetch fails — renders nothing
  it("118-M: fetch fails renders nothing", async () => {
    fetchSpy.mockRejectedValue(new Error("network error"));

    await act(async () => {
      render(<SessionCostBanner />);
    });

    expect(screen.queryByTestId("session-cost-banner")).toBeNull();
    expect(screen.queryByTestId("session-cost-banner-skeleton")).toBeNull();
  });

  // Used all quota — renders upgrade nudge
  it("renders upgrade message when remaining is 0", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ plan: "free", used: 3, limit: 3 }), {
        status: 200,
      })
    );

    await act(async () => {
      render(<SessionCostBanner />);
    });

    const banner = screen.getByTestId("session-cost-banner");
    expect(banner.textContent?.toLowerCase()).toContain("upgrade");
  });
});
