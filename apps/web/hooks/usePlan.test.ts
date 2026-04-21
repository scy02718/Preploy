import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";

// NOTE: We do NOT wrap with <StrictMode> here. In StrictMode, React double-
// invokes effects in development, but usePlan guards against double-fetch via
// the `cancelled` flag and the `if (plan !== undefined) return` early exit
// from the cached sessionStorage value on the second invocation.

// Mock next-auth/react so signOut and useSession are controllable
const mockSignOut = vi.fn();
const mockUseSession = vi.fn();
vi.mock("next-auth/react", () => ({
  signOut: (...args: Parameters<typeof mockSignOut>) => mockSignOut(...args),
  useSession: () => mockUseSession(),
}));

// Import after mocks are registered
import { usePlan, clearPlanCache, signOutAndClearPlan } from "./usePlan";

const PLAN_CACHE_KEY = "preploy:plan";

// Default: authenticated session for tests that don't override it
function setAuthenticatedSession() {
  mockUseSession.mockReturnValue({
    status: "authenticated",
    data: { user: { id: "test" } },
  });
}

describe("usePlan", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
    // Most tests run with an authenticated session; individual tests may override
    setAuthenticatedSession();
  });

  it("first call with empty sessionStorage fires exactly one fetch to /api/users/me and exposes plan", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ plan: "pro" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => usePlan());

    // Initially undefined while loading
    expect(result.current.plan).toBeUndefined();

    await waitFor(() => {
      expect(result.current.plan).toBe("pro");
    });

    // Exactly one fetch, to the correct endpoint
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/users/me");

    vi.unstubAllGlobals();
  });

  it("second render with cached value fires no additional fetch", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ plan: "free" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    // First render — populates the cache
    const { result: first } = renderHook(() => usePlan());
    await waitFor(() => {
      expect(first.current.plan).toBe("free");
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Second render — reads from sessionStorage, no additional fetch
    fetchMock.mockClear();
    const { result: second } = renderHook(() => usePlan());

    // Should resolve synchronously from cache
    expect(second.current.plan).toBe("free");
    // No additional fetch should have been fired
    expect(fetchMock).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it("normalizes legacy \"max\" to \"pro\"", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ plan: "max" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => usePlan());

    await waitFor(() => {
      expect(result.current.plan).toBe("pro");
    });

    // Also verify it was cached as "pro", not "max"
    expect(sessionStorage.getItem(PLAN_CACHE_KEY)).toBe("pro");

    vi.unstubAllGlobals();
  });

  it("clearPlanCache removes the sessionStorage entry so next render re-fetches", async () => {
    // Seed the cache directly
    sessionStorage.setItem(PLAN_CACHE_KEY, "pro");

    // First render reads from cache
    const { result: first } = renderHook(() => usePlan());
    expect(first.current.plan).toBe("pro");

    // Clear the cache
    clearPlanCache();
    expect(sessionStorage.getItem(PLAN_CACHE_KEY)).toBeNull();

    // Next render should start undefined (would fetch, but we don't need to wait)
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ plan: "free" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result: second } = renderHook(() => usePlan());

    // Starts undefined — fetch was triggered
    expect(second.current.plan).toBeUndefined();
    await waitFor(() => {
      expect(second.current.plan).toBe("free");
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    vi.unstubAllGlobals();
  });

  it("signOutAndClearPlan clears cache before invoking next-auth signOut", () => {
    // Seed the cache
    sessionStorage.setItem(PLAN_CACHE_KEY, "pro");

    let cacheValueAtSignOutTime: string | null = "not-captured";
    mockSignOut.mockImplementation(() => {
      // Capture what sessionStorage looks like at the moment signOut is called
      cacheValueAtSignOutTime = sessionStorage.getItem(PLAN_CACHE_KEY);
      return Promise.resolve(undefined);
    });

    signOutAndClearPlan({ callbackUrl: "/" });

    // Cache must have been cleared BEFORE signOut was called
    expect(cacheValueAtSignOutTime).toBeNull();
    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(mockSignOut).toHaveBeenCalledWith({ callbackUrl: "/" });
  });

  it("does not cache or set plan when fetch returns a non-2xx response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({}),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => usePlan());

    // Give the effect time to settle
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(result.current.plan).toBeUndefined();
    expect(sessionStorage.getItem(PLAN_CACHE_KEY)).toBeNull();

    vi.unstubAllGlobals();
  });

  it("does not cache or set plan when fetch rejects with a network error", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network down"));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => usePlan());

    // Give the effect time to settle
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(result.current.plan).toBeUndefined();
    expect(sessionStorage.getItem(PLAN_CACHE_KEY)).toBeNull();

    vi.unstubAllGlobals();
  });

  it("does not fetch when useSession returns status: \"unauthenticated\"", async () => {
    mockUseSession.mockReturnValue({ status: "unauthenticated", data: null });

    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => usePlan());

    // Give effects time to settle
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(fetchMock).toHaveBeenCalledTimes(0);
    expect(result.current.plan).toBeUndefined();

    vi.unstubAllGlobals();
  });

  it("clears stale cached value when status transitions to \"unauthenticated\"", async () => {
    // Seed a stale pro cache (simulating a prior authenticated session)
    sessionStorage.setItem(PLAN_CACHE_KEY, "pro");

    // Start as unauthenticated
    mockUseSession.mockReturnValue({ status: "unauthenticated", data: null });

    const { result } = renderHook(() => usePlan());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    // Stale cached value must be cleared
    expect(result.current.plan).toBeUndefined();
    expect(sessionStorage.getItem(PLAN_CACHE_KEY)).toBeNull();
  });
});
