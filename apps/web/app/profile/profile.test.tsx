import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const baseProfile = {
  id: "user-1",
  email: "test@example.com",
  name: "Test User",
  image: null,
  plan: "free" as const,
  stripeCustomerId: null as string | null,
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

  it("renders plan options after loading", async () => {
    render(<ProfilePage />);
    await vi.waitFor(() => {
      expect(screen.getAllByText("Free").length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getAllByText("Pro").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Max").length).toBeGreaterThanOrEqual(1);
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

  it("shows Upgrade to Pro button for a user without a stripe customer", async () => {
    global.fetch = mockFetchWithProfile({ ...baseProfile, stripeCustomerId: null });
    render(<ProfilePage />);
    await vi.waitFor(() => {
      expect(screen.getByTestId("upgrade-button")).toBeTruthy();
    });
    expect(screen.getAllByText("Upgrade to Pro").length).toBeGreaterThanOrEqual(1);
  });

  it("shows Manage billing button for a user with a stripe customer", async () => {
    global.fetch = mockFetchWithProfile({
      ...baseProfile,
      stripeCustomerId: "cus_test_123",
    });
    render(<ProfilePage />);
    await vi.waitFor(() => {
      expect(screen.getByTestId("manage-billing-button")).toBeTruthy();
    });
    expect(screen.getAllByText("Manage billing").length).toBeGreaterThanOrEqual(1);
  });

  it("clicking Upgrade to Pro calls /api/billing/checkout and redirects", async () => {
    const { fireEvent } = await import("@testing-library/react");
    const profile = { ...baseProfile, stripeCustomerId: null };
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
    const profile = { ...baseProfile, stripeCustomerId: "cus_test_123" };
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
