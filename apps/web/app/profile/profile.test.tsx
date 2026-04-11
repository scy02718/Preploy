import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const mockProfile = {
  id: "user-1",
  email: "test@example.com",
  name: "Test User",
  image: null,
  plan: "free",
  disabledAt: null,
  createdAt: "2026-01-01T00:00:00Z",
};

import ProfilePage from "./page";

describe("ProfilePage", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockProfile,
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
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
});
