import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { DashboardStatTiles } from "./DashboardStatTiles";

describe("DashboardStatTiles", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    vi.clearAllMocks();
  });

  // 110-1: renders monthly text and NOT daily text
  it("renders 'Sessions this month' label — not 'Today' or 'per day'", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ plan: "pro", used: 12, limit: 40 }), {
        status: 200,
      })
    );

    await act(async () => {
      render(
        <DashboardStatTiles
          totalSessions={25}
          avgScore={7.5}
          thisWeek={3}
          isLoading={false}
        />
      );
    });

    // Should contain monthly label
    const monthlyLabel = screen.getAllByText(/sessions this month/i);
    expect(monthlyLabel.length).toBeGreaterThanOrEqual(1);

    // Must NOT contain daily language
    expect(screen.queryByText(/today/i)).toBeNull();
    expect(screen.queryByText(/per day/i)).toBeNull();
  });

  // 110-1: correct used/limit display
  it("renders used/limit value from /api/usage/current", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ plan: "pro", used: 12, limit: 40 }), {
        status: 200,
      })
    );

    await act(async () => {
      render(
        <DashboardStatTiles
          totalSessions={25}
          avgScore={7.5}
          thisWeek={3}
          isLoading={false}
        />
      );
    });

    const valueEl = screen.getByTestId("stat-tile-monthly-value");
    expect(valueEl.textContent).toContain("12");
    expect(valueEl.textContent).toContain("40");
  });

  // 110-1: renders "Unlimited" when limit is null
  it("renders 'Unlimited' display when limit is null", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ plan: "unlimited", used: 5, limit: null }), {
        status: 200,
      })
    );

    await act(async () => {
      render(
        <DashboardStatTiles
          totalSessions={5}
          avgScore={8.0}
          thisWeek={1}
          isLoading={false}
        />
      );
    });

    const valueEl = screen.getByTestId("stat-tile-monthly-value");
    expect(valueEl.textContent).toContain("Unlimited");
  });

  // Renders skeleton while loading
  it("renders skeleton tiles when isLoading is true", () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ plan: "free", used: 0, limit: 3 }), {
        status: 200,
      })
    );

    render(
      <DashboardStatTiles
        totalSessions={0}
        avgScore={null}
        thisWeek={0}
        isLoading={true}
      />
    );

    expect(screen.getByTestId("stat-tiles-skeleton")).toBeInTheDocument();
    expect(screen.queryByTestId("stat-tiles")).toBeNull();
  });

  // Renders other stat tiles correctly
  it("renders total sessions, average score and this-week stats", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ plan: "free", used: 2, limit: 3 }), {
        status: 200,
      })
    );

    await act(async () => {
      render(
        <DashboardStatTiles
          totalSessions={42}
          avgScore={6.8}
          thisWeek={5}
          isLoading={false}
        />
      );
    });

    expect(screen.getAllByText("42").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("6.8").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("5").length).toBeGreaterThanOrEqual(1);
  });
});
