import { describe, it, expect } from "vitest";
import { currentFreePeriodStart, hashEmailMonth, currentMonth } from "./usage";

describe("currentFreePeriodStart", () => {
  it("returns the first day of the current UTC month at midnight", () => {
    const now = new Date(Date.UTC(2026, 4, 17, 13, 42, 19, 999)); // 2026-05-17T13:42:19Z
    const period = currentFreePeriodStart(now);
    expect(period.toISOString()).toBe("2026-05-01T00:00:00.000Z");
  });

  it("uses UTC, not local time, so a Sydney user at midnight local does not get a new period", () => {
    // 2026-05-31 14:30 UTC is 2026-06-01 00:30 in Sydney, but UTC says May.
    const now = new Date(Date.UTC(2026, 4, 31, 14, 30, 0));
    const period = currentFreePeriodStart(now);
    expect(period.toISOString()).toBe("2026-05-01T00:00:00.000Z");
  });

  it("rolls over on UTC month boundary", () => {
    const before = new Date(Date.UTC(2026, 4, 31, 23, 59, 59, 999));
    const after = new Date(Date.UTC(2026, 5, 1, 0, 0, 0, 0));
    expect(currentFreePeriodStart(before).toISOString()).toBe(
      "2026-05-01T00:00:00.000Z"
    );
    expect(currentFreePeriodStart(after).toISOString()).toBe(
      "2026-06-01T00:00:00.000Z"
    );
  });

  it("handles January correctly (month index 0)", () => {
    const now = new Date(Date.UTC(2026, 0, 15, 12, 0, 0));
    expect(currentFreePeriodStart(now).toISOString()).toBe(
      "2026-01-01T00:00:00.000Z"
    );
  });

  it("handles December correctly (month index 11)", () => {
    const now = new Date(Date.UTC(2026, 11, 31, 23, 59, 59));
    expect(currentFreePeriodStart(now).toISOString()).toBe(
      "2026-12-01T00:00:00.000Z"
    );
  });

  it("returns a Date object, not a string", () => {
    expect(currentFreePeriodStart()).toBeInstanceOf(Date);
  });
});

describe("hashEmailMonth", () => {
  it("produces consistent output for the same email+month (S1)", () => {
    const a = hashEmailMonth("user@example.com", "2026-04");
    const b = hashEmailMonth("user@example.com", "2026-04");
    expect(a).toBe(b);
  });

  it("produces different hashes for different months", () => {
    const apr = hashEmailMonth("user@example.com", "2026-04");
    const may = hashEmailMonth("user@example.com", "2026-05");
    expect(apr).not.toBe(may);
  });

  it("produces different hashes for different emails", () => {
    const a = hashEmailMonth("alice@example.com", "2026-04");
    const b = hashEmailMonth("bob@example.com", "2026-04");
    expect(a).not.toBe(b);
  });

  it("normalizes email to lowercase (S5 — no raw PII)", () => {
    const upper = hashEmailMonth("User@Example.COM", "2026-04");
    const lower = hashEmailMonth("user@example.com", "2026-04");
    expect(upper).toBe(lower);
  });

  it("returns a 64-char hex string (SHA-256)", () => {
    const hash = hashEmailMonth("test@test.com", "2026-01");
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("does not contain the original email (S5 — no PII)", () => {
    const hash = hashEmailMonth("user@example.com", "2026-04");
    expect(hash).not.toContain("user");
    expect(hash).not.toContain("example");
  });
});

describe("currentMonth", () => {
  it("returns YYYY-MM format", () => {
    const m = currentMonth(new Date(Date.UTC(2026, 3, 16)));
    expect(m).toBe("2026-04");
  });

  it("zero-pads single-digit months", () => {
    const m = currentMonth(new Date(Date.UTC(2026, 0, 1)));
    expect(m).toBe("2026-01");
  });
});
