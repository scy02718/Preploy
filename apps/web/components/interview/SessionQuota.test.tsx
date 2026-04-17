import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { SessionQuota } from "./SessionQuota";

describe("SessionQuota", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    vi.clearAllMocks();
  });

  // 110-2: renders monthly text, never daily
  it("renders monthly usage text — not daily language", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ plan: "free", used: 1, limit: 3 }), {
        status: 200,
      })
    );

    await act(async () => {
      render(<SessionQuota />);
    });

    // Should speak in monthly terms
    const el = screen.getByText(/sessions used this month/i);
    expect(el).toBeInTheDocument();

    // Must NOT use daily language
    expect(screen.queryByText(/today/i)).toBeNull();
    expect(screen.queryByText(/per day/i)).toBeNull();
    expect(screen.queryByText(/try again tomorrow/i)).toBeNull();
  });

  // 110-2: at-limit shows monthly message
  it("shows monthly limit-reached message when at limit", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ plan: "free", used: 3, limit: 3 }), {
        status: 200,
      })
    );

    await act(async () => {
      render(<SessionQuota />);
    });

    expect(screen.getByText(/monthly limit reached/i)).toBeInTheDocument();
    // Must NOT say "try again tomorrow"
    expect(screen.queryByText(/tomorrow/i)).toBeNull();
  });

  // Renders nothing when fetch fails
  it("renders nothing when API call fails", async () => {
    fetchSpy.mockRejectedValue(new Error("Network error"));

    const { container } = await act(async () => render(<SessionQuota />));
    // After failed fetch, component returns null
    expect(container.firstChild).toBeNull();
  });

  // Renders loading skeleton initially
  it("renders a loading skeleton before data arrives", () => {
    // Fetch that never resolves during this test
    fetchSpy.mockImplementation(() => new Promise(() => {}));

    render(<SessionQuota />);
    // The loading skeleton div should be present
    const skeleton = document.querySelector(".animate-pulse");
    expect(skeleton).toBeInTheDocument();
  });

  // Unlimited plan
  it("renders unlimited message when limit is null", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ plan: "unlimited", used: 0, limit: null }), {
        status: 200,
      })
    );

    await act(async () => {
      render(<SessionQuota />);
    });

    expect(screen.getByText(/unlimited sessions this month/i)).toBeInTheDocument();
  });
});
