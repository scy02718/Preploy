import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";

const { useSessionMock } = vi.hoisted(() => ({
  useSessionMock: vi.fn(() => ({
    status: "authenticated" as const,
    data: { user: { id: "u1" } },
  })),
}));

vi.mock("next-auth/react", () => ({
  useSession: useSessionMock,
}));

import { useReportTimezone } from "./useReportTimezone";

const TZ_CACHE_KEY = "preploy:tz";

beforeEach(() => {
  window.sessionStorage.clear();
  useSessionMock.mockReturnValue({
    status: "authenticated",
    data: { user: { id: "u1" } },
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useReportTimezone", () => {
  it("PATCHes /api/users/me with the detected timezone when cache is empty", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    // Force a deterministic timezone in the test environment.
    vi.spyOn(
      Intl.DateTimeFormat.prototype,
      "resolvedOptions"
    ).mockReturnValue({
      timeZone: "Pacific/Auckland",
    } as unknown as ReturnType<Intl.DateTimeFormat["resolvedOptions"]>);

    renderHook(() => useReportTimezone());

    // Wait a microtask for the effect to fire
    await Promise.resolve();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/users/me");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body)).toEqual({ timezone: "Pacific/Auckland" });
  });

  it("skips the PATCH when sessionStorage already matches the detected timezone", async () => {
    window.sessionStorage.setItem(TZ_CACHE_KEY, "America/New_York");

    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    vi.spyOn(
      Intl.DateTimeFormat.prototype,
      "resolvedOptions"
    ).mockReturnValue({
      timeZone: "America/New_York",
    } as unknown as ReturnType<Intl.DateTimeFormat["resolvedOptions"]>);

    renderHook(() => useReportTimezone());
    await Promise.resolve();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not PATCH when unauthenticated", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useSessionMock.mockReturnValue({ status: "unauthenticated" as any, data: null as any });

    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    renderHook(() => useReportTimezone());
    await Promise.resolve();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not PATCH while session status is 'loading'", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useSessionMock.mockReturnValue({ status: "loading" as any, data: null as any });

    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    renderHook(() => useReportTimezone());
    await Promise.resolve();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("stores the timezone in sessionStorage only after a successful PATCH", async () => {
    // Fetch returns 500 — the hook must not cache on failure so a retry
    // happens on the next mount.
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);

    vi.spyOn(
      Intl.DateTimeFormat.prototype,
      "resolvedOptions"
    ).mockReturnValue({
      timeZone: "Europe/London",
    } as unknown as ReturnType<Intl.DateTimeFormat["resolvedOptions"]>);

    renderHook(() => useReportTimezone());
    // Two microtasks: one for fetch resolution, one for .then chain.
    await Promise.resolve();
    await Promise.resolve();

    expect(window.sessionStorage.getItem(TZ_CACHE_KEY)).toBeNull();
  });
});
