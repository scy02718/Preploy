import { describe, it, expect } from "vitest";
import {
  getHourInTimezone,
  getDateStringInTimezone,
} from "./timezone";

// 2026-04-21 02:00:00 UTC — mid-morning in Europe, mid-afternoon in
// Pacific/Auckland (UTC+12 in NZST), evening-prior in US West.
const UTC_MOMENT = new Date("2026-04-21T02:00:00Z");

describe("getHourInTimezone", () => {
  it("returns UTC hours when timezone is null", () => {
    expect(getHourInTimezone(UTC_MOMENT, null)).toBe(2);
  });

  it("returns UTC hours when timezone is undefined", () => {
    expect(getHourInTimezone(UTC_MOMENT, undefined)).toBe(2);
  });

  it("returns UTC hours when timezone is an empty string", () => {
    expect(getHourInTimezone(UTC_MOMENT, "")).toBe(2);
  });

  it("returns local hour in Pacific/Auckland (UTC+12 standard)", () => {
    // April is outside NZ daylight-saving; UTC+12. 02:00Z → 14:00 local.
    expect(getHourInTimezone(UTC_MOMENT, "Pacific/Auckland")).toBe(14);
  });

  it("returns local hour in America/New_York (UTC-4 daylight)", () => {
    // Late April is EDT (UTC-4). 02:00Z → 22:00 of the previous day local.
    expect(getHourInTimezone(UTC_MOMENT, "America/New_York")).toBe(22);
  });

  it("returns local hour in Europe/London (UTC+1 daylight)", () => {
    // Late April is BST (UTC+1). 02:00Z → 03:00 local.
    expect(getHourInTimezone(UTC_MOMENT, "Europe/London")).toBe(3);
  });

  it("falls back to UTC hours when the timezone string is invalid", () => {
    expect(getHourInTimezone(UTC_MOMENT, "Not/A_Real_Zone")).toBe(2);
  });

  it("normalizes a '24' hour reading to 0", () => {
    // Midnight UTC → midnight local in UTC-0 zones. Some runtimes return
    // "24" instead of "00" for the hour in `2-digit` mode; the helper must
    // normalize to 0.
    const midnight = new Date("2026-04-21T00:00:00Z");
    expect(getHourInTimezone(midnight, "UTC")).toBe(0);
  });
});

describe("getDateStringInTimezone", () => {
  it("returns UTC date when timezone is null", () => {
    expect(getDateStringInTimezone(UTC_MOMENT, null)).toBe("2026-04-21");
  });

  it("returns date for Pacific/Auckland (UTC+12 puts us later)", () => {
    // 02:00Z on April 21 → 14:00 April 21 local. Same day.
    expect(getDateStringInTimezone(UTC_MOMENT, "Pacific/Auckland")).toBe(
      "2026-04-21"
    );
  });

  it("returns previous-day date for America/Los_Angeles (UTC-7 puts us earlier)", () => {
    // 02:00Z April 21 → 19:00 April 20 local (PDT).
    expect(
      getDateStringInTimezone(UTC_MOMENT, "America/Los_Angeles")
    ).toBe("2026-04-20");
  });

  it("falls back to UTC date when the timezone string is invalid", () => {
    expect(getDateStringInTimezone(UTC_MOMENT, "Not/A_Real_Zone")).toBe(
      "2026-04-21"
    );
  });
});
