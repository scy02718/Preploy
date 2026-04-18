import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { UpgradePromptDialog } from "./UpgradePromptDialog";

describe("UpgradePromptDialog", () => {
  const originalFetch = global.fetch;
  const originalLocation = window.location;
  let assignSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    assignSpy = vi.fn();
    // @ts-expect-error — relaxing types for the test stub
    delete window.location;
    Object.defineProperty(window, "location", {
      configurable: true,
      writable: true,
      value: {
        ...originalLocation,
        assign: assignSpy as unknown as Location["assign"],
        replace: vi.fn() as unknown as Location["replace"],
        reload: vi.fn() as unknown as Location["reload"],
      },
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    // @ts-expect-error — relaxing types for the test stub
    delete window.location;
    Object.defineProperty(window, "location", {
      configurable: true,
      writable: true,
      value: originalLocation,
    });
    vi.clearAllMocks();
  });

  it("renders nothing when open is false", () => {
    render(
      <UpgradePromptDialog open={false} onClose={() => {}} used={3} limit={3} />
    );
    expect(screen.queryByTestId("upgrade-dialog")).toBeNull();
  });

  it("shows the current usage numbers from props", () => {
    render(
      <UpgradePromptDialog open={true} onClose={() => {}} used={3} limit={3} />
    );
    expect(screen.getByTestId("upgrade-dialog-used").textContent).toBe("3");
    expect(screen.getByTestId("upgrade-dialog-limit").textContent).toBe("3");
  });

  it("renders the Pro benefits list, leading with the Pro-gated features", () => {
    render(
      <UpgradePromptDialog open={true} onClose={() => {}} used={3} limit={3} />
    );
    // Copy changed when Planner + Resume moved behind the Pro tier: the
    // benefits list now leads with the features-you-unlock rather than
    // the quota bump. See `lib/features.ts` FEATURE_META and /pricing.
    expect(
      screen.getAllByText(/Interview-day Planner/).length
    ).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByText(/Resume upload/).length
    ).toBeGreaterThanOrEqual(1);
  });

  it("clicking 'Maybe later' calls onClose", () => {
    const onClose = vi.fn();
    render(
      <UpgradePromptDialog open={true} onClose={onClose} used={3} limit={3} />
    );
    fireEvent.click(screen.getByText("Maybe later"));
    expect(onClose).toHaveBeenCalled();
  });

  it("clicking 'Upgrade to Pro' POSTs to /api/billing/checkout and redirects", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ url: "https://checkout.stripe.com/test_session" }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(
      <UpgradePromptDialog open={true} onClose={() => {}} used={3} limit={3} />
    );

    fireEvent.click(screen.getByTestId("upgrade-dialog-cta"));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/billing/checkout",
        expect.objectContaining({ method: "POST" })
      );
    });
    await waitFor(() => {
      expect(assignSpy).toHaveBeenCalledWith(
        "https://checkout.stripe.com/test_session"
      );
    });
  });

  it("shows an error message when the checkout endpoint fails", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: "stripe is down" }),
    }) as unknown as typeof fetch;

    render(
      <UpgradePromptDialog open={true} onClose={() => {}} used={3} limit={3} />
    );

    fireEvent.click(screen.getByTestId("upgrade-dialog-cta"));

    await waitFor(() => {
      expect(screen.getAllByText(/stripe is down/).length).toBeGreaterThanOrEqual(1);
    });
    expect(assignSpy).not.toHaveBeenCalled();
  });
});
