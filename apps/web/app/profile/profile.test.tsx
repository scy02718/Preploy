import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const baseProfile: {
  id: string;
  email: string;
  name: string;
  image: null;
  plan: "free" | "pro" | "max";
  stripeCustomerId: string | null;
  disabledAt: null;
  createdAt: string;
} = {
  id: "user-1",
  email: "test@example.com",
  name: "Test User",
  image: null,
  plan: "free",
  stripeCustomerId: null,
  disabledAt: null,
  createdAt: "2026-01-01T00:00:00Z",
};

import ProfilePage from "./page";

function mockFetchWithProfile(profile: typeof baseProfile) {
  return vi.fn().mockImplementation((url: string) => {
    if (typeof url === "string" && url.includes("/api/templates")) {
      return Promise.resolve({ ok: true, json: async () => [] });
    }
    if (typeof url === "string" && url.includes("/api/users/me")) {
      return Promise.resolve({ ok: true, json: async () => profile });
    }
    return Promise.resolve({ ok: true, json: async () => profile });
  }) as unknown as typeof fetch;
}

describe("ProfilePage", () => {
  const originalFetch = global.fetch;
  const originalLocation = window.location;
  let assignSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    global.fetch = mockFetchWithProfile(baseProfile);
    assignSpy = vi.fn();
    // jsdom locks down window.location.assign, so replace the whole object.
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

  it("renders the page title", async () => {
    render(<ProfilePage />);
    await vi.waitFor(() => {
      expect(screen.getAllByText("Profile").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("renders the read-only Plan card showing the user's current plan", async () => {
    render(<ProfilePage />);
    await vi.waitFor(() => {
      // Plan card title and the user's tier badge
      expect(screen.getAllByText("Plan").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("Free").length).toBeGreaterThanOrEqual(1);
    });
    // No interactive plan-change UI — the radio group + Update Plan button
    // were removed because they let any user upgrade themselves to Pro/Max
    // without paying.
    expect(screen.queryByText("Update Plan")).toBeNull();
  });

  it("renders danger zone section", async () => {
    render(<ProfilePage />);
    await vi.waitFor(() => {
      expect(screen.getAllByText("Danger Zone").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("renders disable account button", async () => {
    render(<ProfilePage />);
    await vi.waitFor(() => {
      expect(screen.getAllByText("Disable Account").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("shows Upgrade to Pro button for a free-plan user", async () => {
    global.fetch = mockFetchWithProfile({ ...baseProfile, plan: "free" });
    render(<ProfilePage />);
    await vi.waitFor(() => {
      expect(screen.getByTestId("upgrade-button")).toBeTruthy();
    });
    expect(screen.getAllByText("Upgrade to Pro").length).toBeGreaterThanOrEqual(1);
    // Free users should NEVER see "Manage billing" — even ones with a
    // dangling stripe_customer_id from a previous failed checkout attempt.
    expect(screen.queryByTestId("manage-billing-button")).toBeNull();
  });

  it("shows Upgrade to Pro for a free user even if they have a dangling stripe_customer_id", async () => {
    global.fetch = mockFetchWithProfile({
      ...baseProfile,
      plan: "free",
      stripeCustomerId: "cus_left_over_from_failed_checkout",
    });
    render(<ProfilePage />);
    await vi.waitFor(() => {
      expect(screen.getByTestId("upgrade-button")).toBeTruthy();
    });
    expect(screen.queryByTestId("manage-billing-button")).toBeNull();
  });

  it("shows Manage billing button for a pro-plan user", async () => {
    global.fetch = mockFetchWithProfile({
      ...baseProfile,
      plan: "pro",
      stripeCustomerId: "cus_test_123",
    });
    render(<ProfilePage />);
    await vi.waitFor(() => {
      expect(screen.getByTestId("manage-billing-button")).toBeTruthy();
    });
    expect(screen.getAllByText("Manage billing").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByTestId("upgrade-button")).toBeNull();
  });

  it("clicking Upgrade to Pro calls /api/billing/checkout and redirects", async () => {
    const { fireEvent } = await import("@testing-library/react");
    const profile = { ...baseProfile, plan: "free" as const, stripeCustomerId: null };
    const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes("/api/templates")) {
        return Promise.resolve({ ok: true, json: async () => [] });
      }
      if (url.includes("/api/users/me")) {
        return Promise.resolve({ ok: true, json: async () => profile });
      }
      if (url.includes("/api/billing/checkout") && init?.method === "POST") {
        return Promise.resolve({
          ok: true,
          json: async () => ({ url: "https://checkout.stripe.com/test" }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<ProfilePage />);
    await vi.waitFor(() => {
      expect(screen.getByTestId("upgrade-button")).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId("upgrade-button"));

    await vi.waitFor(() => {
      const checkoutCalls = fetchMock.mock.calls.filter((c) =>
        String(c[0]).includes("/api/billing/checkout")
      );
      expect(checkoutCalls.length).toBeGreaterThanOrEqual(1);
    });
    await vi.waitFor(() => {
      expect(assignSpy).toHaveBeenCalledWith(
        "https://checkout.stripe.com/test"
      );
    });
  });

  it("clicking Manage billing calls /api/billing/portal and redirects", async () => {
    const { fireEvent } = await import("@testing-library/react");
    const profile = { ...baseProfile, plan: "pro" as const, stripeCustomerId: "cus_test_123" };
    const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes("/api/templates")) {
        return Promise.resolve({ ok: true, json: async () => [] });
      }
      if (url.includes("/api/users/me")) {
        return Promise.resolve({ ok: true, json: async () => profile });
      }
      if (url.includes("/api/billing/portal") && init?.method === "POST") {
        return Promise.resolve({
          ok: true,
          json: async () => ({ url: "https://billing.stripe.com/test" }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<ProfilePage />);
    await vi.waitFor(() => {
      expect(screen.getByTestId("manage-billing-button")).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId("manage-billing-button"));

    await vi.waitFor(() => {
      const portalCalls = fetchMock.mock.calls.filter((c) =>
        String(c[0]).includes("/api/billing/portal")
      );
      expect(portalCalls.length).toBeGreaterThanOrEqual(1);
    });
    await vi.waitFor(() => {
      expect(assignSpy).toHaveBeenCalledWith(
        "https://billing.stripe.com/test"
      );
    });
  });
});
